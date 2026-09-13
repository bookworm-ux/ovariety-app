import { Typography } from 'heroui-native';
import { View } from 'react-native';

import type { Symptom } from '@/lib/health-types';
import { SYMPTOM_LABELS, SYMPTOMS } from '@/lib/health-types';

interface SymptomSummary {
  count: number;
  averageSeverity: number;
}

interface SymptomFrequencyBarsProps {
  stats: Partial<Record<Symptom, SymptomSummary>>;
  trackedDays: number;
}

function formatSeverity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function SymptomFrequencyBars({ stats, trackedDays }: SymptomFrequencyBarsProps) {
  const rows = SYMPTOMS.flatMap((symptom) => {
    const summary = stats[symptom];
    return summary ? [{ symptom, ...summary }] : [];
  }).sort((a, b) => b.count - a.count);
  const maxCount = Math.max(0, ...rows.map((row) => row.count));

  if (!rows.length) {
    return (
      <Typography className="text-muted">
        No symptoms logged yet. Add symptoms from the Log tab to build this summary.
      </Typography>
    );
  }

  return (
    <View
      className="gap-4"
      accessible
      accessibilityLabel={`${rows.length} symptoms logged across ${trackedDays} tracked ${trackedDays === 1 ? 'day' : 'days'}.`}
    >
      {rows.map(({ symptom, count, averageSeverity }) => {
        const severity = formatSeverity(averageSeverity);
        const detail = count >= 3 ? `${count} logs · sev ${severity}` : `sev ${severity}`;
        const accessibleDetail =
          count >= 3
            ? `${count} logs, average severity ${severity}`
            : `average severity ${severity}; frequency not shown until 3 logs`;

        return (
          <View
            key={symptom}
            className="gap-2"
            accessibilityLabel={`${SYMPTOM_LABELS[symptom]} — ${accessibleDetail}`}
          >
            <View className="flex-row items-baseline justify-between gap-3">
              <Typography className="text-foreground flex-1 font-medium">
                {SYMPTOM_LABELS[symptom]}
              </Typography>
              <Typography className="text-muted text-right">— {detail}</Typography>
            </View>
            {count >= 3 ? (
              <View className="bg-secondary h-3 overflow-hidden rounded-full">
                <View
                  className="bg-accent h-full rounded-full"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
