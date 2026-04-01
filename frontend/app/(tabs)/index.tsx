import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  Modal, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle, Defs, LinearGradient as SvgGradient, Stop, Text as SvgText,
} from 'react-native-svg';
import { useRouter } from 'expo-router';
import { GRADIENTS } from '../../src/constants/colors';
import { MOCK_WEEKLY_HOURS, MOCK_WEAK_SUBJECTS, DAYS } from '../../src/constants/mockData';
import { F } from '../../src/constants/fonts';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

const { height: SCREEN_H } = Dimensions.get('window');

interface SubjectStat {
  subject: string;
  total_minutes: number;
  total_hours: number;
}

const SUBJECT_COLORS: Record<string, string> = {
  Math: '#4361EE',
  Physics: '#7B5CF0',
  Chemistry: '#FB923C',
  Biology: '#10B981',
  History: '#F59E0B',
  Geography: '#34D399',
  Turkish: '#F472B6',
  English: '#60A5FA',
  Philosophy: '#C084FC',
};

function getSubjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || '#4361EE';
}

const BAR_MAX_H = 80;

// New electric blue + purple dark palette
const BG = '#060B18';
const SURFACE = '#0E1525';
const SURFACE_HL = '#162035';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const BLUE = '#4361EE';
const PURPLE = '#7B5CF0';
const ORANGE = '#FF6D00';
const CYAN = '#4361EE';   // alias kept for compatibility
const RED = '#EF4444';
const PURPLE_START = '#7B5CF0';
const PURPLE_END = '#4361EE';

