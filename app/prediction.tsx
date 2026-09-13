import { type PropsWithChildren, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Typography } from 'heroui-native';
import { addDays, eachDayOfInterval, format, startOfWeek } from 'date-fns';

import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer } from '@/components/HealthNotices';
import { PredictionRangeTimeline } from '@/components/PredictionRangeTimeline';
import { Screen } from '@/components/Screen';
import { displayDate } from '@/lib/date-utils';
import { CONDITION_LABELS } from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';
import { calculatePrediction } from '@/lib/prediction';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PredictionScreen() {
  const profile = useHealthStore((state) => state.profile);
  const periods = useHealthStore((state) => state.periods);
  const labs = useHealthStore((state) => state.labs);
  const [expanded, setExpanded] = useState(false);
  const prediction = useMemo(
    () => (profile ? calculatePrediction(profile, periods, labs) : null),
    [profile, periods, labs],
  );
  if (!profile || !prediction) return <EmptyProfile />;
  const gridStart = startOfWeek(prediction.rangeStart);
  const days = eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 34) });

  return (
    <Screen
      eyebrow="Prediction"
      title={`${displayDate(prediction.rangeStart)} – ${displayDate(prediction.rangeEnd)}`}
      subtitle="This is an estimated 95% range, not a guaranteed date."
    >
      <Card className="gap-2 p-5">
        <Typography type="h4">Estimate timeline</Typography>
        <PredictionRangeTimeline
          ovulationDate={prediction.ovulationDate}
          predictedDate={prediction.predictedDate}
          rangeStart={prediction.rangeStart}
          rangeEnd={prediction.rangeEnd}
        />
      </Card>
      <Card className="gap-3 p-4">
        <View className="flex-row justify-between">
          {WEEKDAYS.map((day) => (
            <Typography key={day} className="text-muted w-[13%] text-center text-xs">
              {day[0]}
            </Typography>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {days.map((day) => {
            const inside = day >= prediction.rangeStart && day <= prediction.rangeEnd;
            const midpoint =
              format(day, 'yyyy-MM-dd') === format(prediction.predictedDate, 'yyyy-MM-dd');
            return (
              <View
                key={day.toISOString()}
                className={`m-[0.6%] aspect-square w-[13%] items-center justify-center rounded-full ${midpoint ? 'bg-accent' : inside ? 'bg-accent/15' : ''}`}
              >
                <Typography
                  className={
                    midpoint
                      ? 'text-accent-foreground font-semibold'
                      : inside
                        ? 'text-accent font-semibold'
                        : 'text-muted'
                  }
                >
                  {format(day, 'd')}
                </Typography>
              </View>
            );
          })}
        </View>
        <Typography className="text-muted text-center text-xs">
          Filled date: center estimate · shaded dates: prediction range
        </Typography>
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
                label="Range multiplier"
                value={`${prediction.calculationDetails.confidenceMultiplier} × spread`}
              />
              <Detail
                label="Range width each side"
                value={`${prediction.confidenceWindowDays} days`}
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
                The displayed range adds and subtracts the rounded multiplier result. Ovulation is a
                separate estimate, not a confirmed event.
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
