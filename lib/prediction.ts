import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

import type { Condition, LabEntry, PeriodEntry, Profile } from '@/lib/health-types';

export interface CycleInterval {
  startDate: string;
  nextStartDate: string;
  length: number;
}

export interface PredictionResult {
  conditionMean: number;
  conditionSpread: number;
  estimateDays: number;
  predictionSpread: number;
  confidenceWindowDays: number;
  predictedDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
  ovulationDate: Date;
  cyclesUsed: number;
  cyclesAvailable: number;
  ownAverage?: number;
  ownSpread?: number;
  usedFallbackCycles: boolean;
  pcosPattern?: 'milder' | 'severe';
  explanation: string;
}

const BASE_PRIORS: Record<Exclude<Condition, 'pcos'>, { mean: number; spread: number }> = {
  none: { mean: 29.3, spread: 3.5 },
  hypothyroid: { mean: 33, spread: 6 },
  hyperthyroid: { mean: 29.3, spread: 7 },
  anemia: { mean: 29.3, spread: 3.5 },
};

export function getCycleIntervals(profile: Profile, periods: PeriodEntry[]): CycleInterval[] {
  const starts = new Set<string>([
    profile.lastPeriodStartDate,
    ...periods.map((item) => item.startDate),
  ]);
  const sorted = [...starts].sort();
  return sorted.slice(0, -1).map((startDate, index) => ({
    startDate,
    nextStartDate: sorted[index + 1],
    length: differenceInCalendarDays(parseISO(sorted[index + 1]), parseISO(startDate)),
  }));
}

function filteredIntervals(intervals: CycleInterval[]) {
  const valid = intervals.filter(({ length }) => length >= 10 && length <= 90);
  return {
    intervals: valid.length > 0 ? valid : intervals,
    usedFallback: intervals.length > 0 && valid.length === 0,
  };
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[]) {
  const mean = average(values);
  const sum = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  return Math.sqrt(sum / (values.length - 1));
}

function mostRecentValue(labs: LabEntry[], key: keyof LabEntry): number | undefined {
  return [...labs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => entry[key])
    .find((value): value is number => typeof value === 'number');
}

type CyclePrior = {
  mean: number;
  spread: number;
  pcosPattern?: 'milder' | 'severe';
};

function getPrior(condition: Condition, labs: LabEntry[], cycleLengths: number[]): CyclePrior {
  if (condition === 'pcos') {
    const longCycleFraction =
      cycleLengths.length > 0
        ? cycleLengths.filter((length) => length >= 55).length / cycleLengths.length
        : 0;
    const isSevere = longCycleFraction >= 0.3;
    return {
      mean: isSevere ? 60 : 43,
      spread: isSevere ? 16 : 10,
      pcosPattern: isSevere ? 'severe' : 'milder',
    };
  }

  const prior = { ...BASE_PRIORS[condition] };
  const tsh = mostRecentValue(labs, 'tsh');
  if (condition === 'hypothyroid' && tsh !== undefined && tsh > 4) {
    prior.mean += Math.min(15, (tsh - 4) * 0.8);
  }
  return prior;
}

export function calculatePrediction(
  profile: Profile,
  periods: PeriodEntry[],
  labs: LabEntry[],
): PredictionResult {
  const availableIntervals = getCycleIntervals(profile, periods);
  const { intervals, usedFallback } = filteredIntervals(availableIntervals);
  const cycleLengths = intervals.map(({ length }) => length);
  const prior = getPrior(profile.condition, labs, cycleLengths);
  const n = cycleLengths.length;
  let estimateDays = prior.mean;
  let predictionSpread = prior.spread;
  let ownAverage: number | undefined;
  let ownSpread: number | undefined;

  if (n > 0) {
    ownAverage = average(cycleLengths);
    ownSpread = Math.max(1, n >= 2 ? sampleStandardDeviation(cycleLengths) : prior.spread);
    const priorWeight = 1 / prior.spread ** 2;
    const dataWeight = n / ownSpread ** 2;
    estimateDays =
      (dataWeight * ownAverage + priorWeight * prior.mean) / (dataWeight + priorWeight);
    const uncertaintyInEstimate = 1 / (dataWeight + priorWeight);
    predictionSpread = Math.sqrt(uncertaintyInEstimate + ownSpread ** 2);
  }

  const confidenceWindowDays = Math.round(predictionSpread * 1.96);
  const latestStart = [
    ...new Set([profile.lastPeriodStartDate, ...periods.map((item) => item.startDate)]),
  ]
    .sort()
    .at(-1)!;
  const predictedDate = addDays(parseISO(latestStart), Math.round(estimateDays));
  const conditionName = profile.condition === 'none' ? 'no selected condition' : profile.condition;

  return {
    conditionMean: prior.mean,
    conditionSpread: prior.spread,
    estimateDays,
    predictionSpread,
    confidenceWindowDays,
    predictedDate,
    rangeStart: addDays(predictedDate, -confidenceWindowDays),
    rangeEnd: addDays(predictedDate, confidenceWindowDays),
    ovulationDate: addDays(predictedDate, -Math.round(12.4)),
    cyclesUsed: n,
    cyclesAvailable: availableIntervals.length,
    ownAverage,
    ownSpread,
    usedFallbackCycles: usedFallback,
    pcosPattern: 'pcosPattern' in prior ? prior.pcosPattern : undefined,
    explanation:
      n === 0
        ? `With no completed cycles yet, this range starts from the research-based estimate for ${conditionName}.`
        : `Because you selected ${conditionName} and have ${n} usable completed cycle${n === 1 ? '' : 's'}, this blends the condition-aware starting pattern with your own history.`,
  };
}

export function getFilteredCycleLengths(profile: Profile, periods: PeriodEntry[]) {
  return filteredIntervals(getCycleIntervals(profile, periods)).intervals.map(
    ({ length }) => length,
  );
}
