import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

import type { Condition, DailyLog, LabEntry, PeriodEntry, Profile } from '@/lib/health-types';

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
  mostLikelyMultiplier: number;
  ovulationOffsetDays: number;
  roundedEstimateDays: number;
}

export interface PredictionResult {
  conditionMean: number;
  conditionSpread: number;
  estimateDays: number;
  predictionSpread: number;
  confidenceWindowDays: number;
  mostLikelyWindowDays: number;
  predictedDate: Date;
  mostLikelyStart: Date;
  mostLikelyEnd: Date;
  rangeStart: Date;
  rangeEnd: Date;
  ovulationDate: Date;
  ovulationReliable: boolean;
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
const MOST_LIKELY_MULTIPLIER = 0.674;
const MAX_RELIABLE_PHASE_WINDOW_DAYS = 14;
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
  const mostLikelyWindowDays = Math.max(1, Math.round(predictionSpread * MOST_LIKELY_MULTIPLIER));
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
    mostLikelyWindowDays,
    predictedDate,
    mostLikelyStart: addDays(predictedDate, -mostLikelyWindowDays),
    mostLikelyEnd: addDays(predictedDate, mostLikelyWindowDays),
    rangeStart: addDays(predictedDate, -confidenceWindowDays),
    rangeEnd: addDays(predictedDate, confidenceWindowDays),
    ovulationDate: addDays(predictedDate, -Math.round(OVULATION_OFFSET_DAYS)),
    ovulationReliable: confidenceWindowDays <= MAX_RELIABLE_PHASE_WINDOW_DAYS,
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
      mostLikelyMultiplier: MOST_LIKELY_MULTIPLIER,
      ovulationOffsetDays: OVULATION_OFFSET_DAYS,
      roundedEstimateDays: Math.round(estimateDays),
    },
    explanation:
      n === 0
        ? `With no completed cycles yet, this range starts from the research-based estimate for ${conditionName}.`
        : `Because you selected ${conditionName} and have ${n} usable completed cycle${n === 1 ? '' : 's'}, this blends the condition-aware starting pattern with your own history.`,
  };
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface DailyGuidanceItem {
  label: 'Energy & focus' | 'Training' | 'Nutrition';
  guidance: string;
  reasoning: string;
}

export type DailyGuidance =
  | {
      status: 'low-confidence';
      reason: string;
    }
  | {
      status: 'available';
      phase: CyclePhase;
      phaseLabel: string;
      phaseReason: string;
      items: DailyGuidanceItem[];
      override?: {
        phaseSuggested: string;
        signalsSaid: string;
        doInstead: string;
      };
    };

const PHASE_GUIDANCE: Record<
  CyclePhase,
  {
    label: string;
    expectedLevel: number;
    energy: string;
    energyReason: string;
    training: string;
    trainingReason: string;
    nutrition: string;
    nutritionReason: string;
  }
