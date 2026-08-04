import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  Image, ScrollView, StatusBar, Platform, Alert, ActivityIndicator, 
  RefreshControl, Modal, TextInput, Share, Animated, KeyboardAvoidingView, Keyboard,
  Dimensions, TouchableWithoutFeedback , Switch,
} from 'react-native';
// NÂNG CẤP: Import SafeAreaView từ react-native-safe-area-context
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Ionicons, FontAwesome5, Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { Tabs, router, useRouter } from 'expo-router'; // Đã gộp chung router và useRouter

// FIRESTORE: Đã gom đủ tất cả các hàm cần thiết (bao gồm cả arrayUnion và arrayRemove của bạn)
import { 
  collection, query, onSnapshot, addDoc, Timestamp, doc, 
  updateDoc, deleteDoc, orderBy, getDocs, getDoc, 
  arrayUnion, increment, arrayRemove, where 
} from "firebase/firestore"; 

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../BDU_SocialApp/firebaseConfig"; // Đã thêm "auth" vào đây để lấy thông tin user hiện tại giống màn tin nhắn

import * as ImagePicker from 'expo-image-picker'; 
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation'; 
import Toast from 'react-native-toast-message';
import LikeButton from './LikeButton';


const BDU_RED = '#C8102E';
const BDU_BG = '#F4F6F9';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const currentUserId = auth.currentUser?.uid || 'guest';


const MOCK_POSTS = [];
const SystemNotice = () => {
  // ẨN HOÀN TOÀN TẠM THỜI ĐỂ CHUYỂN VÀO CHUÔNG THÔNG BÁO
  return null; 

  /* LƯU LẠI CODE CŨ KHI CẦN DÙNG LẠI:
  return (
    <View style={styles.noticeCard}>
      <View style={styles.noticeHeader}>
        <View style={styles.noticeAuthorContainer}>
          <Image source={{ uri: item.avatar }} style={styles.noticeAvatar} />
          <View>
            <Text style={styles.noticeAuthor}>{item.author}</Text>
            <Text style={styles.noticeTime}>{item.time}</Text>
          </View>
        </View>
        <View style={styles.noticeBadge}>
          <Text style={styles.noticeBadgeText}>Thông báo</Text>
        </View>
      </View>
      <Text style={styles.noticeContent}>{item.content}</Text>
    </View>
  );
  */
};

