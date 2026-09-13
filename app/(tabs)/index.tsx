import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Button, Card, Chip, Typography, useThemeColor } from 'heroui-native';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight, Plus } from 'lucide-react-native';

import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer, PrivacyNote } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import { displayDate, displayShortDate, todayISO } from '@/lib/date-utils';
import { useHealthStore } from '@/lib/health-store';
import { calculatePrediction } from '@/lib/prediction';

export default function HomeScreen() {
  const [accentForeground, foreground] = useThemeColor(['accent-foreground', 'foreground']);
  const profile = useHealthStore((state) => state.profile);
  const periods = useHealthStore((state) => state.periods);
  const labs = useHealthStore((state) => state.labs);
  const addPeriod = useHealthStore((state) => state.addPeriod);
  const [saving, setSaving] = useState(false);
  const prediction = useMemo(
    () => (profile ? calculatePrediction(profile, periods, labs) : null),
    [profile, periods, labs],
  );

  if (!profile || !prediction) return <EmptyProfile />;

  const latestStart = [profile.lastPeriodStartDate, ...periods.map((item) => item.startDate)]
    .sort()
    .at(-1)!;
  const cycleDay = Math.max(
    1,
    differenceInCalendarDays(parseISO(todayISO()), parseISO(latestStart)) + 1,
  );
  const alreadyLogged = periods.some((item) => item.startDate === todayISO());

  const startToday = async () => {
    if (alreadyLogged) {
      Alert.alert('Already logged', 'A period start is already recorded for today.');
      return;
    }
    setSaving(true);
    await addPeriod({
      id: `period-${Date.now()}`,
      startDate: todayISO(),
      flowIntensity: 3,
      symptoms: {},
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    Alert.alert(
      'Period started',
      'Today is now cycle day 1. You can add flow and symptoms in Log.',
    );
  };

  return (
    <Screen title={`Cycle day ${cycleDay}`} subtitle={displayDate(todayISO())}>
      <Card className="overflow-hidden p-0">
        <View className="bg-surface-secondary gap-4 p-5">
          <View className="flex-row items-center justify-between">
            <Typography className="text-foreground font-semibold">Next period estimate</Typography>
            <CalendarDays color={foreground} size={22} />
          </View>
          <Typography type="h2" className="text-foreground">
            {displayShortDate(prediction.rangeStart)} – {displayShortDate(prediction.rangeEnd)}
          </Typography>
          <Typography className="text-muted text-sm">
            A range reflects normal cycle-to-cycle variation.
          </Typography>
        </View>
        <Button
          variant="ghost"
          className="m-3 justify-between"
          onPress={() => router.push('/prediction')}
        >
          <Button.Label>See how this was calculated</Button.Label>
          <ChevronRight size={18} color={foreground} />
        </Button>
      </Card>

      <Button size="lg" isDisabled={saving || alreadyLogged} onPress={startToday}>
        <Plus size={20} color={accentForeground} />
        <Button.Label>
          {alreadyLogged ? 'Period start logged today' : 'Period started today'}
        </Button.Label>
      </Button>

      <View className="flex-row gap-3">
        <Card className="flex-1 gap-2 p-4">
          <Typography className="text-muted text-xs">Pattern basis</Typography>
          <Typography className="font-semibold">
            {prediction.cyclesUsed === 0
              ? 'Condition estimate'
              : `${prediction.cyclesUsed} own cycle${prediction.cyclesUsed === 1 ? '' : 's'}`}
          </Typography>
        </Card>
        <Card className="flex-1 gap-2 p-4">
          <Typography className="text-muted text-xs">Estimated ovulation</Typography>
          <Typography className="font-semibold">
            {displayShortDate(prediction.ovulationDate)}
          </Typography>
        </Card>
      </View>

      {prediction.cyclesAvailable > prediction.cyclesUsed ? (
        <Chip color="warning" variant="soft">
          <Chip.Label>
            {prediction.cyclesAvailable - prediction.cyclesUsed} likely mistaken cycle log excluded
          </Chip.Label>
        </Chip>
      ) : null}
      <PrivacyNote>
        Cycle and symptom records remain on this device. Nothing is shared unless you choose to
        export it.
      </PrivacyNote>
      <MedicalDisclaimer />
    </Screen>
  );
}
