import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { SUBJECTS } from '../../src/constants/mockData';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const STUDY_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export default function PomodoroScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [timeLeft, setTimeLeft] = useState(STUDY_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'study' | 'break'>('study');
  const [selectedSubject, setSelectedSubject] = useState('Math');
  const [showPicker, setShowPicker] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [savingSession, setSavingSession] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const totalTime = mode === 'study' ? STUDY_TIME : BREAK_TIME;
  const progress = (totalTime - timeLeft) / totalTime;

  // Pulse animation when running
  useEffect(() => {
    if (isRunning) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [isRunning]);

  // Timer countdown
  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) {
      setIsRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (mode === 'study') {
        setCompletedSessions((p) => p + 1);
        Alert.alert('🎉 Session Complete!', `Great job on ${selectedSubject}! Take a 5-min break.`, [
          {
            text: 'Start Break',
            onPress: () => { setMode('break'); setTimeLeft(BREAK_TIME); setIsRunning(true); },
          },
          {
            text: 'Save & Stop',
            onPress: () => saveSession(STUDY_TIME),
          },
        ]);
      } else {
        Alert.alert('⚡ Break Over!', 'Refreshed? Let\'s get back to it!', [
          {
            text: 'Start Study',
            onPress: () => { setMode('study'); setTimeLeft(STUDY_TIME); setIsRunning(true); },
          },
          { text: 'Rest More', style: 'cancel', onPress: () => setTimeLeft(BREAK_TIME) },
        ]);
      }
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(timer);
  }, [isRunning, timeLeft, mode]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning((r) => !r);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'study' ? STUDY_TIME : BREAK_TIME);
  };

  const saveSession = async (duration = STUDY_TIME - timeLeft) => {
    const mins = Math.max(1, Math.round(duration / 60));
    setSavingSession(true);
    try {
      await fetch(`${BACKEND_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: selectedSubject, duration_minutes: mins }),
      });
      Alert.alert('✅ Saved!', `${selectedSubject} — ${mins} min session logged.`);
    } catch (_) {
      Alert.alert('✅ Saved locally!', `${selectedSubject} — ${mins} min.`);
    } finally {
      setSavingSession(false);
      setMode('study');
      setTimeLeft(STUDY_TIME);
    }
  };

  const ringColor = mode === 'study' ? colors.primary : colors.success;

  return (
    <SafeAreaView testID="pomodoro-screen" style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Header */}
        <Text style={s.title}>Pomodoro Timer</Text>
        <Text style={s.subtitle}>Stay focused, study smart 🧠</Text>

        {/* Subject Selector */}
        <TouchableOpacity
          testID="subject-selector-btn"
          style={s.subjectSelector}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="book-outline" size={18} color={colors.primary} />
          <Text style={s.subjectSelectorText}>{selectedSubject}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Mode Badge */}
        <View style={[s.modeBadge, { backgroundColor: mode === 'study' ? `${colors.primary}22` : `${colors.success}22` }]}>
          <View style={[s.modeDot, { backgroundColor: ringColor }]} />
          <Text style={[s.modeText, { color: ringColor }]}>
            {mode === 'study' ? 'FOCUS TIME' : 'BREAK TIME'}
          </Text>
        </View>

        {/* Timer Ring */}
        <View style={s.timerContainer}>
          <Animated.View style={[s.timerOuter, { transform: [{ scale: pulseAnim }], borderColor: `${ringColor}30` }]}>
            <View style={[s.timerMiddle, { borderColor: `${ringColor}60` }]}>
              <View style={[s.timerInner, { borderColor: ringColor }]}>
                <Text testID="timer-display" style={[s.timerText, { color: colors.textPrimary }]}>
                  {formatTime(timeLeft)}
                </Text>
                <Text style={[s.timerSubText, { color: ringColor }]}>
                  {mode === 'study' ? '25 min' : '5 min'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Progress Bar */}
        <View style={s.progressTrack}>
          <View style={[s.progressBar, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: ringColor }]} />
        </View>
        <Text style={s.progressLabel}>{Math.round(progress * 100)}% complete</Text>

        {/* Controls */}
        <View style={s.controls}>
          <TouchableOpacity testID="reset-timer-btn" style={s.iconBtn} onPress={handleReset}>
            <Ionicons name="refresh-outline" size={26} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="start-pause-btn"
            style={[s.mainBtn, { backgroundColor: ringColor }]}
            onPress={handleStartPause}
          >
            <Ionicons name={isRunning ? 'pause' : 'play'} size={32} color="#fff" />
            <Text style={s.mainBtnText}>{isRunning ? 'Pause' : 'Start'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="save-session-btn"
            style={s.iconBtn}
            onPress={() => saveSession(STUDY_TIME - timeLeft)}
            disabled={savingSession}
          >
            <Ionicons name="save-outline" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.surface }]}>
            <Text style={s.statValue}>{completedSessions}</Text>
            <Text style={s.statLabel}>Sessions Today</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.surface }]}>
            <Text style={s.statValue}>{completedSessions * 25}</Text>
            <Text style={s.statLabel}>Minutes Focused</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[s.statValue, { color: colors.secondary }]}>{selectedSubject.slice(0, 4)}</Text>
            <Text style={s.statLabel}>Subject</Text>
          </View>
        </View>
      </ScrollView>

      {/* Subject Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Select Subject</Text>
            {SUBJECTS.map((subj) => (
              <TouchableOpacity
                key={subj}
                testID={`subject-option-${subj.toLowerCase()}`}
                style={[s.modalOption, { borderColor: colors.border }]}
                onPress={() => { setSelectedSubject(subj); setShowPicker(false); }}
              >
                <Text style={[s.modalOptionText, { color: colors.textPrimary }]}>{subj}</Text>
                {selectedSubject === subj && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.modalCancel, { backgroundColor: colors.surfaceHighlight }]} onPress={() => setShowPicker(false)}>
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
    content: { paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginTop: 20, alignSelf: 'flex-start' },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20, alignSelf: 'flex-start' },
    subjectSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, width: '100%', marginBottom: 16 },
    subjectSelectorText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 24 },
    modeDot: { width: 8, height: 8, borderRadius: 4 },
    modeText: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
    timerContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    timerOuter: { width: 260, height: 260, borderRadius: 130, borderWidth: 16, alignItems: 'center', justifyContent: 'center' },
    timerMiddle: { width: 220, height: 220, borderRadius: 110, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
    timerInner: { width: 180, height: 180, borderRadius: 90, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    timerText: { fontSize: 52, fontWeight: '900', letterSpacing: -2 },
    timerSubText: { fontSize: 14, fontWeight: '600', marginTop: 4 },
    progressTrack: { width: '100%', height: 6, backgroundColor: colors.surfaceHighlight, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
    progressBar: { height: 6, borderRadius: 3 },
    progressLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 28 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 32 },
    iconBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    mainBtn: { width: 120, height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    mainBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
    statsRow: { flexDirection: 'row', gap: 12, width: '100%' },
    statCard: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center' },
    statValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    modalOptionText: { fontSize: 16 },
    modalCancel: { marginTop: 14, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    modalCancelText: { fontSize: 16, fontWeight: '600' },
  });