> = {
  menstrual: {
    label: 'Menstrual phase',
    expectedLevel: 2,
    energy: 'Expect lower energy and use shorter, quieter focus blocks.',
    energyReason: 'Bleeding days can coincide with lower perceived energy and concentration.',
    training: 'Choose rest. If you want movement, try a 10–20 minute easy walk or gentle mobility.',
    trainingReason: 'A recovery-first option reduces load while keeping light movement available.',
    nutrition: 'Prioritize an iron-rich food paired with vitamin C.',
    nutritionReason: 'This supports iron intake during bleeding, especially if flow is heavy.',
  },
  follicular: {
    label: 'Follicular phase',
    expectedLevel: 4,
    energy: 'Plan demanding work while energy and focus may be building.',
    energyReason: 'The phase after bleeding often trends toward improving perceived capacity.',
    training:
      'Try strength work, intervals, or a brisk session; swap to an easy walk if energy dips.',
    trainingReason:
      'Rising capacity may suit progressive training without requiring maximum effort.',
    nutrition: 'Build meals around protein, fiber-rich carbohydrates, and vegetables.',
    nutritionReason: 'Balanced fuel supports training and steadier energy through the day.',
  },
  ovulatory: {
    label: 'Estimated ovulatory phase',
    expectedLevel: 4,
    energy: 'Higher energy and outward focus may be more available today.',
    energyReason: 'The estimated mid-cycle window can align with higher perceived capacity.',
    training:
      'Choose a challenging session if you feel ready; use moderate strength work as the alternative.',
    trainingReason: 'The phase estimate may support intensity, but readiness still sets the load.',
    nutrition: 'Prioritize hydration and a protein-rich meal after training.',
    nutritionReason: 'Fluids and protein support recovery when activity is higher.',
  },
  luteal: {
    label: 'Luteal phase',
    expectedLevel: 3,
    energy: 'Use steady focus blocks and leave more recovery space later in the day.',
    energyReason: 'Perceived energy can become less consistent as the next period approaches.',
    training:
      'Choose moderate strength or easy aerobic work; take a recovery walk if effort feels unusually hard.',
    trainingReason: 'Moderate loading is easier to adjust when day-to-day capacity varies.',
    nutrition:
      'Prioritize regular meals with protein, complex carbohydrates, and magnesium-rich foods.',
    nutritionReason: 'Consistent meals can support steadier energy and common premenstrual needs.',
  },
};

function signalSummary(signals: NonNullable<DailyLog['signals']>) {
  const labels = {
    sleep: 'sleep',
    energy: 'energy',
    cognitiveClarity: 'clarity',
  } as const;
  const signalKeys: Array<keyof typeof labels> = ['sleep', 'energy', 'cognitiveClarity'];

  return signalKeys
    .filter((key) => signals[key] !== undefined)
    .map((key) => `${labels[key]} ${signals[key]}/5`)
    .join(', ');
}

