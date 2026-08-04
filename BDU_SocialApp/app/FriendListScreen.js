import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import { db } from '../../BDU_SocialApp/firebaseConfig'; 
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Đã thêm auth listener
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons'; // Thêm Ionicons cho nút Back

const BDU_RED = '#FF3B30';
const BDU_BG = '#F0F2F5'; // Đồng bộ màu nền mạng xã hội
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

export default function FriendListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    // Dùng onAuthStateChanged để fix triệt để lỗi không lấy được uid khi mới load app
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        setFriends([]);
        return;
      }

      const friendsRef = collection(db, "users", user.uid, "friends");
      const unsubscribeSnapshot = onSnapshot(friendsRef, async (snapshot) => {
        try {
          const fetchPromises = snapshot.docs.map(async (friendDoc) => {
            const friendId = friendDoc.id;
            const userRef = doc(db, "users", friendId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              return {
                id: friendId,
                fullName: userData.fullName || userData.name || "Người dùng BDU",
                avatar: userData.avatar?.trim() ? userData.avatar : DEFAULT_AVATAR
              };
            }
            return null;
          });
          
          const friendsData = (await Promise.all(fetchPromises)).filter(Boolean);
          setFriends(friendsData);
        } catch (error) {
          console.log("Lỗi lấy danh sách bạn bè:", error);
        } finally {
          setLoading(false);
        }
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

  const handleSendMessage = (friend) => {
    router.push({
      pathname: '/messages', 
      params: { userId: friend.id, userName: friend.fullName }
    });
  };

  const filteredFriends = friends.filter(friend => 
    friend.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }) => (
    <View style={styles.friendCard}>
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.fullName}</Text>
        <View style={styles.statusRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.subText} numberOfLines={1}>Đang hoạt động</Text>
        </View>
      </View>
      
      {/* NÚT BACK CHUẨN FORM MATCH / MESSAGES */}
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => router.back()} 
            style={styles.backBtn}
          >
            {/* Đổi từ arrow-back sang chevron-back và tăng size lên 28 */}
            <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
          </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* =======================================================
          HEADER PHẲNG ĐỒNG BỘ CÓ NÚT BACK (Giống Lời mời kết bạn)
          ======================================================= */}
      <View style={styles.appHeaderFlat}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => router.back()} 
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Bạn bè ({friends.length})</Text>
        </View>
      </View>
      
      {/* THANH TÌM KIẾM */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color="#8A8D91" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Tìm kiếm bạn bè..."
            placeholderTextColor="#8A8D91"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={18} color="#CCD0D5" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* DANH SÁCH BẠN BÈ */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={BDU_RED} />
            <Text style={{ marginTop: 12, color: '#65676B' }}>Đang tải danh sách...</Text>
        </View>
      ) : filteredFriends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Feather name="users" size={36} color="#8A8D91" />
          </View>
          <Text style={styles.emptyText}>
            {searchQuery ? "Không tìm thấy kết quả" : "Chưa có bạn bè"}
          </Text>
          <Text style={styles.emptySubText}>
            {searchQuery ? "Hãy thử tìm kiếm với một cái tên khác." : "Hãy kết nối thêm nhiều bạn bè xung quanh nhé!"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' }, // Danh sách thì để nền trắng nhìn sẽ liền mạch hơn với thanh tìm kiếm
  
  // Header Style Đồng bộ
  appHeaderFlat: { 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    paddingHorizontal: 12,
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
    borderRadius: 20,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1A1A1A', 
    letterSpacing: -0.3 
  },
  
  // Thanh Tìm kiếm (Cách tân mượt mà hơn)
  searchWrapper: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: BDU_BG, borderRadius: 20, paddingHorizontal: 15, height: 40 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A1A' },

  // Giao diện list danh sách 
  friendCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14, backgroundColor: '#E4E6EB' },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#31A24C', marginRight: 6 },
  subText: { fontSize: 13, color: '#8A8D91' },
  
  // Nút nhắn tin nhanh
  messageBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0F1', alignItems: 'center', justifyContent: 'center' },

  // Empty State 
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 100 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: BDU_BG, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  emptySubText: { fontSize: 14, color: '#8A8D91', marginTop: 6, textAlign: 'center', lineHeight: 20 },
});