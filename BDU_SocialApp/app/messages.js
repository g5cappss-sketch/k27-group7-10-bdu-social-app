import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, Text, View, FlatList, 
  TouchableOpacity, Image, StatusBar, Platform, TextInput, Modal, Alert 
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

// FIREBASE IMPORTS
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../BDU_SocialApp/firebaseConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BDU_RED = '#C8102E';
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

// HÀM CHUYỂN ĐỔI THỜI GIAN
const formatTime = (timestamp) => {
  if (!timestamp) return 'Vừa xong';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Vừa xong';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} ngày`;
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const currentUserId = auth.currentUser?.uid || 'guest';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  
  const [realChats, setRealChats] = useState([]);
  const [userProfiles, setUserProfiles] = useState({}); 

  // 1. LẮNG NGHE DANH SÁCH TIN NHẮN REAL-TIME
  useEffect(() => {
    if (currentUserId === 'guest') return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUserId),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => {
        const data = doc.data();
        const partnerInfo = data.usersInfo?.find(u => u.uid !== currentUserId) || {};
        
        return { 
          id: doc.id, 
          partnerUid: partnerInfo.uid,
          originalPartnerName: partnerInfo.name || 'Người dùng BDU',
          originalPartnerAvatar: partnerInfo.avatar || DEFAULT_AVATAR,
          originalIsOnline: partnerInfo.isOnline || false,
          ...data 
        };
      });

      setRealChats(fetchedChats);
    }, (error) => {
      console.log("Lỗi lấy danh sách chat:", error);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  // 2. ĐỒNG BỘ PROFILE ĐỐI TÁC
  const partnerUidsString = [...new Set(realChats.map(c => c.partnerUid).filter(Boolean))].sort().join(',');

  useEffect(() => {
    if (!partnerUidsString) return;
    
    const uids = partnerUidsString.split(',');
    const unsubscribes = uids.map(uid => {
      return onSnapshot(doc(db, "users", uid), (snap) => {
        if (snap.exists()) {
          setUserProfiles(prev => ({ ...prev, [uid]: snap.data() }));
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [partnerUidsString]);

  // 3. KẾT HỢP DỮ LIỆU CHAT + PROFILE USER
  const enrichedChats = useMemo(() => {
    return realChats.map(chat => {
      const profile = userProfiles[chat.partnerUid] || {};
      const isMyLastMessage = chat.lastSenderId === currentUserId;
      const prefixStr = isMyLastMessage ? "Bạn: " : "";
      const rawLastMessage = chat.lastMessage || 'Đã gửi một tin nhắn';

      return {
        ...chat,
        user: profile.name || chat.originalPartnerName,
        avatar: profile.avatar || chat.originalPartnerAvatar,
        isOnline: profile.isOnline ?? chat.originalIsOnline,
        lastMessage: `${prefixStr}${rawLastMessage}`,
        time: formatTime(chat.updatedAt), 
        unread: chat.unreadCount?.[currentUserId] || 0
      };
    }).sort((a, b) => (b.isPinned === a.isPinned ? 0 : a.isPinned ? -1 : 1));
  }, [realChats, userProfiles, currentUserId]);

  // 4. LỌC TÌM KIẾM
  const filteredChats = useMemo(() => {
    if (!searchQuery) return enrichedChats;
    return enrichedChats.filter(chat => chat.user.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, enrichedChats]);

  // 5. DANH SÁCH BẠN BÈ ĐANG HOẠT ĐỘNG
  const activeFriends = useMemo(() => {
    return enrichedChats
      .filter(chat => chat.isOnline)
      .map(chat => ({
        id: chat.id,
        name: chat.user.split(' ')[0], 
        avatar: chat.avatar,
      }));
  }, [enrichedChats]);

  const openChatRoom = (userName, roomId) => {
    router.push({ pathname: '/chat', params: { name: userName, chatId: roomId } });
  };

  const handleLongPress = (chat) => {
    setSelectedChat(chat);
    setModalVisible(true);
  };

  const handlePinChat = async () => {
    setModalVisible(false);
    if (!selectedChat) return;
    try {
      await updateDoc(doc(db, "chats", selectedChat.id), {
        isPinned: !selectedChat.isPinned
      });
    } catch (error) {
      Alert.alert("Lỗi", "Không thể ghim đoạn chat này.");
    }
  };

  const handleCreateGroup = () => {
    setModalVisible(false);
    Alert.alert("Tạo nhóm", `Tính năng tạo nhóm với ${selectedChat?.user.split(' ')[0]} đang được phát triển!`);
  };

  const handleDeleteChat = () => {
    Alert.alert(
      "Xóa cuộc trò chuyện", 
      "Bạn có chắc chắn muốn xóa toàn bộ cuộc trò chuyện này không? Hành động này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          style: "destructive", 
          onPress: async () => {
            setModalVisible(false);
            if (!selectedChat) return;
            try {
              await deleteDoc(doc(db, "chats", selectedChat.id));
            } catch (error) {
              Alert.alert("Lỗi", "Không thể xóa cuộc trò chuyện.");
            }
          } 
        }
      ]
    );
  };

  // RENDER: Bạn bè hoạt động
  const renderActiveFriendItem = ({ item }) => (
    <TouchableOpacity style={styles.storyContainer} activeOpacity={0.8} onPress={() => openChatRoom(item.name, item.id)}>
      <View style={styles.storyAvatarRing}>
        <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
        <View style={styles.onlineIndicator} />
      </View>
      <Text style={styles.storyName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  // RENDER: Dòng tin nhắn (THẺ RÕ RÀNG HƠN)
  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.chatCard, item.isPinned && styles.pinnedChatCard]} 
      activeOpacity={0.8} 
      onPress={() => openChatRoom(item.user, item.id)}
      onLongPress={() => handleLongPress(item)}
    >
      {item.isPinned && <View style={styles.pinnedLeftIndicator} />}

      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
        {item.isOnline && <View style={styles.chatOnlineIndicator} />}
      </View>
      
      <View style={styles.chatContentContainer}>
        <View style={styles.chatMainInfo}>
          <Text style={[styles.chatName, item.unread > 0 && styles.textBold]} numberOfLines={1}>
            {item.user}
          </Text>
          <Text style={[styles.chatLastMessage, item.unread > 0 && styles.textBoldMessage]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        </View>

        <View style={styles.chatMetaRight}>
          <Text style={[styles.chatTime, item.unread > 0 && styles.textRedTime]}>{item.time}</Text>
          <View style={styles.metaIconsRow}>
            {item.isPinned && <Feather name="pin" size={14} color={BDU_RED} style={{ marginRight: 6 }} />}
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread > 9 ? '9+' : item.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent />

      {/* HEADER CĂN GIỮA TUYỆT ĐỐI */}
      <View style={styles.appHeaderFlat}>
        {/* Nút Back nằm sát trái */}
        <TouchableOpacity 
          style={styles.backBtn} 
          activeOpacity={0.7} 
          onPress={() => router.replace('/feed')}
        >
          <Feather name="chevron-left" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Tiêu đề nằm giữa */}
        <View style={styles.headerTitleContainer}>
          <Text style={styles.logoFlat}>Trò chuyện</Text>
          <Text style={styles.headerSubFlat}>Tin nhắn & Kết nối BDU</Text>
        </View>

        {/* Nút Edit nằm sát phải */}
        <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
          <Feather name="edit-3" size={18} color={BDU_RED} />
        </TouchableOpacity>
      </View>

      {/* THANH TÌM KIẾM */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#8A8D91" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Tìm kiếm người dùng..."
            placeholderTextColor="#8A8D91"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#8A8D91" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* DANH SÁCH CHAT REAL-TIME */}
      <FlatList
        data={filteredChats}
        keyExtractor={item => item.id}
        renderItem={renderChatItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 30 }}
        ListHeaderComponent={
          (!searchQuery && activeFriends.length > 0) ? (
            <View style={styles.storiesSection}>
              <Text style={styles.sectionTitle}>Đang hoạt động</Text>
              <FlatList
                data={activeFriends}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.id}
                renderItem={renderActiveFriendItem}
                contentContainerStyle={{ paddingHorizontal: 16 }}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptySearch}>
            <View style={styles.emptyIconContainer}>
              <Feather name="message-square" size={32} color={BDU_RED} />
            </View>
            <Text style={styles.emptySearchText}>
              {searchQuery ? "Không tìm thấy người dùng phù hợp" : "Bạn chưa có cuộc trò chuyện nào."}
            </Text>
          </View>
        }
      />

      {/* BOTTOM SHEET MODAL */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.dragHandle} />
            
            <TouchableOpacity style={styles.bottomSheetItem} onPress={handlePinChat}>
              <View style={styles.modalIconBg}>
                <Feather name="pin" size={18} color="#1A1A1A" />
              </View>
              <Text style={styles.sheetText}>{selectedChat?.isPinned ? "Bỏ ghim cuộc trò chuyện" : "Ghim lên đầu danh sách"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bottomSheetItem} onPress={handleCreateGroup}>
              <View style={styles.modalIconBg}>
                <Feather name="users" size={18} color="#1A1A1A" />
              </View>
              <Text style={styles.sheetText}>Tạo nhóm với {selectedChat?.user?.split(' ')[0]}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.bottomSheetItem, { borderBottomWidth: 0 }]} onPress={handleDeleteChat}>
              <View style={[styles.modalIconBg, { backgroundColor: '#FFEBEB' }]}>
                <Feather name="trash-2" size={18} color={BDU_RED} />
              </View>
              <Text style={[styles.sheetText, { color: BDU_RED, fontWeight: '600' }]}>Xóa cuộc trò chuyện</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ĐỔI NỀN TỐI HƠN ĐỂ THẺ TRẮNG NỔI BẬT LÊN
  container: { flex: 1, backgroundColor: '#E9ECEF' }, 
  
  // HEADER GẮN ĐỊNH VỊ (ABSOLUTE) ĐỂ CĂN GIỮA CHUẨN 100%
  appHeaderFlat: { 
    height: 60, 
    flexDirection: 'row', 
    justifyContent: 'center', // Ép chữ vào giữa
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#EAEAEA',
    position: 'relative'
  },
  backBtn: { 
    position: 'absolute',
    left: 12,
    padding: 8, // Tạo vùng bấm rộng rãi, không cần background hay border
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 10
  },
  
  headerTitleContainer: { 
    alignItems: 'center', 
  },
  logoFlat: { fontSize: 18, fontWeight: '800', color: BDU_RED, letterSpacing: -0.5 },
  headerSubFlat: { fontSize: 12, color: '#65676B', marginTop: 2 },
  headerActionBtn: { 
    position: 'absolute',
    right: 16,
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#FFF5F5', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#FAD2D2' 
  },

  // THANH TÌM KIẾM
  searchWrapper: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: '#FFF' },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F4F6F8', 
    borderRadius: 14, 
    paddingHorizontal: 14, 
    height: 46 
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A1A', fontWeight: '500' },

  // STORIES / ACTIVE FRIENDS
  storiesSection: { paddingBottom: 16, paddingTop: 12, backgroundColor: '#FFF', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#8A8D91', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, marginBottom: 12 },
  storyContainer: { alignItems: 'center', marginRight: 16, width: 62 },
  storyAvatarRing: { padding: 2, borderRadius: 32, borderWidth: 2, borderColor: '#E5E7EB', position: 'relative', marginBottom: 4 },
  storyAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#E4E6EB' },
  onlineIndicator: { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#31A24C', borderWidth: 2, borderColor: '#FFF' },
  storyName: { fontSize: 12, color: '#4E5D78', fontWeight: '600', textAlign: 'center' },

  // CARD - ĐÃ TĂNG KHOẢNG CÁCH VÀ ĐỔ BÓNG RÕ RÀNG
  chatCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    marginHorizontal: 16, 
    marginBottom: 16, // KHOẢNG CÁCH PHÂN CHIA TỪNG NGƯỜI LỚN HƠN
    backgroundColor: '#FFF', 
    borderRadius: 20, // Bo góc to hơn
    borderWidth: 1, 
    borderColor: '#EFEFEF',
    overflow: 'hidden',
    // Hiệu ứng nổi bọt (bóng đổ)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  pinnedChatCard: { backgroundColor: '#FFFDFD', borderColor: '#FCDDEC' },
  pinnedLeftIndicator: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: BDU_RED },
  avatarContainer: { position: 'relative', marginRight: 16 },
  chatAvatar: { width: 56, height: 56, borderRadius: 28 },
  chatOnlineIndicator: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#31A24C', borderWidth: 2.5, borderColor: '#FFF' },
  chatContentContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatMainInfo: { flex: 1, paddingRight: 10 },
  chatName: { fontSize: 16, color: '#111827', fontWeight: '600', marginBottom: 4 },
  chatLastMessage: { fontSize: 14, color: '#6B7280', fontWeight: '400' },
  textBold: { fontWeight: '700', color: '#000' },
  textBoldMessage: { fontWeight: '600', color: '#111827' },
  chatMetaRight: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 55 },
  chatTime: { fontSize: 12, color: '#9CA3AF', fontWeight: '400', marginBottom: 6 },
  textRedTime: { color: BDU_RED, fontWeight: '700' },
  metaIconsRow: { flexDirection: 'row', alignItems: 'center', height: 22 },
  unreadBadge: { backgroundColor: BDU_RED, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  unreadText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // EMPTY STATE
  emptySearch: { padding: 40, alignItems: 'center', marginTop: 40 },
  emptyIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF0F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptySearchText: { color: '#8A8D91', fontSize: 13.5, fontWeight: '500', textAlign: 'center' },

  // BOTTOM SHEET MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 35 : 20, paddingHorizontal: 16 },
  dragHandle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 2.5, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  bottomSheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8F9FA' },
  modalIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  sheetText: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
});