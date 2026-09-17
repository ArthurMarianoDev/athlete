import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { Icon, type IconName } from "@/src/components/icons";
import { fonts, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="scope" />
          <NativeTabs.Trigger.Label>Zonas</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="record">
          <NativeTabs.Trigger.Icon sf="record.circle" />
          <NativeTabs.Trigger.Label>Registrar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="leaderboard">
          <NativeTabs.Trigger.Icon sf="trophy.fill" />
          <NativeTabs.Trigger.Label>Ranking</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const icon =
    (name: IconName) =>
    ({ color, focused }: { color: string; focused: boolean }) =>
      <Icon name={name} size={24} color={color} strokeWidth={focused ? 2.4 : 2} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Zonas", tabBarIcon: icon("target") }} />
      <Tabs.Screen name="record" options={{ title: "Registrar", tabBarIcon: icon("play") }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Ranking", tabBarIcon: icon("trophy") }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: icon("user") }} />
    </Tabs>
  );
}
