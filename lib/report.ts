import type { HealthData, Symptom } from '@/lib/health-types';
import { LAB_CONFIG, LAB_KEYS, SYMPTOMS } from '@/lib/health-types';
import { getFilteredCycleLengths } from '@/lib/prediction';

export interface ReportFlag {
  title: string;
  detail: string;
}

export function buildReportStats(data: HealthData) {
  if (!data.profile) return null;
  const lengths = getFilteredCycleLengths(data.profile, data.periods);
  const mean = lengths.length
    ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length
    : undefined;
  const variability =
    lengths.length >= 2 && mean !== undefined
      ? Math.sqrt(
          lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (lengths.length - 1),
        )
      : undefined;
  const symptomCounts: Partial<Record<Symptom, number>> = {};
  for (const symptom of SYMPTOMS) {
    symptomCounts[symptom] =
      data.periods.filter((period) => period.symptoms[symptom] !== undefined).length +
      data.dailyLogs.filter((log) => log.symptoms[symptom] !== undefined).length;
  }
  const flags: ReportFlag[] = [];
  if (variability !== undefined && variability >= 8) {
    flags.push({
      title: 'High cycle variability',
      detail: 'Cycle lengths vary by 8 days or more in this log.',
    });
  }
  const heavyCount = data.periods.filter(
    (period) => period.flowIntensity >= 4 || (period.symptoms.heavyBleeding ?? 0) >= 4,
  ).length;
  if (data.periods.length >= 2 && heavyCount / data.periods.length >= 0.5) {
    flags.push({
      title: 'Frequent heavy-flow logs',
      detail: 'Heavy flow was recorded in at least half of period entries.',
    });
  }
  for (const lab of data.labs) {
    for (const key of LAB_KEYS) {
      const config = LAB_CONFIG[key];
      const value = lab[key];
      if (typeof value === 'number' && (value < config.min || value > config.max)) {
        flags.push({
          title: `${config.label} outside displayed range`,
          detail: `${value} ${config.unit} logged on ${lab.date}; displayed range ${config.min}–${config.max} ${config.unit}.`,
        });
      }
    }
  }
  return {
    lengths,
    average: mean,
    variability,
    min: lengths.length ? Math.min(...lengths) : undefined,
    max: lengths.length ? Math.max(...lengths) : undefined,
    symptomCounts,
    flags,
  };
}
