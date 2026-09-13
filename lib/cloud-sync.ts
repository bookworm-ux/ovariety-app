import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@biltme/backend';
import { create } from 'zustand';

import { bilt } from '@/lib/bilt';
import { useHealthStore } from '@/lib/health-store';
import type {
  Condition,
  DailyLog,
  HealthData,
  LabEntry,
  PeriodEntry,
  Profile,
} from '@/lib/health-types';

const syncPreferenceKey = (userId: string) => `cyclewise:cloud-sync:${userId}`;
const timestamp = (value?: string) => Date.parse(value ?? '') || 0;

interface CloudSyncState {
  initialized: boolean;
  session: Session | null;
  pendingEmail: string | null;
  syncEnabled: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  initialize: () => Promise<() => void>;
  signUp: (email: string, password: string) => Promise<'verification' | 'signedIn'>;
  verifySignUp: (code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSyncEnabled: (enabled: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  deleteCloudData: () => Promise<void>;
  clearError: () => void;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function isCondition(value: unknown): value is Condition {
  return (
    value === 'none' ||
    value === 'pcos' ||
    value === 'hypothyroid' ||
    value === 'hyperthyroid' ||
    value === 'anemia'
  );
}

function conditionFromRemote(value: unknown): Condition {
  if (!isCondition(value)) throw new Error('The cloud profile contains an invalid condition.');
  return value;
}

function flowIntensityFromRemote(value: unknown): PeriodEntry['flowIntensity'] {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  throw new Error('A cloud period entry contains an invalid flow intensity.');
}

function remoteProfileToLocal(row: Record<string, unknown>): Profile {
  return {
    age: Number(row.age),
    heightCm: typeof row.height_cm === 'number' ? row.height_cm : undefined,
    weightKg: typeof row.weight_kg === 'number' ? row.weight_kg : undefined,
    condition: conditionFromRemote(row.condition),
    medications: typeof row.medications === 'string' ? row.medications : undefined,
    lastPeriodStartDate: String(row.last_period_start_date),
    onboardingComplete: Boolean(row.onboarding_complete),
    updatedAt: String(row.updated_at),
  };
}

function remotePeriodToLocal(row: Record<string, unknown>): PeriodEntry {
  return {
    id: String(row.local_id ?? row.id),
    startDate: String(row.start_date),
    endDate: typeof row.end_date === 'string' ? row.end_date : undefined,
    periodLengthDays:
      typeof row.period_length_days === 'number' ? row.period_length_days : undefined,
    flowIntensity: flowIntensityFromRemote(row.flow_intensity),
    symptoms: row.symptoms ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function remoteDailyToLocal(row: Record<string, unknown>): DailyLog {
  return {
    id: String(row.local_id ?? row.id),
    date: String(row.log_date),
    symptoms: row.symptoms ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function remoteLabToLocal(row: Record<string, unknown>, local?: LabEntry): LabEntry {
  const numberValue = (key: string) => (typeof row[key] === 'number' ? row[key] : undefined);
  const hasMatchingLocalAttachment =
    local?.attachment && local.attachment.name === row.attachment_name;
  return {
    id: String(row.local_id ?? row.id),
    date: String(row.result_date),
    tsh: numberValue('tsh'),
    ft4: numberValue('ft4'),
    lh: numberValue('lh'),
    fsh: numberValue('fsh'),
    amh: numberValue('amh'),
    hemoglobin: numberValue('hemoglobin'),
    ferritin: numberValue('ferritin'),
    attachment: hasMatchingLocalAttachment ? local.attachment : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function synchronize(userId: string) {
  const local = useHealthStore.getState();
  const [profileResult, periodResult, dailyResult, labResult] = await Promise.all([
    bilt.from('health_profiles').select('*').maybeSingle(),
    bilt.from('period_entries').select('*'),
    bilt.from('daily_logs').select('*'),
    bilt.from('lab_results').select('*'),
  ]);
  const firstError =
    profileResult.error ?? periodResult.error ?? dailyResult.error ?? labResult.error;
  if (firstError) throw new Error(firstError.message);

  const remoteProfile = profileResult.data;
  if (
    local.profile &&
    (!remoteProfile || timestamp(local.profile.updatedAt) > timestamp(remoteProfile.updated_at))
  ) {
    const result = await bilt.from('health_profiles').upsert({
      user_id: userId,
      age: local.profile.age,
      height_cm: local.profile.heightCm ?? null,
      weight_kg: local.profile.weightKg ?? null,
      condition: local.profile.condition,
      medications: local.profile.medications ?? null,
      last_period_start_date: local.profile.lastPeriodStartDate,
      onboarding_complete: local.profile.onboardingComplete,
      updated_at: local.profile.updatedAt ?? new Date().toISOString(),
    });
    if (result.error) throw new Error(result.error.message);
  }

  const newerRows = <T extends { id: string; createdAt: string; updatedAt?: string }>(
    localRows: T[],
    remoteRows: { id: string; updated_at: string }[],
  ) => {
    const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
    return localRows.filter((row) => {
      const remote = remoteById.get(row.id);
      return !remote || timestamp(row.updatedAt ?? row.createdAt) > timestamp(remote.updated_at);
    });
  };

  const newerPeriods = newerRows(local.periods, periodResult.data ?? []);
  if (newerPeriods.length) {
    const result = await bilt.from('period_entries').upsert(
      newerPeriods.map((row) => ({
        id: row.id,
        local_id: row.id,
        user_id: userId,
        start_date: row.startDate,
        end_date: row.endDate ?? null,
        period_length_days: row.periodLengthDays ?? null,
        flow_intensity: row.flowIntensity,
        symptoms: row.symptoms,
        created_at: row.createdAt,
        updated_at: row.updatedAt ?? row.createdAt,
      })),
    );
    if (result.error) throw new Error(result.error.message);
  }

  const newerDailyLogs = newerRows(local.dailyLogs, dailyResult.data ?? []);
  if (newerDailyLogs.length) {
    const result = await bilt.from('daily_logs').upsert(
      newerDailyLogs.map((row) => ({
        id: row.id,
        local_id: row.id,
        user_id: userId,
        log_date: row.date,
        symptoms: row.symptoms,
        created_at: row.createdAt,
        updated_at: row.updatedAt ?? row.createdAt,
      })),
    );
    if (result.error) throw new Error(result.error.message);
  }

  const newerLabs = newerRows(local.labs, labResult.data ?? []);
  if (newerLabs.length) {
    const result = await bilt.from('lab_results').upsert(
      newerLabs.map((row) => ({
        id: row.id,
        local_id: row.id,
        user_id: userId,
        result_date: row.date,
        tsh: row.tsh ?? null,
        ft4: row.ft4 ?? null,
        lh: row.lh ?? null,
        fsh: row.fsh ?? null,
        amh: row.amh ?? null,
        hemoglobin: row.hemoglobin ?? null,
        ferritin: row.ferritin ?? null,
        attachment_name: row.attachment?.name ?? null,
        attachment_mime_type: row.attachment?.mimeType ?? null,
        attachment_size_bytes: row.attachment?.size ?? null,
        attachment_uri: null,
        created_at: row.createdAt,
        updated_at: row.updatedAt ?? row.createdAt,
      })),
    );
    if (result.error) throw new Error(result.error.message);
  }

  const [finalProfile, finalPeriods, finalDaily, finalLabs] = await Promise.all([
    bilt.from('health_profiles').select('*').maybeSingle(),
    bilt.from('period_entries').select('*').order('start_date'),
    bilt.from('daily_logs').select('*').order('log_date'),
    bilt.from('lab_results').select('*').order('result_date'),
  ]);
  const finalError =
    finalProfile.error ?? finalPeriods.error ?? finalDaily.error ?? finalLabs.error;
  if (finalError) throw new Error(finalError.message);

  const localLabById = new Map(local.labs.map((row) => [row.id, row]));
  const merged: HealthData = {
    version: 1,
    profile: finalProfile.data ? remoteProfileToLocal(finalProfile.data) : local.profile,
    periods: (finalPeriods.data ?? []).map(remotePeriodToLocal),
    dailyLogs: (finalDaily.data ?? []).map(remoteDailyToLocal),
    labs: (finalLabs.data ?? []).map((row) =>
      remoteLabToLocal(row, localLabById.get(row.local_id)),
    ),
  };
  await local.replaceFromCloud(merged);
}

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  initialized: false,
  session: null,
  pendingEmail: null,
  syncEnabled: false,
  syncing: false,
  lastSyncedAt: null,
  error: null,
  initialize: async () => {
    const { data, error } = await bilt.auth.getSession();
    if (error) set({ error: error.message });
    const session = data.session;
    const syncEnabled = session
      ? (await AsyncStorage.getItem(syncPreferenceKey(session.user.id))) === 'true'
      : false;
    set({ initialized: true, session, syncEnabled });

    const { data: listener } = bilt.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        const enabled = nextSession
          ? (await AsyncStorage.getItem(syncPreferenceKey(nextSession.user.id))) === 'true'
          : false;
        set({ session: nextSession, syncEnabled: enabled, pendingEmail: null, error: null });
      })();
    });
    return () => listener.subscription.unsubscribe();
  },
  signUp: async (email, password) => {
    set({ error: null });
    const { data, error } = await bilt.auth.signUp({ email: email.trim(), password });
    if (error) {
      set({ error: error.message });
      throw new Error(error.message);
    }
    if (data.session) {
      set({ session: data.session, pendingEmail: null });
      return 'signedIn';
    }
    set({ pendingEmail: email.trim() });
    return 'verification';
  },
  verifySignUp: async (code) => {
    const email = get().pendingEmail;
    if (!email) throw new Error('Enter your email and create an account first.');
    const { data, error } = await bilt.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'signup',
    });
    if (error) {
      set({ error: error.message });
      throw new Error(error.message);
    }
    set({ session: data.session, pendingEmail: null, error: null });
  },
  signIn: async (email, password) => {
    set({ error: null });
    const { data, error } = await bilt.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      set({ error: error.message });
      throw new Error(error.message);
    }
    const enabled = data.session
      ? (await AsyncStorage.getItem(syncPreferenceKey(data.session.user.id))) === 'true'
      : false;
    set({ session: data.session, syncEnabled: enabled });
    if (enabled) await get().syncNow();
  },
  signOut: async () => {
    const { error } = await bilt.auth.signOut();
    if (error) throw new Error(error.message);
    set({ session: null, syncEnabled: false, lastSyncedAt: null, error: null });
  },
  setSyncEnabled: async (enabled) => {
    const session = get().session;
    if (!session) throw new Error('Sign in before enabling secure sync.');
    await AsyncStorage.setItem(syncPreferenceKey(session.user.id), String(enabled));
    set({ syncEnabled: enabled, error: null });
    if (enabled) await get().syncNow();
  },
  syncNow: async () => {
    const { session, syncEnabled, syncing } = get();
    if (!session || !syncEnabled || syncing) return;
    set({ syncing: true, error: null });
    try {
      await synchronize(session.user.id);
      set({ syncing: false, lastSyncedAt: new Date().toISOString() });
    } catch (error) {
      set({ syncing: false, error: message(error) });
      throw error;
    }
  },
  deleteCloudData: async () => {
    if (!get().session) throw new Error('Sign in to delete the account copy.');
    for (const table of ['lab_results', 'daily_logs', 'period_entries'] as const) {
      const { error } = await bilt.from(table).delete().not('id', 'is', null);
      if (error) throw new Error(error.message);
    }
    const { error } = await bilt.from('health_profiles').delete().not('user_id', 'is', null);
    if (error) throw new Error(error.message);
    set({ lastSyncedAt: null, error: null });
  },
  clearError: () => set({ error: null }),
}));
