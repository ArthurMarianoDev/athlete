import { Platform } from "react-native";

// One source of truth for the tab implementation choice.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
