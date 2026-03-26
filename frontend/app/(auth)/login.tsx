import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { GRADIENTS } from '../../src/constants/colors';
import { F } from '../../src/constants/fonts';

const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const CYAN_DIM = 'rgba(79,172,254,0.15)';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Eksik bilgi', 'Lütfen tüm alanları doldurun.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Giriş Hatası', err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Area */}
          <View style={s.logoArea}>
            <LinearGradient
              colors={GRADIENTS.study as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.logoCircle}
            >
              <Feather name="target" size={36} color="#fff" />
            </LinearGradient>
            <Text style={s.appName}>MyStudyBody</Text>
            <Text style={s.tagline}>Yapay zeka destekli akademik takip</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.title}>Hoş Geldiniz</Text>
            <Text style={s.subtitle}>Hesabınıza giriş yapın</Text>

            {/* Email */}
            <Text style={s.label}>E-posta</Text>
            <View style={[s.inputWrap, emailFocused && s.inputFocused]}>
              <Feather name="mail" size={18} color={emailFocused ? CYAN : MUTED} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="ornek@email.com"
                placeholderTextColor={MUTED}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {/* Password */}
            <Text style={s.label}>Şifre</Text>
            <View style={[s.inputWrap, passFocused && s.inputFocused]}>
              <Feather name="lock" size={18} color={passFocused ? CYAN : MUTED} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Şifreniz"
                placeholderTextColor={MUTED}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                secureTextEntry={!showPass}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={s.eyeBtn}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={MUTED} />
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={GRADIENTS.study as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.btnGrad}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.btnText}>Giriş Yap</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Register Link */}
            <View style={s.switchRow}>
              <Text style={s.switchText}>Hesabınız yok mu? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={s.switchLink}>Kayıt Ol</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingVertical: 40 },

  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  appName: { fontSize: 26, fontFamily: F.xbld, color: CYAN, marginBottom: 6 },
  tagline: { fontSize: 13, fontFamily: F.reg, color: MUTED },

  card: { backgroundColor: SURFACE, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: SURFACE_HL },
  title: { fontSize: 26, fontFamily: F.xbld, color: TXT, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: F.reg, color: MUTED, marginBottom: 24 },

  label: { fontSize: 12, fontFamily: F.bld, color: MUTED, marginBottom: 8, letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE_HL, borderRadius: 14, borderWidth: 1.5, borderColor: SURFACE_HL, marginBottom: 18, paddingHorizontal: 14 },
  inputFocused: { borderColor: CYAN, backgroundColor: 'rgba(79,172,254,0.06)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: F.reg, color: TXT, paddingVertical: 14 },
  eyeBtn: { padding: 8 },

  btn: { borderRadius: 16, overflow: 'hidden', marginTop: 6, marginBottom: 20 },
  btnGrad: { paddingVertical: 17, alignItems: 'center', borderRadius: 16 },
  btnText: { fontSize: 17, fontFamily: F.bld, color: '#fff' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  switchText: { fontSize: 14, fontFamily: F.reg, color: MUTED },
  switchLink: { fontSize: 14, fontFamily: F.bld, color: CYAN },
});
