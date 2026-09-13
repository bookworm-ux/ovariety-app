import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, Typography } from 'heroui-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';

import { EmptyProfile } from '@/components/EmptyProfile';
import { PrivacyNote } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import { useCloudSyncStore } from '@/lib/cloud-sync';
import { CONDITION_LABELS } from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';

export default function SettingsScreen() {
  const profile = useHealthStore((state) => state.profile);
  const exportData = useHealthStore((state) => state.exportData);
  const deleteAll = useHealthStore((state) => state.deleteAll);
  const session = useCloudSyncStore((state) => state.session);
  const syncEnabled = useCloudSyncStore((state) => state.syncEnabled);
  const syncing = useCloudSyncStore((state) => state.syncing);
  const lastSyncedAt = useCloudSyncStore((state) => state.lastSyncedAt);
  const deleteCloudData = useCloudSyncStore((state) => state.deleteCloudData);
  const [busy, setBusy] = useState(false);
  if (!profile) return <EmptyProfile />;

  const exportJson = async () => {
    setBusy(true);
    try {
      const text = JSON.stringify(exportData(), null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'cyclewise-data.json';
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, 'cyclewise-data.json');
        file.write(text);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export all health data',
        });
      }
    } catch {
      Alert.alert('Could not export', 'Your data could not be exported on this device.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete all data?',
      session
        ? 'This permanently removes your profile, cycle logs, symptoms, and lab values from this device and your signed-in account. This cannot be undone.'
        : 'This permanently removes your profile, cycle logs, symptoms, and lab values from this device. Sign in first if you also need to erase a previous account copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              if (session) await deleteCloudData();
              await deleteAll();
              router.replace('/onboarding');
            } catch (error) {
              Alert.alert(
                'Could not delete everything',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );

  return (
    <Screen eyebrow="Settings" title="Profile and privacy">
      <Card className="gap-3 p-5">
        <Typography type="h4">Profile</Typography>
        <View className="flex-row justify-between">
          <Typography className="text-muted">Condition</Typography>
          <Typography className="font-semibold">{CONDITION_LABELS[profile.condition]}</Typography>
        </View>
        <View className="flex-row justify-between gap-3">
          <Typography className="text-muted">Medications</Typography>
          <Typography className="max-w-[60%] text-right font-semibold">
            {profile.medications || 'None listed'}
          </Typography>
        </View>
        <Button
          variant="outline"
          onPress={() => router.push({ pathname: '/onboarding', params: { mode: 'edit' } })}
        >
          <Button.Label>Edit profile</Button.Label>
        </Button>
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Account and sync</Typography>
        <Typography className="text-muted text-sm leading-5">
          {session
            ? syncEnabled
              ? syncing
                ? 'Syncing your health records…'
                : lastSyncedAt
                  ? `Secure sync is on. Last synced ${new Date(lastSyncedAt).toLocaleString()}.`
                  : 'Secure sync is on.'
              : 'Signed in. Health data remains local until you enable sync.'
            : 'Optional account sync is off. Your records remain on this device.'}
        </Typography>
        <Button variant="outline" onPress={() => router.push('/account')}>
          <Button.Label>
            {session ? 'Manage secure sync' : 'Sign in or create account'}
          </Button.Label>
        </Button>
      </Card>
      <PrivacyNote>
        {syncEnabled
          ? 'Structured health records are stored locally and synchronized to your private account copy. Lab PDF documents remain only on this device; only their file metadata is synchronized.'
          : 'Health data is stored locally on this device using the app’s private storage. It is not uploaded unless you explicitly enable secure sync. Anyone with access to an unlocked device or an exported file may be able to see it.'}
      </PrivacyNote>
      <Card className="gap-3 p-5">
        <Typography type="h4">Your data</Typography>
        <Typography className="text-muted text-sm leading-5">
          Export a readable JSON copy of every profile field, period, symptom log, and lab result.
        </Typography>
        <Button isDisabled={busy} onPress={exportJson}>
          <Button.Label>Export all data</Button.Label>
        </Button>
        <Button variant="outline" className="border-danger" onPress={confirmDelete}>
          <Button.Label className="text-danger">Delete all data</Button.Label>
        </Button>
      </Card>
    </Screen>
  );
}
