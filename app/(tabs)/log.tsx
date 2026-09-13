import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Chip, Input, Label, TextField, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { EmptyProfile } from '@/components/EmptyProfile';
import { RatingPicker } from '@/components/RatingPicker';
import { Screen } from '@/components/Screen';
import { isISODate, todayISO } from '@/lib/date-utils';
import {
  DAILY_SIGNAL_LABELS,
  DAILY_SIGNALS,
  type DailySignal,
  type DailySignals,
  type Severity,
  type Symptom,
  SYMPTOM_LABELS,
  SYMPTOMS,
} from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';

export default function LogScreen() {
  const profile = useHealthStore((state) => state.profile);
  const addPeriod = useHealthStore((state) => state.addPeriod);
  const addDailyLog = useHealthStore((state) => state.addDailyLog);
  const [mode, setMode] = useState<'period' | 'daily'>('period');
  const [date, setDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [length, setLength] = useState('');
  const [flow, setFlow] = useState<Severity>(3);
  const [symptoms, setSymptoms] = useState<Partial<Record<Symptom, Severity>>>({});
  const [signals, setSignals] = useState<DailySignals>({});
  const [saving, setSaving] = useState(false);

  if (!profile) return <EmptyProfile />;

  const toggleSymptom = (symptom: Symptom) =>
    setSymptoms((current) => {
      const next = { ...current };
      if (next[symptom]) delete next[symptom];
      else next[symptom] = 3;
      return next;
    });

  const toggleSignal = (signal: DailySignal) =>
    setSignals((current) => {
      const next = { ...current };
      if (next[signal]) delete next[signal];
      else next[signal] = 3;
      return next;
    });

  const save = async () => {
    if (
      !isISODate(date) ||
      date > todayISO() ||
      (endDate && (!isISODate(endDate) || endDate < date))
    ) {
      Alert.alert(
        'Check the dates',
        'Use YYYY-MM-DD and make sure the dates are in order and not in the future.',
      );
      return;
    }
    setSaving(true);
    if (mode === 'period') {
      await addPeriod({
        id: `period-${Date.now()}`,
        startDate: date,
        endDate: endDate || undefined,
        periodLengthDays: length ? Number(length) : undefined,
        flowIntensity: flow,
        symptoms,
        createdAt: new Date().toISOString(),
      });
    } else {
      await addDailyLog({
        id: `daily-${Date.now()}`,
        date,
        symptoms,
        signals: Object.keys(signals).length > 0 ? signals : undefined,
        createdAt: new Date().toISOString(),
      });
    }
    setSaving(false);
    Alert.alert(
      'Saved',
      mode === 'period'
        ? 'Period details were added to your cycle history.'
        : 'Today’s check-in and symptoms were saved.',
    );
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        eyebrow="Log"
        title="Add what you noticed"
        subtitle="Every field beyond the date is optional. Add only what feels useful."
      >
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            variant={mode === 'period' ? 'primary' : 'outline'}
            onPress={() => setMode('period')}
          >
            <Button.Label>Period</Button.Label>
          </Button>
          <Button
            className="flex-1"
            variant={mode === 'daily' ? 'primary' : 'outline'}
            onPress={() => setMode('daily')}
          >
            <Button.Label>Daily symptoms</Button.Label>
          </Button>
        </View>
        <Card className="gap-4 p-5">
          <TextField isRequired>
            <Label>{mode === 'period' ? 'Period start' : 'Log date'}</Label>
            <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          </TextField>
          {mode === 'period' ? (
            <>
              <View className="flex-row gap-3">
                <TextField className="flex-1">
                  <Label>End date</Label>
                  <Input value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
                </TextField>
                <TextField className="flex-1">
                  <Label>Length (days)</Label>
                  <Input
                    value={length}
                    onChangeText={setLength}
                    keyboardType="number-pad"
                    placeholder="Either is fine"
                  />
                </TextField>
              </View>
              <View className="gap-2">
                <Typography className="text-sm font-semibold">Flow intensity</Typography>
                <RatingPicker value={flow} onChange={setFlow} lowLabel="Light" highLabel="Heavy" />
              </View>
            </>
          ) : null}
        </Card>
        {mode === 'daily' ? (
          <Card className="gap-4 p-5">
            <View>
              <Typography type="h4">Today’s signals</Typography>
              <Typography className="text-muted text-sm">
                Optional ratings help Today guidance reflect how you actually feel.
              </Typography>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {DAILY_SIGNALS.map((signal) => {
                const isSelected = signals[signal] !== undefined;
                return (
                  <Chip
                    key={signal}
                    size="md"
                    color={isSelected ? 'accent' : 'default'}
                    variant={isSelected ? 'primary' : 'tertiary'}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => toggleSignal(signal)}
                  >
                    <Chip.Label>{DAILY_SIGNAL_LABELS[signal]}</Chip.Label>
                  </Chip>
                );
              })}
            </View>
            {DAILY_SIGNALS.filter((signal) => signals[signal] !== undefined).map((signal) => (
              <View key={signal} className="border-separator gap-2 border-t pt-4">
                <Typography className="font-semibold">{DAILY_SIGNAL_LABELS[signal]}</Typography>
                <RatingPicker
                  value={signals[signal]}
                  onChange={(value) => setSignals((current) => ({ ...current, [signal]: value }))}
                  lowLabel="Low"
                  highLabel="High"
                />
              </View>
            ))}
          </Card>
        ) : null}
        <Card className="gap-4 p-5">
          <View>
            <Typography type="h4">Symptoms</Typography>
            <Typography className="text-muted text-sm">
              Tap a symptom, then choose severity.
            </Typography>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {SYMPTOMS.map((symptom) => {
              const isSelected = symptoms[symptom] !== undefined;

              return (
                <Chip
                  key={symptom}
                  size="md"
                  color={isSelected ? 'accent' : 'default'}
                  variant={isSelected ? 'primary' : 'tertiary'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${SYMPTOM_LABELS[symptom]} symptom`}
                  onPress={() => toggleSymptom(symptom)}
                >
                  <Chip.Label>{SYMPTOM_LABELS[symptom]}</Chip.Label>
                </Chip>
              );
            })}
          </View>
          {SYMPTOMS.filter((symptom) => symptoms[symptom] !== undefined).map((symptom) => (
            <View key={symptom} className="border-separator gap-2 border-t pt-4">
              <View className="flex-row items-baseline justify-between gap-3">
                <Typography className="font-semibold">
                  {SYMPTOM_LABELS[symptom]} severity
                </Typography>
                <Typography className="text-muted text-xs">Defaults to 3</Typography>
              </View>
              <RatingPicker
                value={symptoms[symptom]}
                onChange={(value) => setSymptoms((current) => ({ ...current, [symptom]: value }))}
              />
            </View>
          ))}
        </Card>
        <Button size="lg" isDisabled={saving} onPress={save}>
          <Button.Label>Save log</Button.Label>
        </Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
