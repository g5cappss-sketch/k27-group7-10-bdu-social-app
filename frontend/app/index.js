import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, 
  KeyboardAvoidingView, Platform, Dimensions, StatusBar, 
  Animated, Linking, ActivityIndicator, Image, Keyboard, Easing,
  ScrollView
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; 

import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore"; 
import { auth, db } from "../../BDU_SocialApp/firebaseConfig"; 

const { width, height } = Dimensions.get('window');

// =======================================================
// 1. TỐI ƯU HÓA PHÔNG CHỮ: Khóa tỷ lệ chữ trên mọi thiết bị Android/iOS
// =======================================================
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.maxFontSizeMultiplier = 1.15; 
Text.defaultProps.allowFontScaling = false;

if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.maxFontSizeMultiplier = 1.15;
TextInput.defaultProps.allowFontScaling = false;

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [errorMessage, setErrorMessage] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Khai báo Animated Values
  const fadeAnim = useRef(new Animated.Value(0)).current; 
  const slideUpAnim = useRef(new Animated.Value(60)).current; 
  const scaleAnim = useRef(new Animated.Value(0.85)).current; 
  const buttonScale = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const bgFloatAnim = useRef(new Animated.Value(0)).current;

  // Hằng số thiết kế
  const BDU_RED = '#C8102E'; 
  const BDU_WHITE = '#FFFFFF';
  const BDU_LOGO_URL = 'https://bdu.edu.vn/assets/news/2019_12/logo_hao_quang_chon_07_2007-1.jpg';
  
  const outerText = "BDU SOCIAL • BDU SOCIAL • ";
  const innerText = "HELLO STUDENT • HELLO STUDENT • ";

  useEffect(() => {
    startAnimations();

    // Loop xoay chữ Loading
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4500, 
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    // Loop trôi nổi cho Background
    Animated.loop(
      Animated.timing(bgFloatAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true
      })
    ).start();

    setTimeout(() => {
      setIsAuthChecking(false);
    }, 2500); 
  }, []);

  // Nội suy cho hiệu ứng quay
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinReverse = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  // Nội suy tọa độ cho hiệu ứng trôi nổi
  const floatY1 = bgFloatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -35, 0] });
  const floatX1 = bgFloatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 20, 0] });
  const floatY2 = bgFloatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 40, 0] });
  const floatX2 = bgFloatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -30, 0] });
  const floatScale = bgFloatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] });

  const startAnimations = () => {
    Animated.stagger(120, [ 
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }) 
      ]),
      Animated.spring(slideUpAnim, { 
        toValue: 0, 
        friction: 8, 
        tension: 45, 
        useNativeDriver: true 
      })
    ]).start();
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 90, useNativeDriver: true }),
      Animated.spring(buttonScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true })
    ]).start();
  };

  const handleLogin = async () => {
    animateButton(); 
    Keyboard.dismiss(); 
    setErrorMessage(''); 

    const normalizedEmail = email.trim().toLowerCase();
    
    if (!normalizedEmail || !password.trim()) {
      setErrorMessage("Vui lòng điền đầy đủ Email và Mật khẩu!");
      return;
    }

    const isSchoolEmail = normalizedEmail.endsWith('@student.bdu.edu.vn') || normalizedEmail.endsWith('@bdu.edu.vn');
    if (!isSchoolEmail) {
      setErrorMessage("Tài khoản không hợp lệ! Vui lòng dùng email BDU.");
      return;
    }

    setIsLoading(true); 

    try {
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (!userData.name || !userData.studentId || !userData.major) {
          router.replace('/profile'); 
        } else {
          router.replace('/feed');
        }
      } else {
        router.replace('/profile');
      }

    } catch (error) {
      console.log("Mã lỗi Firebase trả về:", error.code); 
      if (
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-email'
      ) {
        setErrorMessage("Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại!");
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMessage("Tài khoản bị tạm khóa do nhập sai quá nhiều. Thử lại sau!");
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage("Lỗi kết nối mạng. Vui lòng kiểm tra 4G/Wifi!");
      } else {
        setErrorMessage("Lỗi hệ thống: " + error.message);
      }
    } finally {
      setIsLoading(false); 
    }
  };

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    setTimeout(() => {
      setIsGoogleLoading(false);
      Alert.alert(
        "Tính năng mở rộng",
        "Vì lý do bảo mật, đăng nhập Google yêu cầu ứng dụng phải được Build ra file APK và liên kết chứng chỉ SHA-1 trên Google Cloud.\n\nTrong phiên bản Demo này, vui lòng sử dụng Email trường và Mật khẩu để trải nghiệm luồng xác thực nội bộ của trường BDU."
      );
    }, 800); 
  };

  const handleSupport = () => {
    const myProfileUrl = 'https://www.facebook.com/van.giang.10840?locale=vi_VN'; 
    Linking.openURL(myProfileUrl).catch(() => 
      Alert.alert("Lỗi", "Không thể mở liên kết này!")
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={BDU_RED} />
      
      {/* HIỆU ỨNG TRÔI NỔI NỀN TRẮNG */}
      <View style={StyleSheet.absoluteFillObject}>
        <Animated.View style={[styles.bgBlob, { backgroundColor: 'rgba(200, 16, 46, 0.03)', top: '45%', left: '-20%', transform: [{ translateY: floatY2 }, { translateX: floatX2 }, { scale: floatScale }] }]} />
        <Animated.View style={[styles.bgBlob, { backgroundColor: 'rgba(0, 0, 0, 0.015)', bottom: '-10%', right: '-15%', transform: [{ translateY: floatY1 }, { translateX: floatX1 }] }]} />
      </View>

      {/* 2. TỐI ƯU HÓA DI CHUYỂN BÀN PHÍM: Kết hợp KeyboardAvoidingView + ScrollView */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        style={styles.container}
      >
        <Stack.Screen options={{ headerShown: false }} />
        
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.headerVisual, { backgroundColor: BDU_RED, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <Animated.View style={[styles.headerBlob, { top: -60, right: -40, transform: [{ translateY: floatY1 }, { translateX: floatX1 }] }]} />
            <Animated.View style={[styles.headerBlob, { bottom: -80, left: -60, width: 250, height: 250, borderRadius: 125, transform: [{ translateY: floatY2 }, { translateX: floatX2 }, { scale: floatScale }] }]} />
            
            <View style={styles.brandCircle}>
              <Image 
                source={{ uri: BDU_LOGO_URL }} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.mainTitle}>BDU Social</Text>
            <Text style={styles.subTitle}>Mạng Xã Hội Cộng Đồng</Text>
          </Animated.View>

          <Animated.View style={[
            styles.formContainer, 
            { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }
          ]}>
            
            <View style={styles.welcomeBox}>
              <Text style={styles.loginHeaderText}>ĐĂNG NHẬP</Text>
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>Tài khoản email</Text>
              <TextInput 
                style={[styles.customInput, errorMessage ? styles.inputErrorBorder : null]}
                placeholder="username@student.bdu.edu.vn"
                placeholderTextColor="#999"
                value={email}
                onChangeText={(text) => { setEmail(text); setErrorMessage(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading && !isGoogleLoading} 
              />
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>Mật khẩu</Text>
              <View style={[styles.passwordWrapper, errorMessage ? styles.inputErrorBorder : null]}>
                <TextInput 
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword} 
                  value={password}
                  onChangeText={(text) => { setPassword(text); setErrorMessage(''); }}
                  editable={!isLoading && !isGoogleLoading}
                />
                <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {errorMessage !== '' && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#FF3B30" style={{ marginRight: 6 }} />
                <Text style={styles.errorText} numberOfLines={2}>{errorMessage}</Text>
              </View>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity 
                activeOpacity={0.8}
                style={[styles.primaryButton, { backgroundColor: BDU_RED }]} 
                onPress={handleLogin}
                disabled={isLoading || isGoogleLoading} 
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>ĐĂNG NHẬP NGAY</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>HOẶC</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity 
              activeOpacity={0.7}
              style={styles.googleButton} 
              onPress={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
                  <Text style={styles.googleButtonText}>Tiếp tục với Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.bottomLinks}>
              <TouchableOpacity activeOpacity={0.8} style={styles.actionContainer} onPress={handleSupport}>
                <Text style={{ color: '#999', fontSize: 13, textAlign: 'center' }}>Gặp sự cố đăng nhập? <Text style={{ color: '#666', fontWeight: 'bold' }}>Liên hệ hỗ trợ</Text></Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* OVERLAY LOADING */}
      {isAuthChecking && (
        <View style={[StyleSheet.absoluteFillObject, styles.fakeLoadingContainer]}>
          <StatusBar barStyle="dark-content" backgroundColor="rgba(255,255,255,0.85)" />
          
          <View style={styles.spinnerWrapper}>
            {/* VÒNG NGOÀI */}
            <Animated.View style={[styles.absoluteCenter, { transform: [{ rotate: spin }], width: 155, height: 155 }]}>
              {outerText.split('').map((char, index) => {
                const angle = (index * 360) / outerText.length;
                return (
                  <View key={`outer-${index}`} style={{ position: 'absolute', height: 155, alignItems: 'center', transform: [{ rotate: `${angle}deg` }] }}>
                    <Text style={styles.spinTextCharOuter}>{char}</Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* VÒNG TRONG */}
            <Animated.View style={[styles.absoluteCenter, { transform: [{ rotate: spinReverse }], width: 110, height: 110 }]}>
              <View style={styles.spinRing} />
              {innerText.split('').map((char, index) => {
                const angle = (index * 360) / innerText.length;
                return (
                  <View key={`inner-${index}`} style={{ position: 'absolute', height: 110, alignItems: 'center', transform: [{ rotate: `${angle}deg` }] }}>
                    <Text style={styles.spinTextCharInner}>{char}</Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* LOGO TRUNG TÂM */}
            <Image source={{ uri: BDU_LOGO_URL }} style={styles.loadingLogoCenter} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingBottom: 30 }, // Đảm bảo cuộn được hết nội dung
  
  bgBlob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  headerBlob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.06)', 
  },
  headerVisual: {
    // TỐI ƯU: Sử dụng minHeight động thay cho gán cứng để tránh nuốt màn hình nhỏ
    minHeight: height * 0.32,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingTop: Platform.OS === 'ios' ? 40 : 25,
    paddingHorizontal: 20,
    overflow: 'hidden', 
  },
  brandCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5,
    overflow: 'hidden', zIndex: 2,
  },
  logoImage: { width: 75, height: 75 },
  mainTitle: { fontSize: 26, fontWeight: 'bold', color: '#FFF', letterSpacing: 1, zIndex: 2 },
  subTitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '400', textAlign: 'center', width: '100%', zIndex: 2 },
  
  formContainer: {
    flex: 1, 
    marginTop: -25, 
    backgroundColor: '#FFF', 
    marginHorizontal: 20, 
    borderRadius: 24, 
    padding: 22,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 6,
  },
  
  welcomeBox: { alignItems: 'center', marginBottom: 20, marginTop: 5 },
  loginHeaderText: { fontSize: 24, fontWeight: '900', color: '#C8102E', textTransform: 'uppercase', letterSpacing: 1.5 },
  
  inputBox: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#495057', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  customInput: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 14, color: '#212529' },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 12, paddingHorizontal: 16, height: 50 },
  passwordInput: { flex: 1, height: '100%', fontSize: 14, color: '#212529' },
  eyeIcon: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  
  inputErrorBorder: { borderColor: '#FF3B30', backgroundColor: '#FFF5F5' },
  
  errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, paddingHorizontal: 5 },
  errorText: { color: '#FF3B30', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'center' },

  primaryButton: {
    borderRadius: 12, alignItems: 'center', marginTop: 5,
    shadowColor: '#C8102E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
    height: 52, justifyContent: 'center'
  },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E9ECEF' },
  dividerText: { marginHorizontal: 12, color: '#ADB5BD', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DEE2E6', borderRadius: 12, height: 52
  },
  googleButtonText: { fontSize: 14, fontWeight: '600', color: '#333' },

  bottomLinks: { marginTop: 18, alignItems: 'center' },
  actionContainer: { paddingVertical: 5, width: '100%', alignItems: 'center' },

  fakeLoadingContainer: { backgroundColor: 'rgba(255, 255, 255, 0.94)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  spinnerWrapper: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center' },
  absoluteCenter: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  spinRing: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: '#C8102E', borderStyle: 'dashed', opacity: 0.35 },
  spinTextCharOuter: { color: '#C8102E', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  spinTextCharInner: { color: '#666666', fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  loadingLogoCenter: { position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: '#FFF' },
});