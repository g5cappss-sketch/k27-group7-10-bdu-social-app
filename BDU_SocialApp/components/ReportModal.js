import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig"; // Sửa đường dẫn nếu khác

const REASON_OPTIONS = [
  "Nội dung không phù hợp",
  "Spam hoặc quảng cáo",
  "Ngôn từ thù hận, xúc phạm",
  "Thông tin sai sự thật",
  "Lý do khác",
];

export default function ReportModal({ visible, onClose, postId, reporterId }) {
  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]);
  const [loading, setLoading] = useState(false);

  const handleSendReport = async () => {
    if (!postId || !reporterId) {
      Alert.alert("Lỗi", "Không xác định được bài viết hoặc người báo cáo.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "reports"), {
        postId: postId,
        reporterId: reporterId,
        reason: selectedReason,
        createdAt: serverTimestamp(),
      });

      setLoading(false);
      onClose();
      Alert.alert("Cảm ơn bạn", "Báo cáo của bạn đã được gửi tới Quản trị viên.");
    } catch (error) {
      console.log("Lỗi gửi báo cáo:", error);
      setLoading(false);
      Alert.alert("Lỗi", "Không thể gửi báo cáo lúc này.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.title}>Báo cáo bài viết</Text>
          <Text style={styles.subtitle}>Hãy chọn lý do bạn muốn báo cáo bài viết này:</Text>

          {REASON_OPTIONS.map((reason, index) => (
            <TouchableOpacity
              key={index}
              style={styles.optionRow}
              onPress={() => setSelectedReason(reason)}
            >
              <Text style={styles.optionText}>{reason}</Text>
              <Ionicons
                name={selectedReason === reason ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={selectedReason === reason ? "#C8102E" : "#8A8D91"}
              />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSendReport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Gửi Báo Cáo</Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E4E6EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#050505",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#65676B",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F2F5",
  },
  optionText: {
    fontSize: 15,
    color: "#050505",
  },
  submitBtn: {
    backgroundColor: "#C8102E",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 20,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
  },
});