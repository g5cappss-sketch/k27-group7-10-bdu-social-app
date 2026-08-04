import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  SafeAreaView, Image, StatusBar, Platform, ActivityIndicator, RefreshControl,
  Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Animated, Dimensions
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore"; 
import { auth, db } from "../../BDU_SocialApp/firebaseConfig"; 
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { syncAvatarToPosts } from "./syncAvatar";

const { width, height } = Dimensions.get('window');
const BDU_RED = '#C8102E';
const BDU_BG = '#F4F6F8'; 

// DANH SÁCH CHUẨN 18 NGÀNH HỌC TỪ HÌNH ẢNH CỦA BẠN
const MAJORS_LIST = [
  "Ngôn ngữ Anh", "Xã hội học", "Nhật Bản học", "Hàn Quốc học",
  "Quản trị Kinh doanh", "Tài chính - Ngân hàng", "Kế toán", "Luật",
  "Luật Kinh tế", "Công nghệ Thông tin", "Công nghệ Kỹ thuật Công trình Xây dựng",
  "Công nghệ Kỹ thuật Ô tô", "Công nghệ Kỹ thuật Điện, Điện tử",
  "Logistics và Quản lý Chuỗi Cung ứng", "Công nghệ Thực phẩm",
  "Kiến trúc", "Dược học", "Hoá dược"
];

const formatTime = (timestamp) => {
  if (!timestamp) return 'Vừa xong';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} - ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

