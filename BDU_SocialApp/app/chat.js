import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, 
  TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, 
  StatusBar, Image, ActivityIndicator, Keyboard, Modal, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router'; 
import * as ImagePicker from 'expo-image-picker';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// FIREBASE
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../BDU_SocialApp/firebaseConfig'; 

// SAFE AREA (Import chuẩn xác 1 lần)
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const BDU_RED = '#C8102E';
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

const CHAT_THEMES = [
  { id: 'default', name: 'Mặc định', type: 'color', bg: '#F4F6F9', bubble: BDU_RED },
  { id: 'ocean', name: 'Đại dương', type: 'color', bg: '#E0F7FA', bubble: '#00A8CC' },
  { id: 'dark', name: 'Chế độ Tối', type: 'color', bg: '#1A1A1A', bubble: '#333333' },
];

const REACTION_LIST = ['❤️', '😆', '😮', '😢', '😡', '👍'];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { name, chatId } = useLocalSearchParams(); 
  
  const currentUserId = auth.currentUser?.uid || 'guest';
  const chatRoomId = chatId; 

  // STATE BÀN PHÍM
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // STATE UID ĐỐI TÁC (Dùng để track online realtime)
  const [partnerUid, setPartnerUid] = useState(null);

  // STATE PROFILE ĐỐI TÁC CHAT
  const [partnerName, setPartnerName] = useState(name || 'Người dùng BDU');
  const [partnerAvatar, setPartnerAvatar] = useState(DEFAULT_AVATAR);
  const [partnerStatus, setPartnerStatus] = useState('');

  // STATE CHÍNH
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // STATE NÂNG CAO
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null); 
  const [selectedMessage, setSelectedMessage] = useState(null); 
  const [modalVisible, setModalVisible] = useState(false); 
  const [viewingImage, setViewingImage] = useState(null); 
  
  // STATE CHỦ ĐỀ
  const [activeTheme, setActiveTheme] = useState(CHAT_THEMES[0]);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  // ==========================================
  // EFFECT: Lắng nghe sự kiện Bàn phím
  // ==========================================
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // ==========================================
  // EFFECT 1: Lấy UID của đối tác từ phòng chat
  // ==========================================
  useEffect(() => {
    if (!chatRoomId) {
       setIsLoading(false);
       return;
    }

    const chatDocRef = doc(db, "chats", chatRoomId);
    const unsubscribeChat = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const partnerInfo = data.usersInfo?.find(u => u.uid !== currentUserId);
        
        if (partnerInfo && partnerInfo.uid) {
          setPartnerUid(partnerInfo.uid); 
        }
      }
    });

    return () => unsubscribeChat();
  }, [chatRoomId, currentUserId]);

  // ==========================================
  // EFFECT 2: Lắng nghe trạng thái Online của đối tác
  // ==========================================
  useEffect(() => {
    if (!partnerUid) return;

    const partnerDocRef = doc(db, "users", partnerUid);
    const unsubscribePartner = onSnapshot(partnerDocRef, (userSnap) => {
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setPartnerName(userData.name || 'Người dùng BDU');
        setPartnerAvatar(userData.avatar || DEFAULT_AVATAR);
        
        // Nhảy số realtime
        setPartnerStatus(userData.isOnline ? 'Đang hoạt động' : '');
      }
    });

    return () => unsubscribePartner();
  }, [partnerUid]); 

  // ==========================================
  // EFFECT 3: Lắng nghe danh sách tin nhắn
  // ==========================================
  useEffect(() => {
    if (!chatRoomId) return;

    const q = query(
      collection(db, "chats", chatRoomId, "messages"), 
      orderBy("createdAt", "desc")
    );
    
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        let timeString = 'Vừa xong';
        if (data.createdAt) {
          const date = data.createdAt.toDate();
          timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
        return { id: doc.id, ...data, timeString };
      });
      setMessages(msgs);
      setIsLoading(false);
    });

    return () => unsubscribeMessages();
  }, [chatRoomId]);

  // 2. GỬI TIN NHẮN
  const sendMessage = async (text, imageBase64 = null) => {
    if (!text.trim() && !imageBase64) return;
    const msgToSend = text.trim();
    setMessage('');
    setIsSending(true);

    try {
      if (editingMsg) {
        await updateDoc(doc(db, "chats", chatRoomId, "messages", editingMsg.id), {
          text: msgToSend,
          isEdited: true
        });
        setEditingMsg(null);
      } else {
        await addDoc(collection(db, "chats", chatRoomId, "messages"), {
          text: msgToSend,
          image: imageBase64,
          senderId: currentUserId,
          createdAt: serverTimestamp(),
          replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text || 'Hình ảnh', sender: replyingTo.senderId === currentUserId ? 'Bạn' : partnerName } : null,
          reactions: null,
          isRecalled: false
        });
        setReplyingTo(null);
      }

      await updateDoc(doc(db, "chats", chatRoomId), {
        lastMessage: imageBase64 ? "Đã gửi một hình ảnh" : msgToSend,
        lastSenderId: currentUserId, 
        updatedAt: serverTimestamp()
      });

    } catch (error) {
      Alert.alert("Lỗi", "Không thể gửi tin nhắn.");
    } finally {
      setIsSending(false);
    }
  };

  // 3. CAMERA & ẢNH
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh!'); return; }
    let result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true });
    if (!result.canceled) await sendMessage('', `data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Lỗi', 'Cần quyền truy cập Camera!'); return; }
    let result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (!result.canceled) await sendMessage('', `data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  // 4. ACTION TIN NHẮN 
  const handleLongPress = (msg) => {
    if (msg.isRecalled) return; 
    setSelectedMessage(msg);
    setModalVisible(true);
    Keyboard.dismiss();
  };

  const handleReact = async (emoji) => {
    setModalVisible(false);
    if (!selectedMessage) return;
    try { 
      const reactionValue = emoji === '❌' ? null : emoji;
      await updateDoc(doc(db, "chats", chatRoomId, "messages", selectedMessage.id), { reactions: reactionValue }); 
    } catch (e) {}
  };

  const handleDelete = () => {
    Alert.alert("Thu hồi tin nhắn", "Tin nhắn này sẽ được thu hồi.", [
      { text: "Hủy", style: "cancel" },
      { text: "Thu hồi", style: "destructive", onPress: async () => {
          setModalVisible(false);
          await updateDoc(doc(db, "chats", chatRoomId, "messages", selectedMessage.id), {
            text: "", 
            image: null, 
            isRecalled: true, 
            reactions: null,
            replyTo: null
          });
          
          await updateDoc(doc(db, "chats", chatRoomId), {
            lastMessage: "", 
            lastSenderId: currentUserId,
            updatedAt: serverTimestamp()
          });
        }
      }
    ]);
  };

  const handleEdit = () => {
    setModalVisible(false);
    setEditingMsg(selectedMessage);
    setMessage(selectedMessage.text);
  };

  const handleReply = () => {
    setModalVisible(false);
    setReplyingTo(selectedMessage);
  };

  const handleGoBack = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/'); 
    }
  };

  // 5. RENDER BONG BÓNG CHAT
  const renderMessage = ({ item, index }) => {
    const isMe = item.senderId === currentUserId;
    const nextMessage = messages[index + 1];
    const isConsecutive = nextMessage && nextMessage.senderId === item.senderId;

    if (item.isRecalled) return null;

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem, isConsecutive && { marginBottom: 2 }]}>
        {!isMe && (
          <View style={styles.avatarSpace}>
            {!isConsecutive && <Image source={{ uri: partnerAvatar }} style={styles.chatAvatar} />}
          </View>
        )}

        <TouchableOpacity 
          activeOpacity={0.8} 
          onLongPress={() => handleLongPress(item)}
          style={[
            styles.messageBubble, 
            isMe ? { backgroundColor: activeTheme.bubble } : styles.messageThem, 
            isConsecutive && isMe && styles.consecutiveMe, 
            isConsecutive && !isMe && styles.consecutiveThem
          ]}
        >
          {item.replyTo && (
            <View style={[styles.replyQuote, isMe ? styles.replyQuoteMe : styles.replyQuoteThem]}>
              <Text style={styles.replyQuoteSender}>Trả lời {item.replyTo.sender}</Text>
              <Text style={styles.replyQuoteText} numberOfLines={1}>{item.replyTo.text}</Text>
            </View>
          )}

          {item.image && (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setViewingImage(item.image)}>
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </TouchableOpacity>
          )}
          
          {item.text ? <Text style={[styles.messageText, isMe ? styles.textMe : styles.textThem]}>{item.text}</Text> : null}
          
          <View style={styles.timeRow}>
            {item.isEdited && <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeThem, {marginRight: 5}]}>Đã sửa</Text>}
            <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeThem]}>{item.timeString}</Text>
          </View>

          {item.reactions && (
            <View style={[styles.reactionBadge, isMe ? styles.reactionBadgeMe : styles.reactionBadgeThem]}>
              <Text style={styles.reactionText}>{item.reactions}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
          </TouchableOpacity>
          <Image source={{ uri: partnerAvatar }} style={styles.headerAvatar} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {partnerName}
            </Text>
            {partnerStatus ? (
              <Text style={styles.headerStatus} numberOfLines={1}>
                {partnerStatus}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setThemeModalVisible(true)}>
            <Ionicons name="color-palette" size={24} color={activeTheme.bubble} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ĐÃ FIX: Điều chỉnh lại KeyboardAvoidingView behavior & Xóa offset gây lỗi */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      >
        <View style={{ flex: 1, backgroundColor: activeTheme.bg }}>
          {isLoading ? (
            <View style={styles.loadingContainer}><ActivityIndicator size="large" color={activeTheme.bubble} /></View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.chatContainer}
              showsVerticalScrollIndicator={false}
              inverted={true} 
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            />
          )}
        </View>

        {(replyingTo || editingMsg) && (
          <View style={styles.actionBanner}>
            <View>
              <Text style={[styles.actionBannerTitle, {color: activeTheme.bubble}]}>{editingMsg ? "Đang chỉnh sửa" : `Đang trả lời ${replyingTo.senderId === currentUserId ? 'chính mình' : partnerName}`}</Text>
              <Text style={styles.actionBannerDesc} numberOfLines={1}>{editingMsg ? editingMsg.text : (replyingTo.text || 'Hình ảnh')}</Text>
            </View>
            <TouchableOpacity onPress={() => { setReplyingTo(null); setEditingMsg(null); setMessage(''); }}>
              <Ionicons name="close-circle" size={24} color="#8A8D91" />
            </TouchableOpacity>
          </View>
        )}

        {/* ĐÃ FIX: Tự động trừ đi khoảng dư thừa (insets.bottom) ở dưới đáy khi mở bàn phím để UI khít rịt */}
        <View style={[styles.inputContainer, { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={pickImage}>
            <Ionicons name="image" size={24} color={activeTheme.bubble} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color={activeTheme.bubble} />
          </TouchableOpacity>

          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Nhắn tin..."
              placeholderTextColor="#8A8D91"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
            />
          </View>

          {message.trim() !== '' && (
            <TouchableOpacity style={[styles.sendBtn, {backgroundColor: activeTheme.bubble}]} onPress={() => sendMessage(message)} disabled={isSending}>
              <Ionicons name="send" size={18} color="#FFF" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* MODALS GIỮ NGUYÊN */}
      <Modal visible={themeModalVisible} transparent={true} animationType="slide" onRequestClose={() => setThemeModalVisible(false)}>
        <View style={styles.themeModalOverlay}>
          <View style={[styles.themeModalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.themeModalHeader}>
              <Text style={styles.themeModalTitle}>Tùy chỉnh màu sắc</Text>
              <Text onPress={() => setThemeModalVisible(false)}><Ionicons name="close-circle" size={28} color="#8A8D91" /></Text>
            </View>
            <View style={styles.themeGrid}>
              {CHAT_THEMES.map((theme) => (
                <TouchableOpacity 
                  key={theme.id} 
                  style={[styles.themeOption, activeTheme.id === theme.id && styles.themeOptionActive]}
                  onPress={() => { setActiveTheme(theme); setThemeModalVisible(false); }}
                >
                  <View style={[styles.themePreviewCircle, { backgroundColor: theme.bubble }]} />
                  <Text style={styles.themeOptionName} numberOfLines={1}>{theme.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalMenu}>
            
            <View style={styles.reactionRow}>
              {REACTION_LIST.map((emoji, index) => (
                <TouchableOpacity key={index} onPress={() => handleReact(emoji)}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => handleReact('❌')} style={{justifyContent: 'center'}}>
                <Ionicons name="close-circle" size={30} color="#8A8D91" />
              </TouchableOpacity>
            </View>

            <View style={styles.menuOptions}>
              <TouchableOpacity style={styles.menuItem} onPress={handleReply}>
                <Ionicons name="arrow-undo" size={22} color="#1A1A1A" />
                <Text style={styles.menuText}>Trả lời</Text>
              </TouchableOpacity>
              {selectedMessage?.senderId === currentUserId && (
                <>
                  {selectedMessage?.text && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                      <Ionicons name="pencil" size={22} color="#1A1A1A" />
                      <Text style={styles.menuText}>Chỉnh sửa</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleDelete}>
                    <Ionicons name="trash" size={22} color="#FF4B4B" />
                    <Text style={[styles.menuText, { color: '#FF4B4B' }]}>Thu hồi tin nhắn</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!viewingImage} transparent={true} animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity style={[styles.fullScreenImageCloseBtn, { top: insets.top > 0 ? insets.top + 10 : 30 }]} onPress={() => setViewingImage(null)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          <Image source={{ uri: viewingImage }} style={styles.fullScreenImage} resizeMode="contain" />
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', paddingHorizontal: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  headerTextContainer: { flex: 1, justifyContent: 'center' },
  backBtn: { padding: 5, marginRight: 5 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  headerStatus: { fontSize: 12, color: '#31A24C', fontWeight: '500', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { padding: 8, marginLeft: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  chatContainer: { padding: 15, paddingBottom: 15 },
  messageWrapper: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperThem: { justifyContent: 'flex-start' },
  avatarSpace: { width: 35, marginRight: 8 },
  chatAvatar: { width: 30, height: 30, borderRadius: 15 },

  messageBubble: { maxWidth: '75%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, position: 'relative' },
  messageThem: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  consecutiveMe: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  consecutiveThem: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  
  messageText: { fontSize: 15, lineHeight: 22 },
  textMe: { color: '#FFF' },
  textThem: { color: '#1A1A1A' },
  messageImage: { width: 220, height: 300, borderRadius: 15, marginBottom: 5 },

  recalledBubble: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D3D3D3', paddingVertical: 8, paddingHorizontal: 14 },
  recalledText: { color: '#8A8D91', fontStyle: 'italic', fontSize: 14 },

  timeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, opacity: 0.8 },
  timeText: { fontSize: 10 },
  timeMe: { color: '#FFF' },
  timeThem: { color: '#8A8D91' },

  replyQuote: { paddingLeft: 10, borderLeftWidth: 3, marginBottom: 8, paddingVertical: 2 },
  replyQuoteMe: { borderLeftColor: '#FFF' },
  replyQuoteThem: { borderLeftColor: BDU_RED },
  replyQuoteSender: { fontSize: 12, fontWeight: 'bold', marginBottom: 2, color: '#FFF', opacity: 0.8 },
  replyQuoteText: { fontSize: 13, color: '#FFF', opacity: 0.9 },

  reactionBadge: { position: 'absolute', bottom: -12, backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: '#F0F2F5', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  reactionBadgeMe: { right: 10 },
  reactionBadgeThem: { left: 10 },
  reactionText: { fontSize: 12 },

  actionBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E4E6EB' },
  actionBannerTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  actionBannerDesc: { fontSize: 13, color: '#65676B', maxWidth: 250 },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F2F5' },
  actionBtn: { padding: 8, marginBottom: 3 },
  textInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F9', borderRadius: 24, marginHorizontal: 5, minHeight: 40, maxHeight: 120 },
  input: { flex: 1, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: '#1A1A1A' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 5, marginLeft: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalMenu: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 15, elevation: 10 },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#F4F6F9', padding: 10, borderRadius: 30 },
  reactionEmoji: { fontSize: 26 },
  menuOptions: { backgroundColor: '#F4F6F9', borderRadius: 15, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#E4E6EB' },
  menuText: { fontSize: 16, fontWeight: '600', marginLeft: 15, color: '#1A1A1A' },

  themeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  themeModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20 },
  themeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  themeModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 25 },
  themeOption: { alignItems: 'center', width: '25%', marginBottom: 15 },
  themeOptionActive: { transform: [{ scale: 1.15 }] },
  themePreviewCircle: { width: 55, height: 55, borderRadius: 27.5, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  themeOptionName: { fontSize: 13, color: '#333', textAlign: 'center', fontWeight: '500' },

  fullScreenImageContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullScreenImageCloseBtn: { position: 'absolute', right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 25 },
  fullScreenImage: { width: '100%', height: '100%' }
});