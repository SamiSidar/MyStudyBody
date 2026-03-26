import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MOCK_WEEKLY_ERRORS, MOCK_MONTHLY_ERRORS, MOCK_AI_STUDY_PLAN, SUBJECT_COLORS,
} from '../../src/constants/mockData';
import { GRADIENTS } from '../../src/constants/colors';
import { F } from '../../src/constants/fonts';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/utils/api';

const BAR_MAX_H = 100;
type Period = 'weekly' | 'monthly';

const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const ORANGE = '#FF6D00';
const GREEN = '#10B981';

const PLAN_ICONS = [
  { icon: 'triangle', color: '#4FACFE', bg: 'rgba(79,172,254,0.18)' },
  { icon: 'zap', color: '#A78BFA', bg: 'rgba(167,139,250,0.18)' },
  { icon: 'layers', color: '#FB923C', bg: 'rgba(251,146,60,0.18)' },
  { icon: 'activity', color: '#4FACFE', bg: 'rgba(0,242,254,0.18)' },
  { icon: 'book-open', color: '#F472B6', bg: 'rgba(244,114,182,0.18)' },
  { icon: 'clock', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)' },
];

export default function ReportsScreen() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [errorData, setErrorData] = useState(MOCK_WEEKLY_ERRORS);
  const [realWeeklyData, setRealWeeklyData] = useState<typeof MOCK_WEEKLY_ERRORS | null>(null);
  const [studyPlan, setStudyPlan] = useState(MOCK_AI_STUDY_PLAN);

  const fetchErrors = async () => {
    try {
      const res = await apiFetch('/api/stats/errors');
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const weekly = data.map((d: any) => ({ subject: d.subject, errors: d.errors }));
          setRealWeeklyData(weekly);
          if (period === 'weekly') setErrorData(weekly);
          const plan = data.slice(0, 5).map((d: any, i: number) => ({
            id: String(i),
            subject: d.subject,
            task: `Review ${d.topics?.[0] || d.subject}`,
            detail: `${d.errors} error${d.errors !== 1 ? 's' : ''} logged`,
            priority: d.errors >= 5 ? 'high' : d.errors >= 3 ? 'medium' : 'low',
            color: d.errors >= 5 ? '#EF4444' : d.errors >= 3 ? ORANGE : GREEN,
          }));
          if (plan.length > 0) setStudyPlan(plan);
        }
      }
    } catch (_) {}
  };

  useEffect(() => { fetchErrors(); }, []);

  useEffect(() => {
    if (period === 'weekly') {
      setErrorData(realWeeklyData && realWeeklyData.length > 0 ? realWeeklyData : MOCK_WEEKLY_ERRORS);
    } else {
      setErrorData(MOCK_MONTHLY_ERRORS);
    }
  }, [period, realWeeklyData]);

  const maxErrors = Math.max(...errorData.map((d) => d.errors), 1);
  const totalErrors = errorData.reduce((a, b) => a + b.errors, 0);

  return (
    <SafeAreaView testID="reports-screen" style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Feather name="user" size={16} color={CYAN} />
            </View>
            <Text style={s.appTitle}>{user?.username || 'MyStudyBody'}</Text>
          </View>
          <View style={s.streakBadge}>
            <Text style={s.streakNum}>7</Text>
            <Feather name="zap" size={13} color={ORANGE} />
          </View>
        </View>

        {/* Title */}
        <Text style={s.title}>AI Reports</Text>
        <Text style={s.subtitle}>Weekly performance analytics & growth insights</Text>

        {/* Errors by Subject Card */}
        <View testID="error-chart" style={s.card}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Errors by Subject</Text>
              <Text style={s.cardSubtitle}>Focus areas identified this week</Text>
            </View>
            <View style={s.periodToggle}>
              {(['weekly', 'monthly'] as Period[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  testID={`period-${p}-btn`}
                  style={[s.periodBtn, period === p && s.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
                    {p === 'weekly' ? '7 Days' : '30 Days'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.chartRow}>
            {errorData.map((item, i) => (
              <View key={i} style={s.barCol}>
                <Text style={s.barVal}>{item.errors}</Text>
                <View style={s.barTrack}>
                  <View
                    style={[
                      s.bar,
                      {
                        height: Math.max(4, (item.errors / maxErrors) * BAR_MAX_H),
                        backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
                      },
                    ]}
                  />
                </View>
                <Text style={s.barLabel} numberOfLines={1}>{item.subject.slice(0, 4)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Precision Rate */}
        <View style={s.metricCard}>
          <View style={s.metricIcon}>
            <Feather name="crosshair" size={20} color={CYAN} />
          </View>
          <View style={s.metricContent}>
            <Text style={s.metricLabel}>PRECISION RATE</Text>
            <Text style={s.metricValue}>92.4%</Text>
          </View>
          <View style={[s.metricLine, { backgroundColor: CYAN }]} />
        </View>

        {/* Deep Focus */}
        <View style={s.metricCard}>
          <View style={[s.metricIcon, { backgroundColor: `${ORANGE}18` }]}>
            <Feather name="sun" size={20} color={ORANGE} />
          </View>
          <View style={s.metricContent}>
            <Text style={s.metricLabel}>DEEP FOCUS</Text>
            <Text style={[s.metricValue, { color: TXT }]}>{(parseFloat(weeklyTotal()) + 0).toFixed(1)}h</Text>
            <Text style={s.metricDelta}>+2.4h vs last week</Text>
          </View>
          <View style={[s.metricLine, { backgroundColor: ORANGE }]} />
        </View>

        {/* AI Study Plan */}
        <View style={s.planCard}>
          <View style={s.planHeader}>
            <View style={[s.planHeaderIcon, { backgroundColor: `${CYAN}20` }]}>
              <Feather name="cpu" size={18} color={CYAN} />
            </View>
            <Text style={s.planTitle}>AI Recommended Study Plan</Text>
          </View>

          {studyPlan.map((item, idx) => (
            <TouchableOpacity
              testID={`study-plan-${item.id}`}
              key={item.id}
              style={s.planItem}
              activeOpacity={0.8}
            >
              <View style={[s.planItemIcon, { backgroundColor: PLAN_ICONS[idx % PLAN_ICONS.length].bg }]}>
                <Feather name={PLAN_ICONS[idx % PLAN_ICONS.length].icon as any} size={16} color={PLAN_ICONS[idx % PLAN_ICONS.length].color} />
              </View>
              <View style={s.planItemContent}>
                <Text style={s.planItemTitle}>{item.task}</Text>
                <Text style={s.planItemSub}>{item.subject} · {item.detail}</Text>
              </View>
              {idx === studyPlan.length - 1 ? (
                <TouchableOpacity style={s.startBtn}>
                  <LinearGradient colors={GRADIENTS.study as any} start={{x:0,y:0}} end={{x:1,y:0}} style={s.startBtnGrad}>
                    <Text style={s.startBtnText}>START</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <Feather name="chevron-right" size={16} color={MUTED} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Insight Cards */}
        <View style={s.insightCard}>
          <Text style={[s.insightTitle, { color: CYAN }]}>Subject Insight</Text>
          <Text style={s.insightBody}>
            Your accuracy in {errorData[0]?.subject || 'Mathematics'} has decreased 4% this week. Most errors occurring in common concept areas.
          </Text>
        </View>

        <View style={s.insightCard}>
          <Text style={[s.insightTitle, { color: ORANGE }]}>Time Distribution</Text>
          <Text style={s.insightBody}>
            Evening sessions (7pm – 10pm) show 15% higher session retention rates compared to early morning study blocks.
          </Text>
        </View>

        <View style={[s.insightCard, { marginBottom: 8 }]}>
          <Text style={[s.insightTitle, { color: '#F59E0B' }]}>Next Milestone</Text>
          <Text style={s.insightBody}>
            You are 12 study hours away from the Deep Diver badge. Keep up the consistent focus periods!
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function weeklyTotal() {
  const MOCK_WEEKLY_HOURS = [1.5, 2.5, 3.0, 2.0, 4.0, 1.0, 3.5];
  return MOCK_WEEKLY_HOURS.reduce((a, b) => a + b, 0).toFixed(1);
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingBottom: 32 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: `${CYAN}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${CYAN}35` },
  appTitle: { fontSize: 17, fontFamily: F.bld, color: CYAN },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SURFACE, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: `${ORANGE}25` },
  streakNum: { fontSize: 13, fontFamily: F.bld, color: TXT },

  // Title
  title: { fontSize: 30, fontFamily: F.xbld, color: TXT, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: F.reg, color: MUTED, marginBottom: 22 },

  // Errors Chart Card
  card: { backgroundColor: SURFACE, borderRadius: 18, padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  cardTitle: { fontSize: 15, fontFamily: F.bld, color: TXT },
  cardSubtitle: { fontSize: 11, fontFamily: F.reg, color: MUTED, marginTop: 2 },
  periodToggle: { flexDirection: 'row', backgroundColor: SURFACE_HL, borderRadius: 8, padding: 2 },
  periodBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 },
  periodBtnActive: { backgroundColor: BG },
  periodBtnText: { fontSize: 10, fontFamily: F.sem, color: MUTED },
  periodBtnTextActive: { color: TXT },

  chartRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: BAR_MAX_H + 30 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  barVal: { fontSize: 10, fontFamily: F.sem, color: MUTED, marginBottom: 4 },
  barTrack: { width: 30, height: BAR_MAX_H, backgroundColor: SURFACE_HL, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  barLabel: { fontSize: 10, fontFamily: F.bld, color: MUTED, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Metric Cards
  metricCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  metricIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: `${CYAN}18`, alignItems: 'center', justifyContent: 'center' },
  metricContent: { flex: 1 },
  metricLabel: { fontSize: 10, fontFamily: F.bld, color: MUTED, letterSpacing: 1.2 },
  metricValue: { fontSize: 32, fontFamily: F.xbld, color: CYAN, lineHeight: 40 },
  metricDelta: { fontSize: 11, fontFamily: F.sem, color: GREEN },
  metricLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },

  // Study Plan
  planCard: { backgroundColor: SURFACE, borderRadius: 18, padding: 18, marginBottom: 14 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  planHeaderIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planTitle: { fontSize: 16, fontFamily: F.bld, color: TXT },
  planItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: SURFACE_HL },
  planItemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planItemContent: { flex: 1 },
  planItemTitle: { fontSize: 14, fontFamily: F.bld, color: TXT },
  planItemSub: { fontSize: 11, fontFamily: F.reg, color: MUTED, marginTop: 2 },
  startBtn: { borderRadius: 20, overflow: 'hidden' },
  startBtnGrad: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  startBtnText: { fontSize: 11, fontFamily: F.xbld, color: '#fff', letterSpacing: 0.5 },

  // Insight Cards
  insightCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 16, marginBottom: 10 },
  insightTitle: { fontSize: 12, fontFamily: F.bld, letterSpacing: 0.6, marginBottom: 8 },
  insightBody: { fontSize: 13, fontFamily: F.reg, color: MUTED, lineHeight: 19 },
});
