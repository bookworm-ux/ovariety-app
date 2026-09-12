import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Input, Label, TextField, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { EmptyProfile } from '@/components/EmptyProfile';
import { RatingPicker } from '@/components/RatingPicker';
import { Screen } from '@/components/Screen';
import { isISODate, todayISO } from '@/lib/date-utils';
import { type Severity, type Symptom, SYMPTOM_LABELS, SYMPTOMS } from '@/lib/health-types';
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
  const [saving, setSaving] = useState(false);

  if (!profile) return <EmptyProfile />;

  const toggleSymptom = (symptom: Symptom) =>
    setSymptoms((current) => {
      const next = { ...current };
      if (next[symptom]) delete next[symptom];
      else next[symptom] = 3;
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
        createdAt: new Date().toISOString(),
      });
    }
    setSaving(false);
    Alert.alert(
      'Saved',
      mode === 'period'
        ? 'Period details were added to your cycle history.'
        : 'Today’s symptoms were saved.',
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
        <Card className="gap-4 p-5">
          <View>
            <Typography type="h4">Symptoms</Typography>
            <Typography className="text-muted text-sm">
              Tap a symptom, then choose severity.
            </Typography>
          </View>
          {SYMPTOMS.map((symptom) => (
            <View key={symptom} className="gap-2">
              <Button
                variant={symptoms[symptom] ? 'secondary' : 'outline'}
                onPress={() => toggleSymptom(symptom)}
              >
                <Button.Label>{SYMPTOM_LABELS[symptom]}</Button.Label>
              </Button>
              {symptoms[symptom] ? (
                <RatingPicker
                  value={symptoms[symptom]}
                  onChange={(value) => setSymptoms((current) => ({ ...current, [symptom]: value }))}
                />
              ) : null}
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
