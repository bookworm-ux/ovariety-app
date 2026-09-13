import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

import type { Condition, LabEntry, PeriodEntry, Profile } from '@/lib/health-types';

export interface CycleInterval {
  startDate: string;
  nextStartDate: string;
  length: number;
}

export interface PredictionCalculationDetails {
  cycleFilter: {
    minimumDays: number;
    maximumDays: number;
    validIntervals: number;
  };
  priorSource: 'condition' | 'pcos-pattern';
  pcosClassification?: {
    longCycleThresholdDays: number;
    severeFractionThreshold: number;
    longCycles: number;
    longCycleFraction: number;
  };
  tshAdjustment?: {
    threshold: number;
    multiplier: number;
    capDays: number;
    appliedDays: number;
  };
  weighting?: {
    priorWeight: number;
    historyWeight: number;
    estimateUncertainty: number;
  };
  confidenceMultiplier: number;
  ovulationOffsetDays: number;
  roundedEstimateDays: number;
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
  calculationDetails: PredictionCalculationDetails;
  explanation: string;
}

const MINIMUM_CYCLE_DAYS = 10;
const MAXIMUM_CYCLE_DAYS = 90;
const PCOS_LONG_CYCLE_DAYS = 55;
const PCOS_SEVERE_FRACTION = 0.3;
const TSH_THRESHOLD = 4;
const TSH_ADJUSTMENT_PER_UNIT = 0.8;
const TSH_ADJUSTMENT_CAP_DAYS = 15;
const CONFIDENCE_MULTIPLIER = 1.96;
const OVULATION_OFFSET_DAYS = 12.4;

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
  const valid = intervals.filter(
    ({ length }) => length >= MINIMUM_CYCLE_DAYS && length <= MAXIMUM_CYCLE_DAYS,
  );
  return {
    intervals: valid.length > 0 ? valid : intervals,
    validCount: valid.length,
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
  pcosClassification?: PredictionCalculationDetails['pcosClassification'];
  tshAdjustment?: PredictionCalculationDetails['tshAdjustment'];
};

function getPrior(condition: Condition, labs: LabEntry[], cycleLengths: number[]): CyclePrior {
  if (condition === 'pcos') {
    const longCycles = cycleLengths.filter((length) => length >= PCOS_LONG_CYCLE_DAYS).length;
    const longCycleFraction = cycleLengths.length > 0 ? longCycles / cycleLengths.length : 0;
    const isSevere = longCycleFraction >= PCOS_SEVERE_FRACTION;
    return {
      mean: isSevere ? 60 : 43,
      spread: isSevere ? 16 : 10,
      pcosPattern: isSevere ? 'severe' : 'milder',
      pcosClassification: {
        longCycleThresholdDays: PCOS_LONG_CYCLE_DAYS,
        severeFractionThreshold: PCOS_SEVERE_FRACTION,
        longCycles,
        longCycleFraction,
      },
    };
  }

  const prior = { ...BASE_PRIORS[condition] };
  const tsh = mostRecentValue(labs, 'tsh');
  let tshAdjustment: PredictionCalculationDetails['tshAdjustment'];
  if (condition === 'hypothyroid') {
    const appliedDays =
      tsh !== undefined && tsh > TSH_THRESHOLD
        ? Math.min(TSH_ADJUSTMENT_CAP_DAYS, (tsh - TSH_THRESHOLD) * TSH_ADJUSTMENT_PER_UNIT)
        : 0;
    prior.mean += appliedDays;
    tshAdjustment = {
      threshold: TSH_THRESHOLD,
      multiplier: TSH_ADJUSTMENT_PER_UNIT,
      capDays: TSH_ADJUSTMENT_CAP_DAYS,
      appliedDays,
    };
  }
  return { ...prior, tshAdjustment };
}

export function calculatePrediction(
  profile: Profile,
  periods: PeriodEntry[],
  labs: LabEntry[],
): PredictionResult {
  const availableIntervals = getCycleIntervals(profile, periods);
  const { intervals, validCount, usedFallback } = filteredIntervals(availableIntervals);
  const cycleLengths = intervals.map(({ length }) => length);
  const prior = getPrior(profile.condition, labs, cycleLengths);
  const n = cycleLengths.length;
  let estimateDays = prior.mean;
  let predictionSpread = prior.spread;
  let ownAverage: number | undefined;
  let ownSpread: number | undefined;
  let weighting: PredictionCalculationDetails['weighting'];

  if (n > 0) {
    ownAverage = average(cycleLengths);
    ownSpread = Math.max(1, n >= 2 ? sampleStandardDeviation(cycleLengths) : prior.spread);
    const priorWeight = 1 / prior.spread ** 2;
    const historyWeight = n / ownSpread ** 2;
    estimateDays =
      (historyWeight * ownAverage + priorWeight * prior.mean) / (historyWeight + priorWeight);
    const estimateUncertainty = 1 / (historyWeight + priorWeight);
    predictionSpread = Math.sqrt(estimateUncertainty + ownSpread ** 2);
    weighting = { priorWeight, historyWeight, estimateUncertainty };
  }

  const confidenceWindowDays = Math.round(predictionSpread * CONFIDENCE_MULTIPLIER);
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
    ovulationDate: addDays(predictedDate, -Math.round(OVULATION_OFFSET_DAYS)),
    cyclesUsed: n,
    cyclesAvailable: availableIntervals.length,
    ownAverage,
    ownSpread,
    usedFallbackCycles: usedFallback,
    pcosPattern: prior.pcosPattern,
    calculationDetails: {
      cycleFilter: {
        minimumDays: MINIMUM_CYCLE_DAYS,
        maximumDays: MAXIMUM_CYCLE_DAYS,
        validIntervals: validCount,
      },
      priorSource: profile.condition === 'pcos' ? 'pcos-pattern' : 'condition',
      pcosClassification: prior.pcosClassification,
      tshAdjustment: prior.tshAdjustment,
      weighting,
      confidenceMultiplier: CONFIDENCE_MULTIPLIER,
      ovulationOffsetDays: OVULATION_OFFSET_DAYS,
      roundedEstimateDays: Math.round(estimateDays),
    },
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
