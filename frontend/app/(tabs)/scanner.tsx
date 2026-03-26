import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, TextInput, ActivityIndicator, Alert, Animated,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/context/ThemeContext';
import { SUBJECTS, MOCK_ERROR_TOPICS } from '../../src/constants/mockData';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
type Phase = 'viewfinder' | 'analyzing' | 'form';

export default function ScannerScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [phase, setPhase] = useState<Phase>('viewfinder');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [autoSubject, setAutoSubject] = useState('Math');
  const [autoTopic, setAutoTopic] = useState('Trigonometry');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  // Scan line animation
  const scanAnim = useRef(new Animated.Value(0)).current;
  const scanRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (phase !== 'viewfinder') { scanRef.current?.stop(); return; }
    scanRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    scanRef.current.start();
    return () => scanRef.current?.stop();
  }, [phase]);

  const scanLineY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 190] });

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow gallery access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  };

  const processImage = (uri: string) => {
    setCapturedImage(uri);
    setPhase('analyzing');
    // Mock AI analysis delay
    setTimeout(() => {
      const subjects = Object.keys(MOCK_ERROR_TOPICS);
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const topics = MOCK_ERROR_TOPICS[subject];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      setAutoSubject(subject);
      setAutoTopic(topic);
      setPhase('form');
    }, 2600);
  };

  const handleSaveError = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: autoSubject, topic: autoTopic, notes }),
      });
    } catch (_) {}
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setPhase('viewfinder');
      setCapturedImage(null);
      setNotes('');
    }, 1800);
  };

  const resetScanner = () => {
    setPhase('viewfinder');
    setCapturedImage(null);
    setNotes('');
    setSaved(false);
  };

  return (
    <SafeAreaView testID="scanner-screen" style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          {/* Header */}
          <Text style={s.title}>Error Scanner</Text>
          <Text style={s.subtitle}>Capture your mistake, let AI identify it 🔍</Text>

          {/* Viewfinder Phase */}
          {phase === 'viewfinder' && (
            <>
              <View style={s.viewfinderBox}>
                {/* Corner brackets */}
                <View style={[s.corner, s.cornerTL]} />
                <View style={[s.corner, s.cornerTR]} />
                <View style={[s.corner, s.cornerBL]} />
                <View style={[s.corner, s.cornerBR]} />
                {/* Scan line */}
                <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineY }] }]} />
                {/* Center hint */}
                <View style={s.viewfinderCenter}>
                  <Ionicons name="camera-outline" size={48} color={`${colors.primary}60`} />
                  <Text style={s.viewfinderHint}>Point camera at your question</Text>
                </View>
              </View>

              <View style={s.captureRow}>
                <TouchableOpacity testID="upload-gallery-btn" style={s.galleryBtn} onPress={pickFromGallery}>
                  <Ionicons name="images-outline" size={22} color={colors.primary} />
                  <Text style={s.galleryBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="snap-photo-btn" style={s.snapBtn} onPress={takePhoto}>
                  <View style={s.snapBtnInner} />
                </TouchableOpacity>
                <TouchableOpacity testID="upload-gallery-btn-2" style={s.galleryBtn} onPress={pickFromGallery}>
                  <Ionicons name="cloud-upload-outline" size={22} color={colors.secondary} />
                  <Text style={[s.galleryBtnText, { color: colors.secondary }]}>Upload</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Analyzing Phase */}
          {phase === 'analyzing' && capturedImage && (
            <View testID="analyzing-state" style={s.analyzingContainer}>
              <Image source={{ uri: capturedImage }} style={s.previewImg} resizeMode="cover" />
              <View style={s.analyzeOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.analyzeTitle}>AI analyzing question...</Text>
                <Text style={s.analyzeSubtitle}>Identifying subject & topic</Text>
                {/* Animated dots */}
                <View style={s.dotsRow}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[s.dot, { backgroundColor: i === 1 ? colors.primary : colors.surfaceHighlight }]} />
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Form Phase */}
          {phase === 'form' && (
            <View testID="error-form">
              {/* Success tag */}
              {saved ? (
                <View style={[s.savedBanner, { backgroundColor: `${colors.success}20` }]}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  <Text style={[s.savedText, { color: colors.success }]}>Error saved to your log!</Text>
                </View>
              ) : (
                <View style={[s.successTag, { backgroundColor: `${colors.success}15` }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                  <Text style={[s.successTagText, { color: colors.success }]}>AI Analysis Complete</Text>
                </View>
              )}

              {/* Image thumbnail */}
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={s.thumbnail} resizeMode="cover" />
              )}

              {/* Subject field */}
              <Text style={s.fieldLabel}>Subject</Text>
              <TouchableOpacity
                testID="auto-fill-subject"
                style={s.autoFillRow}
                onPress={() => setShowSubjectPicker(true)}
              >
                <Text style={s.autoFillText}>{autoSubject}</Text>
                <View style={s.aiChip}>
                  <Text style={s.aiChipText}>AI</Text>
                </View>
              </TouchableOpacity>

              {/* Topic field */}
              <Text style={s.fieldLabel}>Topic</Text>
              <View testID="auto-fill-topic" style={s.autoFillRow}>
                <Text style={s.autoFillText}>{autoTopic}</Text>
                <View style={s.aiChip}>
                  <Text style={s.aiChipText}>AI</Text>
                </View>
              </View>

              {/* Notes */}
              <Text style={s.fieldLabel}>Your Notes</Text>
              <TextInput
                testID="notes-input"
                style={s.notesInput}
                placeholder="What did you get wrong? Key things to remember..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />

              {/* Save button */}
              <TouchableOpacity
                testID="save-error-btn"
                style={[s.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveError}
                disabled={saved}
              >
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={s.saveBtnText}>Save Error</Text>
              </TouchableOpacity>

              <TouchableOpacity testID="scan-another-btn" style={s.resetBtn} onPress={resetScanner}>
                <Text style={[s.resetBtnText, { color: colors.textSecondary }]}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Subject Picker Modal */}
      <Modal visible={showSubjectPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Change Subject</Text>
            {SUBJECTS.map((subj) => (
              <TouchableOpacity
                key={subj}
                style={[s.modalOption, { borderColor: colors.border }]}
                onPress={() => { setAutoSubject(subj); setShowSubjectPicker(false); }}
              >
                <Text style={[s.modalOptionText, { color: colors.textPrimary }]}>{subj}</Text>
                {autoSubject === subj && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.modalCancel, { backgroundColor: colors.surfaceHighlight }]} onPress={() => setShowSubjectPicker(false)}>
              <Text style={[s.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingBottom: 32 },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginTop: 20 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 24 },
    viewfinderBox: {
      height: 220, backgroundColor: colors.surface, borderRadius: 16,
      overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      marginBottom: 24, position: 'relative',
    },
    corner: { position: 'absolute', width: 28, height: 28, borderColor: colors.primary, borderWidth: 3 },
    cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
    cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
    cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
    cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
    scanLine: { position: 'absolute', left: 12, right: 12, height: 2, backgroundColor: colors.primary, opacity: 0.8, borderRadius: 1, top: 12 },
    viewfinderCenter: { alignItems: 'center', gap: 8 },
    viewfinderHint: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 20 },
    galleryBtn: { alignItems: 'center', gap: 6, width: 80, paddingVertical: 12, backgroundColor: colors.surface, borderRadius: 14 },
    galleryBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    snapBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    snapBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary },
    analyzingContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: 20, height: 300, position: 'relative' },
    previewImg: { width: '100%', height: '100%' },
    analyzeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.82)', alignItems: 'center', justifyContent: 'center', gap: 10 },
    analyzeTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 12 },
    analyzeSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
    dotsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    successTag: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, alignSelf: 'flex-start' },
    successTagText: { fontWeight: '600', fontSize: 14 },
    savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, marginBottom: 14 },
    savedText: { fontWeight: '700', fontSize: 15 },
    thumbnail: { width: '100%', height: 130, borderRadius: 12, marginBottom: 18 },
    fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
    autoFillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
    autoFillText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    aiChip: { backgroundColor: `${colors.primary}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    aiChipText: { fontSize: 11, fontWeight: '800', color: colors.primary },
    notesInput: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 15, color: colors.textPrimary, minHeight: 100, marginBottom: 20 },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, marginBottom: 12 },
    saveBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
    resetBtn: { alignItems: 'center', paddingVertical: 12 },
    resetBtnText: { fontSize: 15, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    modalOptionText: { fontSize: 16 },
    modalCancel: { marginTop: 14, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    modalCancelText: { fontSize: 16, fontWeight: '600' },
  });
