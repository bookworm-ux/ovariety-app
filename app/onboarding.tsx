import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Description, Input, Label, TextField, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { MedicalDisclaimer, PrivacyNote } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import { CONDITION_LABELS, type Condition } from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';
import { isISODate, todayISO } from '@/lib/date-utils';

const CONDITIONS: Condition[] = ['none', 'pcos', 'hypothyroid', 'hyperthyroid', 'anemia'];

export default function OnboardingScreen() {
  const existing = useHealthStore((state) => state.profile);
  const saveProfile = useHealthStore((state) => state.saveProfile);
  const [age, setAge] = useState(existing?.age?.toString() ?? '');
  const [height, setHeight] = useState(existing?.heightCm?.toString() ?? '');
  const [weight, setWeight] = useState(existing?.weightKg?.toString() ?? '');
  const [condition, setCondition] = useState<Condition>(existing?.condition ?? 'none');
  const [medications, setMedications] = useState(existing?.medications ?? '');
  const [lastPeriod, setLastPeriod] = useState(existing?.lastPeriodStartDate ?? todayISO());
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 10 || parsedAge > 100) {
      Alert.alert('Check your age', 'Enter an age from 10 to 100.');
      return;
    }
    if (!isISODate(lastPeriod) || lastPeriod > todayISO()) {
      Alert.alert(
        'Check the period date',
        'Use a real date in YYYY-MM-DD format that is not in the future.',
      );
      return;
    }
    setSaving(true);
    await saveProfile({
      age: parsedAge,
      heightCm: height ? Number(height) : undefined,
      weightKg: weight ? Number(weight) : undefined,
      condition,
      medications: medications.trim() || undefined,
      lastPeriodStartDate: lastPeriod,
      onboardingComplete: true,
    });
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        eyebrow="Welcome"
        title="Predictions that learn your pattern"
        subtitle="Start with a condition-aware estimate, then let your own cycle history shape it over time."
      >
        <PrivacyNote>
          Your health records stay on this device unless you choose to export or share them. This
          app does not send your health logs to an AI service.
        </PrivacyNote>
        <Card className="gap-4 p-5">
          <Typography type="h4">Your profile</Typography>
          <TextField isRequired>
            <Label>Age</Label>
            <Input keyboardType="number-pad" value={age} onChangeText={setAge} placeholder="Age" />
          </TextField>
          <View className="flex-row gap-3">
            <TextField className="flex-1">
              <Label>Height (cm)</Label>
              <Input
                keyboardType="decimal-pad"
                value={height}
                onChangeText={setHeight}
                placeholder="Optional"
              />
            </TextField>
            <TextField className="flex-1">
              <Label>Weight (kg)</Label>
              <Input
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                placeholder="Optional"
              />
            </TextField>
          </View>
          <TextField isRequired>
            <Label>Most recent period start</Label>
            <Input value={lastPeriod} onChangeText={setLastPeriod} placeholder="YYYY-MM-DD" />
            <Description>
              This anchors your first prediction. You can still have zero completed cycles.
            </Description>
          </TextField>
        </Card>
        <Card className="gap-3 p-5">
          <Typography type="h4">Diagnosed condition</Typography>
          <Typography className="text-muted text-sm">
            Choose only a condition diagnosed by a healthcare professional.
          </Typography>
          <View className="gap-2">
            {CONDITIONS.map((item) => (
              <Button
                key={item}
                variant={condition === item ? 'primary' : 'outline'}
                onPress={() => setCondition(item)}
              >
                <Button.Label>{CONDITION_LABELS[item]}</Button.Label>
              </Button>
            ))}
          </View>
          <TextField>
            <Label>Current medications</Label>
            <Input value={medications} onChangeText={setMedications} placeholder="Optional" />
          </TextField>
        </Card>
        <MedicalDisclaimer />
        <Button size="lg" isDisabled={saving} onPress={submit}>
          <Button.Label>Create my estimate</Button.Label>
        </Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
