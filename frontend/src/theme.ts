// Design tokens for ZoneTrack — dark-first fitness app (neon green accent).
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0D0E12",
  onSurface: "#F8F9FA",
  surfaceSecondary: "#1A1C23",
  onSurfaceSecondary: "#E2E4E9",
  surfaceTertiary: "#262933",
  onSurfaceTertiary: "#C3C6CF",
  surfaceInverse: "#F8F9FA",
  onSurfaceInverse: "#0D0E12",
  muted: "#8A8D98",

  brand: "#00E65C",
  onBrand: "#000000",
  brandPrimary: "#00E65C",
  onBrandPrimary: "#000000",
  brandSecondary: "#00B347",
  onBrandSecondary: "#000000",
  brandTertiary: "#003314",
  onBrandTertiary: "#00E65C",

  success: "#00E65C",
  onSuccess: "#000000",
  warning: "#FFB800",
  onWarning: "#000000",
  error: "#FF3333",
  onError: "#FFFFFF",
  info: "#3399FF",
  onInfo: "#FFFFFF",

  border: "#262933",
  borderStrong: "#3A3E4D",
  divider: "#1A1C23",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

// Dark-only app: expose dark under both keys so the device setting never
// flips us into an unstyled light theme.
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: dark, dark };

export const fonts = {
  display: "Rajdhani-Bold",
  displaySemi: "Rajdhani-SemiBold",
  displayMedium: "Rajdhani-Medium",
  displayRegular: "Rajdhani-Regular",
  body: "Manrope-Regular",
  bodyMedium: "Manrope-Medium",
  bodySemi: "Manrope-SemiBold",
  bodyBold: "Manrope-Bold",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Pin native chrome to dark.
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  useColorScheme();
  return { scheme: "dark", colors: themes.dark ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
