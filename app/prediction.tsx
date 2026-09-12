import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Typography } from 'heroui-native';
import { addDays, eachDayOfInterval, format, startOfWeek } from 'date-fns';

import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer } from '@/components/HealthNotices';
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
          <View className="bg-muted/10 gap-2 rounded-xl p-4">
            <Detail label="Selected condition" value={CONDITION_LABELS[profile.condition]} />
            <Detail
              label="Starting estimate"
              value={`${prediction.conditionMean.toFixed(1)} days`}
            />
            <Detail
              label="Starting spread"
              value={`${prediction.conditionSpread.toFixed(1)} days`}
            />
            <Detail label="Completed cycles used" value={String(prediction.cyclesUsed)} />
            {prediction.ownAverage !== undefined ? (
              <Detail
                label="Your cycle average"
                value={`${prediction.ownAverage.toFixed(1)} days`}
              />
            ) : null}
            <Detail label="Blended estimate" value={`${prediction.estimateDays.toFixed(1)} days`} />
            <Detail
              label="Range width each side"
              value={`${prediction.confidenceWindowDays} days`}
            />
            {prediction.pcosPattern ? (
              <Detail label="PCOS starting pattern" value={prediction.pcosPattern} />
            ) : null}
            <Typography className="text-muted pt-2 text-xs leading-5">
              The app recalculates with a precision-weighted formula every time your history or
              relevant labs change. No AI model or external service is used.
            </Typography>
          </View>
        ) : null}
      </Card>
      <MedicalDisclaimer />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Typography className="text-muted flex-1 text-sm">{label}</Typography>
      <Typography className="text-sm font-semibold">{value}</Typography>
    </View>
  );
}
