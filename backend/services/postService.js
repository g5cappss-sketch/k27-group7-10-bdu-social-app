import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  increment, 
  arrayUnion, 
  arrayRemove, 
  Timestamp 
} from "firebase/firestore";

/**
 * Service xử lý toàn bộ logic liên quan đến Bài viết (Posts) và Bình luận (Comments)
 * Kiến trúc: Tách biệt UI (Giao diện) và Data Layer (Lớp dữ liệu)
 */

// ==========================================
// 1. TẠO BÀI VIẾT MỚI
// ==========================================
export const createPost = async (db, currentUser, postData) => {
  const { content, image, video, isAnonymous } = postData;
  
  if (content.trim() === "" && !image && !video) throw new Error("Nội dung rỗng");

  const postAuthorName = isAnonymous ? "Người dùng ẩn danh" : (currentUser?.name || "Người dùng");
  const postAuthorAvatar = isAnonymous 
      ? "https://arbrealettres.wordpress.com/wp-content/uploads/2018/07/anonyme.png" 
      : (currentUser?.avatar || "");
  const postRole = currentUser?.role || "student";
  const now = Timestamp.now();

  try {
    const docRef = await addDoc(collection(db, "posts"), {
      author: postAuthorName,
      avatar: postAuthorAvatar,
      userId: currentUser.id,
      role: postRole,
      authorRole: postRole,
      isAnonymous,
      content,
      image: image || null,
      video: video || null,
      time: now,
      createdAt: now,
      likedBy: [],
      likes: 0,
      comments: 0
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi PostService - createPost:", error);
    throw error;
  }
};

// ==========================================
// 2. CẬP NHẬT BÀI VIẾT
// ==========================================
export const updatePost = async (db, postId, updateData) => {
  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, updateData);
    return { success: true };
  } catch (error) {
    console.error("Lỗi PostService - updatePost:", error);
    throw error;
  }
};

// ==========================================
// 3. XÓA BÀI VIẾT
// ==========================================
export const deletePost = async (db, postId) => {
  try {
    await deleteDoc(doc(db, "posts", postId));
    return { success: true };
  } catch (error) {
    console.error("Lỗi PostService - deletePost:", error);
    throw error;
  }
};

// ==========================================
// 4. THÍCH / BỎ THÍCH BÀI VIẾT
// ==========================================
export const toggleLikePost = async (db, postId, userId, hasLiked) => {
  if (!userId || userId === 'guest') throw new Error("Chưa đăng nhập");

  const postRef = doc(db, "posts", postId);

  try {
    if (hasLiked) {
      await updateDoc(postRef, {
        likedBy: arrayRemove(userId),
        likes: increment(-1)
      });
    } else {
      await updateDoc(postRef, {
        likedBy: arrayUnion(userId),
        likes: increment(1)
      });
    }
    return { success: true, action: hasLiked ? "unliked" : "liked" };
  } catch (error) {
    console.error("Lỗi PostService - toggleLikePost:", error);
    throw error;
  }
};

// ==========================================
// 5. THÊM BÌNH LUẬN MỚI
// ==========================================
export const addComment = async (db, postId, currentUser, commentData) => {
  const { text, parentId } = commentData;
  if (text.trim() === "") throw new Error("Bình luận rỗng");

  try {
    const docRef = await addDoc(collection(db, "posts", postId, "comments"), {
      author: currentUser.name,
      avatar: currentUser.avatar,
      userId: currentUser.id,
      text: text,
      time: Timestamp.now(),
      parentId: parentId || null,
    });

    // Nếu là bình luận gốc (không phải reply), tăng tổng số comment của bài viết
    if (!parentId) {
      await updateDoc(doc(db, "posts", postId), {
        comments: increment(1)
      });
    }
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Lỗi PostService - addComment:", error);
    throw error;
  }
};

// ==========================================
// 6. CẬP NHẬT/XÓA BÌNH LUẬN
// ==========================================
export const updateComment = async (db, postId, commentId, newText) => {
  try {
    await updateDoc(doc(db, "posts", postId, "comments", commentId), { text: newText });
    return { success: true };
  } catch (error) {
    console.error("Lỗi PostService - updateComment:", error);
    throw error;
  }
};

export const removeComment = async (db, postId, commentId, isParent) => {
  try {
    await deleteDoc(doc(db, "posts", postId, "comments", commentId));
    if (isParent) {
      await updateDoc(doc(db, "posts", postId), { comments: increment(-1) });
    }
    return { success: true };
  } catch (error) {
    console.error("Lỗi PostService - removeComment:", error);
    throw error;
  }
};