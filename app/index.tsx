import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useHealthStore } from '@/lib/health-store';

export default function Index() {
  const hydrated = useHealthStore((state) => state.hydrated);
  const profile = useHealthStore((state) => state.profile);
  const hydrate = useHealthStore((state) => state.hydrate);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);

  if (!hydrated)
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  return <Redirect href={profile?.onboardingComplete ? '/(tabs)' : '/onboarding'} />;
}
