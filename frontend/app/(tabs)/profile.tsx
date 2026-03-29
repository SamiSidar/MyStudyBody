import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS } from '../../src/constants/colors';
import { useTheme } from '../../src/context/ThemeContext';
import { F } from '../../src/constants/fonts';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../src/utils/api';

const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const ORANGE = '#FF6D00';

interface SubjectStat {
  subject: string;
  total_minutes: number;
  total_hours: number;
}

const SUBJECT_COLORS: Record<string, string> = {
  Math: '#4FACFE',
  Physics: '#A78BFA',
  Chemistry: '#FB923C',
  Biology: '#10B981',
  History: '#F59E0B',
  Geography: '#34D399',
  Turkish: '#F472B6',
  English: '#60A5FA',
  Philosophy: '#C084FC',
};

function getSubjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || '#4FACFE';
}

const GOAL_OPTIONS = [
  { label: 'Hedef belirleme', value: null },
  { label: '5 saat / hafta', value: 5 },
  { label: '10 saat / hafta', value: 10 },
  { label: '15 saat / hafta', value: 15 },
  { label: '20 saat / hafta', value: 20 },
  { label: '25 saat / hafta', value: 25 },
  { label: '30 saat / hafta', value: 30 },
  { label: '40 saat / hafta', value: 40 },
];

const INFO_LINKS = [
  { label: 'About MyStudyBody', icon: 'info' },
  { label: 'Privacy Policy', icon: 'shield' },
  { label: 'Rate the App', icon: 'star' },
];

