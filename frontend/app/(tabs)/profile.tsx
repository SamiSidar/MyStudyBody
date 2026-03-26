import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS } from '../../src/constants/colors';
import { useTheme } from '../../src/context/ThemeContext';
import { F } from '../../src/constants/fonts';

const BG = '#080D1A';
const SURFACE = '#0F1829';
const SURFACE_HL = '#1A2540';
const TXT = '#EDF2FF';
const MUTED = '#718096';
const CYAN = '#4FACFE';
const ORANGE = '#FF6D00';

const STATS = [
  { label: 'Study Hours', value: '17.5h', icon: 'clock', color: CYAN },
  { label: 'Streak', value: '7 days', icon: 'zap', color: ORANGE },
  { label: 'Sessions', value: '34', icon: 'target', color: '#A78BFA' },
  { label: 'Accuracy', value: '92%', icon: 'crosshair', color: '#10B981' },
];

const SETTINGS = [
  { label: 'Notifications', icon: 'bell', toggle: true },
  { label: 'Sound Effects', icon: 'volume-2', toggle: true },
  { label: 'Dark Mode', icon: 'moon', toggle: false },
  { label: 'Study Reminders', icon: 'calendar', toggle: true },
];

const INFO_LINKS = [
  { label: 'About MyStudyBody', icon: 'info' },
  { label: 'Privacy Policy', icon: 'shield' },
  { label: 'Rate the App', icon: 'star' },
];

export default function ProfileScreen() {
  const { toggleTheme, theme } = useTheme();
  const [notifs, setNotifs] = useState(true);
  const [sound, setSound] = useState(true);
  const [reminders, setReminders] = useState(false);

  const getToggleValue = (label: string) => {
    if (label === 'Notifications') return notifs;
    if (label === 'Sound Effects') return sound;
    if (label === 'Dark Mode') return theme === 'dark';
    if (label === 'Study Reminders') return reminders;
    return false;
  };

  const handleToggle = (label: string) => {
    if (label === 'Notifications') setNotifs((v) => !v);
    else if (label === 'Sound Effects') setSound((v) => !v);
    else if (label === 'Dark Mode') toggleTheme();
    else if (label === 'Study Reminders') setReminders((v) => !v);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.appTitle}>MyStudyBody</Text>
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
              <Text style={s.avatarInitials}>A</Text>
            </LinearGradient>
          </View>
          <Text style={s.profileName}>Alex</Text>
          <Text style={s.profileRole}>Student · Year 12</Text>
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
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Settings Section */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>
        <View style={s.settingsCard}>
          {SETTINGS.map((setting, i) => (
            <View key={i} style={[s.settingRow, i < SETTINGS.length - 1 && s.settingDivider]}>
              <View style={s.settingLeft}>
                <View style={s.settingIconBox}>
                  <Feather name={setting.icon as any} size={17} color={CYAN} />
                </View>
                <Text style={s.settingLabel}>{setting.label}</Text>
              </View>
              <Switch
                value={getToggleValue(setting.label)}
                onValueChange={() => handleToggle(setting.label)}
                trackColor={{ false: SURFACE_HL, true: `${CYAN}60` }}
                thumbColor={getToggleValue(setting.label) ? CYAN : MUTED}
                ios_backgroundColor={SURFACE_HL}
              />
            </View>
          ))}
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
      </ScrollView>
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

  // Settings
  sectionLabel: { fontSize: 10, fontFamily: F.bld, color: MUTED, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  settingsCard: { backgroundColor: SURFACE, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: SURFACE_HL },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: SURFACE_HL, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 15, fontFamily: F.reg, color: TXT },

  // Version
  versionText: { fontSize: 11, fontFamily: F.reg, color: `${MUTED}80`, textAlign: 'center', marginTop: 4 },
});