const getTimeAgo = (timestamp) => {
  if (!timestamp) return "Vừa xong";

  // Hỗ trợ Firebase Timestamp
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval} năm`;

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval} tháng`;

  interval = Math.floor(seconds / 604800);
  if (interval >= 1) return `${interval} tuần`;

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval} ngày`;

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval} giờ`;

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval} phút`;

  return "Vừa xong";
};

// =====================================================================
// COMPONENT CON: BÌNH LUẬN 
// =====================================================================

const CommentItem = ({ cmt, isReply, handleCommentOptions, handleReply, currentUser, activePostId }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Xác định trạng thái dựa trên dữ liệu Firebase thay vì state cục bộ
  const hasLiked = cmt.likedBy && cmt.likedBy.includes(currentUser.id);
  const hasDisliked = cmt.dislikedBy && cmt.dislikedBy.includes(currentUser.id);
  
  // Đếm số lượng
  const likesCount = cmt.likedBy ? cmt.likedBy.length : 0;
  const dislikesCount = cmt.dislikedBy ? cmt.dislikedBy.length : 0;

  const onReact = async (type) => {
    // Hiệu ứng animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.5, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();

    // Nếu không có thông tin user hoặc bài viết thì bỏ qua
    if (!activePostId || !currentUser.id) return;

    // Trỏ tới document của bình luận này trên Firebase
    const commentRef = doc(db, "posts", activePostId, "comments", cmt.id);

    try {
      if (type === 'like') {
        if (hasLiked) {
          // Bỏ like
          await updateDoc(commentRef, { likedBy: arrayRemove(currentUser.id) });
        } else {
          // Thêm like, đồng thời gỡ dislike (nếu trước đó lỡ bấm dislike)
          await updateDoc(commentRef, {
            likedBy: arrayUnion(currentUser.id),
            ...(hasDisliked ? { dislikedBy: arrayRemove(currentUser.id) } : {})
          });
        }
      } else if (type === 'dislike') {
        if (hasDisliked) {
          // Bỏ dislike
          await updateDoc(commentRef, { dislikedBy: arrayRemove(currentUser.id) });
        } else {
          // Thêm dislike, đồng thời gỡ like (nếu trước đó lỡ bấm like)
          await updateDoc(commentRef, {
            dislikedBy: arrayUnion(currentUser.id),
            ...(hasLiked ? { likedBy: arrayRemove(currentUser.id) } : {})
          });
        }
      }
    } catch (error) {
      console.log("Lỗi khi tương tác bình luận: ", error);
    }
  };

  return (
    <View style={[styles.commentItem, isReply && styles.replyCommentItem]}>
      <Image source={{ uri: cmt.avatar }} style={styles.commentAvatar} />
      <View style={{ flex: 1 }}>
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>{cmt.author}</Text>
          <Text style={styles.commentText}>{cmt.text}</Text>
        </View>
        <View style={styles.commentActionsWrap}>
          <Text style={styles.commentTimeText}>{getTimeAgo(cmt.time)}</Text>
          
          {/* Nút Like kèm bộ đếm */}
          <TouchableOpacity onPress={() => onReact('like')} style={{ paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={hasLiked ? { transform: [{ scale: scaleAnim }] } : {}}>
              <Ionicons name={hasLiked ? "thumbs-up" : "thumbs-up-outline"} size={16} color={hasLiked ? BDU_RED : '#65676B'} />
            </Animated.View>
            {likesCount > 0 && <Text style={{ fontSize: 12, color: '#65676B', marginLeft: 4 }}>{likesCount}</Text>}
          </TouchableOpacity>

          {/* Nút Dislike kèm bộ đếm */}
          <TouchableOpacity onPress={() => onReact('dislike')} style={{ paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={hasDisliked ? "thumbs-down" : "thumbs-down-outline"} size={16} color={hasDisliked ? '#1A1A1A' : '#65676B'} />
            {dislikesCount > 0 && <Text style={{ fontSize: 12, color: '#65676B', marginLeft: 4 }}>{dislikesCount}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleReply(cmt)}>
            <Text style={styles.commentActionText}>Phản hồi</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleCommentOptions(cmt)}>
            <Text style={styles.commentActionText}>Tùy chọn</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// =====================================================================
// COMPONENT CON: BÀI VIẾT 
// =====================================================================
// TÍNH NĂNG MỚI: Thêm prop currentUser và handleAddFriend
const PostItem = ({ 
  item, 
  handlePostOptions, 
  handleShare, 
  openCommentModal, 
  visibleItemIds, 
  currentUser, 
  handleAddFriend,
  sentRequests,
  myFriends // <-- BẮT BUỘC phải có dòng này ở đây
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current; 
  const isSent = sentRequests && sentRequests[item.userId];
  const videoRef = useRef(null); 
  const [isMuted, setIsMuted] = useState(true);
  const [videoStatus, setVideoStatus] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isVisible = visibleItemIds.includes(item.id);
  const lastTap = useRef(null);
  
  

  useEffect(() => {
    if (videoRef.current && !isFullscreen) { 
      if (isVisible) videoRef.current.playAsync();
      else videoRef.current.pauseAsync();
    }
  }, [isVisible, isFullscreen]);

  const handleVideoPress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      toggleFullscreen();
    } else {
      lastTap.current = now;
      if (videoStatus.isPlaying) videoRef.current.pauseAsync();
      else videoRef.current.playAsync();
    }
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (videoRef.current) await videoRef.current.presentFullscreenPlayer();
    } else {
      setIsFullscreen(false);
      if (videoRef.current) await videoRef.current.dismissFullscreenPlayer();
    }
  };

  const handleFullscreenUpdate = async ({ fullscreenUpdate }) => {
    if (fullscreenUpdate === 0 || fullscreenUpdate === 1) {
      await ScreenOrientation.unlockAsync(); 
    } else if (fullscreenUpdate === 3) {
      setIsFullscreen(false);
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); 
    }
  };

  return (
    <View style={styles.postCard}>
     {/* --- 1. HEADER BÀI VIẾT --- */}
      <View style={styles.postHeader}>
        <Image source={{ uri: item.avatar || 'https://i.pravatar.cc/100?img=1' }} style={styles.postAvatar} />
        
        <View style={styles.postInfo}>
          <View style={styles.authorRow}>
            <Text style={styles.postAuthor} numberOfLines={1}>
              {item.author || 'Người dùng ẩn danh'}
            </Text>
            
            {/* THÊM ĐIỀU KIỆN KẾT BẠN (GIỮ NGUYÊN LOGIC CỦA BÁC) */}
            {!myFriends?.[item.userId] && item.userId && currentUser && item.userId !== currentUser.id && (
              <TouchableOpacity
                style={[
                  styles.addFriendBtn,
                  isSent && styles.addFriendBtnSent
                ]}
                activeOpacity={0.7}
                onPress={() => handleAddFriend(item)}
              >
                <Ionicons
                  name={isSent ? 'checkmark-circle' : 'person-add'}
                  size={14}
                  color={isSent ? "#34C759" : "#0084FF"} // Xanh lá nếu đã gửi, Xanh dương nếu chưa
                />
                <Text style={[styles.addFriendText, isSent && styles.addFriendTextSent]}>
                  {isSent ? 'Đã gửi' : 'Kết bạn'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Fix lỗi Firebase Time nếu có, hoặc in ra item.time bình thường */}
          <Text style={styles.postTime}>
            {typeof item.time === 'object' && item.time?.toDate 
              ? item.time.toDate().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) 
              : (item.time || 'Vừa xong')}
          </Text>
        </View>

        {/* Nút Ba chấm (Giữ nguyên logic) */}
        {(currentUser?.id === item.userId || currentUser?.role === 'admin') && (
          <TouchableOpacity onPress={() => handlePostOptions(item)} style={styles.moreBtn} activeOpacity={0.5}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* --- 2. NỘI DUNG CHỮ --- */}
      <Text style={styles.postContent}>{item.content}</Text>
      
      {/* --- 3. NỘI DUNG ẢNH --- */}
      {item.image && <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />}
      
      {/* --- 4. NỘI DUNG VIDEO (GIỮ NGUYÊN HOÀN TOÀN LOGIC CỦA BÁC) --- */}
      {item.video && (
        <View style={styles.videoContainer}>
          <TouchableWithoutFeedback onPress={handleVideoPress}>
            <View style={styles.postVideo}>
              <Video
                ref={videoRef}
                source={{ uri: item.video }}
                style={StyleSheet.absoluteFillObject}
                useNativeControls={isFullscreen}
                resizeMode={ResizeMode.COVER}
                isLooping
                isMuted={isMuted}
                onPlaybackStatusUpdate={status => setVideoStatus(() => status)}
                onFullscreenUpdate={handleFullscreenUpdate}
              />
              
              {!isFullscreen && (
                <>
                  <TouchableOpacity style={styles.muteBtn} onPress={() => setIsMuted(!isMuted)}>
                    <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={16} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fullscreenBtn} onPress={toggleFullscreen}>
                    <Ionicons name="expand" size={16} color="#FFF" />
                  </TouchableOpacity>
                  
                  {!videoStatus?.isPlaying && (
                    <View style={styles.playIconOverlay}>
                      <Ionicons name="play" size={40} color="rgba(255,255,255,0.8)" />
                    </View>
                  )}

                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${(videoStatus?.positionMillis / (videoStatus?.durationMillis || 1)) * 100}%` }]} />
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
      
      {/* --- 5. THỐNG KÊ (LIKE / COMMENT) --- */}
      <View style={styles.postStats}>
        <View style={styles.statsLeft}>
          <View style={styles.likeIconBg}>
            <Ionicons name="heart" size={12} color="#FFF" />
          </View>
          <Text style={styles.statsText}>{item.likedBy?.length || item.likes || 0}</Text>
        </View>
        <Text style={styles.statsText}>{item.comments} bình luận</Text>
      </View>
      
      {/* ĐƯỜNG KẺ MỜ (Điểm nhấn Premium) */}
      <View style={styles.postDivider} />

      {/* --- 6. NÚT TƯƠNG TÁC --- */}
      <View style={styles.postActions}>
        
        {/* COMPONENT LIKE (Giữ nguyên) */}
        <View style={{ flex: 1, marginRight: 8 }}>
          <LikeButton 
            postId={item.id}
            likedBy={item.likedBy}
            currentUserId={currentUser?.id}
          />
        </View>

        {/* NÚT BÌNH LUẬN (Giao diện thẻ Chip) */}
        <TouchableOpacity style={styles.pillBtn} activeOpacity={0.7} onPress={() => openCommentModal(item)}>
          <Ionicons name="chatbubble-outline" size={20} color="#4B4C4F" />
          <Text style={styles.actionText}>Bình luận</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
};

