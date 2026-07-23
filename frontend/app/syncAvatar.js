import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../BDU_SocialApp/firebaseConfig"; // sửa đường dẫn nếu khác

export const syncAvatarToPosts = async (userId, newAvatar) => {
  try {
    // 1. Lấy tất cả bài viết của user
    const postQuery = query(
      collection(db, "posts"),
      where("userId", "==", userId)
    );

    const postSnapshot = await getDocs(postQuery);

    for (const post of postSnapshot.docs) {
      const postData = post.data();

      // CẬP NHẬT BÀI VIẾT: Chỉ đồng bộ nếu KHÔNG PHẢI là bài viết ẩn danh
      // Lưu ý: Đổi chữ 'isAnonymous' thành đúng tên field ẩn danh trong database của bạn nếu khác
      if (!postData.isAnonymous) {
        await updateDoc(post.ref, {
          avatar: newAvatar,
        });
      }

      // 2. Lấy tất cả bình luận trong bài viết đó (bất kể của ai)
      const commentsSnapshot = await getDocs(
        collection(db, "posts", post.id, "comments")
      );

      for (const comment of commentsSnapshot.docs) {
        const commentData = comment.data();

        // CẬP NHẬT BÌNH LUẬN: Đảm bảo bình luận là của user này VÀ không phải bình luận ẩn danh
        if (commentData.userId === userId && !commentData.isAnonymous) {
          await updateDoc(comment.ref, {
            avatar: newAvatar,
          });
        }
      }
    }

    console.log("Đồng bộ avatar thành công (Đã bỏ qua bài viết/bình luận ẩn danh)");
  } catch (err) {
    console.log("Lỗi đồng bộ avatar:", err);
  }
};