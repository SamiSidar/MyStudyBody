// ── Premium Dark Theme ────────────────────────────────
export const darkColors = {
  background: '#080D1A',        // Deep midnight black-blue
  surface: '#0F1829',           // Card surface
  surfaceHighlight: '#1A2540',  // Elevated surface
  primary: '#4FACFE',           // Cyan (gradient end)
  secondary: '#FF6D00',         // Energetic orange
  textPrimary: '#EDF2FF',       // Crisp white-blue
  textSecondary: '#718096',     // Muted slate
  border: '#1A2540',
  success: '#10B981',
  error: '#EF4444',
  tabBarBg: '#080D1A',
  tabBarActive: '#4FACFE',
  tabBarInactive: '#4A5568',
};

// ── Clean Light Theme ─────────────────────────────────
export const lightColors = {
  background: '#F0F4FF',
  surface: '#FFFFFF',
  surfaceHighlight: '#E2E8F0',
  primary: '#2979FF',
  secondary: '#FF6D00',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  error: '#EF4444',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#2979FF',
  tabBarInactive: '#94A3B8',
};

// ── Gradient Tokens ───────────────────────────────────
export const GRADIENTS = {
  study:     ['#00F2FE', '#4FACFE'] as const,  // Neon-mint → Cyan
  break:     ['#10B981', '#059669'] as const,  // Emerald → Green
  secondary: ['#FF6D00', '#FFAB40'] as const,  // Orange → Amber
  hours:     ['#1E40AF', '#4FACFE'] as const,  // Deep blue → Cyan
  purple:    ['#A78BFA', '#7C3AED'] as const,  // Lavender → Violet
};

export type Colors = typeof darkColors;