export function calculateDailyGuidance(
  prediction: PredictionResult,
  latestStart: string,
  latestPeriod: PeriodEntry | undefined,
  dailyLog: DailyLog | undefined,
  today: string,
): DailyGuidance {
  if (!prediction.ovulationReliable) {
    return {
      status: 'low-confidence',
      reason: `The full prediction window is ${prediction.confidenceWindowDays * 2 + 1} days, so the cycle phase cannot be estimated reliably yet. Log more period starts to narrow the range.`,
    };
  }

  const targetDate = parseISO(today);
  const rawCycleDay = differenceInCalendarDays(targetDate, parseISO(latestStart)) + 1;
  const estimatedCycleDays = Math.max(10, prediction.calculationDetails.roundedEstimateDays);
  const cycleDay =
    ((((rawCycleDay - 1) % estimatedCycleDays) + estimatedCycleDays) % estimatedCycleDays) + 1;
  const recordedPeriodLength = latestPeriod?.periodLengthDays
    ? latestPeriod.periodLengthDays
    : latestPeriod?.endDate
      ? differenceInCalendarDays(parseISO(latestPeriod.endDate), parseISO(latestStart)) + 1
      : 5;
  const menstrualDays = Math.min(10, Math.max(2, recordedPeriodLength));
  const estimatedOvulationDay = Math.max(
    menstrualDays + 2,
    estimatedCycleDays - Math.round(prediction.calculationDetails.ovulationOffsetDays),
  );
  let phase: CyclePhase;
  if (cycleDay <= menstrualDays) phase = 'menstrual';
  else if (Math.abs(cycleDay - estimatedOvulationDay) <= 1) phase = 'ovulatory';
  else if (cycleDay < estimatedOvulationDay) phase = 'follicular';
  else phase = 'luteal';

  const phaseGuidance = PHASE_GUIDANCE[phase];
  const signals = dailyLog?.signals ?? {};
  const lowSignals = (['sleep', 'energy', 'cognitiveClarity'] as const).filter(
    (key) => signals[key] !== undefined && signals[key] <= 2,
  );
  const strongSignals =
    signals.energy !== undefined &&
    signals.energy >= 4 &&
    signals.cognitiveClarity !== undefined &&
    signals.cognitiveClarity >= 4 &&
    (signals.sleep === undefined || signals.sleep >= 3);
  const lowerCapacityOverride = lowSignals.length > 0 && phaseGuidance.expectedLevel >= 3;
  const higherCapacityOverride = strongSignals && phaseGuidance.expectedLevel <= 2;
  const summary = signalSummary(signals);

  if (lowerCapacityOverride) {
    return {
      status: 'available',
      phase,
      phaseLabel: phaseGuidance.label,
      phaseReason: `Estimated from cycle day ${cycleDay} and the current prediction window.`,
      override: {
        phaseSuggested: `${phaseGuidance.label} suggested moderate to higher capacity.`,
        signalsSaid: `Today’s log showed lower capacity (${summary}).`,
        doInstead: 'The logged signals take priority: reduce load and reassess tomorrow.',
      },
      items: [
        {
          label: 'Energy & focus',
          guidance: 'Plan for lower energy and use short focus blocks with extra breaks.',
          reasoning:
            'Today’s sleep, energy, or clarity rating is low, so the signal overrides the phase pattern.',
        },
        {
          label: 'Training',
          guidance:
            'Choose rest. If you want movement, take a 10–20 minute easy walk or do gentle mobility.',
          reasoning:
            'Low logged capacity makes recovery more appropriate than the phase-based session.',
        },
        {
          label: 'Nutrition',
          guidance: 'Prioritize regular meals with protein, complex carbohydrates, and fluids.',
          reasoning:
            'Consistent food and hydration are practical support when energy or sleep is low.',
        },
      ],
    };
  }

  if (higherCapacityOverride) {
    return {
      status: 'available',
      phase,
      phaseLabel: phaseGuidance.label,
      phaseReason: `Estimated from cycle day ${cycleDay} and the current prediction window.`,
      override: {
        phaseSuggested: `${phaseGuidance.label} suggested a recovery-first day.`,
        signalsSaid: `Today’s log showed stronger energy and clarity (${summary}).`,
        doInstead:
          'The logged signals take priority: moderate activity is reasonable if it continues to feel good.',
      },
      items: [
        {
          label: 'Energy & focus',
          guidance: 'Use the available energy for one priority task, then check in again.',
          reasoning:
            'Today’s strong energy and clarity ratings outweigh the lower phase expectation.',
        },
        {
          label: 'Training',
          guidance:
            'Try moderate strength work or a brisk walk; switch to gentle mobility if symptoms appear.',
          reasoning:
            'Your signals support more than rest, while the phase still argues against an all-out session.',
        },
        {
          label: 'Nutrition',
          guidance: 'Pair iron-rich food with vitamin C and keep fluids nearby.',
          reasoning:
            'The phase-related nutrition priority still applies even when readiness is higher.',
        },
      ],
    };
  }

  return {
    status: 'available',
    phase,
    phaseLabel: phaseGuidance.label,
    phaseReason: `Estimated from cycle day ${cycleDay} and the current prediction window.`,
    items: [
      {
        label: 'Energy & focus',
        guidance: phaseGuidance.energy,
        reasoning: phaseGuidance.energyReason,
      },
      {
        label: 'Training',
        guidance: phaseGuidance.training,
        reasoning: phaseGuidance.trainingReason,
      },
      {
        label: 'Nutrition',
        guidance: phaseGuidance.nutrition,
        reasoning: phaseGuidance.nutritionReason,
      },
    ],
  };
}

export function getFilteredCycleLengths(profile: Profile, periods: PeriodEntry[]) {
  return filteredIntervals(getCycleIntervals(profile, periods)).intervals.map(
    ({ length }) => length,
  );
}
