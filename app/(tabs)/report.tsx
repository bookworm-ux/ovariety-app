import { useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, Typography } from 'heroui-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { EmptyProfile } from '@/components/EmptyProfile';
import { MedicalDisclaimer } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import {
  CONDITION_LABELS,
  LAB_CONFIG,
  LAB_KEYS,
  SYMPTOM_LABELS,
  SYMPTOMS,
} from '@/lib/health-types';
import { useHealthStore } from '@/lib/health-store';
import { buildReportStats } from '@/lib/report';

const closing =
  'This report is generated from self-reported app data and simple pattern detection. It is not a diagnosis, and is meant to support a conversation with a healthcare provider.';
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
  const [exporting, setExporting] = useState(false);
  const stats = useMemo(
    () => buildReportStats({ version: 1, profile, periods, dailyLogs, labs }),
    [profile, periods, dailyLogs, labs],
  );
  if (!profile || !stats) return <EmptyProfile />;
  const maxLength = Math.max(...stats.lengths, 1);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const cycleRows = stats.lengths
        .map((value, index) => `<tr><td>Cycle ${index + 1}</td><td>${value} days</td></tr>`)
        .join('');
      const symptomRows = SYMPTOMS.filter((key) => stats.symptomCounts[key])
        .map(
          (key) =>
            `<tr><td>${SYMPTOM_LABELS[key]}</td><td>${stats.symptomCounts[key]} logs</td></tr>`,
        )
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
      const html = `<html><head><style>body{font-family:Arial;color:#34282a;padding:30px}h1,h2{color:#8d3f48}table{width:100%;border-collapse:collapse;margin:10px 0 22px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.note{background:#f7eeee;padding:14px;border-radius:8px}</style></head><body><h1>Cycle health summary</h1><p>Prepared from self-reported records.</p><h2>Profile</h2><table><tr><td>Age</td><td>${profile.age}</td></tr><tr><td>Condition</td><td>${escapeHtml(CONDITION_LABELS[profile.condition])}</td></tr><tr><td>Medications</td><td>${escapeHtml(profile.medications || 'None listed')}</td></tr></table><h2>Cycle statistics</h2><p>${stats.lengths.length} completed cycles · Average ${n(stats.average)} days · Variability ${n(stats.variability)} days · Range ${n(stats.min)}–${n(stats.max)} days</p><table>${cycleRows || '<tr><td>No completed cycle lengths yet.</td></tr>'}</table><h2>Symptom frequency</h2><table>${symptomRows || '<tr><td>No symptoms logged.</td></tr>'}</table><h2>Lab results and displayed ranges</h2><table><tr><th>Date</th><th>Marker</th><th>Value</th><th>Displayed range</th></tr>${labRows || '<tr><td colspan="4">No lab values logged.</td></tr>'}</table><h2>Automated pattern flags</h2><p>These are prompts to discuss, not clinical findings.</p><ul>${flagRows}</ul><p class="note">${closing}</p></body></html>`;
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const result = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share doctor report',
        });
      }
    } catch {
      Alert.alert('Could not export', 'The report could not be created on this device.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen
      eyebrow="Doctor report"
      title="A clearer appointment summary"
      subtitle="Review this before sharing. It includes only information stored in this app."
    >
      <Card className="gap-3 p-5">
        <Typography type="h4">Profile summary</Typography>
        <Row label="Age" value={String(profile.age)} />
        <Row label="Condition" value={CONDITION_LABELS[profile.condition]} />
        <Row label="Medications" value={profile.medications || 'None listed'} />
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Cycle stats</Typography>
        <View className="flex-row flex-wrap gap-3">
          <Stat label="Average" value={`${n(stats.average)} days`} />
          <Stat label="Variability" value={`${n(stats.variability)} days`} />
          <Stat label="Min / max" value={`${n(stats.min)} / ${n(stats.max)}`} />
          <Stat label="Cycles logged" value={String(stats.lengths.length)} />
        </View>
        {stats.lengths.length ? (
          <View className="mt-2 h-36 flex-row items-end gap-2">
            {stats.lengths.map((length, index) => {
              const occurrence = stats.lengths
                .slice(0, index)
                .filter((previousLength) => previousLength === length).length;
              return (
                <View key={`${length}-${occurrence}`} className="flex-1 items-center gap-1">
                  <View
                    className="bg-accent w-full rounded-t"
                    style={{ height: Math.max(8, (length / maxLength) * 105) }}
                  />
                  <Typography className="text-muted text-[10px]">{length}</Typography>
                </View>
              );
            })}
          </View>
        ) : (
          <Typography className="text-muted text-sm">
            Complete another period start to create the first cycle length.
          </Typography>
        )}
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Symptom frequency</Typography>
        {SYMPTOMS.filter((key) => stats.symptomCounts[key]).map((key) => (
          <Row key={key} label={SYMPTOM_LABELS[key]} value={`${stats.symptomCounts[key]} logs`} />
        ))}
        {Object.values(stats.symptomCounts).every((value) => value === 0) ? (
          <Typography className="text-muted text-sm">No symptoms logged yet.</Typography>
        ) : null}
      </Card>
      <Card className="gap-3 p-5">
        <Typography type="h4">Automated pattern flags</Typography>
        <Typography className="text-muted text-xs leading-5">
          Prompts for a healthcare conversation, not findings or diagnoses.
        </Typography>
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
      <Typography className="text-muted text-xs leading-5">{closing}</Typography>
      <Button size="lg" isDisabled={exporting} onPress={exportPdf}>
        <Button.Label>
          {Platform.OS === 'web' ? 'Print or save as PDF' : 'Export and share PDF'}
        </Button.Label>
      </Button>
      <MedicalDisclaimer />
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
