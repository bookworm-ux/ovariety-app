import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { Typography } from 'heroui-native';

export function PrivacyNote({ children }: PropsWithChildren) {
  return (
    <View className="border-accent/20 bg-accent/10 rounded-2xl border p-4">
      <Typography className="text-foreground text-sm font-semibold">Private by default</Typography>
      <Typography className="text-muted mt-1 text-sm leading-5">{children}</Typography>
    </View>
  );
}

export function MedicalDisclaimer({ children }: PropsWithChildren) {
  return (
    <View className="bg-muted/10 rounded-2xl p-4">
      <Typography className="text-muted text-xs leading-5">
        {children ??
          'Predictions and pattern flags are estimates from self-reported data. They are not a diagnosis or medical advice.'}
      </Typography>
    </View>
  );
}
