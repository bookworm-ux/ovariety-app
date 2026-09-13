import { useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, Typography } from 'heroui-native';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { CycleLengthBars } from '@/components/CycleLengthBars';
import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import { SymptomFrequencyBars } from '@/components/SymptomFrequencyBars';
import { bilt } from '@/lib/bilt';
import { useCloudSyncStore } from '@/lib/cloud-sync';
import {
  CONDITION_LABELS,
  LAB_CONFIG,
  LAB_KEYS,
  SYMPTOM_LABELS,
  SYMPTOMS,
} from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';
import { buildReportStats } from '@/lib/report';

const reportDisclaimer =
  'Symptom frequencies and automated flags summarize self-reported patterns, not clinical significance or findings. This report is not a diagnosis or medical advice.';
const n = (value?: number) => (value === undefined ? '—' : value.toFixed(1));
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export default function ReportScreen() {
  const profile = useHealthStore((state) => state.profile);
  const periods = useHealthStore((state) => state.periods);
  const dailyLogs = useHealthStore((state) => state.dailyLogs);
  const labs = useHealthStore((state) => state.labs);
  const session = useCloudSyncStore((state) => state.session);
  const syncEnabled = useCloudSyncStore((state) => state.syncEnabled);
  const syncNow = useCloudSyncStore((state) => state.syncNow);
  const [exporting, setExporting] = useState(false);
  const stats = useMemo(
    () => buildReportStats({ version: 1, profile, periods, dailyLogs, labs }),
    [profile, periods, dailyLogs, labs],
  );
  if (!profile || !stats) return <EmptyProfile />;

  const exportPdf = async () => {
    setExporting(true);
    try {
      let cloudHtml: string | undefined;
      if (session && syncEnabled) {
        await syncNow();
        const { data, error } = await bilt.functions.invoke<{ html: string }>(
          'generate-health-report',
          { body: {} },
        );
        if (error) throw new Error(error.message);
        if (!data?.html) throw new Error('The cloud report did not return a document.');
        cloudHtml = data.html;
      }
      const cycleRows = stats.lengths
        .map((value, index) => `<tr><td>Cycle ${index + 1}</td><td>${value} days</td></tr>`)
        .join('');
      const symptomRows = SYMPTOMS.flatMap((key) => {
        const symptom = stats.symptomStats[key];
        return symptom ? [{ key, ...symptom }] : [];
      })
        .sort((a, b) => b.count - a.count)
        .map(({ key, count, averageSeverity }) => {
          const severity = Number.isInteger(averageSeverity)
            ? String(averageSeverity)
            : averageSeverity.toFixed(1);
          return `<tr><td>${SYMPTOM_LABELS[key]}</td><td>${count} ${count === 1 ? 'log' : 'logs'} of ${stats.trackedDays} ${stats.trackedDays === 1 ? 'day' : 'days'} tracked, average severity ${severity}</td></tr>`;
        })
        .join('');
      const labRows = labs
        .flatMap((lab) =>
          LAB_KEYS.filter((key) => typeof lab[key] === 'number').map((key) => {
            const config = LAB_CONFIG[key];
            return `<tr><td>${lab.date}</td><td>${config.label}</td><td>${lab[key]} ${config.unit}</td><td>${config.min}–${config.max} ${config.unit}</td></tr>`;
          }),
        )
        .join('');
      const flagRows = stats.flags.length
        ? stats.flags
            .map(
              (flag) =>
                `<li><strong>${escapeHtml(flag.title)}:</strong> ${escapeHtml(flag.detail)}</li>`,
            )
            .join('')
        : '<li>No automated pattern flags from the available logs.</li>';
      const cycleSummary = stats.lengths.length
        ? `<p>${stats.lengths.length} completed cycles · Average ${n(stats.average)} days · Variability ${n(stats.variability)} days · Range ${n(stats.min)}–${n(stats.max)} days</p><table>${cycleRows}</table>`
        : '<p>No complete cycles have been logged yet, so predictions are based on the typical pattern for your condition until your own cycles accumulate.</p>';
      const localHtml = `<html><head><style>body{font-family:Arial;color:#4b3a42;background:#f7eff1;padding:30px}h1,h2{color:#a1526e}table{width:100%;border-collapse:collapse;margin:10px 0 22px}td,th{border-bottom:1px solid #d0839f;padding:8px;text-align:left}.note{background:#f6dde5;padding:14px;border-radius:8px}</style></head><body><h1>Cycle health summary</h1><p>Prepared from self-reported records.</p><h2>Profile</h2><table><tr><td>Age</td><td>${profile.age}</td></tr><tr><td>Condition</td><td>${escapeHtml(CONDITION_LABELS[profile.condition])}</td></tr><tr><td>Medications</td><td>${escapeHtml(profile.medications || 'None listed')}</td></tr></table><h2>Cycle statistics</h2>${cycleSummary}<h2>Symptom frequency</h2><table>${symptomRows || '<tr><td>No symptoms logged.</td></tr>'}</table><h2>Lab results and displayed ranges</h2><table><tr><th>Date</th><th>Marker</th><th>Value</th><th>Displayed range</th></tr>${labRows || '<tr><td colspan="4">No lab values logged.</td></tr>'}</table><h2>Automated pattern flags</h2><ul>${flagRows}</ul><p class="note">${reportDisclaimer}</p></body></html>`;
      const html = cloudHtml ?? localHtml;
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const result = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share doctor report',
        });
      }
    } catch (error) {
      Alert.alert(
        'Could not export',
        error instanceof Error ? error.message : 'The report could not be created.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      eyebrow="Doctor report"
      title="A clearer appointment summary"
      subtitle={
        syncEnabled
          ? 'Review this before sharing. The PDF is created on this device from your synchronized record data.'
          : 'Review this before sharing. It includes only information stored in this app.'
      }
    >
      <Card className="gap-3 p-5">
        <Typography type="h4">Profile summary</Typography>
        <Row label="Age" value={String(profile.age)} />
        <Row label="Condition" value={CONDITION_LABELS[profile.condition]} />
        <Row label="Medications" value={profile.medications || 'None listed'} />
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Lab results</Typography>
        <Typography className="text-muted text-sm leading-5">
          Add condition-specific lab values, attach the original PDF, or do both. PDFs remain on
          this device; only entered numeric values and attachment metadata can sync. Saved values
          are included in this report.
        </Typography>
        <Button variant="outline" onPress={() => router.push('/labs')}>
          <Button.Label>Add lab values</Button.Label>
        </Button>
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Cycle stats</Typography>
        {stats.lengths.length ? (
          <>
            <View className="flex-row flex-wrap gap-3">
              <Stat label="Average" value={`${n(stats.average)} days`} />
              <Stat label="Variability" value={`${n(stats.variability)} days`} />
              <Stat label="Min / max" value={`${n(stats.min)} / ${n(stats.max)}`} />
              <Stat label="Cycles logged" value={String(stats.lengths.length)} />
            </View>
            <CycleLengthBars lengths={stats.lengths} average={stats.average} />
          </>
        ) : (
          <Typography className="text-muted text-sm leading-5">
            No complete cycles have been logged yet, so predictions are based on the typical pattern
            for your condition until your own cycles accumulate.
          </Typography>
        )}
      </Card>
      <Card className="gap-4 p-5">
        <View className="gap-1">
          <Typography type="h4">Symptom frequency</Typography>
          <Typography className="text-muted text-sm">
            How often each symptom appears across your period and daily logs.
          </Typography>
        </View>
        <SymptomFrequencyBars stats={stats.symptomStats} trackedDays={stats.trackedDays} />
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Automated pattern flags</Typography>
        {stats.flags.length ? (
          stats.flags.map((flag, index) => {
            const occurrence = stats.flags
              .slice(0, index)
              .filter(
                (previousFlag) =>
                  previousFlag.title === flag.title && previousFlag.detail === flag.detail,
              ).length;
            return (
              <View
                key={`${flag.title}-${flag.detail}-${occurrence}`}
                className="bg-warning/10 rounded-xl p-3"
              >
                <Typography className="text-sm font-semibold">{flag.title}</Typography>
                <Typography className="text-muted text-sm">{flag.detail}</Typography>
              </View>
            );
          })
        ) : (
          <Typography className="text-muted text-sm">
            No flags from the data currently available.
          </Typography>
        )}
      </Card>
      <Button size="lg" isDisabled={exporting} onPress={exportPdf}>
        <Button.Label>
          {Platform.OS === 'web' ? 'Print or save as PDF' : 'Export and share PDF'}
        </Button.Label>
      </Button>
      <MedicalDisclaimer>{reportDisclaimer}</MedicalDisclaimer>
    </Screen>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Typography className="text-muted text-sm">{label}</Typography>
      <Typography className="max-w-[60%] text-right text-sm font-semibold">{value}</Typography>
    </View>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-muted/10 min-w-[45%] flex-1 rounded-xl p-3">
      <Typography className="text-muted text-xs">{label}</Typography>
      <Typography className="font-semibold">{value}</Typography>
    </View>
  );
}
