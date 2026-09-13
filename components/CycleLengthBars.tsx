import { ScrollView, View } from 'react-native';
import { Typography } from 'heroui-native';

type CycleLengthBarsProps = {
  lengths: number[];
  average?: number;
};

export function CycleLengthBars({ lengths, average }: CycleLengthBarsProps) {
  if (!lengths.length) return null;

  const minimum = Math.min(...lengths);
  const maximum = Math.max(...lengths);
  const span = Math.max(1, maximum - minimum);
  const chartWidth = Math.max(280, lengths.length * 38);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Cycle length chart. ${lengths.map((length, index) => `Cycle ${index + 1}: ${length} days`).join('. ')}`}
      className="gap-2"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Typography className="text-muted text-xs">Older</Typography>
        {average !== undefined ? (
          <Typography className="text-muted text-xs">Average {average.toFixed(1)} days</Typography>
        ) : null}
        <Typography className="text-muted text-xs">Recent</Typography>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="h-36 flex-row items-end gap-2" style={{ width: chartWidth }}>
          {lengths.map((length, index) => {
            const occurrence = lengths
              .slice(0, index)
              .filter((previousLength) => previousLength === length).length;
            const height = 44 + ((length - minimum) / span) * 60;
            return (
              <View key={`${length}-${occurrence}`} className="flex-1 items-center gap-1">
                <Typography className="text-foreground text-[10px] font-semibold">
                  {length}
                </Typography>
                <View className="bg-accent w-full min-w-4 rounded-t-lg" style={{ height }} />
                <Typography className="text-muted text-[10px]">C{index + 1}</Typography>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Typography className="text-muted text-xs">Cycle length in days</Typography>
    </View>
  );
}
