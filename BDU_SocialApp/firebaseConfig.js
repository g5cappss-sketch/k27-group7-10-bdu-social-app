import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // 1. Bắt buộc phải import getFirestore
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD2BWynnbhaixtyuNqJl_hBlKnPDLAoIwY",
  authDomain: "bdu-b8eca.firebaseapp.com",
  projectId: "bdu-b8eca",
  storageBucket: "bdu-b8eca.firebasestorage.app",
  messagingSenderId: "756264070691",
  appId: "1:756264070691:web:1ad40b86051311ce0c4b96"
  // Đã bỏ measurementId và analytics để tránh lỗi trên app mobile
};

// Khởi tạo Firebase App
const app = initializeApp(firebaseConfig);

// 2. Khởi tạo biến db (Firestore)
const db = getFirestore(app);

// 3. BẮT BUỘC PHẢI EXPORT biến db ra ngoài thì feed.js mới nhận được
export { app, db };
export const auth = getAuth(app);