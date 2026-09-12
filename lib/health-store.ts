import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  EMPTY_HEALTH_DATA,
  LAB_KEYS,
  type DailyLog,
  type HealthData,
  type LabEntry,
  type PeriodEntry,
  type Profile,
  type Severity,
  type Symptom,
} from '@/lib/health-types';

const STORAGE_KEY = 'cyclewise:health-data:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSeverity(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function isSymptoms(value: unknown): value is Partial<Record<Symptom, Severity>> {
  return isRecord(value) && Object.values(value).every(isSeverity);
}

function isCondition(value: unknown): value is Profile['condition'] {
  return ['none', 'pcos', 'hypothyroid', 'hyperthyroid', 'anemia'].some(
    (condition) => condition === value,
  );
}

function isProfile(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    typeof value.age === 'number' &&
    isCondition(value.condition) &&
    typeof value.lastPeriodStartDate === 'string' &&
    typeof value.onboardingComplete === 'boolean' &&
    (value.heightCm === undefined || typeof value.heightCm === 'number') &&
    (value.weightKg === undefined || typeof value.weightKg === 'number') &&
    (value.medications === undefined || typeof value.medications === 'string')
  );
}

function isPeriodEntry(value: unknown): value is PeriodEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.startDate === 'string' &&
    isSeverity(value.flowIntensity) &&
    isSymptoms(value.symptoms) &&
    typeof value.createdAt === 'string' &&
    (value.endDate === undefined || typeof value.endDate === 'string') &&
    (value.periodLengthDays === undefined || typeof value.periodLengthDays === 'number')
  );
}

function isDailyLog(value: unknown): value is DailyLog {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    isSymptoms(value.symptoms) &&
    typeof value.createdAt === 'string'
  );
}

function isLabEntry(value: unknown): value is LabEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.createdAt === 'string' &&
    LAB_KEYS.every((key) => value[key] === undefined || typeof value[key] === 'number')
  );
}

function isHealthData(value: unknown): value is HealthData {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.profile === null || isProfile(value.profile)) &&
    Array.isArray(value.periods) &&
    value.periods.every(isPeriodEntry) &&
    Array.isArray(value.dailyLogs) &&
    value.dailyLogs.every(isDailyLog) &&
    Array.isArray(value.labs) &&
    value.labs.every(isLabEntry)
  );
}

type HealthStore = HealthData & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  addPeriod: (entry: PeriodEntry) => Promise<void>;
  addDailyLog: (entry: DailyLog) => Promise<void>;
  addLab: (entry: LabEntry) => Promise<void>;
  deleteAll: () => Promise<void>;
  exportData: () => HealthData;
};

async function persist(data: HealthData) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const useHealthStore = create<HealthStore>((set, get) => ({
  ...EMPTY_HEALTH_DATA,
  hydrated: false,
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isHealthData(parsed))
        set({ ...parsed, dailyLogs: parsed.dailyLogs ?? [], hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  saveProfile: async (profile) => {
    const data: HealthData = {
      version: 1,
      profile,
      periods: get().periods,
      dailyLogs: get().dailyLogs,
      labs: get().labs,
    };
    set(data);
    await persist(data);
  },
  addPeriod: async (entry) => {
    const periods = [
      ...get().periods.filter((item) => item.startDate !== entry.startDate),
      entry,
    ].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const data: HealthData = {
      version: 1,
      profile: get().profile,
      periods,
      dailyLogs: get().dailyLogs,
      labs: get().labs,
    };
    set(data);
    await persist(data);
  },
  addDailyLog: async (entry) => {
    const dailyLogs = [...get().dailyLogs.filter((item) => item.date !== entry.date), entry].sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    const data: HealthData = {
      version: 1,
      profile: get().profile,
      periods: get().periods,
      dailyLogs,
      labs: get().labs,
    };
    set(data);
    await persist(data);
  },
  addLab: async (entry) => {
    const labs = [...get().labs, entry].sort((a, b) => a.date.localeCompare(b.date));
    const data: HealthData = {
      version: 1,
      profile: get().profile,
      periods: get().periods,
      dailyLogs: get().dailyLogs,
      labs,
    };
    set(data);
    await persist(data);
  },
  deleteAll: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ ...EMPTY_HEALTH_DATA });
  },
  exportData: () => ({
    version: 1,
    profile: get().profile,
    periods: get().periods,
    dailyLogs: get().dailyLogs,
    labs: get().labs,
  }),
}));
