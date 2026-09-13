import { View } from 'react-native';
import { Typography } from 'heroui-native';

import type { Symptom } from '@/lib/health-types';
import { SYMPTOM_LABELS, SYMPTOMS } from '@/lib/health-types';

type SymptomCount = {
  key: Symptom;
  count: number;
};

type SymptomFrequencyBarsProps = {
  counts: Partial<Record<Symptom, number>>;
};

export function SymptomFrequencyBars({ counts }: SymptomFrequencyBarsProps) {
  const entries: SymptomCount[] = SYMPTOMS.flatMap((key): SymptomCount[] => {
    const count = counts[key] ?? 0;
    return count > 0 ? [{ key, count }] : [];
  }).sort((a, b) => b.count - a.count || SYMPTOMS.indexOf(a.key) - SYMPTOMS.indexOf(b.key));

  if (!entries.length) {
    return <Typography className="text-muted text-sm">No symptoms logged yet.</Typography>;
  }

  const maximum = entries[0].count;

  return (
    <View className="gap-4">
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Symptom frequency chart. ${entries.map((entry) => `${SYMPTOM_LABELS[entry.key]}: ${entry.count} ${entry.count === 1 ? 'log' : 'logs'}`).join('. ')}`}
        className="gap-3"
      >
        {entries.map((entry) => (
          <View key={entry.key} className="gap-1.5">
            <View className="flex-row items-start justify-between gap-3">
              <Typography className="min-w-0 flex-1 text-sm font-medium">
                {SYMPTOM_LABELS[entry.key]}
              </Typography>
              <Typography className="text-muted shrink-0 text-xs">
                {entry.count} {entry.count === 1 ? 'log' : 'logs'}
              </Typography>
            </View>
            <View className="bg-muted/15 h-2.5 overflow-hidden rounded-full">
              <View
                className="bg-accent h-full rounded-full"
                style={{ width: `${(entry.count / maximum) * 100}%` }}
              />
            </View>
          </View>
        ))}
      </View>
      <Typography className="text-muted text-xs leading-5">
        Bar lengths are relative to your most frequently recorded symptom. Counts show logged
        occurrences, not clinical significance.
      </Typography>
    </View>
  );
}