export default function ProfileScreen() {
  const USER_ID = auth.currentUser?.uid; 

  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // FIX: Thay URL ảnh bìa mặc định bằng link ảnh thực tế chuẩn
  const [currentUser, setCurrentUser] = useState({
    name: "",
    studentId: "",
    major: "",
    className: "", 
    bio: "",
    avatar: "https://i.pravatar.cc/300?img=12",
    cover: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1000&auto=format&fit=crop",
    friendsCount: 0,
    followersCount: 0,
  });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [majorModalVisible, setMajorModalVisible] = useState(false);
  const [editForm, setEditForm] = useState(currentUser);
  const [isSaving, setIsSaving] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  const [postMenuVisible, setPostMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editPostVisible, setEditPostVisible] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // LẮNG NGHE USER REAL-TIME
  useEffect(() => {
    if (!USER_ID) return; 
    
    const unsubscribe = onSnapshot(doc(db, "users", USER_ID), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUser(data);
        setEditForm(data);
        
        // Yêu cầu cập nhật nếu thiếu các thông tin quan trọng
        if (!data.name || !data.studentId || !data.major || !data.className) {
          setIsSetupRequired(true);
          setEditModalVisible(true);
        }
      } else {
        setIsSetupRequired(true);
        setEditModalVisible(true);
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, (error) => {
      console.log("Lỗi tải profile realtime:", error);
    });

    return () => unsubscribe();
  }, [USER_ID]);

  // LẮNG NGHE BÀI VIẾT REAL-TIME
  useEffect(() => {
    if (!USER_ID) return;
    const q = query(collection(db, "posts"), where("userId", "==", USER_ID));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      postsData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setUserPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [USER_ID]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // FIX: Nén chất lượng ảnh thấp hơn (quality 0.15 đối với ảnh bìa) để không bị nổ dung lượng 1MB của Firestore
  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Bảo mật', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
      return;
    }
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, 
      aspect: type === 'avatar' ? [1, 1] : [16, 9], 
      quality: type === 'cover' ? 0.15 : 0.2, // Giảm nén tối đa để lưu vừa Firestore
      base64: true, 
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const imageUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setEditForm(prev => ({ ...prev, [type]: imageUri }));
    }
  };

  const handleSaveProfile = async () => {
    if (!editForm.name?.trim() || !editForm.studentId?.trim() || !editForm.major?.trim() || !editForm.className?.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ Họ tên, MSSV, Chuyên ngành và Lớp học!");
      return;
    }

    setIsSaving(true);

    try {
      await setDoc(doc(db, "users", USER_ID), editForm);

      if (editForm.avatar) {
        await syncAvatarToPosts(USER_ID, editForm.avatar);
      }

      const wasSetupRequired = isSetupRequired;
      setIsSetupRequired(false);
      setEditModalVisible(false);

      if (wasSetupRequired) {
        Alert.alert("Tuyệt vời!", "Hồ sơ của bạn đã được cập nhật thành công.", [
          { text: "Bắt đầu sử dụng", onPress: () => router.replace('/feed') }
        ]);
      } else {
        Alert.alert("Thành công", "Đã cập nhật thông tin cá nhân!");
      }

    } catch (error) {
      Alert.alert("Lỗi", "Không thể lưu dữ liệu (ảnh có thể quá lớn). Hãy chọn ảnh khác!");
      console.log("Lỗi lưu profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePost = async (postId) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa vĩnh viễn bài viết này không?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          style: "destructive", 
          onPress: async () => {
            setPostMenuVisible(false);
            try {
              await deleteDoc(doc(db, "posts", postId));
            } catch (error) {
              Alert.alert("Lỗi", "Không thể xóa bài viết này lúc này.");
            }
          } 
        }
      ]
    );
  };

  const handleUpdatePostContent = async () => {
    if (!editPostContent.trim()) return;
    try {
      await updateDoc(doc(db, "posts", selectedPost.id), {
        content: editPostContent
      });
      setEditPostVisible(false);
      setSelectedPost(null);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật bài viết.");
    }
  };

  const getCount = (field, fallbackCount) => {
    if (Array.isArray(field)) return field.length;
    if (typeof field === 'object' && field !== null) return Object.keys(field).length;
    return fallbackCount || 0;
  };

  const coverScale = scrollY.interpolate({
    inputRange: [-100, 0, 100], outputRange: [1.15, 1, 1], extrapolate: 'clamp'
  });
  const coverTranslateY = scrollY.interpolate({
    inputRange: [-100, 0, 100], outputRange: [-30, 0, 10], extrapolate: 'clamp'
  });

  // HEADER PROFILE
  const renderProfileHeader = () => (
    <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
      <View style={styles.coverWrapper}>
        <Animated.Image 
          source={{ uri: currentUser.cover }} 
          style={[styles.coverPhoto, { transform: [{ scale: coverScale }, { translateY: coverTranslateY }] }]} 
        />
        <View style={styles.coverGradient} />
        
        {/* NÚT TRỜ VỀ */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.navigate('/feed')}>
          <Feather name="chevron-left" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.floatingProfileCard}>
        <View style={styles.avatarActionRow}>
          <View style={styles.avatarOuterShadow}>
            <Image source={{ uri: currentUser.avatar }} style={styles.avatarPremium} />
            <View style={styles.onlineIndicator} />
          </View>
          
          <TouchableOpacity 
            style={styles.editButtonPremium} 
            onPress={() => { setEditForm(currentUser); setEditModalVisible(true); }}
          >
            <Feather name="edit-3" size={14} color="#1A1A1A" />
            <Text style={styles.editButtonTextPremium}>Chỉnh sửa</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.userNamePremium}>{currentUser.name || "Đang cập nhật..."}</Text>
          <Ionicons name="checkmark-circle" size={18} color={BDU_RED} style={{marginLeft: 6}} />
        </View>
        <Text style={styles.userMajorPremium}>{currentUser.major || "Chưa cập nhật ngành học"}</Text>
        
        {currentUser.bio ? <Text style={styles.userBioPremium}>{currentUser.bio}</Text> : null}

        {/* THỐNG KÊ */}
        <View style={styles.statsPremiumContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumberPremium}>{userPosts.length}</Text>
            <Text style={styles.statLabelPremium}>Bài viết</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumberPremium}>
              {getCount(currentUser.friends, currentUser.friendsCount)}
            </Text>
            <Text style={styles.statLabelPremium}>Bạn bè</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumberPremium}>
              {getCount(currentUser.followers, currentUser.followersCount)}
            </Text>
            <Text style={styles.statLabelPremium}>Theo dõi</Text>
          </View>
        </View>

        {/* CHIPS DETAIL */}
        <View style={styles.chipsContainer}>
          <View style={styles.infoChip}>
            <Feather name="hash" size={12} color="#65676B" />
            <Text style={styles.chipText}>{currentUser.studentId || "MSSV trống"}</Text>
          </View>
          
          {currentUser.className ? (
            <View style={styles.infoChip}>
              <Feather name="book-open" size={12} color="#65676B" />
              <Text style={styles.chipText}>{currentUser.className}</Text>
            </View>
          ) : null}

          <View style={[styles.infoChip, {backgroundColor: '#FFF0F2', borderColor: BDU_RED, borderWidth: 0.5}]}>
            <Feather name="award" size={12} color={BDU_RED} />
            <Text style={[styles.chipText, {color: BDU_RED, fontWeight: '600'}]}>BDU Student</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Bài viết của bạn</Text>
        <Feather name="grid" size={20} color="#1A1A1A" />
      </View>
    </Animated.View>
  );

  // RENDER BÀI VIẾT
  const renderPost = ({ item }) => (
    <View style={styles.postCardPremium}>
      <View style={styles.postHeader}>
        <View style={styles.postHeaderLeft}>
          <Image source={{ uri: currentUser.avatar }} style={styles.postAvatar} />
          <View>
            <Text style={styles.postAuthorName}>{currentUser.name}</Text>
            <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.postMenuBtn}
          onPress={() => {
            setSelectedPost(item);
            setEditPostContent(item.content || "");
            setPostMenuVisible(true);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
        </TouchableOpacity>
      </View>

      {item.content ? <Text style={styles.postContentPremium}>{item.content}</Text> : null}

      {item.videoUrl ? (
        <View style={styles.mediaContainer}>
          <Video
            source={{ uri: item.videoUrl }}
            style={styles.postMediaPremium}
            useNativeControls
            resizeMode="cover"
            isLooping
          />
        </View>
      ) : 
      (item.image || item.imageUrl) ? (
        <View style={styles.mediaContainer}>
          <Image 
            source={{ uri: item.image || item.imageUrl }} 
            style={styles.postMediaPremium} 
          />
        </View>
      ) : null}

      <View style={styles.postStatsRow}>
        <View style={styles.postStatsLeft}>
          <View style={styles.iconCircleBg}>
            <Ionicons name="heart" size={12} color="#FFF" />
          </View>
          <Text style={styles.postStatText}>{item.likes || 0}</Text>
        </View>
        <Text style={styles.postStatText}>{item.comments || 0} bình luận</Text>
      </View>

      <View style={styles.postActionsPremium}>
        <TouchableOpacity style={styles.actionBtnPremium}>
          <Feather name="heart" size={20} color="#65676B" />
          <Text style={styles.actionTextPremium}>Thích</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnPremium}>
          <Feather name="message-circle" size={20} color="#65676B" />
          <Text style={styles.actionTextPremium}>Bình luận</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Tabs.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={BDU_RED} />
        </View>
      ) : (
        <Animated.FlatList
          data={userPosts}
          renderItem={renderPost}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderProfileHeader}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainerPremium}>
              <Feather name="image" size={50} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Chưa có bài đăng nào</Text>
              <Text style={styles.emptySub}>Những khoảnh khắc bạn chia sẻ sẽ xuất hiện ở đây.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BDU_RED} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* MODAL BOTTOM SHEET: ĐIỀU HƯỚNG BÀI VIẾT (SỬA/XÓA) */}
      <Modal visible={postMenuVisible} animationType="slide" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPostMenuVisible(false)}>
          <View style={styles.bottomSheetContent}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity 
              style={styles.sheetOption} 
              onPress={() => {
                setPostMenuVisible(false);
                setEditPostVisible(true);
              }}
            >
              <View style={[styles.sheetIconBox, {backgroundColor: '#F0F2F5'}]}>
                <Feather name="edit-2" size={18} color="#1A1A1A" />
              </View>
              <Text style={styles.sheetOptionText}>Chỉnh sửa bài viết</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.sheetOption, { borderBottomWidth: 0 }]} 
              onPress={() => handleDeletePost(selectedPost?.id)}
            >
              <View style={[styles.sheetIconBox, {backgroundColor: '#FFF0F2'}]}>
                <Feather name="trash-2" size={18} color="#FF3B30" />
              </View>
              <Text style={[styles.sheetOptionText, { color: '#FF3B30' }]}>Xóa bài viết</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: SỬA NỘI DUNG CHỮ BÀI VIẾT */}
      <Modal visible={editPostVisible} animationType="fade" transparent={true}>
        <View style={styles.centeredModalOverlay}>
          <View style={styles.editPostBox}>
            <Text style={styles.editPostTitle}>Chỉnh sửa bài viết</Text>
            <TextInput
              style={styles.editPostInput}
              multiline
              value={editPostContent}
              onChangeText={setEditPostContent}
            />
            <View style={styles.editPostActions}>
              <TouchableOpacity style={styles.cancelMinBtn} onPress={() => setEditPostVisible(false)}>
                <Text style={styles.cancelMinText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveMinBtn} onPress={handleUpdatePostContent}>
                <Text style={styles.saveMinText}>Cập nhật</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL THIẾT LẬP THÔNG TIN CÁ NHÂN */}
      <Modal 
  visible={editModalVisible} 
  animationType="slide" 
  transparent={false}
  style={{ margin: 0 }} // <--- THÊM DÒNG NÀY NẾU DÙNG THƯ VIỆN NGOÀI