// ── SVG Donut Ring Chart ──────────────────────────────
function DonutChart({ hours, goalPct }: { hours: string; goalPct: number | null }) {
  const SIZE = 148;
  const STROKE = 13;
  const R = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * R;
  const progress = goalPct != null ? Math.min(goalPct / 100, 1) : 0.38;
  const offset = circ * (1 - progress);

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={BLUE} />
          <Stop offset="100%" stopColor={PURPLE} />
        </SvgGradient>
      </Defs>
      {/* Background ring */}
      <Circle
        cx={SIZE / 2} cy={SIZE / 2} r={R}
        stroke="#162035" strokeWidth={STROKE} fill="none"
      />
      {/* Progress ring */}
      <Circle
        cx={SIZE / 2} cy={SIZE / 2} r={R}
        stroke="url(#ringGrad)" strokeWidth={STROKE} fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${SIZE / 2}, ${SIZE / 2}`}
      />
      {/* Center: hours */}
      <SvgText
        x={SIZE / 2} y={SIZE / 2 - 8}
        textAnchor="middle"
        fill="#EDF2FF"
        fontSize="30"
        fontWeight="bold"
      >
        {hours}
      </SvgText>
      <SvgText
        x={SIZE / 2} y={SIZE / 2 + 12}
        textAnchor="middle"
        fill="#718096"
        fontSize="11"
      >
        saat / hafta
      </SvgText>
      {goalPct != null && (
        <SvgText
          x={SIZE / 2} y={SIZE / 2 + 30}
          textAnchor="middle"
          fill={BLUE}
          fontSize="12"
          fontWeight="bold"
        >
          {`%${goalPct} hedef`}
        </SvgText>
      )}
    </Svg>
  );
}

interface PerfStats {
  weekly_goal_pct: number | null;
  efficiency_pct: number | null;
  focus_grade: string | null;
  notifications_disabled: boolean;
}

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [weeklyHours, setWeeklyHours] = useState(MOCK_WEEKLY_HOURS);
  const [weakSubjects, setWeakSubjects] = useState(MOCK_WEAK_SUBJECTS);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'Day' | 'Week'>('Week');
  const [perfStats, setPerfStats] = useState<PerfStats>({
    weekly_goal_pct: null,
    efficiency_pct: null,
    focus_grade: null,
    notifications_disabled: false,
  });

  // Subject breakdown modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [allTimeHours, setAllTimeHours] = useState<number>(0);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const totalHours = weeklyHours.reduce((a, b) => a + b, 0).toFixed(1);
  const maxHour = Math.max(...weeklyHours, 0.1);
  const todayIndex = (new Date().getDay() + 6) % 7;

  const fetchData = async () => {
    try {
      const [wRes, eRes, pRes] = await Promise.all([
        apiFetch('/api/stats/weekly'),
        apiFetch('/api/stats/errors'),
        apiFetch('/api/stats/performance'),
      ]);
      if (wRes.ok) {
        const d = await wRes.json();
        if (d.daily_hours?.length === 7 && d.total_hours > 0) setWeeklyHours(d.daily_hours);
      }
      if (eRes.ok) {
        const d = await eRes.json();
        if (d.length > 0) setWeakSubjects(d);
      }
      if (pRes.ok) {
        const d = await pRes.json();
        setPerfStats(d);
      }
    } catch (_) {}
  };

  const openSubjectModal = async () => {
    setShowSubjectModal(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (subjectStats.length === 0) {
      setLoadingSubjects(true);
      try {
        const res = await apiFetch('/api/stats/subjects');
        if (res.ok) {
          const d = await res.json();
          setSubjectStats(d.subjects || []);
          setAllTimeHours(d.total_hours || 0);
        }
      } catch (_) {} finally {
        setLoadingSubjects(false);
      }
    }
  };

  const closeSubjectModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_H,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowSubjectModal(false));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSubjectStats([]); // force refresh subject stats too
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
        <TouchableOpacity onPress={openSubjectModal} activeOpacity={0.88}>
        <View style={s.perfCard}>
          {/* Card header */}
          <View style={s.perfCardTop}>
            <Text style={s.perfLabel}>HAFTALIK PERFORMANS</Text>
            <View style={s.perfTapHint}>
              <Feather name="bar-chart-2" size={12} color={BLUE} />
              <Text style={s.perfTapHintText}>Dağılım</Text>
            </View>
          </View>

          {/* Body: Donut + Stats side by side */}
          <View style={s.perfBody}>
            {/* Donut ring chart */}
            <DonutChart hours={totalHours} goalPct={perfStats.weekly_goal_pct} />

            {/* Right side stats */}
            <View style={s.perfRightStats}>
              <View style={s.perfStatItem}>
                <Text style={s.perfStatLabel}>Haftalık Hedef</Text>
                <Text style={s.perfStatValue}>
                  {perfStats.weekly_goal_pct != null ? `${perfStats.weekly_goal_pct}%` : '—'}
                </Text>
              </View>
              <View style={s.perfStatSep} />
              <View style={s.perfStatItem}>
                <Text style={s.perfStatLabel}>Verimlilik</Text>
                <Text style={s.perfStatValue}>
                  {perfStats.efficiency_pct != null ? `${perfStats.efficiency_pct}%` : '—'}
                </Text>
              </View>
              <View style={s.perfStatSep} />
              <View style={s.perfStatItem}>
                <Text style={s.perfStatLabel}>Odak Skoru</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[s.perfStatValue, { color: BLUE }]}>
                    {perfStats.focus_grade ?? '—'}
                  </Text>
                  {perfStats.notifications_disabled && perfStats.focus_grade && (
                    <Feather name="bell-off" size={11} color={BLUE} />
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
        </TouchableOpacity>

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
          style={[s.actionCard, { borderColor: BLUE }]}
          onPress={() => router.push('/(tabs)/pomodoro')}
          activeOpacity={0.85}
        >
          <View style={[s.actionIconBox, { backgroundColor: `${BLUE}22` }]}>
            <Feather name="play-circle" size={22} color={BLUE} />
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

      {/* ── Subject Breakdown Modal ── */}
      <Modal visible={showSubjectModal} transparent animationType="none" onRequestClose={closeSubjectModal}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={closeSubjectModal}>
          <Animated.View style={[s.modalSheet, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity activeOpacity={1}>
              {/* Handle */}
              <View style={s.modalHandle} />

              {/* Modal Header */}
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>Ders Dağılımı</Text>
                  <Text style={s.modalSub}>
                    {allTimeHours > 0 ? `Toplam ${allTimeHours} saat ders` : 'Tüm zamanlar'}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeSubjectModal} style={s.modalClose}>
                  <Feather name="x" size={18} color={MUTED} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              {loadingSubjects ? (
                <View style={s.modalLoading}>
                  <Feather name="loader" size={24} color={CYAN} />
                  <Text style={s.modalLoadingText}>Yükleniyor...</Text>
                </View>
              ) : subjectStats.length === 0 ? (
                <View style={s.modalEmpty}>
                  <Feather name="clock" size={40} color={MUTED} />
                  <Text style={s.modalEmptyTitle}>Henüz oturum yok</Text>
                  <Text style={s.modalEmptyText}>
                    Pomodoro ile ders çalışıp kaydet butonuna bas, burada görünecek.
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                  {(() => {
                    const maxMins = Math.max(...subjectStats.map((s) => s.total_minutes), 1);
                    return subjectStats.map((item, i) => {
                      const pct = Math.max(4, (item.total_minutes / maxMins) * 100);
                      const color = getSubjectColor(item.subject);
                      const hrs = item.total_hours;
                      const mins = item.total_minutes % 60;
                      const timeStr = hrs >= 1
                        ? `${hrs}s ${mins > 0 ? mins + 'dk' : ''}`
                        : `${item.total_minutes}dk`;
                      return (
                        <View key={i} style={s.subjectRow}>
                          <View style={s.subjectRowLeft}>
                            <View style={[s.subjectDot, { backgroundColor: color }]} />
                            <Text style={s.subjectName} numberOfLines={1}>{item.subject}</Text>
                          </View>
                          <View style={s.barArea}>
                            <View style={s.barTrackModal}>
                              <LinearGradient
                                colors={[color, `${color}99`]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[s.barFill, { width: `${pct}%` as any }]}
                              />
                            </View>
                          </View>
                          <Text style={[s.subjectTime, { color }]}>{timeStr}</Text>
                        </View>
                      );
                    });
                  })()}
                </ScrollView>
              )}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20, paddingBottom: 28 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 18 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${BLUE}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${BLUE}40` },
  appTitle: { fontSize: 18, fontFamily: F.bld, color: BLUE, letterSpacing: 0.2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SURFACE, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: `${ORANGE}40` },
  streakNum: { fontSize: 15, fontFamily: F.bld, color: TXT },

  // Welcome
  welcome: { fontSize: 13, fontFamily: F.reg, color: MUTED, marginBottom: 6 },
  headline: { fontSize: 34, fontFamily: F.xbld, color: TXT, lineHeight: 42, marginBottom: 22 },
  headlineAccent: { color: BLUE, fontFamily: F.xbld },

  // Performance Card — new donut layout
  perfCard: { backgroundColor: SURFACE, borderRadius: 22, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: `${BLUE}18` },
  perfCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  perfLabel: { fontSize: 10, fontFamily: F.bld, color: BLUE, letterSpacing: 1.6 },
  perfTapHint: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${BLUE}15`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  perfTapHintText: { fontSize: 10, fontFamily: F.sem, color: BLUE },
  // Donut layout
  perfBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  perfRightStats: { flex: 1, gap: 0 },
  perfStatItem: { paddingVertical: 10 },
  perfStatLabel: { fontSize: 10, fontFamily: F.reg, color: MUTED, letterSpacing: 0.8, marginBottom: 4 },
  perfStatValue: { fontSize: 22, fontFamily: F.xbld, color: TXT },
  perfStatSep: { height: 1, backgroundColor: SURFACE_HL },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0A1120',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: SCREEN_H * 0.75,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#1E2D4A', alignSelf: 'center', marginBottom: 22 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontFamily: F.xbld, color: TXT },
  modalSub: { fontSize: 12, fontFamily: F.reg, color: MUTED, marginTop: 4 },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE_HL, alignItems: 'center', justifyContent: 'center' },
  modalLoading: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  modalLoadingText: { fontSize: 14, fontFamily: F.reg, color: MUTED },
  modalEmpty: { paddingVertical: 40, alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  modalEmptyTitle: { fontSize: 16, fontFamily: F.bld, color: TXT },
  modalEmptyText: { fontSize: 13, fontFamily: F.reg, color: MUTED, textAlign: 'center', lineHeight: 20 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  subjectRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 90 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  subjectName: { fontSize: 13, fontFamily: F.sem, color: TXT, flex: 1 },
  barArea: { flex: 1 },
  barTrackModal: { height: 10, backgroundColor: SURFACE_HL, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  subjectTime: { fontSize: 13, fontFamily: F.bld, width: 52, textAlign: 'right' },

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
  toggleBtnActive: { backgroundColor: `${BLUE}30`, borderWidth: 1, borderColor: `${BLUE}40` },
  toggleTxt: { fontSize: 12, fontFamily: F.sem, color: MUTED },
  toggleTxtActive: { color: BLUE },

  // Chart
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: BAR_MAX_H + 24 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: 24, height: BAR_MAX_H, backgroundColor: SURFACE_HL, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barDay: { fontSize: 11, fontFamily: F.sem, color: MUTED, marginTop: 6 },
});
