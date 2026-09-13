import { type PropsWithChildren, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, PressableFeedback, Typography } from 'heroui-native';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from 'date-fns';

import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer } from '@/components/HealthNotices';
import { PredictionRangeTimeline } from '@/components/PredictionRangeTimeline';
import { Screen } from '@/components/Screen';
import { displayDate } from '@/lib/date-utils';
import { CONDITION_LABELS } from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';
import { calculateDailyGuidance, calculatePrediction, type CyclePhase } from '@/lib/prediction';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PHASES = [
  'menstrual',
  'follicular',
  'ovulatory',
  'luteal',
] as const satisfies readonly CyclePhase[];

const PHASE_STYLES: Record<CyclePhase, { label: string; background: string; marker: string }> = {
  menstrual: {
    label: 'Menstrual',
    background: 'bg-phase-menstrual',
    marker: 'bg-phase-menstrual-marker',
  },
  follicular: {
    label: 'Follicular',
    background: 'bg-phase-follicular',
    marker: 'bg-phase-follicular-marker',
  },
  ovulatory: {
    label: 'Ovulatory',
    background: 'bg-phase-ovulatory',
    marker: 'bg-phase-ovulatory-marker',
  },
  luteal: {
    label: 'Luteal',
    background: 'bg-phase-luteal',
    marker: 'bg-phase-luteal-marker',
  },
};

