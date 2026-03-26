export const SUBJECTS = ['Math', 'Physics', 'Chemistry', 'Biology', 'History', 'English'];

export const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const MOCK_WEEKLY_HOURS = [1.5, 2.5, 3.0, 2.0, 4.0, 1.0, 3.5];

export const MOCK_WEAK_SUBJECTS = [
  { subject: 'Math', errors: 12, topics: ['Trigonometry', 'Calculus'] },
  { subject: 'Physics', errors: 8, topics: ['Kinematics', 'Waves'] },
  { subject: 'Chemistry', errors: 6, topics: ['Organic Reactions'] },
  { subject: 'History', errors: 4, topics: ['World War II'] },
];

export const MOCK_ERROR_TOPICS: Record<string, string[]> = {
  Math: ['Trigonometry', 'Calculus', 'Algebra', 'Geometry', 'Statistics'],
  Physics: ['Kinematics', 'Dynamics', 'Thermodynamics', 'Waves', 'Optics'],
  Chemistry: ['Organic Reactions', 'Periodic Table', 'Electrochemistry', 'Equilibrium'],
  Biology: ['Cell Biology', 'Genetics', 'Ecology', 'Human Anatomy'],
  History: ['World War I', 'World War II', 'Ancient Civilizations', 'Industrial Revolution'],
  English: ['Essay Writing', 'Grammar', 'Literature Analysis', 'Comprehension'],
};

export const SUBJECT_COLORS = ['#2979FF', '#FF6D00', '#10B981', '#EF4444', '#A855F7', '#F59E0B'];

export const MOCK_WEEKLY_ERRORS = [
  { subject: 'Math', errors: 5 },
  { subject: 'Physics', errors: 3 },
  { subject: 'Chemistry', errors: 2 },
  { subject: 'Biology', errors: 2 },
  { subject: 'History', errors: 1 },
];

export const MOCK_MONTHLY_ERRORS = [
  { subject: 'Math', errors: 18 },
  { subject: 'Physics', errors: 12 },
  { subject: 'Chemistry', errors: 8 },
  { subject: 'Biology', errors: 7 },
  { subject: 'History', errors: 5 },
  { subject: 'English', errors: 3 },
];

export const MOCK_AI_STUDY_PLAN = [
  { id: '1', subject: 'Math', task: 'Review Trigonometry', detail: '3 errors this week', priority: 'high', color: '#EF4444' },
  { id: '2', subject: 'Physics', task: 'Practice Kinematics problems', detail: '4 errors this week', priority: 'high', color: '#EF4444' },
  { id: '3', subject: 'Chemistry', task: 'Review Organic Reactions', detail: '3 errors this week', priority: 'medium', color: '#FF6D00' },
  { id: '4', subject: 'Math', task: 'Calculus — Limits & Derivatives', detail: '2 errors this week', priority: 'medium', color: '#FF6D00' },
  { id: '5', subject: 'History', task: 'Study World War II timeline', detail: '2 errors this week', priority: 'low', color: '#10B981' },
  { id: '6', subject: 'English', task: 'Practice Essay Structure', detail: '1 error this week', priority: 'low', color: '#10B981' },
];
