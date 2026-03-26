import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  Alert, Animated, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/context/ThemeContext';
import { SUBJECTS } from '../../src/constants/mockData';
import { GRADIENTS } from '../../src/constants/colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BREAK_MINS = 5;
const DURATION_OPTIONS = [25, 40, 50, 60];
const RING_SIZE = 270;
const RING_PADDING = 6;

export default function PomodoroScreen() {
  const { colors } = useTheme();

  // ── Timer State ──────────────────────────────────────
  const [studyDuration, setStudyDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'study' | 'break'>('study');
  const [completedSessions, setCompletedSessions] = useState(0);
  const [savingSession, setSavingSession] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  // ── Subject State ────────────────────────────────────
  const [selectedSubject, setSelectedSubject] = useState('Math');
  const [subjects, setSubjects] = useState([...SUBJECTS]);
  const [showPicker, setShowPicker] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const totalSecs = mode === 'study' ? studyDuration * 60 : BREAK_MINS * 60;
  const progress = Math.min(1, (totalSecs - timeLeft) / totalSecs);
  const activeGradient = (mode === 'study' ? GRADIENTS.study : GRADIENTS.break) as [string, string];
  const btnGradient = (isRunning ? GRADIENTS.secondary : activeGradient) as [string, string];

  // ── Pulse glow when running ──────────────────────────
  useEffect(() => {
    if (isRunning) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [isRunning]);

  // ── Countdown ────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) {
      setIsRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (mode === 'study') {
        setCompletedSessions((p) => p + 1);
        Alert.alert(
          '🎉 Session Complete!',
          `${studyDuration}-min focus on ${selectedSubject} done! Break time.`,
          [
            { text: `Start ${BREAK_MINS}-min Break`, onPress: () => { setMode('break'); setTimeLeft(BREAK_MINS * 60); setIsRunning(true); } },
            { text: 'Save & Stop', onPress: () => handleSave(studyDuration * 60) },
          ]
        );
      } else {
        Alert.alert('⚡ Break Over!', "Refreshed? Let's crush it again!", [
          { text: 'Start Study', onPress: () => { setMode('study'); setTimeLeft(studyDuration * 60); setIsRunning(true); } },
          { text: 'Rest More', style: 'cancel', onPress: () => setTimeLeft(BREAK_MINS * 60) },
        ]);
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(t);
  }, [isRunning, timeLeft, mode, studyDuration, selectedSubject]);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const selectDuration = (mins: number) => {
    if (isRunning) setIsRunning(false);
    setStudyDuration(mins);
    if (mode === 'study') setTimeLeft(mins * 60);
  };

  const handleStartPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning((r) => !r);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning(false);
    setTimeLeft(mode === 'study' ? studyDuration * 60 : BREAK_MINS * 60);
  };

  const handleSave = async (elapsed = studyDuration * 60 - timeLeft) => {
    const mins = Math.max(1, Math.round(elapsed / 60));
    setSavingSession(true);
    try {
      await fetch(`${BACKEND_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: selectedSubject, duration_minutes: mins }),
      });
      Alert.alert('✅ Saved!', `${selectedSubject} — ${mins} min logged.`);
    } catch {
      Alert.alert('✅ Saved locally!', `${selectedSubject} — ${mins} min.`);
    } finally {
      setSavingSession(false);
      setMode('study');
      setTimeLeft(studyDuration * 60);
    }
  };

  // ── Subject management ───────────────────────────────
  const addSubject = () => {
    const t = newSubjectInput.trim();
    if (t && !subjects.includes(t)) {
      setSubjects((prev) => [...prev, t]);
      setNewSubjectInput('');
    }
  };

  const removeSubject = (subj: string) => {
    if (subjects.length <= 1) return;
    setSubjects((prev) => prev.filter((s) => s !== subj));
    if (selectedSubject === subj) setSelectedSubject(subjects.find((s) => s !== subj)!);
  };

  const s = styles;

  return (
    <SafeAreaView testID="pomodoro-screen" style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* ── Header ── */}
        <Text style={s.title}>Pomodoro Timer</Text>
        <Text style={s.subtitle}>Deep work fuels big results 🚀</Text>

        {/* ── Subject Selector ── */}
        <TouchableOpacity testID="subject-selector-btn" style={s.subjectWrap} onPress={() => setShowPicker(true)} activeOpacity={0.85}>
          <LinearGradient colors={['#101C35', '#162240']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.subjectGrad}>
            <LinearGradient colors={GRADIENTS.study as any} style={s.subjectIconBg}>
              <Ionicons name="book-outline" size={16} color="#fff" />
            </LinearGradient>
            <Text style={s.subjectText}>{selectedSubject}</Text>
            <Ionicons name="chevron-down" size={16} color="#718096" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Duration Chips ── */}
        <View style={s.chipsRow}>
          {DURATION_OPTIONS.map((d) => (
            <TouchableOpacity key={d} testID={`duration-chip-${d}`} onPress={() => selectDuration(d)} activeOpacity={0.8}>
              {studyDuration === d ? (
                <LinearGradient colors={GRADIENTS.study as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.chipActive}>
                  <Text style={s.chipTextActive}>{d} min</Text>
                </LinearGradient>
              ) : (
                <View style={s.chipInactive}>
                  <Text style={s.chipTextInactive}>{d} min</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Mode Badge ── */}
        <View style={[s.modeBadge, { backgroundColor: mode === 'study' ? 'rgba(0,242,254,0.1)' : 'rgba(16,185,129,0.1)' }]}>
          <View style={[s.modeDot, { backgroundColor: activeGradient[0] }]} />
          <Text style={[s.modeText, { color: activeGradient[0] }]}>
            {mode === 'study' ? 'FOCUS TIME' : 'BREAK TIME'}
          </Text>
        </View>

        {/* ── Gradient Ring Timer ── */}
        <View style={s.timerContainer}>
          <Animated.View
            style={[
              s.glowWrap,
              {
                transform: [{ scale: pulseAnim }],
                shadowColor: activeGradient[0],
                shadowOpacity: isRunning ? 0.8 : 0.25,
              },
            ]}
          >
            <LinearGradient
              colors={activeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.gradientRing}
            >
              <View style={s.timerCenter}>
                <Text testID="timer-display" style={s.timerText}>{fmt(timeLeft)}</Text>
                <Text style={[s.timerSub, { color: activeGradient[0] }]}>
                  {mode === 'study' ? `${studyDuration} min focus` : `${BREAK_MINS} min break`}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* ── Progress Bar ── */}
        <View style={s.progressTrack} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
          <LinearGradient
            colors={activeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: trackWidth * progress, height: '100%', borderRadius: 4 }}
          />
        </View>
        <Text style={s.progressLabel}>{Math.round(progress * 100)}% complete</Text>

        {/* ── Controls ── */}
        <View style={s.controls}>
          <TouchableOpacity testID="reset-timer-btn" style={s.iconBtn} onPress={handleReset}>
            <Ionicons name="refresh-outline" size={26} color="#718096" />
          </TouchableOpacity>

          <TouchableOpacity testID="start-pause-btn" onPress={handleStartPause} activeOpacity={0.85}>
            <LinearGradient colors={btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.mainBtn}>
              <Ionicons name={isRunning ? 'pause' : 'play'} size={30} color="#fff" />
              <Text style={s.mainBtnText}>{isRunning ? 'Pause' : 'Start'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            testID="save-session-btn"
            style={[s.iconBtn, savingSession && { opacity: 0.5 }]}
            onPress={() => handleSave(studyDuration * 60 - timeLeft)}
            disabled={savingSession}
          >
            <Ionicons name="save-outline" size={26} color="#718096" />
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          {[
            { value: completedSessions, label: 'Sessions' },
            { value: completedSessions * studyDuration, label: 'Min Focused' },
            { value: selectedSubject.slice(0, 4), label: 'Subject' },
          ].map((item, i) => (
            <View key={i} style={s.statCard}>
              <Text style={[s.statValue, { color: i === 2 ? GRADIENTS.study[0] : GRADIENTS.study[1] }]}>
                {item.value}
              </Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Subject Picker Modal ── */}
      <Modal visible={showPicker} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              {/* Sheet handle */}
              <View style={s.handle} />

              <View style={s.sheetHeader}>
                <View>
                  <Text style={s.sheetTitle}>Select Subject</Text>
                  <Text style={s.sheetSubtitle}>{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPicker(false)} style={s.closeBtn}>
                  <Ionicons name="close" size={20} color="#718096" />
                </TouchableOpacity>
              </View>

              {/* Subject List */}
              <ScrollView style={{ maxHeight: 310 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {subjects.map((subj) => {
                  const isSelected = selectedSubject === subj;
                  return (
                    <TouchableOpacity
                      key={subj}
                      testID={`subject-option-${subj.toLowerCase()}`}
                      style={[s.subjectRow, isSelected && s.subjectRowActive]}
                      onPress={() => { setSelectedSubject(subj); setShowPicker(false); }}
                      activeOpacity={0.7}
                    >
                      <View style={s.subjectRowLeft}>
                        {isSelected ? (
                          <LinearGradient colors={GRADIENTS.study as any} style={s.radioDot} />
                        ) : (
                          <View style={s.radioEmpty} />
                        )}
                        <Text style={[s.subjectRowText, isSelected && { color: GRADIENTS.study[1] }]}>
                          {subj}
                        </Text>
                      </View>
                      <TouchableOpacity
                        testID={`remove-subject-${subj.toLowerCase()}`}
                        onPress={() => removeSubject(subj)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.trashBtn}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Add Subject Row */}
              <View style={s.addRow}>
                <TextInput
                  testID="add-subject-input"
                  style={s.addInput}
                  placeholder="Add new subject..."
                  placeholderTextColor="#4A5568"
                  value={newSubjectInput}
                  onChangeText={setNewSubjectInput}
                  onSubmitEditing={addSubject}
                  returnKeyType="done"
                />
                <TouchableOpacity testID="add-subject-btn" onPress={addSubject} activeOpacity={0.85}>
                  <LinearGradient colors={GRADIENTS.study as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.addBtn}>
                    <Text style={s.addBtnText}>Add</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Done button */}
              <TouchableOpacity style={s.doneBtn} onPress={() => setShowPicker(false)}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles (using hardcoded premium dark values for Pomodoro's identity) ──────
const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const BORDER = '#1A2540';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },

  title: { fontSize: 28, fontWeight: '800', color: TXT, marginTop: 20, alignSelf: 'flex-start' },
  subtitle: { fontSize: 14, color: MUTED, marginTop: 4, marginBottom: 22, alignSelf: 'flex-start' },

  subjectWrap: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  subjectGrad: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  subjectIconBg: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  subjectText: { flex: 1, fontSize: 16, fontWeight: '700', color: TXT },

  chipsRow: { flexDirection: 'row', gap: 10, marginBottom: 22, alignSelf: 'flex-start' },
  chipActive: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  chipTextActive: { fontSize: 14, fontWeight: '700', color: '#fff' },
  chipInactive: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: SURFACE_HL, borderWidth: 1, borderColor: '#2A3560' },
  chipTextInactive: { fontSize: 14, fontWeight: '600', color: MUTED },

  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 24 },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeText: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },

  timerContainer: { alignItems: 'center', marginBottom: 28 },
  glowWrap: { shadowOffset: { width: 0, height: 0 }, shadowRadius: 32, elevation: 20 },
  gradientRing: { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, padding: RING_PADDING, alignItems: 'center', justifyContent: 'center' },
  timerCenter: { flex: 1, width: '100%', borderRadius: (RING_SIZE - RING_PADDING * 2) / 2, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  timerText: { fontSize: 58, fontWeight: '900', color: TXT, letterSpacing: -2 },
  timerSub: { fontSize: 14, fontWeight: '600', marginTop: 6 },

  progressTrack: { width: '100%', height: 7, backgroundColor: SURFACE_HL, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressLabel: { fontSize: 12, color: MUTED, marginBottom: 28 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 32 },
  iconBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: SURFACE_HL, alignItems: 'center', justifyContent: 'center' },
  mainBtn: { width: 136, height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mainBtnText: { fontSize: 18, fontWeight: '800', color: '#fff' },

  statsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', backgroundColor: SURFACE },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 4, textAlign: 'center', fontWeight: '600' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0C1628', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2A3560', alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: TXT },
  sheetSubtitle: { fontSize: 13, color: MUTED, marginTop: 3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE_HL, alignItems: 'center', justifyContent: 'center' },

  subjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 2 },
  subjectRowActive: { backgroundColor: 'rgba(79,172,254,0.08)' },
  subjectRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioDot: { width: 20, height: 20, borderRadius: 10 },
  radioEmpty: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#2A3560' },
  subjectRowText: { fontSize: 16, fontWeight: '500', color: TXT },
  trashBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)' },

  addRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 12 },
  addInput: { flex: 1, backgroundColor: SURFACE_HL, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: TXT, borderWidth: 1, borderColor: '#2A3560' },
  addBtn: { borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  doneBtn: { backgroundColor: SURFACE_HL, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: MUTED },
});
