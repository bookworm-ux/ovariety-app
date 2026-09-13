import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Card, Description, Input, Label, TextField, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import { isISODate, todayISO } from '@/lib/date-utils';
import { LAB_CONFIG, type LabKey, relevantLabKeys } from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';
import { createId } from '@/lib/id';
import { pickLabPdf, saveLabPdf, type PendingLabPdf } from '@/lib/lab-attachments';

function formatFileSize(bytes?: number) {
  if (bytes === undefined) return 'PDF document';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB PDF`;
}

export default function LabsScreen() {
  const profile = useHealthStore((state) => state.profile);
  const addLab = useHealthStore((state) => state.addLab);
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Partial<Record<LabKey, string>>>({});
  const [pendingPdf, setPendingPdf] = useState<PendingLabPdf | null>(null);
  const [pickingPdf, setPickingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!profile) return <EmptyProfile />;
  const keys = relevantLabKeys(profile.condition);

  const choosePdf = async () => {
    setPickingPdf(true);
    try {
      const picked = await pickLabPdf();
      if (picked) setPendingPdf(picked);
    } catch (error) {
      Alert.alert(
        'Could not attach PDF',
        error instanceof Error ? error.message : 'Choose another PDF and try again.',
      );
    } finally {
      setPickingPdf(false);
    }
  };

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
    if (Object.keys(numeric).length === 0 && !pendingPdf) {
      Alert.alert('Add a result', 'Enter at least one lab value or attach a PDF to save.');
      return;
    }

    setSaving(true);
    try {
      const id = createId('lab');
      const attachment = pendingPdf ? await saveLabPdf(pendingPdf, id) : undefined;
      await addLab({
        id,
        date,
        ...numeric,
        attachment,
        createdAt: new Date().toISOString(),
      });
      router.back();
    } catch {
      Alert.alert('Could not save results', 'Your lab results could not be saved on this device.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        eyebrow="Optional"
        title="Add lab values"
        subtitle="Enter individual values, attach the original PDF, or do both. Lab data is optional."
      >
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
          {!keys.length ? (
            <Typography className="text-muted text-sm">
              There are no condition-specific value fields for your current profile. You can still
              attach a PDF result.
            </Typography>
          ) : null}
        </Card>

        <Card className="gap-3 p-5">
          <View className="gap-1">
            <Typography type="h4">Original result PDF</Typography>
            <Typography className="text-muted text-sm leading-5">
              Optional. The PDF stays in this app’s local storage. Maximum file size: 4 MB.
            </Typography>
          </View>
          {pendingPdf ? (
            <View className="bg-muted/10 gap-1 rounded-xl p-3">
              <Typography className="font-semibold" numberOfLines={2}>
                {pendingPdf.name}
              </Typography>
              <Typography className="text-muted text-sm">
                {formatFileSize(pendingPdf.size)}
              </Typography>
            </View>
          ) : null}
          <View className="gap-2 sm:flex-row">
            <Button variant="outline" isDisabled={pickingPdf || saving} onPress={choosePdf}>
              <Button.Label>{pendingPdf ? 'Replace PDF' : 'Choose PDF'}</Button.Label>
            </Button>
            {pendingPdf ? (
              <Button
                variant="ghost"
                isDisabled={pickingPdf || saving}
                onPress={() => setPendingPdf(null)}
              >
                <Button.Label>Remove</Button.Label>
              </Button>
            ) : null}
          </View>
        </Card>

        {profile.condition === 'anemia' ? (
          <Typography className="text-muted text-sm leading-5">
            Hemoglobin and ferritin can create report flags, but never change your predicted date.
          </Typography>
        ) : null}
        <MedicalDisclaimer />
        <Button size="lg" isDisabled={saving || pickingPdf} onPress={save}>
          <Button.Label>Save results</Button.Label>
        </Button>
      </Screen>
    </KeyboardAvoidingView>
  );
}
