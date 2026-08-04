import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../../BDU_SocialApp/firebaseConfig'; // <-- Đảm bảo đường dẫn này đúng với file config của bạn

export default function LikeButton({ postId, likedBy = [], currentUserId }) {
  const isLikedByMe = likedBy.includes(currentUserId);

  const handleLikePress = async () => {
    if (!currentUserId) return;

    const postRef = doc(db, "posts", postId);

    try {
      if (isLikedByMe) {
        // Nếu đã thích -> Bỏ thích
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUserId),
          likes: increment(-1)
        });
      } else {
        // Nếu chưa thích -> Thích
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUserId),
          likes: increment(1)
        });
      }
    } catch (error) {
      console.error("Lỗi khi xử lý Like:", error);
    }
  };

  return (
    <TouchableOpacity 
      style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8 }} 
      activeOpacity={0.7}
      onPress={handleLikePress}
    >
      <Ionicons 
        name={isLikedByMe ? "heart" : "heart-outline"} 
        size={20} 
        color={isLikedByMe ? '#C8102E' : '#4A4A4A'} 
      />
      <Text style={{ 
        marginLeft: 6, 
        fontSize: 14, 
        color: isLikedByMe ? '#C8102E' : '#4A4A4A', 
        fontWeight: isLikedByMe ? '700' : '500' 
      }}>
        Thích
      </Text>
    </TouchableOpacity>
  );
}