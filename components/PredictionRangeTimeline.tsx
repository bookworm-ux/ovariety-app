import { View } from 'react-native';
import { differenceInCalendarDays } from 'date-fns';
import { Typography } from 'heroui-native';

import { displayShortDate } from '@/lib/date-utils';

type PredictionRangeTimelineProps = {
  mostLikelyEnd: Date;
  mostLikelyStart: Date;
  predictedDate: Date;
  rangeEnd: Date;
  rangeStart: Date;
};

export function PredictionRangeTimeline({
  mostLikelyEnd,
  mostLikelyStart,
  predictedDate,
  rangeEnd,
  rangeStart,
}: PredictionRangeTimelineProps) {
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));
  const position = (date: Date) =>
    `${Math.min(100, Math.max(0, (differenceInCalendarDays(date, rangeStart) / totalDays) * 100))}%` as const;
  const likelyLeft = position(mostLikelyStart);
  const likelyWidth =
    `${Math.max(3, (differenceInCalendarDays(mostLikelyEnd, mostLikelyStart) / totalDays) * 100)}%` as const;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Estimated next-period timeline. Full range ${displayShortDate(rangeStart)} to ${displayShortDate(rangeEnd)}. Most likely date ${displayShortDate(predictedDate)}. Most likely week ${displayShortDate(mostLikelyStart)} to ${displayShortDate(mostLikelyEnd)}.`}
      className="gap-3 py-2"
    >
      <View className="relative h-8 justify-center">
        <View className="bg-accent/20 h-3 rounded-full" />
        <View
          className="bg-accent absolute h-3 rounded-full"
          style={{ left: likelyLeft, width: likelyWidth }}
        />
        <View className="border-background bg-accent absolute left-0 h-4 w-4 -translate-x-1 rounded-full border-2" />
        <View
          className="border-background bg-accent absolute h-5 w-5 -translate-x-2.5 rounded-full border-2"
          style={{ left: position(predictedDate) }}
        />
        <View className="border-background bg-accent absolute right-0 h-4 w-4 translate-x-1 rounded-full border-2" />
      </View>

      <View className="flex-row items-center justify-between gap-1">
        <Typography className="text-xs font-semibold">{displayShortDate(rangeStart)}</Typography>
        <Typography className="text-muted text-xs">—</Typography>
        <Typography className="text-accent text-xs font-semibold">
          {displayShortDate(predictedDate)}
        </Typography>
        <Typography className="text-muted text-xs">—</Typography>
        <Typography className="text-right text-xs font-semibold">
          {displayShortDate(rangeEnd)}
        </Typography>
      </View>
      <View className="flex-row">
        <Typography className="text-muted flex-1 text-[10px]">Range start</Typography>
        <Typography className="text-muted flex-1 text-center text-[10px]">Most likely</Typography>
        <Typography className="text-muted flex-1 text-right text-[10px]">Range end</Typography>
      </View>
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
        <View className="flex-row items-center gap-2">
          <View className="bg-accent h-2.5 w-8 rounded-full" />
          <Typography className="text-muted text-xs">Most likely week</Typography>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="bg-accent/20 h-2.5 w-8 rounded-full" />
          <Typography className="text-muted text-xs">Full range</Typography>
        </View>
      </View>
    </View>
  );
}
