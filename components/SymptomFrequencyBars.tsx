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
    const count = counts[key];
    return count !== undefined && count > 0 ? [{ key, count }] : [];
  }).sort((a, b) => b.count - a.count);

  if (!entries.length) return null;

  const maximum = Math.max(...entries.map((entry) => entry.count));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Symptom frequency chart. ${entries.map((entry) => `${SYMPTOM_LABELS[entry.key]}: ${entry.count} logs`).join('. ')}`}
      className="gap-4"
    >
      {entries.map((entry: SymptomCount) => (
        <View key={entry.key} className="gap-1.5">
          <View className="flex-row items-center justify-between gap-3">
            <Typography className="text-sm font-medium">{SYMPTOM_LABELS[entry.key]}</Typography>
            <Typography className="text-muted text-xs">
              {entry.count} {entry.count === 1 ? 'log' : 'logs'}
            </Typography>
          </View>
          <View className="bg-muted/15 h-2.5 overflow-hidden rounded-full">
            <View
              className="bg-accent h-full rounded-full"
              style={{ width: `${Math.max(8, (entry.count / maximum) * 100)}%` }}
            />
          </View>
        </View>
      ))}
      <Typography className="text-muted text-xs">
        Counts show how often each symptom was recorded, not its clinical significance.
      </Typography>
    </View>
  );
}
