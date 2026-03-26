import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { MOCK_WEEKLY_HOURS, MOCK_WEAK_SUBJECTS, DAYS } from '../../src/constants/mockData';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BAR_MAX_H = 80;

export default function Dashboard() {
  const { colors, toggleTheme, theme } = useTheme();
  const router = useRouter();
  const [weeklyHours, setWeeklyHours] = useState(MOCK_WEEKLY_HOURS);
  const [weakSubjects, setWeakSubjects] = useState(MOCK_WEAK_SUBJECTS);
  const [refreshing, setRefreshing] = useState(false);
  const s = makeStyles(colors);

  const totalHours = weeklyHours.reduce((a, b) => a + b, 0).toFixed(1);
  const maxHour = Math.max(...weeklyHours, 0.1);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const fetchData = async () => {
    try {
      const [wRes, eRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/stats/weekly`),
        fetch(`${BACKEND_URL}/api/stats/errors`),
      ]);
      if (wRes.ok) {
        const d = await wRes.json();
        // Only override mock data if user has actually logged sessions
        if (d.daily_hours?.length === 7 && d.total_hours > 0) setWeeklyHours(d.daily_hours);
      }
      if (eRes.ok) {
        const d = await eRes.json();
        if (d.length > 0) setWeakSubjects(d);
      }
    } catch (_) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <SafeAreaView testID="dashboard-screen" style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getGreeting()} 👋</Text>
            <Text style={s.subtitle}>Let's crush it today!</Text>
          </View>
          <TouchableOpacity testID="theme-toggle-btn" onPress={toggleTheme} style={s.themeBtn}>
            <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Total Hours Card */}
        <View testID="total-hours-card" style={s.hoursCard}>
          <View>
            <Text style={s.hoursCardLabel}>Total Study Hours</Text>
            <Text style={s.hoursCardSub}>This Week</Text>
            <Text testID="total-hours-value" style={s.hoursValue}>{totalHours}h</Text>
          </View>
          <View style={s.streakBadge}>
            <Ionicons name="flame" size={20} color={colors.secondary} />
            <Text style={s.streakText}>5 day{'\n'}streak</Text>
          </View>
        </View>

        {/* Daily Activity Chart */}
        <View testID="weekly-chart" style={s.card}>
          <Text style={s.cardTitle}>Daily Activity</Text>
          <View style={s.chartRow}>
            {weeklyHours.map((h, i) => (
              <View key={i} style={s.barCol}>
                <Text style={s.barLabel}>{h > 0 ? `${h}` : ''}</Text>
                <View style={s.barTrack}>
                  <View
                    style={[
                      s.bar,
                      {
                        height: (h / maxHour) * BAR_MAX_H,
                        backgroundColor: i === new Date().getDay() - 1 ? colors.secondary : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={s.barDay}>{DAYS[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Weak Subjects */}
        <Text style={s.sectionTitle}>⚠️ Weak Subjects</Text>
        {weakSubjects.map((item, i) => (
          <View testID={`weak-subject-${item.subject.toLowerCase()}`} key={i} style={s.subjectCard}>
            <View style={[s.subjectDot, { backgroundColor: ['#2979FF', '#FF6D00', '#10B981', '#EF4444'][i % 4] }]} />
            <View style={s.subjectInfo}>
              <Text style={s.subjectName}>{item.subject}</Text>
              <Text style={s.subjectTopics} numberOfLines={1}>
                {item.topics?.join(' · ') || 'Review needed'}
              </Text>
            </View>
            <View style={s.errorBadge}>
              <Text style={s.errorCount}>{item.errors}</Text>
              <Text style={s.errorLabel}>errors</Text>
            </View>
          </View>
        ))}

        {/* Quick Actions */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actionsRow}>
          <TouchableOpacity
            testID="start-pomodoro-btn"
            style={[s.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/pomodoro')}
          >
            <Ionicons name="timer-outline" size={26} color="#fff" />
            <Text style={s.actionText}>Start{'\n'}Pomodoro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="scan-error-btn"
            style={[s.actionBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push('/(tabs)/scanner')}
          >
            <Ionicons name="scan-outline" size={26} color="#fff" />
            <Text style={s.actionText}>Scan{'\n'}Error</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingBottom: 24 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 20 },
    greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 3 },
    themeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    hoursCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 22, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    hoursCardLabel: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
    hoursCardSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
    hoursValue: { fontSize: 52, fontWeight: '900', color: '#fff', marginTop: 6 },
    streakBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
    streakText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center', marginTop: 4 },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
    chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: BAR_MAX_H + 40 },
    barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    barLabel: { fontSize: 9, color: colors.textSecondary, marginBottom: 3 },
    barTrack: { width: 26, height: BAR_MAX_H, backgroundColor: colors.surfaceHighlight, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    bar: { width: '100%', borderRadius: 6 },
    barDay: { fontSize: 11, color: colors.textSecondary, marginTop: 6, fontWeight: '600' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
    subjectCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
    subjectDot: { width: 12, height: 12, borderRadius: 6 },
    subjectInfo: { flex: 1 },
    subjectName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    subjectTopics: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    errorBadge: { alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    errorCount: { fontSize: 20, fontWeight: '800', color: colors.error },
    errorLabel: { fontSize: 10, color: colors.error, fontWeight: '600' },
    actionsRow: { flexDirection: 'row', gap: 14, marginBottom: 8 },
    actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 18 },
    actionText: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  });
