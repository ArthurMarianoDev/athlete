import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// ---------------------------------------------------------------------------
// PrimaryButton
// ---------------------------------------------------------------------------
export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  testID?: string;
  style?: ViewStyle;
}) {
  const styles = useButtonStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary"
      ? styles.primary
      : variant === "danger"
        ? styles.danger
        : styles.secondary;
  const txt =
    variant === "secondary" ? { color: colors.onSurface } : { color: colors.onBrandPrimary };
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        bg,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabledOpacity,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.onSurface : colors.onBrandPrimary} />
      ) : (
        <Text style={[styles.label, txt]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles((colors) => ({
  base: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.brandPrimary },
  secondary: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.error },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabledOpacity: { opacity: 0.45 },
  label: { fontFamily: fonts.bodyBold, fontSize: 16 },
}));

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  const styles = useSegStyles();
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useSegStyles = makeStyles((colors) => ({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  itemActive: { backgroundColor: colors.brandPrimary },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.muted },
  labelActive: { color: colors.onBrandPrimary },
}));

// ---------------------------------------------------------------------------
// Empty / Loading states
// ---------------------------------------------------------------------------
export function LoadingView({ label }: { label?: string }) {
  const styles = useStateStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="loading-view">
      <ActivityIndicator color={colors.brandPrimary} size="large" />
      {label ? <Text style={styles.subtle}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  testID,
}: {
  title: string;
  message?: string;
  icon?: string;
  testID?: string;
}) {
  const styles = useStateStyles();
  return (
    <View style={styles.center} testID={testID ?? "empty-state"}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.subtle}>{message}</Text> : null}
    </View>
  );
}

const useStateStyles = makeStyles((colors) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  icon: { fontSize: 44 },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  subtle: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: "center" },
}));

// ---------------------------------------------------------------------------
// Avatar (initials)
// ---------------------------------------------------------------------------
export function Avatar({ name, size = 40 }: { name?: string; size?: number }) {
  const { colors } = useTheme();
  const initials = (name || "A")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceTertiary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontFamily: fonts.displaySemi, color: colors.brandPrimary, fontSize: size * 0.4 }}>
        {initials}
      </Text>
    </View>
  );
}