export default function ProfileScreen() {
  const { toggleTheme, theme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sound, setSound] = useState(true);
  const [reminders, setReminders] = useState(false);

  // Real stats from API
  const [totalHours, setTotalHours] = useState<string>('—');
  const [sessionCount, setSessionCount] = useState<string>('—');
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // User settings (synced with backend)
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [notifsDisabled, setNotifsDisabled] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, settingsRes] = await Promise.all([
          apiFetch('/api/stats/subjects'),
          apiFetch('/api/user/settings'),
        ]);
        if (statsRes.ok) {
          const d = await statsRes.json();
          setTotalHours(d.total_hours > 0 ? `${d.total_hours}s` : '0s');
          setSessionCount(String(d.session_count || 0));
          setSubjectStats(d.subjects || []);
        }
        if (settingsRes.ok) {
          const d = await settingsRes.json();
          setWeeklyGoal(d.weekly_goal_hours ?? null);
          setNotifsDisabled(d.notifications_disabled ?? false);
        }
      } catch (_) {} finally {
        setLoadingStats(false);
      }
    };
    fetchAll();
  }, []);

  const saveSettings = async (patch: Record<string, unknown>) => {
    setSavingSettings(true);
    try {
      await apiFetch('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    } catch (_) {} finally {
      setSavingSettings(false);
    }
  };

  const handleGoalSelect = (value: number | null) => {
    setWeeklyGoal(value);
    setShowGoalModal(false);
    saveSettings({ weekly_goal_hours: value });
  };

  const handleNotifsToggle = () => {
    const newVal = !notifsDisabled;
    setNotifsDisabled(newVal);
    saveSettings({ notifications_disabled: newVal });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const displayName = user?.username || 'Kullanıcı';
  const displayEmail = user?.email || '';
  const avatarInitial = displayName[0].toUpperCase();

  const goalLabel = weeklyGoal ? `${weeklyGoal} saat/hafta` : '—';

  const STATS = [
    { label: 'Ders Saati', value: totalHours, icon: 'clock', color: CYAN },
    { label: 'Seri', value: '7 gün', icon: 'zap', color: ORANGE },
    { label: 'Oturum', value: sessionCount, icon: 'target', color: '#A78BFA' },
    { label: 'Doğruluk', value: '92%', icon: 'crosshair', color: '#10B981' },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.appTitle}>{user?.username || 'Profil'}</Text>
          <TouchableOpacity style={s.settingsBtn}>
            <Feather name="settings" size={20} color={MUTED} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <LinearGradient
          colors={['#0F1829', '#162240']}
          style={s.profileCard}
        >
          <View style={s.avatarLarge}>
            <LinearGradient colors={GRADIENTS.study as any} style={s.avatarGrad}>
              <Text style={s.avatarInitials}>{avatarInitial}</Text>
            </LinearGradient>
          </View>
          <Text style={s.profileName}>{displayName}</Text>
          <Text style={s.profileRole}>{displayEmail || 'Student'}</Text>
          <View style={s.profileBadge}>
            <Feather name="zap" size={12} color={ORANGE} />
            <Text style={s.profileBadgeText}>7-Day Streak Active</Text>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={s.statsGrid}>
          {STATS.map((stat, i) => (
            <View key={i} style={s.statCell}>
              <View style={[s.statIcon, { backgroundColor: `${stat.color}18` }]}>
                <Feather name={stat.icon as any} size={18} color={stat.color} />
              </View>
              {loadingStats && (i === 0 || i === 2) ? (
                <ActivityIndicator size="small" color={stat.color} style={{ marginBottom: 4 }} />
              ) : (
                <Text style={s.statValue}>{stat.value}</Text>
              )}
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Ders Dağılımı */}
        <Text style={s.sectionLabel}>DERS DAĞILIMI</Text>
        <View style={s.breakdownCard}>
          {loadingStats ? (
            <View style={s.breakdownLoading}>
              <ActivityIndicator size="small" color={CYAN} />
              <Text style={s.breakdownLoadingText}>Yükleniyor...</Text>
            </View>
          ) : subjectStats.length === 0 ? (
            <View style={s.breakdownEmpty}>
              <Feather name="clock" size={32} color={MUTED} />
              <Text style={s.breakdownEmptyText}>
                Henüz çalışma oturumu yok.{'\n'}Pomodoro ekranından ders çalışmaya başla!
              </Text>
            </View>
          ) : (
            <>
              {(() => {
                const maxMins = Math.max(...subjectStats.map((it) => it.total_minutes), 1);
                return subjectStats.map((item, i) => {
                  const pct = Math.max(4, (item.total_minutes / maxMins) * 100);
                  const color = getSubjectColor(item.subject);
                  const hrs = item.total_hours;
                  const mins = item.total_minutes % 60;
                  const timeStr = hrs >= 1
                    ? `${hrs}s${mins > 0 ? ` ${mins}dk` : ''}`
                    : `${item.total_minutes}dk`;
                  return (
                    <View key={i} style={[s.bRow, i > 0 && { marginTop: 14 }]}>
                      <View style={s.bRowTop}>
                        <View style={s.bRowLeft}>
                          <View style={[s.bDot, { backgroundColor: color }]} />
                          <Text style={s.bSubject}>{item.subject}</Text>
                        </View>
                        <Text style={[s.bTime, { color }]}>{timeStr}</Text>
                      </View>
                      <View style={s.bTrack}>
                        <LinearGradient
                          colors={[color, `${color}80`]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[s.bFill, { width: `${pct}%` as any }]}
                        />
                      </View>
                    </View>
                  );
                });
              })()}
            </>
          )}
        </View>

        {/* Settings Section */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.settingsCard}>

          {/* Haftalık Hedef */}
          <TouchableOpacity
            style={[s.settingRow, s.settingDivider]}
            onPress={() => setShowGoalModal(true)}
            activeOpacity={0.8}
          >
            <View style={s.settingLeft}>
              <View style={s.settingIconBox}>
                <Feather name="target" size={17} color={CYAN} />
              </View>
              <View>
                <Text style={s.settingLabel}>Haftalık Hedef</Text>
                <Text style={s.settingSubLabel}>{goalLabel}</Text>
              </View>
            </View>
            <View style={s.settingRight}>
              {savingSettings && <ActivityIndicator size="small" color={CYAN} />}
              <Feather name="chevron-right" size={16} color={MUTED} />
            </View>
          </TouchableOpacity>

          {/* Bildirimler Kapalı (Odak Skoru etkiler) */}
          <View style={[s.settingRow, s.settingDivider]}>
            <View style={s.settingLeft}>
              <View style={s.settingIconBox}>
                <Feather name={notifsDisabled ? 'bell-off' : 'bell'} size={17} color={CYAN} />
              </View>
              <View>
                <Text style={s.settingLabel}>Ders Modunda Bildirimleri Kapat</Text>
                <Text style={s.settingSubLabel}>Odak Skoru'nu etkiler</Text>
              </View>
            </View>
            <Switch
              value={notifsDisabled}
              onValueChange={handleNotifsToggle}
              trackColor={{ false: SURFACE_HL, true: `${CYAN}60` }}
              thumbColor={notifsDisabled ? CYAN : MUTED}
              ios_backgroundColor={SURFACE_HL}
            />
          </View>

          {/* Sound Effects */}
          <View style={[s.settingRow, s.settingDivider]}>
            <View style={s.settingLeft}>
              <View style={s.settingIconBox}>
                <Feather name="volume-2" size={17} color={CYAN} />
              </View>
              <Text style={s.settingLabel}>Sound Effects</Text>
            </View>
            <Switch
              value={sound}
              onValueChange={() => setSound((v) => !v)}
              trackColor={{ false: SURFACE_HL, true: `${CYAN}60` }}
              thumbColor={sound ? CYAN : MUTED}
              ios_backgroundColor={SURFACE_HL}
            />
          </View>

          {/* Dark Mode */}
          <View style={[s.settingRow, s.settingDivider]}>
            <View style={s.settingLeft}>
              <View style={s.settingIconBox}>
                <Feather name="moon" size={17} color={CYAN} />
              </View>
              <Text style={s.settingLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: SURFACE_HL, true: `${CYAN}60` }}
              thumbColor={theme === 'dark' ? CYAN : MUTED}
              ios_backgroundColor={SURFACE_HL}
            />
          </View>

          {/* Study Reminders */}
          <View style={s.settingRow}>
            <View style={s.settingLeft}>
              <View style={s.settingIconBox}>
                <Feather name="calendar" size={17} color={CYAN} />
              </View>
              <Text style={s.settingLabel}>Study Reminders</Text>
            </View>
            <Switch
              value={reminders}
              onValueChange={() => setReminders((v) => !v)}
              trackColor={{ false: SURFACE_HL, true: `${CYAN}60` }}
              thumbColor={reminders ? CYAN : MUTED}
              ios_backgroundColor={SURFACE_HL}
            />
          </View>
        </View>

        {/* Info Links */}
        <Text style={s.sectionLabel}>APP INFO</Text>
        <View style={s.settingsCard}>
          {INFO_LINKS.map((link, i) => (
            <TouchableOpacity
              key={i}
              style={[s.settingRow, i < INFO_LINKS.length - 1 && s.settingDivider]}
              activeOpacity={0.7}
            >
              <View style={s.settingLeft}>
                <View style={s.settingIconBox}>
                  <Feather name={link.icon as any} size={17} color={MUTED} />
                </View>
                <Text style={s.settingLabel}>{link.label}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={MUTED} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Version */}
        <Text style={s.versionText}>MyStudyBody v1.0.0 · Built with focus in mind</Text>

        {/* Sign Out Button */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={s.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Haftalık Hedef Picker Modal */}
      <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
        <TouchableOpacity style={s.goalOverlay} activeOpacity={1} onPress={() => setShowGoalModal(false)}>
          <View style={s.goalSheet}>
            <Text style={s.goalTitle}>Haftalık Hedef Belirle</Text>
            <Text style={s.goalSub}>Kaç saat ders çalışmak istiyorsun?</Text>
            {GOAL_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[s.goalOption, weeklyGoal === opt.value && s.goalOptionActive]}
                onPress={() => handleGoalSelect(opt.value)}
                activeOpacity={0.8}
              >
                <Text style={[s.goalOptionText, weeklyGoal === opt.value && { color: CYAN }]}>
                  {opt.label}
                </Text>
                {weeklyGoal === opt.value && <Feather name="check" size={16} color={CYAN} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 18, paddingBottom: 32 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 20 },
  appTitle: { fontSize: 18, fontFamily: F.bld, color: CYAN },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },

  // Profile Card
  profileCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 18, borderWidth: 1, borderColor: SURFACE_HL },
  avatarLarge: { marginBottom: 14 },
  avatarGrad: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 32, fontFamily: F.xbld, color: '#fff' },
  profileName: { fontSize: 24, fontFamily: F.xbld, color: TXT, marginBottom: 4 },
  profileRole: { fontSize: 14, fontFamily: F.reg, color: MUTED, marginBottom: 12 },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${ORANGE}18`, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  profileBadgeText: { fontSize: 12, fontFamily: F.sem, color: ORANGE },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCell: { width: '47.5%', backgroundColor: SURFACE, borderRadius: 16, padding: 16, alignItems: 'flex-start' },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 20, fontFamily: F.xbld, color: TXT, marginBottom: 4 },
  statLabel: { fontSize: 11, fontFamily: F.reg, color: MUTED },

  // Ders Dağılımı (Breakdown)
  breakdownCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 18, marginBottom: 24 },
  breakdownLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, justifyContent: 'center' },
  breakdownLoadingText: { fontSize: 13, fontFamily: F.reg, color: MUTED },
  breakdownEmpty: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  breakdownEmptyText: { fontSize: 13, fontFamily: F.reg, color: MUTED, textAlign: 'center', lineHeight: 20 },
  bRow: {},
  bRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  bRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bDot: { width: 10, height: 10, borderRadius: 5 },
  bSubject: { fontSize: 14, fontFamily: F.sem, color: TXT },
  bTime: { fontSize: 13, fontFamily: F.bld },
  bTrack: { height: 8, backgroundColor: '#1A2540', borderRadius: 4, overflow: 'hidden' },
  bFill: { height: '100%', borderRadius: 4 },

  // Settings
  sectionLabel: { fontSize: 10, fontFamily: F.bld, color: MUTED, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  settingsCard: { backgroundColor: SURFACE, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: SURFACE_HL },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 8 },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: SURFACE_HL, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 14, fontFamily: F.sem, color: TXT },
  settingSubLabel: { fontSize: 11, fontFamily: F.reg, color: MUTED, marginTop: 2 },

  // Goal Picker Modal
  goalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  goalSheet: { backgroundColor: '#0C1628', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  goalTitle: { fontSize: 20, fontFamily: F.xbld, color: TXT, marginBottom: 6 },
  goalSub: { fontSize: 13, fontFamily: F.reg, color: MUTED, marginBottom: 20 },
  goalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#1A2540' },
  goalOptionActive: { backgroundColor: `${CYAN}18`, borderWidth: 1, borderColor: `${CYAN}50` },
  goalOptionText: { fontSize: 15, fontFamily: F.sem, color: TXT },

  // Version
  versionText: { fontSize: 11, fontFamily: F.reg, color: `${MUTED}80`, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 16, paddingVertical: 15, marginBottom: 8 },
  logoutText: { fontSize: 16, fontFamily: F.bld, color: '#EF4444' },
});
