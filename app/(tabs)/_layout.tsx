import { ClipboardPlus, FileText, Home, Settings } from 'lucide-react-native';
import { Redirect, Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useThemeColor } from 'heroui-native';
import { useUniwind } from 'uniwind';

import { useHealthStore } from '@/lib/health-store';

export default function TabLayout() {
  const { theme } = useUniwind();
  const hydrated = useHealthStore((state) => state.hydrated);
  const onboardingComplete = useHealthStore((state) => state.profile?.onboardingComplete ?? false);
  const [background, foreground, border, accent, muted] = useThemeColor([
    'background',
    'foreground',
    'border',
    'accent',
    'muted',
  ]);

  if (!hydrated) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: background },
          headerTintColor: foreground,
          headerTitleStyle: { color: foreground },
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: background },
          tabBarStyle: { backgroundColor: background, borderTopColor: border },
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: muted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: 'Log',
            tabBarIcon: ({ color, size }) => <ClipboardPlus color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'Report',
            tabBarIcon: ({ color, size }) => <FileText color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size ?? 24} />,
          }}
        />
      </Tabs>
    </>
  );
}
