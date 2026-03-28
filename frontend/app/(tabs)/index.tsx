import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { GRADIENTS } from '../../src/constants/colors';
import { MOCK_WEEKLY_HOURS, MOCK_WEAK_SUBJECTS, DAYS } from '../../src/constants/mockData';
import { F } from '../../src/constants/fonts';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

const BAR_MAX_H = 80;

// Premium dark palette
const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const ORANGE = '#FF6D00';
const RED = '#EF4444';
const PURPLE_START = '#A78BFA';
const PURPLE_END = '#7C3AED';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [weeklyHours, setWeeklyHours] = useState(MOCK_WEEKLY_HOURS);
  const [weakSubjects, setWeakSubjects] = useState(MOCK_WEAK_SUBJECTS);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'Day' | 'Week'>('Week');

  const totalHours = weeklyHours.reduce((a, b) => a + b, 0).toFixed(1);
  const maxHour = Math.max(...weeklyHours, 0.1);
  const todayIndex = (new Date().getDay() + 6) % 7;

  const fetchData = async () => {
    try {
      const [wRes, eRes] = await Promise.all([
        apiFetch('/api/stats/weekly'),
        apiFetch('/api/stats/errors'),
      ]);
      if (wRes.ok) {
        const d = await wRes.json();
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN} />}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Feather name="user" size={17} color={CYAN} />
            </View>
            <Text style={s.appTitle}>{user?.username || 'MyStudyBody'}</Text>
          </View>
          <View style={s.streakBadge}>
            <Text style={s.streakNum}>7</Text>
            <Feather name="zap" size={14} color={ORANGE} />
          </View>
        </View>

        {/* ── Welcome & Headline ── */}
        <Text style={s.welcome}>Welcome back, {user?.username || 'Alex'}</Text>
        <Text style={s.headline}>
          {'Your mind is\nan '}
          <Text style={s.headlineAccent}>architect.</Text>
        </Text>

        {/* ── Performance Overview ── */}
        <View style={s.perfCard}>
          <Text style={s.perfLabel}>PERFORMANCE OVERVIEW</Text>
          <Text style={s.perfTitle}>Total Study Hours</Text>
          <View style={s.perfValueRow}>
            <Text testID="total-hours-value" style={s.perfValue}>{totalHours}</Text>
            <Text style={s.perfUnit}> hrs</Text>
          </View>
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statBoxLabel}>Weekly{`\n`}Goal</Text>
              <Text style={s.statBoxValue}>82%</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statBoxLabel}>Efficiency</Text>
              <Text style={s.statBoxValue}>94%</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statBoxLabel}>Focus{`\n`}Score</Text>
              <Text style={[s.statBoxValue, { color: CYAN }]}>A+</Text>
            </View>
          </View>
        </View>

        {/* ── Weak Subjects ── */}
        <View style={s.weakCard}>
          <View style={s.weakHeader}>
            <Text style={s.weakTitle}>Weak Subjects</Text>
            <Feather name="alert-triangle" size={18} color={ORANGE} />
          </View>
          {weakSubjects.slice(0, 3).map((item, i) => (
            <View testID={`weak-subject-${item.subject.toLowerCase()}`} key={i} style={s.weakItem}>
              <View style={s.weakInfo}>
                <Text style={s.weakName}>{item.subject}</Text>
                <Text style={s.weakDetail} numberOfLines={1}>
                  {item.topics?.[0] || 'Review needed'}
                </Text>
              </View>
              <View style={s.errBadge}>
                <Text style={s.errBadgeText}>{item.errors} errors</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={s.examBtnWrap} activeOpacity={0.85} onPress={() => router.push('/exam')}>
            <LinearGradient
              colors={[PURPLE_START, PURPLE_END]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.examGrad}
            >
              <Text style={s.examBtnText}>Generate Practice Exam</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Action Cards ── */}
        <TouchableOpacity
          testID="start-pomodoro-btn"
          style={[s.actionCard, { borderColor: CYAN }]}
          onPress={() => router.push('/(tabs)/pomodoro')}
          activeOpacity={0.85}
        >
          <View style={[s.actionIconBox, { backgroundColor: `${CYAN}22` }]}>
            <Feather name="play-circle" size={22} color={CYAN} />
          </View>
          <View style={s.actionInfo}>
            <Text style={s.actionTitle}>Start Pomodoro</Text>
            <Text style={s.actionSub}>Deep work session: 25 mins</Text>
          </View>
          <Feather name="chevron-right" size={20} color={MUTED} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="scan-error-btn"
          style={[s.actionCard, { borderColor: ORANGE, marginBottom: 20 }]}
          onPress={() => router.push('/(tabs)/scanner')}
          activeOpacity={0.85}
        >
          <View style={[s.actionIconBox, { backgroundColor: `${ORANGE}22` }]}>
            <Feather name="camera" size={22} color={ORANGE} />
          </View>
          <View style={s.actionInfo}>
            <Text style={s.actionTitle}>Scan Error</Text>
            <Text style={s.actionSub}>Instant AI analysis from photo</Text>
          </View>
          <Feather name="chevron-right" size={20} color={MUTED} />
        </TouchableOpacity>

        {/* ── Daily Focus Trends ── */}
        <View testID="weekly-chart" style={s.trendsCard}>
          <View style={s.trendsTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.trendsTitle}>Daily Focus Trends</Text>
              <Text style={s.trendsSub}>Measuring cognitive load throughout the week</Text>
            </View>
            <View style={s.trendsToggle}>
              {(['Day', 'Week'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setChartPeriod(p)}
                  style={[s.toggleBtn, chartPeriod === p && s.toggleBtnActive]}
                >
                  <Text style={[s.toggleTxt, chartPeriod === p && s.toggleTxtActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.chartRow}>
            {weeklyHours.map((h, i) => (
              <View key={i} style={s.barCol}>
                <View style={s.barTrack}>
                  {i === todayIndex ? (
                    <LinearGradient
                      colors={GRADIENTS.study as any}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 0, y: 0 }}
                      style={[s.bar, { height: Math.max(4, (h / maxHour) * BAR_MAX_H) }]}
                    />
                  ) : (
                    <View style={[s.bar, {
                      height: Math.max(4, (h / maxHour) * BAR_MAX_H),
                      backgroundColor: SURFACE_HL,
                    }]} />
                  )}
                </View>
                <Text style={[s.barDay, i === todayIndex && { color: CYAN, fontFamily: F.bld }]}>
                  {DAYS[i]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20, paddingBottom: 28 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 18 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${CYAN}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${CYAN}40` },
  appTitle: { fontSize: 18, fontFamily: F.bld, color: CYAN, letterSpacing: 0.2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SURFACE, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: `${ORANGE}30` },
  streakNum: { fontSize: 15, fontFamily: F.bld, color: TXT },

  // Welcome
  welcome: { fontSize: 13, fontFamily: F.reg, color: MUTED, marginBottom: 6 },
  headline: { fontSize: 34, fontFamily: F.xbld, color: TXT, lineHeight: 42, marginBottom: 22 },
  headlineAccent: { color: CYAN, fontFamily: F.xbld },

  // Performance
  perfCard: { backgroundColor: SURFACE, borderRadius: 18, padding: 20, marginBottom: 16 },
  perfLabel: { fontSize: 10, fontFamily: F.sem, color: MUTED, letterSpacing: 1.4, marginBottom: 4 },
  perfTitle: { fontSize: 13, fontFamily: F.reg, color: MUTED, marginBottom: 4 },
  perfValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 },
  perfValue: { fontSize: 52, fontFamily: F.xbld, color: TXT, lineHeight: 60 },
  perfUnit: { fontSize: 18, fontFamily: F.sem, color: MUTED, marginBottom: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'stretch' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statDivider: { width: 1, backgroundColor: SURFACE_HL, marginVertical: 4 },
  statBoxLabel: { fontSize: 10, fontFamily: F.reg, color: MUTED, textAlign: 'center', lineHeight: 14, marginBottom: 6 },
  statBoxValue: { fontSize: 20, fontFamily: F.xbld, color: TXT },

  // Weak Subjects
  weakCard: { backgroundColor: SURFACE, borderRadius: 18, padding: 18, marginBottom: 16 },
  weakHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  weakTitle: { fontSize: 16, fontFamily: F.bld, color: TXT },
  weakItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: SURFACE_HL },
  weakInfo: { flex: 1 },
  weakName: { fontSize: 14, fontFamily: F.sem, color: TXT },
  weakDetail: { fontSize: 12, fontFamily: F.reg, color: MUTED, marginTop: 2 },
  errBadge: { backgroundColor: `${RED}18`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  errBadgeText: { fontSize: 11, fontFamily: F.sem, color: RED },
  examBtnWrap: { borderRadius: 30, overflow: 'hidden', marginTop: 16 },
  examGrad: { paddingVertical: 13, alignItems: 'center', borderRadius: 30 },
  examBtnText: { fontSize: 14, fontFamily: F.bld, color: '#fff' },

  // Action Cards
  actionCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5 },
  actionIconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 16, fontFamily: F.bld, color: TXT },
  actionSub: { fontSize: 12, fontFamily: F.reg, color: MUTED, marginTop: 3 },

  // Daily Trends
  trendsCard: { backgroundColor: SURFACE, borderRadius: 18, padding: 18, marginBottom: 8 },
  trendsTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18, gap: 10 },
  trendsTitle: { fontSize: 15, fontFamily: F.bld, color: TXT, marginBottom: 3 },
  trendsSub: { fontSize: 11, fontFamily: F.reg, color: MUTED, lineHeight: 16 },
  trendsToggle: { flexDirection: 'row', backgroundColor: SURFACE_HL, borderRadius: 10, padding: 3 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: BG },
  toggleTxt: { fontSize: 12, fontFamily: F.sem, color: MUTED },
  toggleTxtActive: { color: TXT },

  // Chart
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: BAR_MAX_H + 24 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: 24, height: BAR_MAX_H, backgroundColor: SURFACE_HL, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barDay: { fontSize: 11, fontFamily: F.sem, color: MUTED, marginTop: 6 },
});
