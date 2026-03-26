# MyStudyBody — Product Requirements Document

**Last Updated:** March 2026  
**Status:** MVP Complete ✅

---

## 1. Overview

**MyStudyBody** is an AI-driven EdTech productivity mobile app built with React Native (Expo). It helps high school and college students (ages 15–25) study smarter by tracking their study sessions, identifying weak subjects from scanned errors, and generating personalized AI study plans.

---

## 2. Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Expo SDK 54), Expo Router v6 (file-based routing) |
| Backend | FastAPI (Python), port 8001 |
| Database | MongoDB (local via Motor async driver) |
| Navigation | Expo Router tabs + Stack |
| State | React Context (ThemeContext) + useState per screen |
| Styling | StyleSheet.create (no CSS, no external UI lib) |

### Key Files
```
frontend/
├── app/
│   ├── _layout.tsx          — Root Stack + ThemeProvider
│   ├── index.tsx            — Redirect to (tabs)
│   └── (tabs)/
│       ├── _layout.tsx      — Bottom tab navigator
│       ├── index.tsx        — Dashboard screen
│       ├── pomodoro.tsx     — Pomodoro Timer screen
│       ├── scanner.tsx      — Error Scanner screen
│       └── reports.tsx      — AI Reports screen
└── src/
    ├── context/ThemeContext.tsx  — Dark/Light theme toggle
    └── constants/
        ├── colors.ts        — Design system color tokens
        └── mockData.ts      — Sample/fallback data

backend/
└── server.py                — FastAPI with /api prefix
```

---

## 3. User Personas

- **High school student** (15–18): Studies multiple subjects, needs Pomodoro focus, scans textbook mistakes
- **College student** (18–25): More self-directed, tracks study analytics, uses AI study plans for exams

---

## 4. Core Requirements (Static)

- [x] Dark mode default with light mode toggle
- [x] Blue (#2979FF) primary, orange (#FF6D00) secondary accent colors
- [x] 4-tab bottom navigation (Home, Pomodoro, Scanner, Reports)
- [x] No authentication (local + MongoDB, no login required)
- [x] Mock AI analysis (no real AI calls)
- [x] Supports iOS and Android (React Native Expo)

---

## 5. What's Been Implemented

### Dashboard (Home) — `(tabs)/index.tsx`
- Greeting by time of day (Good Morning/Afternoon/Evening)
- Total Study Hours card (real data from API, fallback to mock)
- 7-day activity bar chart (today highlighted in orange)
- Weak Subjects list (real data from error scans, fallback mock)
- Quick Action buttons → "Start Pomodoro" + "Scan Error"
- Theme toggle (dark ↔ light)
- Pull-to-refresh

### Pomodoro Timer — `(tabs)/pomodoro.tsx`
- 25-min study / 5-min break mode with countdown
- Animated pulsing concentric ring display
- Subject selector modal (Math, Physics, Chemistry, Biology, History, English)
- Start / Pause / Reset controls with haptic feedback
- Progress bar showing % complete
- Save Session → POST /api/sessions → MongoDB
- Sessions Today + Minutes Focused stats cards

### Error Scanner — `(tabs)/scanner.tsx`
- Camera viewfinder simulation with animated corner brackets
- Scanning line animation (Animated loop)
- Gallery upload (expo-image-picker, media library permission)
- Camera capture (expo-image-picker, camera permission)
- Mock AI analysis loading state (2.6s delay, ActivityIndicator)
- Auto-filled Subject and Topic fields with "AI" badge
- Notes text input
- Save Error → POST /api/errors → MongoDB

### AI Reports — `(tabs)/reports.tsx`
- Weekly / Monthly period toggle
- Summary cards (Total Errors, Subjects count, Weakest subject)
- Color-coded bar chart (errors per subject)
- AI Insight card with trend advice
- AI Recommended Study Plan list with HIGH/MEDIUM/LOW priority badges
- Real backend data when errors logged, mock fallback otherwise

---

## 6. Backend API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/ | Health check |
| POST | /api/sessions | Create study session |
| GET | /api/sessions | List all sessions |
| GET | /api/stats/weekly | Daily hours (Mon–Sun) for current week |
| POST | /api/errors | Create error scan |
| GET | /api/errors | List all errors |
| GET | /api/stats/errors | Errors per subject with topics |

---

## 7. Design System

- **Colors:** Dark bg `#0F172A`, Surface `#1E293B`, Primary `#2979FF`, Secondary `#FF6D00`
- **Typography:** System fonts (SF Pro / Roboto), 8pt grid
- **Border radius:** sm=8, md=12, lg=16, xl=24
- **Spacing:** 8, 16, 20, 24, 32px

---

## 8. Prioritized Backlog

### P0 (Critical — Next Sprint)
- [ ] Real AI image analysis (Claude Haiku or Gemini Flash for question scanning)
- [ ] Subject-level drill-down screen (tap a subject → see all errors for it)
- [ ] Persistent streak counter (save streak to DB)

### P1 (High Value)
- [ ] Notification reminders ("Time to study!", daily goals)
- [ ] Export study report (PDF or share card)
- [ ] Pomodoro sound effects (tick, completion chime)
- [ ] Settings screen (customize Pomodoro duration, subjects list)
- [ ] Monthly calendar heatmap view

### P2 (Nice to Have)
- [ ] Optional Google Sign-in for cloud sync
- [ ] Leaderboard / study-with-friends mode
- [ ] Gamification (badges, level system)
- [ ] Multi-language support

---

## 9. Recent Updates (March 2026 — Sprint 2)

### Visual Identity Overhaul
- Premium deep dark theme: `#080D1A` bg, `#0F1829` surfaces, `#1A2540` highlights
- New gradient token system (`GRADIENTS`) in `colors.ts`: study (neon-mint→cyan), break (emerald), secondary (orange→amber), hours (deep blue→cyan)
- Dashboard: Total Hours card → `LinearGradient` (deep blue→cyan)
- Dashboard: Quick action buttons → full gradient fills (study/secondary)
- `expo-linear-gradient@55.0.9` added

### Pomodoro Custom Durations
- 4 pill-shaped duration chips: **25 / 40 / 50 / 60 min**
- Active chip = gradient fill; inactive = dark surface + border
- Selecting a chip resets timer to new duration immediately

### Dynamic Subject Management
- Bottom sheet supports full CRUD: Add (text input + gradient Add btn), Delete (trash icon)
- Premium modal: sheet handle, gradient radio dots, "X" close, "Done" CTA
- Minimum 1 subject guard (prevents deleting last subject)
