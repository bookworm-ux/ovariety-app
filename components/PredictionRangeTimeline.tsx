import { View } from 'react-native';
import { differenceInCalendarDays, min } from 'date-fns';
import { Typography } from 'heroui-native';

import { displayShortDate } from '@/lib/date-utils';

type PredictionRangeTimelineProps = {
  ovulationDate: Date;
  predictedDate: Date;
  rangeEnd: Date;
  rangeStart: Date;
};

export function PredictionRangeTimeline({
  ovulationDate,
  predictedDate,
  rangeEnd,
  rangeStart,
}: PredictionRangeTimelineProps) {
  const timelineStart = min([ovulationDate, rangeStart]);
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, timelineStart));
  const position = (date: Date) =>
    `${Math.min(100, Math.max(0, (differenceInCalendarDays(date, timelineStart) / totalDays) * 100))}%` as const;
  const rangeLeft = position(rangeStart);
  const rangeWidth =
    `${Math.max(2, (differenceInCalendarDays(rangeEnd, rangeStart) / totalDays) * 100)}%` as const;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Estimated timeline. Ovulation estimate ${displayShortDate(ovulationDate)}. Next period range ${displayShortDate(rangeStart)} to ${displayShortDate(rangeEnd)}, centered on ${displayShortDate(predictedDate)}.`}
      className="gap-3 py-2"
    >
      <View className="relative h-10 justify-center">
        <View className="bg-muted/20 h-1.5 rounded-full" />
        <View
          className="bg-accent/25 absolute h-3 rounded-full"
          style={{ left: rangeLeft, width: rangeWidth }}
        />
        <View
          className="border-background bg-foreground absolute h-4 w-4 -translate-x-2 rounded-full border-2"
          style={{ left: position(ovulationDate) }}
        />
        <View
          className="border-background bg-accent absolute h-5 w-5 -translate-x-2.5 rounded-full border-2"
          style={{ left: position(predictedDate) }}
        />
      </View>
      <View className="flex-row justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Typography className="text-muted text-[10px] tracking-wide uppercase">
            Ovulation estimate
          </Typography>
          <Typography className="text-xs font-semibold">
            {displayShortDate(ovulationDate)}
          </Typography>
        </View>
        <View className="flex-1 items-center gap-0.5">
          <Typography className="text-muted text-center text-[10px] tracking-wide uppercase">
            Center estimate
          </Typography>
          <Typography className="text-accent text-xs font-semibold">
            {displayShortDate(predictedDate)}
          </Typography>
        </View>
        <View className="flex-1 items-end gap-0.5">
          <Typography className="text-muted text-right text-[10px] tracking-wide uppercase">
            Range ends
          </Typography>
          <Typography className="text-right text-xs font-semibold">
            {displayShortDate(rangeEnd)}
          </Typography>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="bg-accent/25 h-2.5 w-8 rounded-full" />
        <Typography className="text-muted text-xs">
          Estimated next-period range starts {displayShortDate(rangeStart)}
        </Typography>
      </View>
    </View>
  );
}
