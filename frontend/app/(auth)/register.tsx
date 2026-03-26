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
const RED = '#EF4444';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [focused, setFocused] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPass.trim()) {
      Alert.alert('Eksik bilgi', 'Lütfen tüm alanları doldurun.');
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert('Kullanıcı adı', 'Kullanıcı adı en az 3 karakter olmalı.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Şifre', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== confirmPass) {
      Alert.alert('Şifre Hatası', 'Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Kayıt Hatası', err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => [
    s.inputWrap,
    focused === field && s.inputFocused,
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={MUTED} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={s.logoArea}>
            <LinearGradient
              colors={GRADIENTS.study as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.logoCircle}
            >
              <Feather name="user-plus" size={32} color="#fff" />
            </LinearGradient>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.title}>Hesap Oluştur</Text>
            <Text style={s.subtitle}>Odaklanmış öğrencilere katıl</Text>

            {/* Username */}
            <Text style={s.label}>Kullanıcı Adı</Text>
            <View style={inputStyle('username')}>
              <Feather name="at-sign" size={18} color={focused === 'username' ? CYAN : MUTED} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="kullaniciadiniz"
                placeholderTextColor={MUTED}
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoComplete="username"
              />
            </View>

            {/* Email */}
            <Text style={s.label}>E-posta</Text>
            <View style={inputStyle('email')}>
              <Feather name="mail" size={18} color={focused === 'email' ? CYAN : MUTED} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="ornek@email.com"
                placeholderTextColor={MUTED}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {/* Password */}
            <Text style={s.label}>Şifre</Text>
            <View style={inputStyle('password')}>
              <Feather name="lock" size={18} color={focused === 'password' ? CYAN : MUTED} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="En az 6 karakter"
                placeholderTextColor={MUTED}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={s.eyeBtn}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={MUTED} />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <Text style={s.label}>Şifre Tekrar</Text>
            <View style={inputStyle('confirm')}>
              <Feather
                name="shield"
                size={18}
                color={focused === 'confirm' ? CYAN : confirmPass && confirmPass !== password ? RED : MUTED}
                style={s.inputIcon}
              />
              <TextInput
                style={s.input}
                placeholder="Şifrenizi tekrar girin"
                placeholderTextColor={MUTED}
                value={confirmPass}
                onChangeText={setConfirmPass}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={s.eyeBtn}>
                <Feather name={showConfirm ? 'eye-off' : 'eye'} size={18} color={MUTED} />
              </TouchableOpacity>
            </View>

            {/* Password mismatch hint */}
            {confirmPass.length > 0 && confirmPass !== password && (
              <Text style={s.errorHint}>Şifreler eşleşmiyor</Text>
            )}

            {/* Register Button */}
            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
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
                  <Text style={s.btnText}>Hesap Oluştur</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={s.switchRow}>
              <Text style={s.switchText}>Zaten hesabınız var mı? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={s.switchLink}>Giriş Yap</Text>
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
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },

  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoCircle: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: SURFACE, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: SURFACE_HL },
  title: { fontSize: 24, fontFamily: F.xbld, color: TXT, marginBottom: 6 },
  subtitle: { fontSize: 13, fontFamily: F.reg, color: MUTED, marginBottom: 22 },

  label: { fontSize: 12, fontFamily: F.bld, color: MUTED, marginBottom: 8, letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE_HL, borderRadius: 14, borderWidth: 1.5, borderColor: SURFACE_HL, marginBottom: 16, paddingHorizontal: 14 },
  inputFocused: { borderColor: CYAN, backgroundColor: 'rgba(79,172,254,0.06)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: F.reg, color: TXT, paddingVertical: 13 },
  eyeBtn: { padding: 8 },
  errorHint: { fontSize: 12, fontFamily: F.reg, color: RED, marginTop: -10, marginBottom: 12, marginLeft: 4 },

  btn: { borderRadius: 16, overflow: 'hidden', marginTop: 8, marginBottom: 18 },
  btnGrad: { paddingVertical: 17, alignItems: 'center', borderRadius: 16 },
  btnText: { fontSize: 17, fontFamily: F.bld, color: '#fff' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  switchText: { fontSize: 14, fontFamily: F.reg, color: MUTED },
  switchLink: { fontSize: 14, fontFamily: F.bld, color: CYAN },
});