export default function PredictionScreen() {
  const profile = useHealthStore((state) => state.profile);
  const periods = useHealthStore((state) => state.periods);
  const dailyLogs = useHealthStore((state) => state.dailyLogs);
  const labs = useHealthStore((state) => state.labs);
  const [expanded, setExpanded] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const prediction = useMemo(
    () => (profile ? calculatePrediction(profile, periods, labs) : null),
    [profile, periods, labs],
  );
  if (!profile || !prediction) return <EmptyProfile />;
  const monthStart = startOfMonth(displayedMonth);
  const monthEnd = endOfMonth(displayedMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingDayCount = getDay(monthStart);
  const calendarCells = [
    ...Array.from({ length: leadingDayCount }, (_, offset) => ({
      day: null,
      key: `empty-${format(addDays(monthStart, offset - leadingDayCount), 'yyyy-MM-dd')}`,
    })),
    ...monthDays.map((day) => ({ day, key: format(day, 'yyyy-MM-dd') })),
  ];
  const cycleStarts = [
    profile.lastPeriodStartDate,
    ...periods.map((item) => item.startDate),
  ].sort();
  const guidanceForDate = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const cycleStart = cycleStarts.filter((start) => start <= dateKey).at(-1) ?? cycleStarts[0];
    const period = periods.find((item) => item.startDate === cycleStart);
    const dailyLog = dailyLogs.find((item) => item.date === dateKey);
    return calculateDailyGuidance(prediction, cycleStart, period, dailyLog, dateKey);
  };
  const selectedGuidance = guidanceForDate(selectedDate);
  const selectedPhaseStyle =
    selectedGuidance.status === 'available' ? PHASE_STYLES[selectedGuidance.phase] : null;

  const changeMonth = (amount: number) => {
    const nextMonth = startOfMonth(addMonths(displayedMonth, amount));
    setDisplayedMonth(nextMonth);
    setSelectedDate(nextMonth);
  };

  return (
    <Screen
      eyebrow="Prediction"
      title={`${displayDate(prediction.rangeStart)} – ${displayDate(prediction.rangeEnd)}`}
      subtitle="This is an estimated 95% range, not a guaranteed date."
    >
      <Card className="gap-2 p-5">
        <Typography type="h4">Estimate timeline</Typography>
        <PredictionRangeTimeline
          mostLikelyEnd={prediction.mostLikelyEnd}
          mostLikelyStart={prediction.mostLikelyStart}
          predictedDate={prediction.predictedDate}
          rangeStart={prediction.rangeStart}
          rangeEnd={prediction.rangeEnd}
        />
      </Card>
      <Card className="gap-3 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Button
            accessibilityLabel="Show previous month"
            className="min-w-24"
            variant="outline"
            onPress={() => changeMonth(-1)}
          >
            <Button.Label>Previous</Button.Label>
          </Button>
          <Typography className="flex-1 text-center" type="h4">
            {format(displayedMonth, 'MMMM yyyy')}
          </Typography>
          <Button
            accessibilityLabel="Show next month"
            className="min-w-24"
            variant="outline"
            onPress={() => changeMonth(1)}
          >
            <Button.Label>Next</Button.Label>
          </Button>
        </View>
        <View className="flex-row justify-between">
          {WEEKDAYS.map((day) => (
            <Typography key={day} className="text-muted w-[13%] text-center text-xs">
              {day[0]}
            </Typography>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {calendarCells.map(({ day, key }) => {
            if (!day) {
              return <View key={key} className="m-[0.6%] aspect-square w-[13%]" />;
            }

            const dayGuidance = guidanceForDate(day);
            const phaseStyle =
              dayGuidance.status === 'available' ? PHASE_STYLES[dayGuidance.phase] : null;
            const selected = key === format(selectedDate, 'yyyy-MM-dd');
            const insidePredictionRange =
              day >= prediction.rangeStart && day <= prediction.rangeEnd;
            const accessibilityPhase = phaseStyle
              ? `${phaseStyle.label} phase estimate`
              : 'phase unavailable';

            return (
              <PressableFeedback
                key={key}
                accessibilityLabel={`${format(day, 'MMMM d')}, ${accessibilityPhase}. Select for guidance.`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`m-[0.6%] aspect-square w-[13%] items-center justify-center rounded-full border-2 ${phaseStyle?.background ?? 'bg-surface-secondary'} ${selected ? 'border-foreground' : 'border-transparent'}`}
                onPress={() => setSelectedDate(day)}
              >
                <Typography className="font-semibold">{format(day, 'd')}</Typography>
                <View className="absolute bottom-1.5 flex-row gap-1">
                  {phaseStyle ? (
                    <View className={`h-1.5 w-1.5 rounded-full ${phaseStyle.marker}`} />
                  ) : null}
                  {insidePredictionRange ? (
                    <View className="bg-accent h-1.5 w-1.5 rounded-full" />
                  ) : null}
                </View>
              </PressableFeedback>
            );
          })}
        </View>
        <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2">
          {PHASES.map((phase) => (
            <View key={phase} className="flex-row items-center gap-2">
              <View className={`h-2.5 w-5 rounded-full ${PHASE_STYLES[phase].background}`} />
              <Typography className="text-muted text-xs">{PHASE_STYLES[phase].label}</Typography>
            </View>
          ))}
          <View className="flex-row items-center gap-2">
            <View className="bg-accent h-2.5 w-2.5 rounded-full" />
            <Typography className="text-muted text-xs">Predicted period range</Typography>
          </View>
        </View>
        <Typography className="text-muted text-center text-xs">
          Phase shades are estimates. Tap any date for productivity, training, and nutrition
          guidance.
        </Typography>
      </Card>
      <Card className="gap-4 p-5">
        <View className="gap-1">
          <Typography type="h4">{format(selectedDate, 'EEEE, MMMM d')}</Typography>
          {selectedPhaseStyle && selectedGuidance.status === 'available' ? (
            <Typography className="text-muted text-sm">
              {selectedPhaseStyle.label} phase estimate · {selectedGuidance.phaseReason}
            </Typography>
          ) : null}
        </View>
        {selectedGuidance.status === 'low-confidence' ? (
          <View className="bg-surface-secondary gap-2 rounded-xl p-4">
            <Typography className="font-semibold">Phase guidance is not reliable yet</Typography>
            <Typography className="text-muted text-sm leading-6">
              {selectedGuidance.reason}
            </Typography>
          </View>
        ) : (
          <>
            {selectedGuidance.override ? (
              <View className="bg-surface-secondary gap-2 rounded-xl p-4">
                <Typography className="font-semibold">Your logged signals take priority</Typography>
                <Typography className="text-muted text-sm leading-6">
                  {selectedGuidance.override.phaseSuggested} {selectedGuidance.override.signalsSaid}{' '}
                  {selectedGuidance.override.doInstead}
                </Typography>
              </View>
            ) : null}
            {selectedGuidance.items.map((item) => (
              <View key={item.label} className="gap-1">
                <Typography className="font-semibold">{item.label}</Typography>
                <Typography className="text-sm leading-6">{item.guidance}</Typography>
                <Typography className="text-muted text-xs leading-5">
                  Why: {item.reasoning}
                </Typography>
              </View>
            ))}
          </>
        )}
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Why this range?</Typography>
        <Typography className="text-muted text-sm leading-6">{prediction.explanation}</Typography>
        <Button variant="outline" onPress={() => setExpanded((value) => !value)}>
          <Button.Label>
            {expanded ? 'Hide calculation details' : 'Show calculation details'}
          </Button.Label>
        </Button>
        {expanded ? (
          <View className="bg-muted/10 gap-4 rounded-xl p-4">
            <View className="gap-1">
              <Typography className="font-semibold">Developer model trace</Typography>
              <Typography className="text-muted text-xs leading-5">
                These are the bundled FemNova constants and derived values used for this estimate.
                No synthetic source records are included.
              </Typography>
            </View>

            <CalculationSection title="1. Select usable cycle history">
              <Detail label="Selected condition" value={CONDITION_LABELS[profile.condition]} />
              <Detail
                label="Accepted cycle length"
                value={`${prediction.calculationDetails.cycleFilter.minimumDays}–${prediction.calculationDetails.cycleFilter.maximumDays} days`}
              />
              <Detail
                label="Valid completed cycles"
                value={`${prediction.calculationDetails.cycleFilter.validIntervals} of ${prediction.cyclesAvailable}`}
              />
              {prediction.usedFallbackCycles ? (
                <Typography className="text-muted text-xs leading-5">
                  No completed interval passed the filter, so the available logged intervals were
                  used as a fallback.
                </Typography>
              ) : null}
            </CalculationSection>

            <CalculationSection title="2. Choose the starting pattern">
              <Detail
                label="Prior source"
                value={
                  prediction.calculationDetails.priorSource === 'pcos-pattern'
                    ? 'PCOS pattern rule'
                    : 'Condition constant'
                }
              />
              <Detail label="Starting mean" value={`${prediction.conditionMean.toFixed(1)} days`} />
              <Detail
                label="Starting spread"
                value={`${prediction.conditionSpread.toFixed(1)} days`}
              />
              {prediction.pcosPattern && prediction.calculationDetails.pcosClassification ? (
                <>
                  <Detail label="Selected PCOS pattern" value={prediction.pcosPattern} />
                  <Detail
                    label="Long-cycle rule"
                    value={`≥ ${prediction.calculationDetails.pcosClassification.longCycleThresholdDays} days`}
                  />
                  <Detail
                    label="Observed long-cycle share"
                    value={`${prediction.calculationDetails.pcosClassification.longCycles}/${prediction.cyclesUsed} (${formatPercent(prediction.calculationDetails.pcosClassification.longCycleFraction)})`}
                  />
                  <Typography className="text-muted text-xs leading-5">
                    The severe starting pattern is selected when at least{' '}
                    {formatPercent(
                      prediction.calculationDetails.pcosClassification.severeFractionThreshold,
                    )}{' '}
                    of usable cycles meet the long-cycle rule. This is a calculation label, not a
                    diagnosis or severity assessment.
                  </Typography>
                </>
              ) : null}
              {prediction.calculationDetails.tshAdjustment ? (
                <>
                  <Detail
                    label="TSH adjustment applied"
                    value={`+${prediction.calculationDetails.tshAdjustment.appliedDays.toFixed(1)} days`}
                  />
                  <Typography className="text-muted text-xs leading-5">
                    Formula when the latest entered TSH is above{' '}
                    {prediction.calculationDetails.tshAdjustment.threshold}: min(
                    {prediction.calculationDetails.tshAdjustment.capDays}, (TSH −{' '}
                    {prediction.calculationDetails.tshAdjustment.threshold}) ×{' '}
                    {prediction.calculationDetails.tshAdjustment.multiplier}). This adjusts the
                    model estimate only.
                  </Typography>
                </>
              ) : null}
            </CalculationSection>

            <CalculationSection title="3. Blend the prior with logged history">
              <Detail label="Completed cycles used" value={String(prediction.cyclesUsed)} />
              {prediction.ownAverage !== undefined ? (
                <Detail
                  label="Personal cycle average"
                  value={`${prediction.ownAverage.toFixed(1)} days`}
                />
              ) : null}
              {prediction.ownSpread !== undefined ? (
                <Detail
                  label="Personal cycle spread"
                  value={`${prediction.ownSpread.toFixed(1)} days`}
                />
              ) : null}
              {prediction.calculationDetails.weighting ? (
                <>
                  <Detail
                    label="Prior precision weight"
                    value={prediction.calculationDetails.weighting.priorWeight.toFixed(4)}
                  />
                  <Detail
                    label="History precision weight"
                    value={prediction.calculationDetails.weighting.historyWeight.toFixed(4)}
                  />
                  <Typography className="text-muted text-xs leading-5">
                    Blended mean = (history weight × personal average + prior weight × starting
                    mean) ÷ (history weight + prior weight). Prior weight = 1 ÷ starting spread²;
                    history weight = cycle count ÷ personal spread².
                  </Typography>
                </>
              ) : (
                <Typography className="text-muted text-xs leading-5">
                  No completed cycle was available, so this estimate uses the starting pattern
                  without precision weighting.
                </Typography>
              )}
              <Detail
                label="Blended estimate"
                value={`${prediction.estimateDays.toFixed(1)} days`}
              />
            </CalculationSection>

            <CalculationSection title="4. Build the displayed dates">
              <Detail
                label="Predictive spread"
                value={`${prediction.predictionSpread.toFixed(1)} days`}
              />
              <Detail
                label="Full range multiplier"
                value={`${prediction.calculationDetails.confidenceMultiplier} × spread`}
              />
              <Detail
                label="Full range width each side"
                value={`${prediction.confidenceWindowDays} days`}
              />
              <Detail
                label="Most likely multiplier"
                value={`${prediction.calculationDetails.mostLikelyMultiplier} × spread`}
              />
              <Detail
                label="Most likely width each side"
                value={`${prediction.mostLikelyWindowDays} days`}
              />
              <Detail
                label="Rounded cycle estimate"
                value={`${prediction.calculationDetails.roundedEstimateDays} days`}
              />
              <Detail
                label="Ovulation offset constant"
                value={`${prediction.calculationDetails.ovulationOffsetDays} days before midpoint`}
              />
              <Typography className="text-muted text-xs leading-5">
                The midpoint adds the rounded blended estimate to the latest logged period start.
                The full range uses the 95% multiplier; the solid most-likely band uses the 50%
                multiplier. Ovulation is withheld from the interface when the full-range half-width
                exceeds 14 days.
              </Typography>
            </CalculationSection>

            <Typography className="text-muted text-xs leading-5">
              The app recalculates locally whenever cycle history or relevant numeric labs change.
              No AI model, external calculation service, or bundled synthetic record is used at
              runtime.
            </Typography>
          </View>
        ) : null}
      </Card>
      <MedicalDisclaimer />
    </Screen>
  );
}

function CalculationSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View className="border-border gap-2 border-t pt-4">
      <Typography className="text-sm font-semibold">{title}</Typography>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Typography className="text-muted flex-1 text-sm">{label}</Typography>
      <Typography className="max-w-[55%] text-right text-sm font-semibold">{value}</Typography>
    </View>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value === 0 ? 0 : 1)}%`;
}
