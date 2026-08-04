import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false, // Ẩn thanh header mặc định của Expo để bạn tự làm custom header (như cái appHeader bạn đã làm)
        animation: 'fade', // Hiệu ứng chuyển trang mượt mà
      }} 
    />
  );
}