import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { db } from '../../BDU_SocialApp/firebaseConfig'; 
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Đã thêm onAuthStateChanged
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BDU_RED = '#FF3B30'; 
const BDU_BG = '#F0F2F5';
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    // Dùng onAuthStateChanged để chắc chắn luôn lấy được User ID kể cả khi app vừa boot
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        setRequests([]);
        return;
      }

      // LẮNG NGHE REALTIME LỜI MỜI KẾT BẠN
      const q = query(
        collection(db, "friend_requests"),
        where("toUserId", "==", user.uid),
        where("status", "==", "pending")
      );

      const unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
        try {
          const fetchPromises = snapshot.docs.map(async (requestDoc) => {
            const data = requestDoc.data();
            const userRef = doc(db, "users", data.fromUserId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              return {
                id: requestDoc.id, 
                senderId: data.fromUserId,
                fullName: userData.fullName || userData.name || "Người dùng BDU",
                avatar: userData.avatar?.trim() ? userData.avatar : DEFAULT_AVATAR
              };
            }
            return null;
          });

          const requestsData = (await Promise.all(fetchPromises)).filter(Boolean);
          setRequests(requestsData);
        } catch (error) {
          console.log("Lỗi lấy dữ liệu lời mời:", error);
        } finally {
          setLoading(false);
        }
      }, (error) => {
        console.log("Lỗi Listener Realtime:", error);
        setLoading(false);
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

  const handleAccept = async (request) => {
    const currentUserId = getAuth().currentUser?.uid;
    if (!currentUserId) return;

    try {
      // 1. Thêm bạn vào sub-collection "friends" của 2 người
      await setDoc(doc(db, "users", currentUserId, "friends", request.senderId), {
        friendId: request.senderId,
        addedAt: new Date()
      });

      await setDoc(doc(db, "users", request.senderId, "friends", currentUserId), {
        friendId: currentUserId,
        addedAt: new Date()
      });

      // 2. Xóa lời mời kết bạn (Realtime sẽ tự động loại bỏ người này khỏi UI ngay lập tức)
      await deleteDoc(doc(db, "friend_requests", request.id));
      Alert.alert("Thành công", `Bạn và ${request.fullName} đã trở thành bạn bè!`);
    } catch (error) {
      console.log("Lỗi chấp nhận kết bạn:", error);
      Alert.alert("Lỗi", "Không thể chấp nhận lúc này.");
    }
  };

  const handleReject = async (requestId) => {
    try {
      await deleteDoc(doc(db, "friend_requests", requestId));
    } catch (error) {
      console.log("Lỗi từ chối kết bạn:", error);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.requestCard}>
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.fullName}</Text>
        <Text style={styles.timeText}>Muốn kết nối với bạn</Text>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.8} onPress={() => handleAccept(item)}>
            <Feather name="check" size={16} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.acceptText}>Xác nhận</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.8} onPress={() => handleReject(item.id)}>
            <Feather name="x" size={16} color="#1A1A1A" style={{ marginRight: 4 }} />
            <Text style={styles.rejectText}>Xóa</Text> 
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.appHeaderFlat}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
         {/* NÚT BACK CHUẨN FORM MATCH / MESSAGES */}
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => router.back()} 
            style={styles.backBtn}
          >
            {/* Đổi từ arrow-back sang chevron-back và tăng size lên 28 */}
            <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Lời mời kết bạn</Text>
          
          {requests.length > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* CONTENT */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={BDU_RED} />
            <Text style={{ marginTop: 12, color: '#65676B' }}>Đang tải lời mời...</Text>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Feather name="user-check" size={36} color="#8A8D91" />
          </View>
          <Text style={styles.emptyText}>Hộp thư trống trải</Text>
          <Text style={styles.emptySubText}>Khi có ai đó gửi lời mời, chúng sẽ xuất hiện ở đây.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BDU_BG }, 
  appHeaderFlat: { 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#EAEAEA',
    paddingHorizontal: 12,
  },
  backBtn: { padding: 8, marginRight: 4, borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 },
  badgeCount: { backgroundColor: BDU_RED, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  requestCard: { 
    flexDirection: 'row', 
    padding: 16, 
    marginHorizontal: 16, 
    marginBottom: 12, 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 12, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1, 
  },
  avatar: { width: 68, height: 68, borderRadius: 34, marginRight: 14, backgroundColor: '#E4E6EB' },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  timeText: { fontSize: 13, color: '#65676B', marginBottom: 12 }, 
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { flex: 1, flexDirection: 'row', backgroundColor: BDU_RED, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  rejectBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#E4E6EB', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#1A1A1A', fontWeight: '600', fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E4E6EB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  emptySubText: { fontSize: 14, color: '#65676B', marginTop: 8, textAlign: 'center', lineHeight: 20 }
});