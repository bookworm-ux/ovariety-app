import { View } from 'react-native';
import { Button, Typography } from 'heroui-native';

import type { Severity } from '@/lib/health-types';

interface RatingPickerProps {
  value?: Severity;
  onChange: (value: Severity) => void;
  lowLabel?: string;
  highLabel?: string;
}

export function RatingPicker({
  value,
  onChange,
  lowLabel = 'Mild',
  highLabel = 'Strong',
}: RatingPickerProps) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {([1, 2, 3, 4, 5] as Severity[]).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={value === item ? 'primary' : 'outline'}
            className="min-w-0 flex-1"
            onPress={() => onChange(item)}
          >
            <Button.Label>{item}</Button.Label>
          </Button>
        ))}
      </View>
      <View className="flex-row justify-between">
        <Typography className="text-muted text-xs">{lowLabel}</Typography>
        <Typography className="text-muted text-xs">{highLabel}</Typography>
      </View>
    </View>
  );
}
