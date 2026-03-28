import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { GRADIENTS } from '../src/constants/colors';
import { F } from '../src/constants/fonts';
import { apiFetch } from '../src/utils/api';

const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const GREEN = '#10B981';
const RED = '#EF4444';
const ORANGE = '#FF6D00';
const PURPLE = '#A78BFA';

type TimeFilter = 'week' | 'month' | 'year' | 'all';
type ExamPhase = 'filter' | 'question' | 'summary';

interface Question {
  id: string;
  subject: string;
  topic: string;
  notes: string;
  question_summary: string;
  ai_insight: string;
  image_base64: string;
  created_at: string;
}

interface QuestionResult {
  question_id: string;
  understood: boolean;
}

const TIME_FILTERS: { key: TimeFilter; label: string; icon: string }[] = [
  { key: 'week', label: 'Son 1 Hafta', icon: 'calendar' },
  { key: 'month', label: 'Son 1 Ay', icon: 'calendar' },
  { key: 'year', label: 'Son 1 Yil', icon: 'calendar' },
  { key: 'all', label: 'Tum Zamanlar', icon: 'infinity' },
];

const SUBJECTS = ['Tumu', 'Math', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Turkish', 'English', 'Philosophy'];

export default function ExamScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<ExamPhase>('filter');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [subject, setSubject] = useState('Tumu');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Slide animation for question transition
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Fetch count whenever filter changes
  useEffect(() => {
    if (phase === 'filter') fetchCount();
  }, [timeFilter, subject, phase]);

  const fetchCount = async () => {
    setCountLoading(true);
    try {
      const sub = subject === 'Tumu' ? 'all' : subject;
      const res = await apiFetch(`/api/exam/questions?time_filter=${timeFilter}&subject=${sub}`);
      if (res.ok) {
        const data = await res.json();
        setQuestionCount(data.length);
      } else {
        setQuestionCount(0);
      }
    } catch (_) {
      setQuestionCount(0);
    }
    setCountLoading(false);
  };

  const startExam = async () => {
    setLoading(true);
    try {
      const sub = subject === 'Tumu' ? 'all' : subject;
      const res = await apiFetch(`/api/exam/questions?time_filter=${timeFilter}&subject=${sub}`);
      if (res.ok) {
        const data: Question[] = await res.json();
        setQuestions(data);
        setCurrentIndex(0);
        setResults([]);
        setPhase('question');
        animateProgress(0, data.length);
      }
    } catch (_) {}
    setLoading(false);
  };

  const animateProgress = (index: number, total: number) => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? (index + 1) / total : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const slideIn = () => {
    slideAnim.setValue(60);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  const markQuestion = (understood: boolean) => {
    const q = questions[currentIndex];
    const newResults = [...results, { question_id: q.id, understood }];
    setResults(newResults);

    if (currentIndex + 1 >= questions.length) {
      // Last question — save and show summary
      saveResults(newResults);
    } else {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      animateProgress(next, questions.length);
      slideIn();
    }
  };

  const saveResults = async (finalResults: QuestionResult[]) => {
    setSubmitting(true);
    try {
      await apiFetch('/api/exam/results', {
        method: 'POST',
        body: JSON.stringify({ results: finalResults }),
      });
    } catch (_) {}
    setSubmitting(false);
    setPhase('summary');
  };

  const restartWithHard = () => {
    const hardIds = new Set(results.filter(r => !r.understood).map(r => r.question_id));
    const hardQuestions = questions.filter(q => hardIds.has(q.id));
    if (hardQuestions.length === 0) {
      router.back();
      return;
    }
    setQuestions(hardQuestions);
    setCurrentIndex(0);
    setResults([]);
    setPhase('question');
    animateProgress(0, hardQuestions.length);
  };

  // ── FILTER PHASE ──────────────────────────────────────────────────
  if (phase === 'filter') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.filterContent}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={TXT} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Pratik Sinav Olustur</Text>
            <TouchableOpacity onPress={fetchCount} style={s.backBtn} disabled={countLoading}>
              {countLoading
                ? <ActivityIndicator size="small" color={CYAN} />
                : <Feather name="refresh-cw" size={18} color={CYAN} />
              }
            </TouchableOpacity>
          </View>

          <Text style={s.filterSectionLabel}>ZAMAN ARALIGI</Text>
          <View style={s.chipRow}>
            {TIME_FILTERS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[s.chip, timeFilter === t.key && s.chipActive]}
                onPress={() => setTimeFilter(t.key)}
              >
                {timeFilter === t.key && (
                  <LinearGradient colors={GRADIENTS.study as any} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject} />
                )}
                <Text style={[s.chipText, timeFilter === t.key && s.chipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.filterSectionLabel, { marginTop: 20 }]}>DERS FILTRESi</Text>
          <View style={s.chipRow}>
            {SUBJECTS.map((subj) => (
              <TouchableOpacity
                key={subj}
                style={[s.chip, subject === subj && s.chipActive]}
                onPress={() => setSubject(subj)}
              >
                {subject === subj && (
                  <LinearGradient colors={GRADIENTS.study as any} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject} />
                )}
                <Text style={[s.chipText, subject === subj && s.chipTextActive]}>
                  {subj}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Count Card */}
          <View style={s.countCard}>
            <View style={[s.countIconWrap, { backgroundColor: questionCount === 0 ? `${MUTED}15` : `${CYAN}18` }]}>
              <Feather name="book-open" size={22} color={questionCount === 0 ? MUTED : CYAN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.countLabel}>BULUNAN SORU</Text>
              {countLoading
                ? <ActivityIndicator size="small" color={CYAN} style={{ marginTop: 4 }} />
                : <Text style={[s.countValue, { color: questionCount === 0 ? MUTED : CYAN }]}>
                    {questionCount === null ? '...' : questionCount === 0 ? 'Henuz soru yok' : `${questionCount} soru`}
                  </Text>
              }
            </View>
          </View>

          {/* Empty state — subtle, not error */}
          {!countLoading && questionCount === 0 && (
            <View style={s.emptyHint}>
              <Text style={s.emptyHintText}>
                Bu filtre icin kayitli soru bulunamadi.{'\n'}
                Scanner ile soru yukleyin, sonra yenilemek icin {' '}
                <Text style={{ color: CYAN }}>yenile butonuna</Text> basin.
              </Text>
              <TouchableOpacity
                style={s.goScanBtn}
                onPress={() => router.push('/(tabs)/scanner')}
              >
                <Feather name="camera" size={14} color={CYAN} />
                <Text style={s.goScanText}>Tarayiciya Git</Text>
              </TouchableOpacity>
            </View>
          )}

          {!countLoading && questionCount !== null && questionCount > 0 && (
            <TouchableOpacity
              style={[s.startBtn, loading && { opacity: 0.6 }]}
              onPress={startExam}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[PURPLE, '#7C3AED']}
                start={{x:0,y:0}} end={{x:1,y:0}}
                style={s.startBtnGrad}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="play-circle" size={20} color="#fff" />
                )}
                <Text style={s.startBtnText}>
                  {loading ? 'Hazirlanıyor...' : `${questionCount} Soruyla Sinavi Basla`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── QUESTION PHASE ────────────────────────────────────────────────
  if (phase === 'question') {
    const q = questions[currentIndex];
    const progress = (currentIndex) / questions.length;
    const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Top Bar */}
        <View style={s.qHeader}>
          <TouchableOpacity
            onPress={() => {
              setPhase('filter');
              setResults([]);
            }}
            style={s.backBtn}
          >
            <Feather name="x" size={20} color={MUTED} />
          </TouchableOpacity>
          <View style={s.qProgress}>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressBar, { width: progressWidth }]} />
            </View>
            <Text style={s.qCount}>{currentIndex + 1} / {questions.length}</Text>
          </View>
          <View style={[s.subjectBadge, { backgroundColor: `${CYAN}20` }]}>
            <Text style={s.subjectBadgeText} numberOfLines={1}>{q.subject}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.qContent}>
          <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>

            {/* Topic */}
            <Text style={s.topicLabel}>{q.topic}</Text>

            {/* Question Image */}
            {q.image_base64 ? (
              <View style={s.imageCard}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${q.image_base64}` }}
                  style={s.questionImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={s.noImageCard}>
                <Feather name="image" size={40} color={MUTED} />
                <Text style={s.noImageText}>Gorsel bulunamadi</Text>
              </View>
            )}

            {/* Question Summary */}
            {!!q.question_summary && (
              <View style={s.summaryCard}>
                <Feather name="file-text" size={14} color={MUTED} />
                <Text style={s.summaryText}>{q.question_summary}</Text>
              </View>
            )}

            {/* Notes */}
            {!!q.notes && !q.question_summary && (
              <View style={s.summaryCard}>
                <Feather name="edit-3" size={14} color={MUTED} />
                <Text style={s.summaryText}>{q.notes}</Text>
              </View>
            )}

            {/* AI Insight */}
            {!!q.ai_insight && (
              <View style={s.insightCard}>
                <Feather name="zap" size={14} color={CYAN} />
                <Text style={s.insightText}>{q.ai_insight}</Text>
              </View>
            )}

            {/* Date info */}
            <Text style={s.dateText}>
              {new Date(q.created_at).toLocaleDateString('tr-TR', {
                day: 'numeric', month: 'long', year: 'numeric'
              })}
            </Text>
          </Animated.View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.hardBtn}
            onPress={() => markQuestion(false)}
            activeOpacity={0.85}
          >
            <Feather name="x-circle" size={22} color={RED} />
            <Text style={s.hardBtnText}>Hala Zor</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.okBtn}
            onPress={() => markQuestion(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[GREEN, '#059669']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={s.okBtnGrad}
            >
              <Feather name="check-circle" size={22} color="#fff" />
              <Text style={s.okBtnText}>Anladim</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {submitting && (
          <View style={s.submittingOverlay}>
            <ActivityIndicator size="large" color={CYAN} />
            <Text style={s.submittingText}>Sonuclar kaydediliyor...</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ── SUMMARY PHASE ──────────────────────────────────────────────────
  const understood = results.filter(r => r.understood).length;
  const hard = results.filter(r => !r.understood).length;
  const total = results.length;
  const score = total > 0 ? Math.round((understood / total) * 100) : 0;

  // Group hard questions by topic
  const hardTopics: Record<string, number> = {};
  results.forEach(r => {
    if (!r.understood) {
      const q = questions.find(qq => qq.id === r.question_id);
      if (q) {
        const key = `${q.subject} - ${q.topic}`;
        hardTopics[key] = (hardTopics[key] || 0) + 1;
      }
    }
  });

  const scoreColor = score >= 80 ? GREEN : score >= 50 ? ORANGE : RED;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.summaryContent}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={TXT} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Sinav Sonucu</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Score Circle */}
        <View style={s.scoreSection}>
          <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[s.scorePercent, { color: scoreColor }]}>{score}%</Text>
            <Text style={s.scoreLabel}>Basari</Text>
          </View>
          <Text style={s.completeText}>
            {score >= 80 ? 'Harika! Cok iyi gidiyor.' : score >= 50 ? 'Iyi! Biraz daha calisma gerekiyor.' : 'Zor konulara odaklan.'}
          </Text>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.statBox, { borderColor: `${GREEN}30` }]}>
            <View style={[s.statIcon, { backgroundColor: `${GREEN}18` }]}>
              <Feather name="check-circle" size={20} color={GREEN} />
            </View>
            <Text style={[s.statNum, { color: GREEN }]}>{understood}</Text>
            <Text style={s.statLbl}>Anladim</Text>
          </View>
          <View style={[s.statBox, { borderColor: `${RED}30` }]}>
            <View style={[s.statIcon, { backgroundColor: `${RED}18` }]}>
              <Feather name="x-circle" size={20} color={RED} />
            </View>
            <Text style={[s.statNum, { color: RED }]}>{hard}</Text>
            <Text style={s.statLbl}>Hala Zor</Text>
          </View>
          <View style={[s.statBox, { borderColor: `${CYAN}30` }]}>
            <View style={[s.statIcon, { backgroundColor: `${CYAN}18` }]}>
              <Feather name="book-open" size={20} color={CYAN} />
            </View>
            <Text style={[s.statNum, { color: CYAN }]}>{total}</Text>
            <Text style={s.statLbl}>Toplam</Text>
          </View>
        </View>

        {/* Hard Topics Breakdown */}
        {Object.keys(hardTopics).length > 0 && (
          <View style={s.breakdownCard}>
            <View style={s.breakdownHeader}>
              <Feather name="alert-triangle" size={16} color={ORANGE} />
              <Text style={s.breakdownTitle}>Zorlandığınız Konular</Text>
            </View>
            {Object.entries(hardTopics)
              .sort((a, b) => b[1] - a[1])
              .map(([topic, count], i) => (
                <View key={i} style={s.breakdownRow}>
                  <View style={s.breakdownDot} />
                  <Text style={s.breakdownTopic} numberOfLines={1}>{topic}</Text>
                  <View style={s.breakdownBadge}>
                    <Text style={s.breakdownCount}>{count} soru</Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* Action Buttons */}
        {hard > 0 && (
          <TouchableOpacity style={s.retryBtn} onPress={restartWithHard} activeOpacity={0.85}>
            <LinearGradient
              colors={[RED, '#DC2626']}
              start={{x:0,y:0}} end={{x:1,y:0}}
              style={s.retryBtnGrad}
            >
              <Feather name="refresh-cw" size={18} color="#fff" />
              <Text style={s.retryBtnText}>Zor Sorulari Tekrar Et ({hard})</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.newExamBtn} onPress={() => setPhase('filter')}>
          <Feather name="plus-circle" size={18} color={PURPLE} />
          <Text style={s.newExamText}>Yeni Sinav Olustur</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}>
          <Text style={s.homeText}>Ana Sayfaya Don</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Common
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 17, fontFamily: F.bld, color: TXT },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },

  // Filter
  filterContent: { paddingHorizontal: 20, paddingBottom: 40 },
  filterSectionLabel: { fontSize: 11, fontFamily: F.xbld, color: MUTED, letterSpacing: 1.2, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: SURFACE, borderWidth: 1, borderColor: SURFACE_HL, overflow: 'hidden' },
  chipActive: { borderColor: 'transparent' },
  chipText: { fontSize: 13, fontFamily: F.sem, color: MUTED },
  chipTextActive: { color: '#fff', fontFamily: F.bld },
  countCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: SURFACE, borderRadius: 16, padding: 18, marginTop: 24, marginBottom: 20, borderWidth: 1, borderColor: `${CYAN}20` },
  countIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  countLabel: { fontSize: 10, fontFamily: F.xbld, color: MUTED, letterSpacing: 1.0 },
  countValue: { fontSize: 22, fontFamily: F.xbld, marginTop: 2 },
  emptyHint: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, gap: 14 },
  emptyHintText: { fontSize: 13, fontFamily: F.reg, color: MUTED, textAlign: 'center', lineHeight: 20 },
  goScanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: `${CYAN}30` },
  goScanText: { fontSize: 14, fontFamily: F.bld, color: CYAN },
  startBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  startBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  startBtnText: { fontSize: 15, fontFamily: F.bld, color: '#fff' },

  // Question
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  qProgress: { flex: 1, gap: 4 },
  progressTrack: { height: 4, backgroundColor: SURFACE_HL, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: CYAN, borderRadius: 2 },
  qCount: { fontSize: 11, fontFamily: F.sem, color: MUTED, textAlign: 'right' },
  subjectBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  subjectBadgeText: { fontSize: 11, fontFamily: F.bld, color: CYAN },
  qContent: { paddingHorizontal: 18, paddingBottom: 20 },
  topicLabel: { fontSize: 22, fontFamily: F.xbld, color: TXT, marginBottom: 16, lineHeight: 28 },
  imageCard: { backgroundColor: SURFACE, borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: SURFACE_HL },
  questionImage: { width: '100%', height: 280 },
  noImageCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 40, alignItems: 'center', gap: 10, marginBottom: 16 },
  noImageText: { fontSize: 13, fontFamily: F.reg, color: MUTED },
  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 12 },
  summaryText: { flex: 1, fontSize: 13, fontFamily: F.reg, color: MUTED, lineHeight: 19 },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: `${CYAN}10`, borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: CYAN },
  insightText: { flex: 1, fontSize: 13, fontFamily: F.reg, color: TXT, lineHeight: 19 },
  dateText: { fontSize: 11, fontFamily: F.reg, color: MUTED, textAlign: 'right', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  hardBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: `${RED}15`, borderRadius: 16, paddingVertical: 16, borderWidth: 1.5, borderColor: `${RED}35` },
  hardBtnText: { fontSize: 15, fontFamily: F.bld, color: RED },
  okBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  okBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  okBtnText: { fontSize: 15, fontFamily: F.bld, color: '#fff' },
  submittingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,13,26,0.8)', alignItems: 'center', justifyContent: 'center', gap: 14 },
  submittingText: { fontSize: 14, fontFamily: F.sem, color: TXT },

  // Summary
  summaryContent: { paddingHorizontal: 20, paddingBottom: 40 },
  scoreSection: { alignItems: 'center', paddingVertical: 24, gap: 14 },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: SURFACE },
  scorePercent: { fontSize: 36, fontFamily: F.xbld },
  scoreLabel: { fontSize: 11, fontFamily: F.bld, color: MUTED, letterSpacing: 0.5 },
  completeText: { fontSize: 15, fontFamily: F.sem, color: MUTED, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: SURFACE, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 28, fontFamily: F.xbld },
  statLbl: { fontSize: 11, fontFamily: F.sem, color: MUTED },
  breakdownCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 18, marginBottom: 16 },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  breakdownTitle: { fontSize: 14, fontFamily: F.bld, color: TXT },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: SURFACE_HL },
  breakdownDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  breakdownTopic: { flex: 1, fontSize: 13, fontFamily: F.reg, color: TXT },
  breakdownBadge: { backgroundColor: `${RED}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  breakdownCount: { fontSize: 11, fontFamily: F.bld, color: RED },
  retryBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  retryBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
  retryBtnText: { fontSize: 15, fontFamily: F.bld, color: '#fff' },
  newExamBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SURFACE, borderRadius: 16, paddingVertical: 14, marginBottom: 10, borderWidth: 1, borderColor: `${PURPLE}30` },
  newExamText: { fontSize: 14, fontFamily: F.bld, color: PURPLE },
  homeBtn: { alignItems: 'center', paddingVertical: 12 },
  homeText: { fontSize: 14, fontFamily: F.sem, color: MUTED },
});
