import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, TextInput, Alert, Animated,
  KeyboardAvoidingView, Platform, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { SUBJECTS } from '../../src/constants/mockData';
import { GRADIENTS } from '../../src/constants/colors';
import { F } from '../../src/constants/fonts';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

type Phase = 'viewfinder' | 'analyzing' | 'form';

const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const ORANGE = '#FF6D00';
const GREEN = '#10B981';

const ANALYZE_STEPS = [
  'Goruntu aliniyor...',
  'Soru okunuyor...',
  'Ders tanimlaniyor...',
  'Konu siniflandiriliyor...',
  'Analiz tamamlaniyor...',
];

const PRO_TIPS = [
  'Metni ortalayin, golge olmamasina dikkat edin.',
  'Iyi aydinlatma AI dogrulugunu arttirir.',
  'Kamerayi sabit tutun, net goruntu alin.',
  'Tum soru seçenekleri cerceve icinde olsun.',
];

export default function ScannerScreen() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('viewfinder');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [autoSubject, setAutoSubject] = useState('Math');
  const [autoTopic, setAutoTopic] = useState('');
  const [questionSummary, setQuestionSummary] = useState('');
  const [aiInsight, setAiInsight] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * PRO_TIPS.length));

  const scanAnim = useRef(new Animated.Value(0)).current;
  const scanRef = useRef<Animated.CompositeAnimation | null>(null);
  const dotAnim = useRef(new Animated.Value(1)).current;
  const dotRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const stepTimerRef = useRef<NodeJS.Timeout[]>([]);

  // Scan line animation
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

  // Analyzing animations
  useEffect(() => {
    if (phase === 'analyzing') {
      // Pulse dot
      dotRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 0.25, duration: 500, useNativeDriver: true }),
          Animated.timing(dotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      dotRef.current.start();

      // Progress bar animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      }).start();

      // Step messages cycle
      setAnalyzeStep(0);
      const timers: NodeJS.Timeout[] = [];
      ANALYZE_STEPS.forEach((_, i) => {
        if (i > 0) {
          timers.push(setTimeout(() => setAnalyzeStep(i), i * 1600));
        }
      });
      stepTimerRef.current = timers;
    } else {
      dotRef.current?.stop();
      dotAnim.setValue(1);
      progressAnim.setValue(0);
      stepTimerRef.current.forEach(clearTimeout);
      stepTimerRef.current = [];
    }
    return () => {
      stepTimerRef.current.forEach(clearTimeout);
    };
  }, [phase]);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Izin Gerekli', 'Galeri erisim izni verin.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) processImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Izin Gerekli', 'Kamera erisim izni verin.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) processImage(result.assets[0].uri);
  };

  const processImage = async (uri: string) => {
    setCapturedImage(uri);
    setAutoSubject('');
    setAutoTopic('');
    setAiInsight('');
    setQuestionSummary('');
    setNotes('');
    setPhase('analyzing');

    try {
      // Convert image to base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Send to Gemini Vision
      const res = await apiFetch('/api/ai/analyze-image', {
        method: 'POST',
        body: JSON.stringify({ image_base64: base64 }),
      });

      if (res.ok) {
        const data = await res.json();
        setAutoSubject(data.subject || 'Math');
        setAutoTopic(data.topic || '');
        setAiInsight(data.insight || '');
        setQuestionSummary(data.question_summary || '');
      } else {
        setAutoSubject('Math');
      }
    } catch (e) {
      // On error, just go to form with empty fields
      setAutoSubject('Math');
    }

    setPhase('form');
  };

  const handleSaveError = async () => {
    setSaving(true);
    try {
      // Read image as base64 for storage (compressed)
      let storedBase64 = '';
      if (capturedImage) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            capturedImage,
            [{ resize: { width: 800 } }],
            { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG }
          );
          storedBase64 = await FileSystem.readAsStringAsync(manipulated.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (_) {}
      }

      await apiFetch('/api/errors', {
        method: 'POST',
        body: JSON.stringify({
          subject: autoSubject || 'Math',
          topic: autoTopic || autoSubject || 'Genel',
          notes: notes.trim() || questionSummary,
          image_base64: storedBase64,
          question_summary: questionSummary,
          ai_insight: aiInsight,
        }),
      });
    } catch (_) {}
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setPhase('viewfinder');
      setCapturedImage(null);
      setNotes('');
      setAiInsight('');
      setAutoTopic('');
      setQuestionSummary('');
    }, 1800);
  };

  const resetScanner = () => {
    setPhase('viewfinder');
    setCapturedImage(null);
    setNotes('');
    setSaved(false);
    setAiInsight('');
    setAutoTopic('');
    setQuestionSummary('');
  };

  const scanLineY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 210] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

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

            {/* Status Banner */}
            {saved ? (
              <View style={s.savedBanner}>
                <Feather name="check-circle" size={20} color={GREEN} />
                <Text style={s.savedText}>Hata gunlugune kaydedildi!</Text>
              </View>
            ) : (
              <View style={s.successTag}>
                <LinearGradient colors={GRADIENTS.study as any} start={{x:0,y:0}} end={{x:1,y:0}} style={s.successDot} />
                <Text style={s.successTagText}>AI Analizi Tamamlandi</Text>
              </View>
            )}

            {capturedImage && (
              <Image source={{ uri: capturedImage }} style={s.thumbnail} resizeMode="cover" />
            )}

            {/* AI Result Cards */}
            {(!!autoSubject || !!autoTopic) && (
              <View style={s.aiResultCard}>
                <View style={s.aiResultHeader}>
                  <Feather name="cpu" size={14} color={CYAN} />
                  <Text style={s.aiResultTitle}>Gemini Vision Analizi</Text>
                </View>

                <View style={s.aiResultRow}>
                  <View style={s.aiResultItem}>
                    <Text style={s.aiResultLabel}>DERS</Text>
                    <TouchableOpacity
                      testID="auto-fill-subject"
                      style={s.aiResultValue}
                      onPress={() => setShowSubjectPicker(true)}
                    >
                      <Text style={s.aiResultText}>{autoSubject || '—'}</Text>
                      <Feather name="edit-2" size={12} color={MUTED} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.aiResultDivider} />
                  <View style={s.aiResultItem}>
                    <Text style={s.aiResultLabel}>KONU</Text>
                    <View testID="auto-fill-topic" style={[s.aiResultValue, { borderBottomWidth: 0 }]}>
                      <Text style={s.aiResultText} numberOfLines={2}>
                        {autoTopic || '—'}
                      </Text>
                    </View>
                  </View>
                </View>

                {!!questionSummary && (
                  <View style={s.summaryRow}>
                    <Feather name="file-text" size={12} color={MUTED} />
                    <Text style={s.summaryText} numberOfLines={2}>{questionSummary}</Text>
                  </View>
                )}
              </View>
            )}

            {/* AI Insight */}
            {!!aiInsight && (
              <View style={s.insightBox}>
                <Feather name="zap" size={14} color={CYAN} />
                <Text style={s.insightText}>{aiInsight}</Text>
              </View>
            )}

            {/* Optional Notes */}
            <Text style={s.fieldLabel}>Eklemek Istedikleriniz (Opsiyonel)</Text>
            <TextInput
              testID="notes-input"
              style={s.notesInput}
              placeholder="AI analizine ek bilgi ekleyebilirsiniz..."
              placeholderTextColor={MUTED}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />

            <TouchableOpacity
              testID="save-error-btn"
              style={[s.saveBtn, (saved || saving) && { opacity: 0.5 }]}
              onPress={handleSaveError}
              disabled={saved || saving}
            >
              <LinearGradient colors={GRADIENTS.study as any} start={{x:0,y:0}} end={{x:1,y:0}} style={s.saveBtnGrad}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="save" size={18} color="#fff" />
                )}
                <Text style={s.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Hata Gunlugune Kaydet'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity testID="scan-another-btn" style={s.scanAnotherBtn} onPress={resetScanner}>
              <Text style={s.scanAnotherText}>Baska Tara</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Subject Picker Modal */}
        <Modal visible={showSubjectPicker} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>Ders Degistir</Text>
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
                <Text style={s.modalCancelText}>Iptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── VIEWFINDER + ANALYZING ─────────────────────────────────────────
  return (
    <SafeAreaView testID="scanner-screen" style={s.safe} edges={['top']}>
      <View style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.appTitle}>{user?.username || 'MyStudyBody'}</Text>
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

        {/* Viewfinder */}
        <View style={s.viewfinderArea}>
          {phase === 'analyzing' && capturedImage ? (
            <Image source={{ uri: capturedImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={s.viewfinderBg} />
          )}

          {phase === 'analyzing' && (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,13,26,0.72)' }]} />
          )}

          {phase === 'viewfinder' && (
            <View style={s.proTipCard}>
              <View style={s.proTipBorder} />
              <View style={s.proTipContent}>
                <Text style={s.proTipLabel}>IPUCU</Text>
                <Text style={s.proTipText}>{PRO_TIPS[tipIndex]}</Text>
              </View>
            </View>
          )}

          {/* Corner brackets */}
          <View style={[s.corner, s.cTL]} />
          <View style={[s.corner, s.cTR]} />
          <View style={[s.corner, s.cBL]} />
          <View style={[s.corner, s.cBR]} />

          {/* Scan line */}
          <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineY }] }]} />

          {/* Viewfinder center hint */}
          {phase === 'viewfinder' && (
            <View style={s.viewfinderCenter}>
              <Feather name="maximize" size={40} color={`${CYAN}50`} />
              <Text style={s.viewfinderHint}>Soruyu cerceve icine alin</Text>
            </View>
          )}

          {/* Analyzing overlay */}
          {phase === 'analyzing' && (
            <View style={s.analyzingOverlay}>
              {/* Icon with pulse */}
              <View style={s.analyzingIconWrap}>
                <Animated.View style={[s.analyzingPulse, { opacity: dotAnim }]} />
                <View style={s.analyzingIcon}>
                  <Feather name="cpu" size={28} color={CYAN} />
                </View>
              </View>

              {/* Step text */}
              <Text style={s.analyzingStepText}>{ANALYZE_STEPS[analyzeStep]}</Text>
              <Text style={s.analyzingSubText}>Gemini Vision tarafiyla isleniyor</Text>

              {/* Progress bar */}
              <View style={s.progressTrack}>
                <Animated.View style={[s.progressBar, { width: progressWidth }]} />
              </View>
            </View>
          )}
        </View>

        {/* Status bar */}
        <View style={[s.statusBar, phase !== 'analyzing' && s.statusBarHidden]}>
          <Animated.View style={[s.statusDot, { opacity: dotAnim }]} />
          <Text style={s.statusText}>GORUNTU ISLENIYOR...</Text>
        </View>

        {/* Bottom Controls */}
        <View style={s.bottomControls}>
          <TouchableOpacity
            testID="upload-gallery-btn"
            style={[s.sideBtn, phase === 'analyzing' && { opacity: 0.3 }]}
            onPress={pickFromGallery}
            disabled={phase === 'analyzing'}
          >
            <Feather name="image" size={22} color={TXT} />
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

  // Analyzing overlay
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  analyzingIconWrap: { position: 'relative', width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  analyzingPulse: { position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: `${CYAN}25`, borderWidth: 1.5, borderColor: `${CYAN}50` },
  analyzingIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: `${CYAN}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${CYAN}50` },
  analyzingStepText: { fontSize: 16, fontFamily: F.bld, color: TXT, textAlign: 'center' },
  analyzingSubText: { fontSize: 12, fontFamily: F.reg, color: MUTED, textAlign: 'center', marginBottom: 16 },
  progressTrack: { width: '100%', height: 4, backgroundColor: SURFACE_HL, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: CYAN, borderRadius: 2 },

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
  successTag: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(79,172,254,0.1)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, alignSelf: 'flex-start', borderWidth: 1, borderColor: `${CYAN}25` },
  successDot: { width: 10, height: 10, borderRadius: 5 },
  successTagText: { fontFamily: F.bld, fontSize: 13, color: CYAN },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 12, padding: 14, marginBottom: 14 },
  savedText: { fontFamily: F.bld, fontSize: 15, color: GREEN },
  thumbnail: { width: '100%', height: 140, borderRadius: 14, marginBottom: 18 },

  // AI Result Card
  aiResultCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: `${CYAN}20` },
  aiResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  aiResultTitle: { fontSize: 12, fontFamily: F.bld, color: CYAN, letterSpacing: 0.5 },
  aiResultRow: { flexDirection: 'row', gap: 0, marginBottom: 10 },
  aiResultItem: { flex: 1 },
  aiResultDivider: { width: 1, backgroundColor: SURFACE_HL, marginHorizontal: 12 },
  aiResultLabel: { fontSize: 10, fontFamily: F.xbld, color: MUTED, letterSpacing: 1.0, marginBottom: 6 },
  aiResultValue: { flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: SURFACE_HL, paddingBottom: 6 },
  aiResultText: { flex: 1, fontSize: 15, fontFamily: F.bld, color: TXT },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: SURFACE_HL },
  summaryText: { flex: 1, fontSize: 12, fontFamily: F.reg, color: MUTED, lineHeight: 16 },

  // AI Insight
  insightBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: `${CYAN}10`, borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: CYAN },
  insightText: { flex: 1, fontSize: 13, fontFamily: F.reg, color: TXT, lineHeight: 19 },

  // Fields
  fieldLabel: { fontSize: 11, fontFamily: F.bld, color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.0 },
  notesInput: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: F.reg, color: TXT, minHeight: 90, marginBottom: 16 },
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
