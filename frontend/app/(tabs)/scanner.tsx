import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, TextInput, Alert, Animated,
  KeyboardAvoidingView, Platform, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SUBJECTS, MOCK_ERROR_TOPICS } from '../../src/constants/mockData';
import { GRADIENTS } from '../../src/constants/colors';
import { F } from '../../src/constants/fonts';
import { useAuth } from '../../src/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
type Phase = 'viewfinder' | 'analyzing' | 'form';

const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const ORANGE = '#FF6D00';

const PRO_TIPS = [
  'Center the text and avoid shadows for 99% accuracy.',
  'Good lighting improves AI recognition significantly.',
  'Keep the camera steady for sharper text detection.',
  'Frame the full question including answer choices.',
];

export default function ScannerScreen() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('viewfinder');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [autoSubject, setAutoSubject] = useState('Math');
  const [autoTopic, setAutoTopic] = useState('Trigonometry');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * PRO_TIPS.length));

  // Scan line animation
  const scanAnim = useRef(new Animated.Value(0)).current;
  const scanRef = useRef<Animated.CompositeAnimation | null>(null);
  // Pulse dot animation
  const dotAnim = useRef(new Animated.Value(1)).current;
  const dotRef = useRef<Animated.CompositeAnimation | null>(null);

  // Scan line
  useEffect(() => {
    scanRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    scanRef.current.start();
    return () => scanRef.current?.stop();
  }, []);

  // Pulsing dot for analyzing
  useEffect(() => {
    if (phase === 'analyzing') {
      dotRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      dotRef.current.start();
    } else {
      dotRef.current?.stop();
      dotAnim.setValue(1);
    }
  }, [phase]);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow gallery access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) processImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6 });
    if (!result.canceled && result.assets[0]) processImage(result.assets[0].uri);
  };

  const processImage = (uri: string) => {
    setCapturedImage(uri);
    setPhase('analyzing');
    setTimeout(() => {
      const subjectKeys = Object.keys(MOCK_ERROR_TOPICS);
      const subject = subjectKeys[Math.floor(Math.random() * subjectKeys.length)];
      const topics = MOCK_ERROR_TOPICS[subject];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      setAutoSubject(subject);
      setAutoTopic(topic);
      setPhase('form');
    }, 2800);
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

  const scanLineY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 210] });

  // ── FORM PHASE ──────────────────────────────────────────────────────
  if (phase === 'form') {
    return (
      <SafeAreaView testID="scanner-screen" style={s.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.formContent}>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.appTitle}>{user?.username || 'MyStudyBody'}</Text>
              <TouchableOpacity onPress={resetScanner} style={s.closeBtn}>
                <Feather name="x" size={20} color={MUTED} />
              </TouchableOpacity>
            </View>

            {/* Status */}
            {saved ? (
              <View style={s.savedBanner}>
                <Feather name="check-circle" size={20} color="#10B981" />
                <Text style={s.savedText}>Error saved to your log!</Text>
              </View>
            ) : (
              <View style={s.successTag}>
                <LinearGradient colors={GRADIENTS.study as any} start={{x:0,y:0}} end={{x:1,y:0}} style={s.successDot} />
                <Text style={s.successTagText}>AI Analysis Complete</Text>
              </View>
            )}

            {capturedImage && (
              <Image source={{ uri: capturedImage }} style={s.thumbnail} resizeMode="cover" />
            )}

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

            <Text style={s.fieldLabel}>Topic</Text>
            <View testID="auto-fill-topic" style={s.autoFillRow}>
              <Text style={s.autoFillText}>{autoTopic}</Text>
              <View style={s.aiChip}>
                <Text style={s.aiChipText}>AI</Text>
              </View>
            </View>

            <Text style={s.fieldLabel}>Your Notes</Text>
            <TextInput
              testID="notes-input"
              style={s.notesInput}
              placeholder="What did you get wrong? Key things to remember..."
              placeholderTextColor={MUTED}
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />

            <TouchableOpacity
              testID="save-error-btn"
              style={[s.saveBtn, saved && { opacity: 0.5 }]}
              onPress={handleSaveError}
              disabled={saved}
            >
              <LinearGradient colors={GRADIENTS.study as any} start={{x:0,y:0}} end={{x:1,y:0}} style={s.saveBtnGrad}>
                <Feather name="save" size={18} color="#fff" />
                <Text style={s.saveBtnText}>Save to Error Log</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity testID="scan-another-btn" style={s.scanAnotherBtn} onPress={resetScanner}>
              <Text style={s.scanAnotherText}>Scan Another</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Subject Picker Modal */}
        <Modal visible={showSubjectPicker} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>Change Subject</Text>
              {SUBJECTS.map((subj) => (
                <TouchableOpacity
                  key={subj}
                  style={s.modalOption}
                  onPress={() => { setAutoSubject(subj); setShowSubjectPicker(false); }}
                >
                  <Text style={s.modalOptionText}>{subj}</Text>
                  {autoSubject === subj && <Feather name="check-circle" size={18} color={CYAN} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowSubjectPicker(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── VIEWFINDER + ANALYZING PHASES ─────────────────────────────────
  return (
    <SafeAreaView testID="scanner-screen" style={s.safe} edges={['top']}>
      <View style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.appTitle}>MyStudyBody</Text>
          <View style={s.headerRight}>
            <View style={s.streakBadge}>
              <Text style={s.streakNum}>7</Text>
              <Feather name="zap" size={13} color={ORANGE} />
            </View>
            {phase === 'analyzing' && (
              <TouchableOpacity onPress={resetScanner} style={s.closeBtn}>
                <Feather name="x" size={20} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Viewfinder Area */}
        <View style={s.viewfinderArea}>

          {/* Background or captured image */}
          {phase === 'analyzing' && capturedImage ? (
            <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={s.viewfinderBg} />
          )}

          {/* Dark overlay during analyzing */}
          {phase === 'analyzing' && (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,13,26,0.55)' }]} />
          )}

          {/* PRO TIP Card */}
          {phase === 'viewfinder' && (
            <View style={s.proTipCard}>
              <View style={s.proTipBorder} />
              <View style={s.proTipContent}>
                <Text style={s.proTipLabel}>PRO TIP</Text>
                <Text style={s.proTipText}>{PRO_TIPS[tipIndex]}</Text>
              </View>
            </View>
          )}

          {/* Corner Brackets */}
          <View style={[s.corner, s.cTL]} />
          <View style={[s.corner, s.cTR]} />
          <View style={[s.corner, s.cBL]} />
          <View style={[s.corner, s.cBR]} />

          {/* Scanning Line */}
          <Animated.View
            style={[
              s.scanLine,
              { transform: [{ translateY: scanLineY }] },
            ]}
          />

          {/* Center hint (viewfinder only) */}
          {phase === 'viewfinder' && (
            <View style={s.viewfinderCenter}>
              <Feather name="maximize" size={40} color={`${CYAN}50`} />
              <Text style={s.viewfinderHint}>Frame your question</Text>
            </View>
          )}

          {/* Analyzing overlay center */}
          {phase === 'analyzing' && (
            <View style={s.analyzingCenter}>
              <View style={s.analyzingIcon}>
                <Feather name="cpu" size={26} color={CYAN} />
              </View>
              <Text style={s.analyzingText}>Processing question...</Text>
            </View>
          )}
        </View>

        {/* AI Status Bar */}
        <View style={[s.statusBar, phase !== 'analyzing' && s.statusBarHidden]}>
          <Animated.View style={[s.statusDot, { opacity: dotAnim }]} />
          <Text style={s.statusText}>AI ANALYZING QUESTION...</Text>
        </View>

        {/* Bottom Controls */}
        <View style={s.bottomControls}>
          <TouchableOpacity
            testID="upload-gallery-btn"
            style={s.sideBtn}
            onPress={pickFromGallery}
            disabled={phase === 'analyzing'}
          >
            <Feather name="image" size={22} color={phase === 'analyzing' ? MUTED : TXT} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="snap-photo-btn"
            style={[s.captureBtn, phase === 'analyzing' && s.captureBtnDisabled]}
            onPress={takePhoto}
            disabled={phase === 'analyzing'}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={phase === 'analyzing' ? ['#2A3560', '#2A3560'] : (GRADIENTS.study as any)}
              style={s.captureBtnInner}
            />
          </TouchableOpacity>

          <TouchableOpacity
            testID="flash-btn"
            style={[s.sideBtn, flashOn && { backgroundColor: `${ORANGE}22` }]}
            onPress={() => setFlashOn((f) => !f)}
          >
            <Feather name="zap" size={22} color={flashOn ? ORANGE : TXT} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  appTitle: { fontSize: 18, fontFamily: F.bld, color: CYAN },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SURFACE, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: `${ORANGE}25` },
  streakNum: { fontSize: 13, fontFamily: F.bld, color: TXT },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },

  // Viewfinder
  viewfinderArea: { flex: 1, marginHorizontal: 16, marginBottom: 8, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  viewfinderBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050A14' },

  // PRO TIP
  proTipCard: { position: 'absolute', top: 16, left: 16, right: 80, flexDirection: 'row', backgroundColor: 'rgba(8,13,26,0.85)', borderRadius: 12, overflow: 'hidden', zIndex: 10 },
  proTipBorder: { width: 4, backgroundColor: ORANGE },
  proTipContent: { flex: 1, padding: 12 },
  proTipLabel: { fontSize: 11, fontFamily: F.xbld, color: ORANGE, letterSpacing: 1.2, marginBottom: 4 },
  proTipText: { fontSize: 12, fontFamily: F.reg, color: 'rgba(237,242,255,0.85)', lineHeight: 16 },

  // Corner brackets
  corner: { position: 'absolute', width: 32, height: 32, borderColor: CYAN, borderWidth: 2.5 },
  cTL: { top: '20%', left: '8%', borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cTR: { top: '20%', right: '8%', borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cBL: { bottom: '20%', left: '8%', borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cBR: { bottom: '20%', right: '8%', borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  // Scan line
  scanLine: { position: 'absolute', left: '8%', right: '8%', height: 2, backgroundColor: CYAN, shadowColor: CYAN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 6, elevation: 6, top: '20%' },

  // Viewfinder center
  viewfinderCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  viewfinderHint: { fontSize: 14, fontFamily: F.reg, color: MUTED },

  // Analyzing center
  analyzingCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 14 },
  analyzingIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: `${CYAN}18`, borderWidth: 1.5, borderColor: `${CYAN}40`, alignItems: 'center', justifyContent: 'center' },
  analyzingText: { fontSize: 14, fontFamily: F.sem, color: `${TXT}80` },

  // Status bar
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 10, marginHorizontal: 16, marginBottom: 4, backgroundColor: 'rgba(15,24,41,0.9)', borderRadius: 30 },
  statusBarHidden: { opacity: 0 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CYAN },
  statusText: { fontSize: 12, fontFamily: F.bld, color: TXT, letterSpacing: 1.0 },

  // Bottom controls
  bottomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24, paddingVertical: 14 },
  sideBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'transparent', borderWidth: 3, borderColor: CYAN, alignItems: 'center', justifyContent: 'center' },
  captureBtnDisabled: { borderColor: SURFACE_HL },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28 },

  // Form phase
  formContent: { paddingHorizontal: 20, paddingBottom: 40 },
  successTag: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, alignSelf: 'flex-start' },
  successDot: { width: 10, height: 10, borderRadius: 5 },
  successTagText: { fontFamily: F.sem, fontSize: 14, color: '#10B981' },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 12, padding: 14, marginBottom: 14 },
  savedText: { fontFamily: F.bld, fontSize: 15, color: '#10B981' },
  thumbnail: { width: '100%', height: 130, borderRadius: 14, marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontFamily: F.bld, color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.0 },
  autoFillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  autoFillText: { fontSize: 16, fontFamily: F.sem, color: TXT },
  aiChip: { backgroundColor: `${CYAN}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  aiChipText: { fontSize: 10, fontFamily: F.xbld, color: CYAN },
  notesInput: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: F.reg, color: TXT, minHeight: 100, marginBottom: 20 },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  saveBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  saveBtnText: { fontSize: 16, fontFamily: F.bld, color: '#fff' },
  scanAnotherBtn: { alignItems: 'center', paddingVertical: 12 },
  scanAnotherText: { fontSize: 14, fontFamily: F.sem, color: MUTED },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontFamily: F.bld, color: TXT, marginBottom: 16 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: SURFACE_HL },
  modalOptionText: { fontSize: 16, fontFamily: F.reg, color: TXT },
  modalCancel: { marginTop: 14, backgroundColor: SURFACE_HL, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontFamily: F.sem, color: MUTED },
});
