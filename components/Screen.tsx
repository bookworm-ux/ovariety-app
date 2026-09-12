import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { Typography } from 'heroui-native';

interface ScreenProps extends PropsWithChildren {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  scroll?: boolean;
}

export function Screen({ children, title, eyebrow, subtitle, scroll = true }: ScreenProps) {
  const content = (
    <View className="pb-safe-or-8 pt-safe-or-5 mx-auto w-full max-w-2xl gap-5 px-5">
      {title ? (
        <View className="gap-1">
          {eyebrow ? (
            <Typography className="text-accent text-xs font-semibold tracking-widest uppercase">
              {eyebrow}
            </Typography>
          ) : null}
          <Typography type="h2" className="text-foreground">
            {title}
          </Typography>
          {subtitle ? (
            <Typography className="text-muted text-sm leading-5">{subtitle}</Typography>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  return scroll ? (
    <ScrollView className="bg-background flex-1" contentContainerClassName="grow">
      {content}
    </ScrollView>
  ) : (
    <View className="bg-background flex-1">{content}</View>
  );
}
