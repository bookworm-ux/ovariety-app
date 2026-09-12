import { View } from 'react-native';
import { Button, Card, Typography } from 'heroui-native';
import { router } from 'expo-router';

export function EmptyProfile() {
  return (
    <View className="bg-background flex-1 items-center justify-center px-6">
      <Card className="w-full max-w-md gap-4 p-5">
        <Typography type="h3">Finish your setup</Typography>
        <Typography className="text-muted">
          Add a few details and your most recent period start date to create your first estimate.
        </Typography>
        <Button onPress={() => router.replace('/onboarding')}>
          <Button.Label>Start setup</Button.Label>
        </Button>
      </Card>
    </View>
  );
}
