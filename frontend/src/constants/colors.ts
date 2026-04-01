// ── Premium Dark Theme ────────────────────────────────
export const darkColors = {
  background: '#060B18',        // Deep midnight
  surface: '#0E1525',           // Card surface
  surfaceHighlight: '#162035',  // Elevated surface
  primary: '#4361EE',           // Electric blue (reference palette)
  primarySoft: '#5B7BFF',       // Lighter electric blue
  purple: '#7B5CF0',            // Violet accent
  secondary: '#FF6D00',         // Energetic orange
  textPrimary: '#EDF2FF',       // Crisp white-blue
  textSecondary: '#718096',     // Muted slate
  border: '#1E2D4A',
  success: '#10B981',
  error: '#EF4444',
  tabBarBg: '#060B18',
  tabBarActive: '#4361EE',
  tabBarInactive: '#4A5568',
};

// ── Clean Light Theme ─────────────────────────────────
export const lightColors = {
  background: '#F0F4FF',
  surface: '#FFFFFF',
  surfaceHighlight: '#E2E8F0',
  primary: '#4361EE',
  primarySoft: '#5B7BFF',
  purple: '#7B5CF0',
  secondary: '#FF6D00',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  error: '#EF4444',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#4361EE',
  tabBarInactive: '#94A3B8',
};

// ── Gradient Tokens ───────────────────────────────────
export const GRADIENTS = {
  study:     ['#4361EE', '#7B5CF0'] as const,  // Electric blue → Violet
  break:     ['#10B981', '#059669'] as const,  // Emerald → Green
  secondary: ['#FF6D00', '#FFAB40'] as const,  // Orange → Amber
  hours:     ['#4361EE', '#7B5CF0'] as const,  // Blue → Purple
  purple:    ['#7B5CF0', '#4361EE'] as const,  // Violet → Blue
  ring:      ['#4361EE', '#7B5CF0', '#00D2FF'] as const,  // Ring gradient
};

export type Colors = typeof darkColors;
