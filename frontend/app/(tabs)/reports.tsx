import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import {
  MOCK_WEEKLY_ERRORS, MOCK_MONTHLY_ERRORS, MOCK_AI_STUDY_PLAN, SUBJECT_COLORS,
} from '../../src/constants/mockData';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BAR_MAX_H = 100;
type Period = 'weekly' | 'monthly';

export default function ReportsScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [period, setPeriod] = useState<Period>('weekly');
  const [errorData, setErrorData] = useState(MOCK_WEEKLY_ERRORS);
  const [realWeeklyData, setRealWeeklyData] = useState<typeof MOCK_WEEKLY_ERRORS | null>(null);
  const [studyPlan, setStudyPlan] = useState(MOCK_AI_STUDY_PLAN);

  const fetchErrors = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stats/errors`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const weekly = data.map((d: any) => ({ subject: d.subject, errors: d.errors }));
          setRealWeeklyData(weekly);
          if (period === 'weekly') setErrorData(weekly);
          // Build AI study plan from real data
          const plan = data.slice(0, 5).map((d: any, i: number) => ({
            id: String(i),
            subject: d.subject,
            task: `Review ${d.topics?.[0] || d.subject}`,
            detail: `${d.errors} error${d.errors !== 1 ? 's' : ''} logged`,
            priority: d.errors >= 5 ? 'high' : d.errors >= 3 ? 'medium' : 'low',
            color: d.errors >= 5 ? colors.error : d.errors >= 3 ? colors.secondary : colors.success,
          }));
          if (plan.length > 0) setStudyPlan(plan);
        }
      }
    } catch (_) {}
  };

  useEffect(() => { fetchErrors(); }, []);

  // Period toggle: use real data for weekly (if available), mock for monthly
  useEffect(() => {
    if (period === 'weekly') {
      setErrorData(realWeeklyData && realWeeklyData.length > 0 ? realWeeklyData : MOCK_WEEKLY_ERRORS);
    } else {
      setErrorData(MOCK_MONTHLY_ERRORS);
    }
  }, [period, realWeeklyData]);

  const maxErrors = Math.max(...errorData.map((d) => d.errors), 1);
  const totalErrors = errorData.reduce((a, b) => a + b.errors, 0);

  const priorityBadgeColor = (p: string) =>
    p === 'high' ? colors.error : p === 'medium' ? colors.secondary : colors.success;

  return (
    <SafeAreaView testID="reports-screen" style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Header */}
        <Text style={s.title}>AI Reports</Text>
        <Text style={s.subtitle}>Understand your weak points 📊</Text>

        {/* Period Toggle */}
        <View testID="period-toggle" style={s.toggle}>
          {(['weekly', 'monthly'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              testID={`period-${p}-btn`}
              style={[s.toggleBtn, period === p && { backgroundColor: colors.primary }]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[s.toggleText, period === p && { color: '#fff' }]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: `${colors.error}15` }]}>
            <Text style={[s.summaryValue, { color: colors.error }]}>{totalErrors}</Text>
            <Text style={s.summaryLabel}>Total Errors</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: `${colors.primary}15` }]}>
            <Text style={[s.summaryValue, { color: colors.primary }]}>{errorData.length}</Text>
            <Text style={s.summaryLabel}>Subjects</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: `${colors.success}15` }]}>
            <Text style={[s.summaryValue, { color: colors.success }]}>
              {errorData.length > 0 ? errorData[0].subject.slice(0, 4) : '—'}
            </Text>
            <Text style={s.summaryLabel}>Weakest</Text>
          </View>
        </View>

        {/* Bar Chart */}
        <View testID="error-chart" style={s.card}>
          <Text style={s.cardTitle}>Errors by Subject</Text>
          <Text style={s.cardSubtitle}>{period === 'weekly' ? 'This Week' : 'This Month'}</Text>
          <View style={s.chartRow}>
            {errorData.map((item, i) => (
              <View key={i} style={s.barCol}>
                <Text style={s.barVal}>{item.errors}</Text>
                <View style={s.barTrack}>
                  <View
                    style={[
                      s.bar,
                      {
                        height: (item.errors / maxErrors) * BAR_MAX_H,
                        backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
                      },
                    ]}
                  />
                </View>
                <Text style={s.barLabel} numberOfLines={1}>
                  {item.subject.slice(0, 4)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Trend Insight */}
        <View style={[s.insightCard, { backgroundColor: `${colors.primary}12` }]}>
          <Ionicons name="trending-up-outline" size={22} color={colors.primary} />
          <View style={s.insightText}>
            <Text style={[s.insightTitle, { color: colors.primary }]}>AI Insight</Text>
            <Text style={s.insightBody}>
              {errorData[0]?.subject || 'Math'} has the most errors ({errorData[0]?.errors || 0}).
              Focus on it first this week!
            </Text>
          </View>
        </View>

        {/* AI Study Plan */}
        <Text style={s.sectionTitle}>🤖 AI Recommended Study Plan</Text>
        {studyPlan.map((item) => (
          <View testID={`study-plan-${item.id}`} key={item.id} style={s.planCard}>
            <View style={[s.planPriority, { backgroundColor: priorityBadgeColor(item.priority) }]}>
              <Text style={s.planPriorityText}>{item.priority.toUpperCase()}</Text>
            </View>
            <View style={s.planContent}>
              <Text style={s.planTask}>{item.task}</Text>
              <Text style={s.planSubject}>{item.subject} · {item.detail}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.textSecondary} />
          </View>
        ))}

        {/* Motivational footer */}
        <View style={[s.motivationCard, { backgroundColor: colors.surface }]}>
          <Text style={s.motivationText}>
            💡 "The secret of getting ahead is getting started." — Mark Twain
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingBottom: 32 },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, marginTop: 20 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
    toggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 20, alignSelf: 'flex-start' },
    toggleBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    toggleText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    summaryCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
    summaryValue: { fontSize: 24, fontWeight: '900' },
    summaryLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 3, fontWeight: '600' },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginBottom: 16 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 16 },
    chartRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: BAR_MAX_H + 40 },
    barCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
    barVal: { fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' },
    barTrack: { width: 28, height: BAR_MAX_H, backgroundColor: colors.surfaceHighlight, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
    bar: { width: '100%', borderRadius: 6 },
    barLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 6, fontWeight: '600', textAlign: 'center' },
    insightCard: { flexDirection: 'row', gap: 12, borderRadius: 14, padding: 16, marginBottom: 24, alignItems: 'flex-start' },
    insightText: { flex: 1 },
    insightTitle: { fontSize: 14, fontWeight: '700' },
    insightBody: { fontSize: 13, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
    planCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
    planPriority: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    planPriorityText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    planContent: { flex: 1 },
    planTask: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    planSubject: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
    motivationCard: { borderRadius: 14, padding: 18, marginTop: 8 },
    motivationText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center', fontStyle: 'italic' },
  });
