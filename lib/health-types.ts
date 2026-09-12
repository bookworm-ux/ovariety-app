export type Condition = 'none' | 'pcos' | 'hypothyroid' | 'hyperthyroid' | 'anemia';

export const CONDITION_LABELS: Record<Condition, string> = {
  none: 'No diagnosed condition',
  pcos: 'PCOS',
  hypothyroid: 'Hypothyroidism',
  hyperthyroid: 'Hyperthyroidism',
  anemia: 'Anemia',
};

export const SYMPTOMS = [
  'cramps',
  'fatigue',
  'moodSwings',
  'headache',
  'bloating',
  'hotFlashes',
  'coldIntolerance',
  'heavyBleeding',
  'spotting',
  'acne',
  'hairLoss',
  'dizziness',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];
export type Severity = 1 | 2 | 3 | 4 | 5;

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  cramps: 'Cramps',
  fatigue: 'Fatigue',
  moodSwings: 'Mood swings',
  headache: 'Headache',
  bloating: 'Bloating',
  hotFlashes: 'Hot flashes',
  coldIntolerance: 'Cold intolerance',
  heavyBleeding: 'Heavy bleeding',
  spotting: 'Spotting',
  acne: 'Acne',
  hairLoss: 'Hair loss',
  dizziness: 'Dizziness',
};

export interface Profile {
  age: number;
  heightCm?: number;
  weightKg?: number;
  condition: Condition;
  medications?: string;
  lastPeriodStartDate: string;
  onboardingComplete: boolean;
}

export interface PeriodEntry {
  id: string;
  startDate: string;
  endDate?: string;
  periodLengthDays?: number;
  flowIntensity: Severity;
  symptoms: Partial<Record<Symptom, Severity>>;
  createdAt: string;
}

export interface DailyLog {
  id: string;
  date: string;
  symptoms: Partial<Record<Symptom, Severity>>;
  createdAt: string;
}

export interface LabEntry {
  id: string;
  date: string;
  tsh?: number;
  ft4?: number;
  lh?: number;
  fsh?: number;
  amh?: number;
  hemoglobin?: number;
  ferritin?: number;
  createdAt: string;
}

export interface HealthData {
  version: 1;
  profile: Profile | null;
  periods: PeriodEntry[];
  dailyLogs: DailyLog[];
  labs: LabEntry[];
}

export const EMPTY_HEALTH_DATA: HealthData = {
  version: 1,
  profile: null,
  periods: [],
  dailyLogs: [],
  labs: [],
};

export const LAB_KEYS = ['tsh', 'ft4', 'lh', 'fsh', 'amh', 'hemoglobin', 'ferritin'] as const;

export const LAB_CONFIG = {
  tsh: { label: 'TSH', unit: 'mIU/L', min: 0.4, max: 4 },
  ft4: { label: 'Free T4', unit: 'ng/dL', min: 0.8, max: 1.8 },
  lh: { label: 'LH', unit: 'IU/L', min: 1.9, max: 12.5 },
  fsh: { label: 'FSH', unit: 'IU/L', min: 2.5, max: 10.2 },
  amh: { label: 'AMH', unit: 'ng/mL', min: 1, max: 4 },
  hemoglobin: { label: 'Hemoglobin', unit: 'g/dL', min: 12, max: 15.5 },
  ferritin: { label: 'Ferritin', unit: 'ng/mL', min: 15, max: 150 },
} as const;

export type LabKey = keyof typeof LAB_CONFIG;

export function relevantLabKeys(condition: Condition): LabKey[] {
  if (condition === 'pcos') return ['lh', 'fsh', 'amh'];
  if (condition === 'hypothyroid' || condition === 'hyperthyroid') return ['tsh', 'ft4'];
  if (condition === 'anemia') return ['hemoglobin', 'ferritin'];
  return [];
}