// =====================================================================
// MÀN HÌNH CHÍNH
// =====================================================================
export default function FeedScreen() {
  // CẬP NHẬT 2: State lưu trữ thông tin người dùng đang đăng nhập
  const [currentUser, setCurrentUser] = useState({
    id: null,
    name: "Đang tải...",
    avatar: "https://i.pravatar.cc/100?img=1" 
  });

  const [posts, setPosts] = useState([]); 
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [visibleItemIds, setVisibleItemIds] = useState([]);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current; 
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setVisibleItemIds(viewableItems.map(v => v.item.id));
  }).current;

  const [notifications, setNotifications] = useState([]);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [sentRequests, setSentRequests] = useState({});

  const [modalVisible, setModalVisible] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null); 
  const [selectedImage, setSelectedImage] = useState(null); 
  const [selectedVideo, setSelectedVideo] = useState(null); 

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activePost, setActivePost] = useState(null); 
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]); 
  const [isCommenting, setIsCommenting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); 
  const [sendingComment, setSendingComment] = useState(false);
  const router = useRouter();
  const [myFriends, setMyFriends] = useState({});
  const [menuVisible, setMenuVisible] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); // Lưu tab đang chọn (mặc định là 'feed')
  
  // CẬP NHẬT 3: Lắng nghe Auth và Fetch User Firestore
  useEffect(() => {
    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async(user)=>{
      if (user) {
        // Lấy thông tin chi tiết từ collection 'users'
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCurrentUser({
  id: user.uid,
  name: userData.fullName || userData.name || user.displayName || "Sinh viên BDU",
  avatar: userData.avatar || user.photoURL || "https://i.pravatar.cc/100?img=1",
  role: userData.role || "user"
});
        } else {
          // Fallback nếu người dùng chưa cập nhật profile trong Firestore
          setCurrentUser({
  id: user.uid,
  name: user.displayName || "Sinh viên BDU",
  avatar: user.photoURL || "https://i.pravatar.cc/100?img=1",
  role: "user"
});
        }
      }
    });
    return unsubscribeAuth;
  }, []);

  
  useEffect(() => {
  if (!currentUser?.id) return;

  setLoading(true);

  // Realtime Posts
  const postsQuery = query(
    collection(db, "posts"),
    orderBy("time", "desc")
  );

  const unsubscribePosts = onSnapshot(
    postsQuery,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const item = doc.data();

        let formattedTime = "Vừa xong";

        if (item.time?.toDate) {
          const date = item.time.toDate();

          formattedTime =
            `${date.getHours().toString().padStart(2, "0")}:` +
            `${date.getMinutes().toString().padStart(2, "0")} - ` +
            `${date.getDate()}/${date.getMonth() + 1}`;
        }

        return {
          id: doc.id,
          ...item,
          time: formattedTime,
          likes: item.likes || 0,
          comments: item.comments || 0,
          likedBy: item.likedBy || [],
        };
      });

      setPosts(data);
      setLoading(false);
    },
    (error) => {
      console.log(error);
      setLoading(false);
    }
  );

  // Friends realtime
  const friendsRef = collection(db, "users", currentUser.id, "friends");

  const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
    const friends = {};

    snapshot.forEach((doc) => {
      friends[doc.id] = true;
    });

    setMyFriends(friends);
  });

  return () => {
    unsubscribePosts();
    unsubscribeFriends();
  };
}, [currentUser?.id]);

  const handleRefresh = async () => {
  setRefreshing(true);

  setTimeout(() => {
    setRefreshing(false);
  }, 600);
};

  // MỚI: Lắng nghe Notifications & Friend Requests Realtime
  useEffect(() => {
    if (!currentUser.id) return;

    // Lắng nghe Notifications
    const qNotif = query(collection(db, "notifications"), where("userId", "==", currentUser.id), orderBy("time", "desc"));
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
    });

    // Lắng nghe Friend Requests
    const qFriend = query(collection(db, "friend_requests"), where("fromUserId", "==", currentUser.id));
    const unsubFriend = onSnapshot(qFriend, (snapshot) => {
      const requests = {};
      snapshot.docs.forEach(doc => {
        requests[doc.data().toUserId] = doc.id;
      });
      setSentRequests(requests);
    });

    return () => {
      unsubNotif();
      unsubFriend();
    };
  }, [currentUser.id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Bảo mật', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, 
      allowsEditing: true, 
      aspect: [4, 3],      
      quality: 0.8,        
      base64: true, 
    });
    if (!result.canceled) {
      if (result.assets[0].type === 'video') {
        setSelectedVideo(result.assets[0].uri); 
        setSelectedImage(null); 
      } else {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`); 
        setSelectedVideo(null); 
      }
      setModalVisible(true);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Bảo mật', 'Ứng dụng cần quyền camera.');
    
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3], 
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      if (result.assets[0].type === 'video') {
        setSelectedVideo(result.assets[0].uri);
        setSelectedImage(null);
      } else {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        setSelectedVideo(null);
      }
      setModalVisible(true);
    }
  };

  const deletePost = async (item) => {
  const isOwner = currentUser?.id === item.userId;
  const isAdmin = currentUser?.role === "admin";

  if (!isOwner && !isAdmin) {
    Alert.alert("Thông báo", "Bạn không có quyền xóa bài viết này.");
    return;
  }

  try {
    await deleteDoc(doc(db, "posts", item.id));

    Toast.show({
      type: "success",
      text1: "Đã xóa bài viết",
      visibilityTime: 1500,
    });

  } catch (error) {
    console.log(error);

    Alert.alert("Lỗi", "Không thể xóa bài viết.");
  }
};

  const handleCreatePost = async () => {
  // 1. Kiểm tra nếu không có nội dung, ảnh hoặc video thì bỏ qua
  if (newPostText.trim() === "" && !selectedImage && !selectedVideo) return;
  
  setIsPosting(true);

  try {
    // 2. Xác định tên, avatar và vai trò dựa trên trạng thái ẨN DANH
    const postAuthorName = isAnonymous ? "Người dùng ẩn danh" : (currentUser?.name || "Người dùng");
    const postAuthorAvatar = isAnonymous ? "https://arbrealettres.wordpress.com/wp-content/uploads/2018/07/anonyme.png" : (currentUser?.avatar || "");
    const postRole = currentUser?.role || "student";

    if (editingPostId) {
      // --- LOGIC CHỈNH SỬA BÀI VIẾT ---
      await updateDoc(doc(db, "posts", editingPostId), {
        content: newPostText,
        author: postAuthorName,
        avatar: postAuthorAvatar,
        isAnonymous: isAnonymous,
        ...(selectedImage ? { image: selectedImage, video: null } : {}), 
        ...(selectedVideo ? { video: selectedVideo, image: null } : {})
      });
      setEditingPostId(null);
    } else {
      const now = Timestamp.now();

await addDoc(collection(db, "posts"), {
  author: postAuthorName,
  avatar: postAuthorAvatar,
  userId: currentUser.id,
  role: postRole,
  authorRole: postRole,
  isAnonymous,
  content: newPostText,
  image: selectedImage || null,
  video: selectedVideo || null,
  time: now,
  createdAt: now,
  likedBy: [],
  likes: 0,
  comments: 0
});
    }

    // 3. Reset toàn bộ form sau khi đăng thành công
    setModalVisible(false);
    setNewPostText("");
    setSelectedImage(null);
    setSelectedVideo(null);
    setIsAnonymous(false); // Trở về mặc định không ẩn danh
  } catch (error) {
    console.error("Lỗi đăng bài lên Firebase:", error);
    Alert.alert("Lỗi", "Không thể đăng bài viết, vui lòng thử lại!");
  } finally {
    setIsPosting(false);
  }
};

  const handleShare = async (content) => {
    try { await Share.share({ message: `Xem bài viết này trên BDU Social:\n\n"${content}"` }); } catch (error) {}
  };

  const handlePostOptions = (item) => {

  const isOwner = currentUser.id === item.userId;
  const isAdmin = currentUser.role === "admin";

  const buttons = [];

  // Chủ bài viết mới được sửa
  if (isOwner) {
    buttons.push({
      text: "Chỉnh sửa",
      onPress: () => {
        setNewPostText(item.content);
        setSelectedImage(item.image || null);
        setSelectedVideo(item.video || null);
        setEditingPostId(item.id);
        setModalVisible(true);
      }
    });
  }

  // Chủ bài viết hoặc Admin được xóa
  if (isOwner || isAdmin) {
  buttons.push({
    text: "Xóa bài viết",
    style: "destructive",
    onPress: () => deletePost(item)
  });
}

  buttons.push({
    text: "Hủy",
    style: "cancel"
  });

  Alert.alert(
    "Tùy chọn",
    "Bạn muốn làm gì?",
    buttons
  );
};

  const openCommentModal = (post) => {
  setComments([]);            // reset ngay
  setActivePost(post);
  setCommentModalVisible(true);
  setEditingCommentId(null);
  setReplyingTo(null);
  setCommentText("");
};


  // TÍNH NĂNG MỚI: Hàm xử lý nút Kết bạn
  const handleAddFriend = async (targetUser) => {
  try {
    // Thêm dấu ?. ở đây để an toàn
    const existingRequestId = sentRequests?.[targetUser.userId]; 
    if (existingRequestId) {
      // Hủy kết bạn
      await deleteDoc(doc(db, "friend_requests", existingRequestId));

      // Hiện popup nhẹ thông báo Hủy thành công
      Toast.show({
        type: 'info',
        text1: 'Đã thu hồi lời mời kết bạn!',
        visibilityTime: 1500,
      });
    } else {
      // Gửi kết bạn mới
      await addDoc(collection(db,"friend_requests"),{

fromUserId:currentUser.id,
toUserId:targetUser.userId,
status:"pending",
time:Timestamp.now()

})

      // Hiện popup nhẹ thông báo Gửi thành công
      Toast.show({
        type: 'success',
        text1: 'Đã gửi lời mời kết bạn!',
        visibilityTime: 1500,
      });
    }
  } catch (error) {
    console.log("Lỗi xử lý kết bạn:", error);
    Toast.show({
      type: 'error',
      text1: 'Có lỗi xảy ra, vui lòng thử lại!',
    });
  }
};
// DÁN ĐOẠN NÀY DƯỚI HÀM handleAddFriend CỦA BẠN
const handleLikePost = async (postId, likedByArray = []) => {
  if (!currentUser?.id || currentUser.id === 'guest') {
    Alert.alert("Thông báo", "Bạn cần đăng nhập để thực hiện tính năng này!");
    return;
  }

  const postRef = doc(db, "posts", postId);
  // Đảm bảo likedByArray luôn là một mảng hợp lệ
  const safeLikedBy = Array.isArray(likedByArray) ? likedByArray : [];
  const hasLiked = safeLikedBy.includes(currentUser.id);

  try {
    if (hasLiked) {
      // Nếu đã thích trước đó -> Bấm lại nghĩa là BỎ THÍCH
      await updateDoc(postRef, {
        likedBy: arrayRemove(currentUser.id), // Xóa UID khỏi mảng danh sách thích
        likes: increment(-1) // Giảm số lượng lượt thích đi 1
      });
    } else {
      // Nếu chưa thích -> Bấm để THÍCH
      await updateDoc(postRef, {
        likedBy: arrayUnion(currentUser.id), // Thêm UID vào mảng danh sách thích
        likes: increment(1) // Tăng số lượng lượt thích lên 1
      });
    }
  } catch (error) {
    console.error("Lỗi khi xử lý Like bài viết:", error);
  }
};

  useEffect(() => {
    if (!activePost?.id) {
        setComments([]);
        return;
    }

    const q = query(
        collection(db, "posts", activePost.id, "comments"),
        orderBy("time", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        setComments(data);
    });

    return unsubscribe;
}, [activePost?.id]);

  const handleSendComment = async () => {
  if (commentText.trim() === "") return;

  setIsCommenting(true);
  setSendingComment(true);

  try {
    if (editingCommentId) {
      await updateDoc(
        doc(db, "posts", activePost.id, "comments", editingCommentId),
        { text: commentText }
      );

      setEditingCommentId(null);

    } else {
      await addDoc(
        collection(db, "posts", activePost.id, "comments"),
        {
          author: currentUser.name,
          avatar: currentUser.avatar,
          userId: currentUser.id,
          text: commentText,
          time: Timestamp.now(),
          parentId: replyingTo ? replyingTo.id : null,
        }
      );

      if (!replyingTo) {
        await updateDoc(doc(db, "posts", activePost.id), {
          comments: increment(1)
        });
      }
    }

    setCommentText("");
    setReplyingTo(null);
    Keyboard.dismiss();

    Toast.show({
  type: "success",
  text1: "Đã đăng bình luận",
  position: "top",
  visibilityTime: 1500,
  topOffset: 70,
});

  } catch (error) {
    Toast.show({
      type: "error",
      text1: "Không thể gửi bình luận",
      position: "bottom",
    });

    console.log(error);
  } finally {
    setIsCommenting(false);
    setSendingComment(false);
  }
};

  const handleCommentOptions = (cmt) => {
    Alert.alert("Tùy chọn bình luận", "Bạn muốn làm gì?", [
      { text: "Chỉnh sửa", onPress: () => { setCommentText(cmt.text); setEditingCommentId(cmt.id); setReplyingTo(null); } },
      { text: "Xóa", style: "destructive", onPress: async () => {
          Alert.alert("Xác nhận", "Xóa bình luận này?", [
            { text: "Hủy", style: "cancel" },
            { text: "Xóa", style: "destructive", onPress: async () => {
                await deleteDoc(doc(db, "posts", activePost.id, "comments", cmt.id));
                if(!cmt.parentId) await updateDoc(doc(db, "posts", activePost.id), { comments: increment(-1) });
              }
            }
          ]);
        }
      },
      { text: "Hủy", style: "cancel" }
    ]);
  };

 const renderListHeader = () => {
  return (
    <View style={styles.headerWrapper}>
      {/* 1. KHU VỰC Ô ĐĂNG BÀI (Full viền trắng, gọn gàng) */}
      <View style={styles.createPostCard}>
        
        {/* Hàng 1: Avatar và Ô nhập liệu */}
        <View style={styles.inputSection}>
          <Image 
            source={{ uri: currentUser?.avatar?.trim() ? currentUser.avatar : DEFAULT_AVATAR }} 
            style={styles.userAvatar} 
          />
          <TouchableOpacity 
            style={styles.inputButton} 
            activeOpacity={0.6} // Tăng hiệu ứng mờ khi bấm để có animation nhẹ
            onPress={() => {
              setNewPostText(""); 
              setSelectedImage(null); 
              setSelectedVideo(null); 
              setEditingPostId(null); 
              setModalVisible(true);
            }}
          >
            <Text style={styles.inputText}>
              {`Bạn đang nghĩ gì, ${currentUser?.name ? currentUser.name.split(' ').pop() : ''}?`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hàng 2: Các nút chức năng (Chỉ giữ Ảnh/Video và Chụp ảnh) */}
        <View style={styles.createActions}>
          <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.5} onPress={pickImage}>
            <Ionicons name="images" size={24} color="#45BD62" />
            <Text style={styles.createActionText}>Ảnh / Video</Text>
          </TouchableOpacity>
          
          {/* Đường kẻ dọc chia đôi 2 nút cho rõ ràng */}
          <View style={styles.verticalDivider} />

          <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.5} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color="#0084FF" />
            <Text style={styles.createActionText}>Chụp ảnh</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* DẢI PHÂN CÁCH DÀY - BÍ QUYẾT ĐỂ TÁCH BIỆT CÁC KHỐI */}
      <View style={styles.thickDivider} />

      {/* KHU VỰC STORY SẼ NẰM Ở ĐÂY NẾU BẠN THÊM VÀO */}
      {/* <StorySection /> */}
      {/* <View style={styles.thickDivider} /> */}

      {/* 2. THẺ THÔNG BÁO HỆ THỐNG */}
      <SystemNotice />
      
    </View>
  );
};

 return (
    <>
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: '#FFF', flex: 1 }]}>
        <Tabs.Screen options={{ headerShown: false }} />
        {/* Tối ưu thanh Status Bar tone sáng để clean hơn */}
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent={Platform.OS === 'android' ? false : true} />
        
        {/* Bọc toàn bộ nội dung trong View nền BDU_BG */}
        <View style={{ flex: 1, backgroundColor: BDU_BG }}>
          
          {/* =======================================================
              HEADER CHUẨN TONE FLAT TỐI GIẢN (Giống màn Match)
              ======================================================= */}
          <View style={styles.appHeaderFlat}>
  <View style={styles.headerTitleContainer}>
    
    {/* KHỐI BỌC TOÀN BỘ LOGO VÀ CHỮ */}
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center' 
    }}>
      
      {/* 1. HÌNH ẢNH LOGO (Chữ B trong hình tròn đỏ) */}
      <Image 
        source={require('../assets/images/logo-bdu.png')} 
        style={{ 
          width: 46,   // Chỉnh kích thước to lên một chút để cân đối với 2 dòng chữ
          height: 46 
        }} 
        resizeMode="contain" 
      />

      {/* 2. KHỐI CHỨA CHỮ BÊN PHẢI */}
      <View style={{ 
        marginLeft: 1.5,        // Tạo khoảng cách hở với logo cho thoáng giống hình
        justifyContent: 'center',
      }}>
        
        {/* DÒNG 1: Chữ "BDUSocial" */}
        {/* Dùng 1 thẻ Text bọc ngoài để 2 chữ tự động nằm sát ngang hàng nhau */}
        <Text style={{ 
          fontSize: 24, 
          fontWeight: '900', 
          letterSpacing: -1.5, // Ép chữ hơi sát lại cho mạnh mẽ
          lineHeight: 28,      // Cố định chiều cao dòng để không bị lệch
        }}>
          {/* Mẹo: Dùng textShadowColor trùng với màu chữ để "đắp" thêm độ dày cho nét */}
          <Text style={{ 
            color: '#fc0707',
            textShadowColor: '#fc0707', 
            textShadowOffset: { width: 0.5, height: 0.5 },
            textShadowRadius: 0.5
          }}>BDU</Text>

          <Text style={{ 
            color: '#1A1A1A',
            textShadowColor: '#1A1A1A', 
            textShadowOffset: { width: 0.5, height: 0.5 },
            textShadowRadius: 0.5
          }}>Social</Text>
        </Text>

        {/* DÒNG 2: Slogan "KẾT NỐI - CHIA SẺ" */}
        <Text style={{ 
          fontSize: 10, 
          fontWeight: '900',   // Đã nâng từ 700 lên 900 để chữ đậm đà hơn
          color: '#8A8D91',    // Màu xám trung tính tĩnh chuẩn thiết kế
          letterSpacing: 2.5,  // Kéo giãn khoảng cách giữa các chữ cái ra xa nhau
          marginTop: -2        // Kéo xích lên một chút cho sát với dòng trên
        }}>
          KẾT NỐI - CHIA SẺ
        </Text>
        
      </View>
    </View>

          {/* Tôi đã tạm ẩn dòng chữ phụ đi vì logo của bác đã có chữ rồi. 
              Nếu bác vẫn muốn giữ, hãy bỏ dấu comment (//) ở dưới nhé */}
          {/* <Text style={styles.headerSubFlat}>Kết nối đam mê</Text> */}
          
        </View>
            
            {/* Cụm nút Action bên phải */}
          <View style={{ position: 'absolute', right: 16, flexDirection: 'row', gap: 8 }}>
            
          {/* 1. NÚT DANH SÁCH BẠN BÈ */}
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => router.push('/FriendsScreen')} 
              style={styles.actionIconBtn}
            >
              <Ionicons 
                name="people-circle-outline" // Tên chuẩn 100%
                size={25} 
                color="#fc0707" 
              />
            </TouchableOpacity>

            {/* 2. NÚT TIN NHẮN (ĐOẠN BẠN MUỐN THÊM VÀO) */}
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => router.push('/messages')} 
              style={styles.actionIconBtn}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={23} color="#1A1A1A" />
            </TouchableOpacity>

          </View>
        </View>

        {/* =======================================================
  {/* =======================================================
    TOP NAVIGATION NGANG (5 TAB: BẢNG TIN, MATCH, THÔNG BÁO, PROFILE, MENU)
    ======================================================= */}
<View style={styles.topMenuBar}>
  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false} 
    contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}
  >
    {/* Tab 1: Bảng tin */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'feed' && styles.menuTabItemActive]} 
      activeOpacity={0.8}
      onPress={() => setActiveTab('feed')}
    >
      <Ionicons name="home" size={20} color={activeTab === 'feed' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'feed' && styles.menuTabTextActive]}>Bảng tin</Text>
    </TouchableOpacity>

    {/* Tab 2: Match */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'match' && styles.menuTabItemActive]} 
      activeOpacity={0.7}
      onPress={() => {
        setActiveTab('match');
        router.replace('/match');
      }}
    >
      <Ionicons name="people-outline" size={20} color={activeTab === 'match' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'match' && styles.menuTabTextActive]}>Match</Text>
    </TouchableOpacity>

    {/* Tab 3: Thông báo */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'notification' && styles.menuTabItemActive]} 
      activeOpacity={0.7}
      onPress={() => {
        setActiveTab('notification');
        setNotificationModalVisible(true);
      }}
    >
      <View style={{ position: 'relative' }}>
        <Ionicons name="notifications-outline" size={20} color={activeTab === 'notification' ? BDU_RED : "#65676B"} />
        {notifications && notifications.length > 0 && <View style={styles.smallBadgeDot} />}
      </View>
      <Text style={[styles.menuTabText, activeTab === 'notification' && styles.menuTabTextActive]}>Thông báo</Text>
    </TouchableOpacity>

    {/* Tab 4: Cá nhân */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'profile' && styles.menuTabItemActive]} 
      activeOpacity={0.7}
      onPress={() => {
        setActiveTab('profile');
        router.push('/profile');
      }}
    >
      <Ionicons name="person-outline" size={20} color={activeTab === 'profile' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'profile' && styles.menuTabTextActive]}>Cá nhân</Text>
    </TouchableOpacity>

    {/* Tab 5: Menu */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'menu' && styles.menuTabItemActive]} 
      activeOpacity={0.7}
      onPress={() => {
        setActiveTab('menu');
        setMenuVisible(true);
      }}
    >
      <Ionicons name="menu-outline" size={20} color={activeTab === 'menu' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'menu' && styles.menuTabTextActive]}>Menu</Text>
    </TouchableOpacity>
  </ScrollView>
</View> 
          {/* =======================================================
              NỀN BẢNG TIN (Khu vực cuộn FlatList)
              ======================================================= */}
          <View style={styles.feedWrapper}>
            {loading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <ActivityIndicator size="large" color={BDU_RED} />
                <Text style={{ marginTop: 16, color: '#65676B', fontSize: 15, fontWeight: '500' }}>Đang tải bảng tin...</Text>
              </View>
            ) : (
              <FlatList
                data={(posts && posts.length > 0) ? posts : MOCK_POSTS} 
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                renderItem={({ item }) => (
                  <PostItem 
                    item={item} 
                    handlePostOptions={handlePostOptions} 
                    handleShare={handleShare} 
                    openCommentModal={openCommentModal} 
                    visibleItemIds={visibleItemIds}
                    currentUser={currentUser}
                    handleAddFriend={handleAddFriend}
                    sentRequests={sentRequests} 
                    myFriends={myFriends}
                  />
                )}
                keyExtractor={item => item.id}
                ListHeaderComponent={renderListHeader}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 30 }}
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={10}
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BDU_RED} colors={[BDU_RED]} /> }
              />
            )}
          </View>

          {/* =======================================================
          {/* =======================================================
              CÁC MODAL ĐƯỢC GIỮ NGUYÊN BÊN DƯỚI NÀY
              ======================================================= */}
              
          {/* 1. GIAO DIỆN MODAL ĐĂNG BÀI */}
          <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => { setModalVisible(false); setEditingPostId(null); setSelectedImage(null); setSelectedVideo(null); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => { setModalVisible(false); setEditingPostId(null); setSelectedImage(null); setSelectedVideo(null); }} style={{ padding: 5 }}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{editingPostId ? "Sửa bài viết" : "Tạo bài viết"}</Text>
                  <TouchableOpacity onPress={handleCreatePost} disabled={isPosting || (newPostText.trim() === "" && !selectedImage && !selectedVideo)}>
                    <Text style={[styles.postButtonText, (isPosting || (newPostText.trim() === "" && !selectedImage && !selectedVideo)) && { color: '#FFB3B3' }]}>{isPosting ? "Đang xử lý..." : "XONG"}</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 16 }}>
                  <View style={styles.modalUserInfo}>
                    <Image source={{ uri: currentUser?.avatar }} style={styles.userAvatar} />
                    
                    <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 4 }}>
                      <Text style={[styles.modalUserName, { marginTop: 6, marginBottom: 2 }]}>
                        {currentUser?.name}
                      </Text>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#65676B', marginRight: 8 }}>
                          Đăng ẩn danh
                        </Text>
                        <Switch 
                          value={isAnonymous} 
                          onValueChange={setIsAnonymous}
                          trackColor={{ false: "#CCD0D5", true: "#C8102E" }}
                          thumbColor={"#FFF"}
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} 
                        />
                      </View>
                    </View>
                  </View>

                  <TextInput style={styles.textInput} placeholder="Bạn đang nghĩ gì?" placeholderTextColor="#8A8D91" multiline autoFocus value={newPostText} onChangeText={setNewPostText} />

                  {selectedImage && (
                    <View style={styles.previewImageContainer}>
                      <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.removeImageBtn} activeOpacity={0.7} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close" size={20} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {selectedVideo && (
                    <View style={styles.previewImageContainer}>
                      <Video source={{ uri: selectedVideo }} style={styles.previewImage} resizeMode={ResizeMode.COVER} isLooping shouldPlay={true} isMuted />
                      <TouchableOpacity style={styles.removeImageBtn} activeOpacity={0.7} onPress={() => setSelectedVideo(null)}>
                        <Ionicons name="close" size={20} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalTools}>
                  <TouchableOpacity onPress={pickImage} style={styles.toolBtn} activeOpacity={0.7}><Ionicons name="image" size={24} color="#45BD62" /><Text style={styles.toolBtnText}>Thêm</Text></TouchableOpacity>
                  <TouchableOpacity onPress={takePhoto} style={styles.toolBtn} activeOpacity={0.7}><Ionicons name="camera" size={24} color="#0084FF" /><Text style={styles.toolBtnText}>Chụp / Quay</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* 2. MODAL BÌNH LUẬN */}
          <Modal visible={commentModalVisible} animationType="slide" transparent onRequestClose={() => setCommentModalVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
              <View style={styles.commentModalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Bình luận</Text>
                  <View style={{ width: 28 }} />
                </View>

                <FlatList
                  data={comments}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <CommentItem
                      cmt={item}
                      isReply={false}
                      handleCommentOptions={handleCommentOptions}
                      handleReply={() => setReplyingTo(item)}
                      currentUser={currentUser}
                      activePostId={activePost?.id}
                    />
                  )}
                  contentContainerStyle={{ padding: 15 }}
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 30, color: "#888" }}>Chưa có bình luận</Text>}
                />

                <View style={styles.commentInputWrapper}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Viết bình luận..."
                    value={commentText}
                    onChangeText={setCommentText}
                  />
                  <TouchableOpacity disabled={isCommenting} onPress={handleSendComment} activeOpacity={0.7}>
                    {isCommenting ? (
                      <ActivityIndicator size="small" color={BDU_RED} />
                    ) : (
                      <Ionicons name="send" size={24} color={BDU_RED} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* 3. MODAL THÔNG BÁO */}
          <Modal visible={notificationModalVisible} animationType="slide" transparent={true} onRequestClose={() => setNotificationModalVisible(false)}>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(240, 237, 237, 0)' }]}> 
              <View style={[styles.modalContent, { height: '80%' }]}>
                <View style={styles.modalHeader}>
                  <View style={{ width: 28 }} />
                  <Text style={styles.modalTitle}>Thông báo</Text>
                  <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={{ padding: 5 }}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={notifications}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.7} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', flexDirection: 'row', backgroundColor: item.isRead ? '#FFF' : '#E8F4FF' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E4E6EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="notifications" size={20} color={BDU_RED} />
                      </View>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 15, color: '#1A1A1A', fontWeight: item.isRead ? 'normal' : '600' }}>
                          {item.content || item.message || "Bạn có thông báo mới."}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#8A8D91', marginTop: 4 }}>{getTimeAgo(item.time)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#8A8D91', fontSize: 15 }}>Hiện chưa có thông báo mới nào.</Text>}
                />
              </View>
            </View>
          </Modal>

          {/* 4. MODAL MENU XỔ LÊN */}
          <Modal animationType="slide" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
            {/* Đã gỡ bỏ lớp nền đen mờ ở đây */}
            <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: 'transparent' }]} activeOpacity={1} onPress={() => setMenuVisible(false)} />
            
            <View style={styles.menuContainer}>
              <View style={styles.dragIndicator} /> 
              <Text style={styles.menuHeaderTitle}>Menu</Text>

              <TouchableOpacity 
                style={styles.menuItem} 
                activeOpacity={0.7}
                onPress={() => {
                  setMenuVisible(false);
                  router.push('/FriendListScreen');
                }}
              >
                <View style={[styles.iconBox, { backgroundColor: '#E7F3FF' }]}>
                  <Ionicons name="people" size={24} color="#0866FF" />
                </View>
                <Text style={styles.menuItemText}>Danh sách bạn bè</Text>
                <Ionicons name="chevron-forward" size={20} color="#65676B" style={styles.arrowIcon} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => {
                Alert.alert("Đăng xuất", "Bạn có muốn thoát tài khoản không?", [
                    { text: "Hủy", style: "cancel" },
                    { text: "Đăng xuất", style: "destructive", onPress: () => router.replace('/') }
                ]);
              }}>
                <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="log-out-outline" size={24} color={BDU_RED} />
                </View>
                <Text style={styles.menuItemText}>Đăng xuất</Text>
                <Ionicons name="chevron-forward" size={20} color="#65676B" style={styles.arrowIcon} />
              </TouchableOpacity>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
      <Toast />
    </>
  );
};
const styles = StyleSheet.create({

  // ==========================================
  // TOP NAVIGATION NGANG
  // ==========================================
  // ==========================================
  // NAVIGATION TRƯỢT NGANG (TOP MENU BAR)
  // ==========================================
  topMenuBar: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
  },
  menuTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8, // Khoảng cách giữa các nút
    backgroundColor: '#F0F2F5', // Nền xám nhạt cho tab chưa chọn
    borderRadius: 20, // Bo tròn dạng viên thuốc
  },
  menuTabItemActive: {
    backgroundColor: 'rgba(228, 30, 38, 0.1)', // Nền đỏ mờ (BDU_RED) cho tab đang chọn
  },
  menuTabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#65676B',
  },
  menuTabTextActive: {
    color: BDU_RED, // Chữ đỏ cho tab đang chọn
  },
  smallBadgeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BDU_RED,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  // ==========================================
  // CÁC STYLE BỔ SUNG CHO TÍNH NĂNG MỚI (NOTICE)
  // ==========================================
  noticeCard: {
    backgroundColor: '#FFF',
    borderLeftWidth: 5,
    borderLeftColor: '#C8102E', // Màu đỏ BDU làm điểm nhấn
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  noticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  noticeAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    backgroundColor: '#F4F6F9',
  },
  noticeAuthor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  noticeTime: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  noticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C8102E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  noticeBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  noticeContent: {
    fontSize: 14,
    color: '#2C2C2E',
    lineHeight: 20,
    fontWeight: '500',
  },

  // ==========================================
  // MENU XỔ LÊN
  // ==========================================
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#CCD0D5',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 15,
  },
  menuHeaderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#050505',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#050505',
    flex: 1,
  },
  arrowIcon: {
    marginLeft: 'auto',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF0000',
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },

  // -- Nút kết bạn --
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BDU_RED, 
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: 8,
  },
  addFriendBtnSent: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  addFriendText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  addFriendTextSent: {
    color: '#34C759',
  },

  // ==========================================
  // LAYOUT CHÍNH & HEADER
  // ==========================================
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  
  // BƠM VÀO: Nền của toàn bộ danh sách cuộn phải là màu XÁM
  feedWrapper: { 
    flex: 1, 
    backgroundColor: '#F0F2F5' 
  },

  // --- STYLE CHO HEADER FLAT MỚI ---
  appHeaderFlat: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    paddingHorizontal: 16,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logoFlat: {
    fontSize: 24,
    fontWeight: '900',
    color: '#C8102E',
    letterSpacing: -0.8,
    textTransform: 'uppercase',
  },
  headerSubFlat: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8D91',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 16, 46, 0.08)',
    borderRadius: 20,
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C8102E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // ==========================================
  // CREATE POST CARD (ĐÃ BƠM CSS MỚI ĐỂ CẮT DÍNH LIỀN)
  // ==========================================
  // Wrapper bọc header đăng bài
  headerWrapper: {
    backgroundColor: '#F0F2F5',
  },
  createPostCard: {
    backgroundColor: '#FFFFFF', // Trắng tinh để nổi bật trên nền xám
    paddingTop: 16,
    // Đã xóa borderRadius và margin để phẳng sát màn hình
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  userAvatar: {
    width: 44, // Avatar to xịn hơn
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E4E6EB', // Viền mờ bao quanh avatar
  },
  inputButton: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#F0F2F5',
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 22, // Bo góc tròn xoe dạng viên thuốc
  },
  inputText: {
    color: '#65676B',
    fontSize: 15,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F5',
    marginBottom: 12,
  },
  createActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
    paddingVertical: 8,
  },
  createActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  createActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#65676B',
  },
  // BƠM VÀO: Kẻ sọc giữa các nút đăng bài
  verticalDivider: {
    width: 1,
    backgroundColor: '#E4E6EB',
    marginVertical: 6,
  },

  // BƠM VÀO: DẢI PHÂN CÁCH DÀY (CỨU TINH CHỐNG RỐI MẮT)
  thickDivider: {
    height: 10,
    backgroundColor: '#F0F2F5',
    width: '100%',
  },

  // ==========================================
  // POST CARD & MEDIA
  // ==========================================
  // BƠM VÀO: THẺ BÀI VIẾT PHẲNG (Dùng class này cho PostItem để hết dính liền)
  postContainer: { // Tên class này bạn dò đúng tên trong code của bạn nhé
    backgroundColor: '#FFFFFF',
    borderRadius: 16, // Độ cong của góc (giữ nguyên theo code cũ của bạn)
    marginHorizontal: 12,
    marginBottom: 16,
    
    // 🔴 THÊM 2 DÒNG NÀY ĐỂ TẠO VIỀN ĐỎ:
    borderWidth: 1.5, // Độ dày của viền (có thể chỉnh 1 hoặc 2 tùy mắt thẩm mỹ)
    borderColor: '#fc0707', // Màu đỏ thương hiệu của bạn (hoặc dùng '#C8102E')
    
    // (Tùy chọn) Nếu bạn muốn viền nó mờ mờ tinh tế hơn, không bị chói quá thì dùng dòng này:
    // borderColor: 'rgba(252, 7, 7, 0.4)', 

    // Các thuộc tính đổ bóng cũ của bạn cứ giữ nguyên ở dưới...
    elevation: 2,
    shadowColor: '#ff0000',
    // ...
  },
  
  // Vẫn giữ lại thẻ cũ phòng hờ nếu bạn đang dùng nó ở đâu đó (Không xóa gì cả)
 // --- BÀI VIẾT ĐANG DÙNG CLASS NÀY ---
  postCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 16,
    
    // 🔴 CHỈNH SỬA TẠI ĐÂY:
    borderWidth: 1,       // Đổi thành 1.5 cho rõ viền
    borderColor: '#ff4a4a', // 🔴 ĐỔI TỪ '#ff7113' THÀNH MÀU ĐỎ NÀY!

    // Đổ bóng màu đỏ mờ cho "tone sur tone"
    shadowColor: '#fffefe', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: '#E4E6EB',
  },
  postInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  postAuthor: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1E21',
    marginRight: 8,
  },
  postTime: {
    fontSize: 13,
    color: '#8A8D91',
    fontWeight: '400',
  },
  moreBtn: {
    padding: 6,
  },
  postContent: {
    fontSize: 15,
    color: '#1C1E21',
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F0F2F5', 
  },

  // --- VIDEO ---
  videoContainer: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: '#000', elevation: 2, position: 'relative' },
  postVideo: { width: '100%', height: 250, position: 'relative' },
  muteBtn: { position: 'absolute', bottom: 15, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 15 },
  fullscreenBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 15 },
  playIconOverlay: { position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -20}, {translateY: -20}], backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  progressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressBarFill: { height: '100%', backgroundColor: BDU_RED },

  // --- THỐNG KÊ & TƯƠNG TÁC ---
  postStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }, 
  statsLeft: { flexDirection: 'row', alignItems: 'center' },
  likeIconBg: { backgroundColor: BDU_RED, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  statsText: { color: '#65676B', fontSize: 14, marginLeft: 6, fontWeight: '500' },
  
  postDivider: {
    height: 1,
    backgroundColor: '#E4E6EB',
    marginHorizontal: 16,
  },
  postActions: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  pillBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#F4F6F9', borderRadius: 12 },
  actionText: { color: '#4A4A4A', marginLeft: 6, fontWeight: '600', fontSize: 14 },

  // ==========================================
  // BOTTOM FOOTER CHUẨN ĐỎ - TRẮNG
  // ==========================================
  bottomFooterBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#FFF', height: 50, borderTopWidth: 1, borderTopColor: '#EAEAEA', paddingBottom: Platform.OS === 'ios' ? 10 : 0 },
  footerTab: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  footerTabText: { fontSize: 9.5, color: '#8A8D91', marginTop: 2, fontWeight: '500' },
  footerBadge: { position: 'absolute', top: -2, right: 25, backgroundColor: BDU_RED, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFF' },
  footerBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },

  // ==========================================
  // MODAL (TẠO BÀI VIẾT / PREVIEW)
  // ==========================================
  modalOverlay: {flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end', },
  modalContent: { backgroundColor: '#F4F6F9', height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BDU_RED, paddingVertical: 16, paddingHorizontal: 20, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  postButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  modalUserInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalUserName: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  textInput: { fontSize: 18, color: '#1A1A1A', textAlignVertical: 'top', minHeight: 80 },
  previewImageContainer: { position: 'relative', marginTop: 15, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
  previewImage: { width: '100%', height: 250, resizeMode: 'cover' },
  removeImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  modalTools: { flexDirection: 'row', gap: 15, borderTopWidth: 1, borderTopColor: '#E4E6EB', paddingVertical: 15, paddingHorizontal: 16, backgroundColor: '#FFF' },
  toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F9', paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: '#E4E6EB' },
  toolBtnText: { marginLeft: 8, fontWeight: '700', color: '#4A4A4A' },

  // ==========================================
  // COMMENTS
  // ==========================================
  commentModalContainer: {
    backgroundColor: '#FFF',
    height: '65%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: BDU_RED, paddingVertical: 15, position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  closeCommentBtn: { position: 'absolute', right: 15 },
  commentItem: { flexDirection: 'row', marginBottom: 15 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: '#E4E6EB' },
  commentBubble: { backgroundColor: '#F0F2F5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexShrink: 1, alignSelf: 'flex-start' },
  commentAuthor: { fontWeight: '800', fontSize: 13, color: '#1A1A1A', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#2C2C2C', lineHeight: 20 },
  commentActionsWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 10, gap: 10 },
  commentTimeText: { fontSize: 12, color: '#8A8D91', fontWeight: '500' },
  commentActionText: { fontSize: 12, color: '#65676B', fontWeight: '700' },
  emptyCommentText: { textAlign: 'center', color: '#8A8D91', marginTop: 40, fontSize: 15, fontStyle: 'italic' },
  
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0F2F5', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E4E6EB' },
  replyBannerText: { fontSize: 13, color: '#65676B', fontWeight: '600' },
  replyCommentItem: { 
    marginLeft: 45, 
    marginTop: 2, 
    paddingLeft: 10, 
    borderLeftWidth: 2, 
    borderLeftColor: '#E4E6EB', 
  },
  
  commentInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#FFF",
  },
  commentInputAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, marginBottom: 5 },
  commentInput: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  sendCommentBtn: { padding: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 5 }
  
});