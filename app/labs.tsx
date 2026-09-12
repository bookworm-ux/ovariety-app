import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Description, Input, Label, TextField, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import { isISODate, todayISO } from '@/lib/date-utils';
import { LAB_CONFIG, type LabKey, relevantLabKeys } from '@/lib/health-types';
import { createId } from '@/lib/id';
import { useHealthStore } from '@/lib/health-store';

export default function LabsScreen() {
  const profile = useHealthStore((state) => state.profile);
  const addLab = useHealthStore((state) => state.addLab);
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Partial<Record<LabKey, string>>>({});
  const [saving, setSaving] = useState(false);
  if (!profile) return <EmptyProfile />;
  const keys = relevantLabKeys(profile.condition);

  const save = async () => {
    if (!isISODate(date) || date > todayISO()) {
      Alert.alert('Check the date', 'Enter a valid date in YYYY-MM-DD format.');
      return;
    }
    const numeric = Object.fromEntries(
      keys.filter((key) => values[key]?.trim()).map((key) => [key, Number(values[key])]),
    ) as Partial<Record<LabKey, number>>;
    if (Object.values(numeric).some((value) => !Number.isFinite(value))) {
      Alert.alert('Check the values', 'Lab values must be numbers.');
      return;
    }
    if (Object.keys(numeric).length === 0) {
      Alert.alert('Add a value', 'Enter at least one lab result to save.');
      return;
    }
    setSaving(true);
    await addLab({
      id: createId('lab'),
      date,
      ...numeric,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        eyebrow="Optional"
        title="Add lab values"
        subtitle="The most recent value for each marker is used. You can use the app without lab data."
      >
        {keys.length ? (
          <Card className="gap-4 p-5">
            <TextField isRequired>
              <Label>Result date</Label>
              <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            </TextField>
            {keys.map((key) => {
              const item = LAB_CONFIG[key];
              return (
                <TextField key={key}>
                  <Label>
                    {item.label} ({item.unit})
                  </Label>
                  <Input
                    keyboardType="decimal-pad"
                    value={values[key] ?? ''}
                    onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
                    placeholder="Optional"
                  />
                  <Description>
                    Reference range shown in reports: {item.min}–{item.max} {item.unit}
                  </Description>
                </TextField>
              );
            })}
          </Card>
        ) : (
          <View className="bg-muted/10 rounded-2xl p-5">
            <Typography className="text-muted text-sm">
              There are no condition-specific lab fields for your current profile.
            </Typography>
          </View>
        )}
        {profile.condition === 'anemia' ? (
          <Typography className="text-muted text-sm leading-5">
            Hemoglobin and ferritin can create report flags, but never change your predicted date.
          </Typography>
        ) : null}
        <MedicalDisclaimer />
        {keys.length ? (
          <Button size="lg" isDisabled={saving} onPress={save}>
            <Button.Label>Save results</Button.Label>
          </Button>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