>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => !isSetupRequired && setEditModalVisible(false)} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Hủy</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Hồ sơ cá nhân</Text>
              <TouchableOpacity onPress={handleSaveProfile} disabled={isSaving} style={styles.headerBtn}>
                <Text style={[styles.headerBtnText, { color: BDU_RED, fontWeight: '700' }]}>
                  {isSaving ? "Lưu..." : "Lưu"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
              <View style={styles.mediaEditContainer}>
                <Image source={{ uri: editForm.cover }} style={styles.editCoverPhoto} />
                
                {/* FIX: Thêm zIndex & elevation để nút camera đổi ảnh bìa luôn bấm được */}
                <TouchableOpacity style={styles.editCoverBtn} onPress={() => pickImage('cover')}>
                  <Feather name="camera" size={18} color="#1A1A1A" />
                </TouchableOpacity>

                <View style={styles.editAvatarWrapper}>
                  <Image source={{ uri: editForm.avatar }} style={styles.editAvatarPhoto} />
                  <TouchableOpacity style={styles.editAvatarBtn} onPress={() => pickImage('avatar')}>
                    <Feather name="camera" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.editFormContainer}>
                <Text style={styles.inputLabel}>Họ và tên *</Text>
                <TextInput style={styles.textInput} placeholder="Nhập họ và tên" value={editForm.name} onChangeText={(text) => setEditForm({...editForm, name: text})} />
                
                <View style={styles.rowInputs}>
                  <View style={{flex: 1, marginRight: 10}}>
                    <Text style={styles.inputLabel}>MSSV *</Text>
                    <TextInput style={styles.textInput} placeholder="Mã số SV" value={editForm.studentId} keyboardType="numeric" onChangeText={(text) => setEditForm({...editForm, studentId: text})} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.inputLabel}>Lớp học *</Text>
                    <TextInput style={styles.textInput} placeholder="VD: 22TH1" value={editForm.className} onChangeText={(text) => setEditForm({...editForm, className: text})} />
                  </View>
                </View>

                {/* CHUYÊN NGÀNH */}
                <Text style={styles.inputLabel}>Chuyên ngành *</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  activeOpacity={0.7}
                  onPress={() => setMajorModalVisible(true)}
                >
                  <Text style={[styles.dropdownValueText, !editForm.major && { color: '#A0A3A7' }]}>
                    {editForm.major || "Chọn chuyên ngành..."}
                  </Text>
                  <Feather name="chevron-down" size={20} color="#65676B" />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Tiểu sử bản thân</Text>
                <TextInput style={[styles.textInput, { height: 80, paddingTop: 12 }]} placeholder="Vài nét về bạn..." multiline value={editForm.bio} onChangeText={(text) => setEditForm({...editForm, bio: text})} />
              </View>
            </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>

      {/* MODAL CHỌN CHUYÊN NGÀNH */}
      <Modal visible={majorModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.majorModalContent}>
            <View style={styles.majorModalHeader}>
              <Text style={styles.majorModalTitle}>Chọn chuyên ngành</Text>
              <TouchableOpacity onPress={() => setMajorModalVisible(false)} style={styles.majorCloseBtn}>
                <Ionicons name="close-circle" size={26} color="#E4E6EB" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={MAJORS_LIST}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const isSelected = editForm.major === item;
                return (
                  <TouchableOpacity 
                    style={[styles.majorItemRow, isSelected && styles.majorItemRowSelected]}
                    onPress={() => {
                      setEditForm({ ...editForm, major: item });
                      setMajorModalVisible(false);
                    }}
                  >
                    <Text style={[styles.majorItemText, isSelected && styles.majorItemTextSelected]}>
                      {item}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BDU_BG },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  headerContainer: { paddingBottom: 15 },
 coverWrapper: { width: '100%', height: 210, overflow: 'hidden', backgroundColor: '#FFF' },
  coverPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverGradient: { 
    display: 'none' // Ẩn lớp màng đen này đi để không bị lộ vạch đen phía trên thẻ thông tin
  },
  
 backButton: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 50 : 30, // Chỉnh lại top cho vừa mắt hơn trên mọi dòng máy
    left: 16, 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 10 
  },

  // 3. Đảm bảo card thông tin đẩy lên đè vừa đẹp lên ảnh bìa
  floatingProfileCard: { 
    backgroundColor: '#FFF', 
    marginTop: -40, // Đổ dốc nhẹ đẹp mắt không lộ khoảng hở đen phía sau
    marginHorizontal: 16, 
    borderRadius: 24, 
    padding: 22, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },

  avatarActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -65 },
  avatarOuterShadow: { 
    width: 104, height: 104, borderRadius: 52, 
    backgroundColor: '#FFF', padding: 4, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 
  },
  avatarPremium: { width: '100%', height: '100%', borderRadius: 50 },
  onlineIndicator: { position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, backgroundColor: '#31A24C', borderRadius: 9, borderWidth: 3, borderColor: '#FFF' },
  
  editButtonPremium: { flexDirection: 'row', backgroundColor: '#F4F6F8', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', marginBottom: 5 },
  editButtonTextPremium: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginLeft: 6 },
  
  nameSection: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  userNamePremium: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  userMajorPremium: { fontSize: 14, color: '#65676B', fontWeight: '500', marginTop: 4 },
  userBioPremium: { fontSize: 14, color: '#4A4A4A', marginTop: 12, lineHeight: 22, fontStyle: 'italic' },
  
  statsPremiumContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16 },
  statBox: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E4E6EB' },
  statNumberPremium: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  statLabelPremium: { fontSize: 12, color: '#65676B', marginTop: 4, fontWeight: '500' },

  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  infoChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  chipText: { fontSize: 12, color: '#4A4A4A', marginLeft: 6, fontWeight: '600' },
  
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 25, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },

  postCardPremium: { 
    backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 16, borderRadius: 20, 
    paddingTop: 16, paddingBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  postAuthorName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  postTime: { fontSize: 12, color: '#8A8D91', marginTop: 2 },
  postMenuBtn: { padding: 4 },
  
  postContentPremium: { fontSize: 15, color: '#1A1A1A', lineHeight: 22, paddingHorizontal: 16, marginBottom: 12 },
  mediaContainer: { paddingHorizontal: 10, marginBottom: 12 },
  postMediaPremium: { width: '100%', height: 250, borderRadius: 16, backgroundColor: '#F0F2F5' },
  
  postStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  postStatsLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconCircleBg: { backgroundColor: BDU_RED, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  postStatText: { color: '#65676B', fontSize: 13, fontWeight: '500' },
  
  postActionsPremium: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F4F6F8', paddingTop: 12, paddingHorizontal: 16, gap: 10 },
  actionBtnPremium: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F9FAFB', paddingVertical: 10, borderRadius: 12 },
  actionTextPremium: { color: '#4A4A4A', fontSize: 14, fontWeight: '600' },

  emptyContainerPremium: { alignItems: 'center', marginTop: 50, paddingHorizontal: 40 },
  emptyTitle: { color: '#1A1A1A', fontSize: 16, fontWeight: '700', marginTop: 15 },
  emptySub: { color: '#8A8D91', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  bottomSheetContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#E4E6EB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F4F6F8' },
  sheetIconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  sheetOptionText: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },

  centeredModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editPostBox: { width: width * 0.85, backgroundColor: '#FFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  editPostTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: '#1A1A1A' },
  editPostInput: { borderWidth: 1, backgroundColor: '#F9FAFB', borderColor: '#E4E6EB', borderRadius: 12, padding: 16, height: 120, textAlignVertical: 'top', fontSize: 15 },
  editPostActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  cancelMinBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  cancelMinText: { color: '#65676B', fontWeight: '700', fontSize: 15 },
  saveMinBtn: { backgroundColor: BDU_RED, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  saveMinText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F4F6F8', backgroundColor: '#FFF' },
  headerBtn: { padding: 4 },
  headerBtnText: { color: '#65676B', fontSize: 16, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  mediaEditContainer: { height: 180, backgroundColor: '#F0F2F5', marginBottom: 20 },
  
  // 👉 ĐÂY LÀ CHỖ ĐÃ SỬA: Đổi height từ 130 thành '100%' để lấp đầy khoảng hở xám
  editCoverPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  editCoverBtn: { 
    position: 'absolute', 
    right: 16, 
    top: 16, 
    backgroundColor: '#FFF', 
    padding: 8, 
    borderRadius: 20, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 5,
    zIndex: 10,
    elevation: 5
  },
  
  editAvatarWrapper: { position: 'absolute', bottom: -20, left: 24, width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF', padding: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  editAvatarPhoto: { width: '100%', height: '100%', borderRadius: 45 },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: BDU_RED, padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' },
  
  editFormContainer: { paddingHorizontal: 24 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#4A4A4A', marginBottom: 8, marginTop: 16 },
  textInput: { backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1A1A1A', borderWidth: 1, borderColor: '#E4E6EB' },

  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#E4E6EB' },
  dropdownValueText: { fontSize: 15, color: '#1A1A1A', fontWeight: '500' },

  // STYLES DÀNH CHO MODAL CHỌN CHUYÊN NGÀNH
  majorModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', paddingVertical: 16 },
  majorModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F4F6F8' },
  majorModalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  majorCloseBtn: { padding: 4 },
  majorItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F4F6F8' },
  majorItemRowSelected: { backgroundColor: '#FFF0F2', borderRadius: 12 },
  majorItemText: { fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
  majorItemTextSelected: { color: BDU_RED, fontWeight: '700' },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: BDU_RED, justifyContent: 'center', alignItems: 'center' },
});