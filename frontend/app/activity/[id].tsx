import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api/client";
import {
  ACTIVITY_META,
  fmtDistance,
  fmtDistanceUnit,
  fmtDuration,
  fmtPace,
  fmtSpeed,
  timeAgo,
  type Activity,
} from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { LoadingView, EmptyState, PrimaryButton } from "@/src/components/ui";
import { RouteMap } from "@/src/components/route-map";
import { Icon, ACTIVITY_ICON } from "@/src/components/icons";
import { useAuth } from "@/src/auth/auth-context";

export default function ActivityDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["activity", id],
    queryFn: async () => (await api.get<{ activity: Activity }>(`/activities/${id}`)).activity,
  });

  const del = useMutation({
    mutationFn: async () => api.del(`/activities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["profile-stats"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      router.back();
    },
  });

  if (query.isLoading) return <View style={styles.root}><LoadingView /></View>;
  if (query.isError || !query.data)
    return (
      <View style={styles.root}>
        <EmptyState icon="⚠️" title="Não encontrada" message="Esta atividade não existe." />
      </View>
    );

  const a = query.data;
  const meta = ACTIVITY_META[a.type];
  const isMine = a.user_id === user?.user_id;
  const isMoving = a.type === "cycle";

  const grid = [
    { label: "Distância", value: `${fmtDistance(a.distance_m)} ${fmtDistanceUnit(a.distance_m)}`, icon: "ruler" as const },
    { label: "Duração", value: fmtDuration(a.duration_s), icon: "clock" as const },
    isMoving
      ? { label: "Vel. média", value: `${fmtSpeed(a.avg_speed_kmh)} km/h`, icon: "bolt" as const }
      : { label: "Ritmo médio", value: `${fmtPace(a.avg_pace_s_per_km)} /km`, icon: "bolt" as const },
    { label: "Calorias", value: `${Math.round(a.calories ?? 0)} kcal`, icon: "flame" as const },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <RouteMap points={a.route} height={320} rounded={false} />
        <LinearGradient
          colors={["transparent", "rgba(13,14,18,0.4)", colors.surface]}
          style={styles.mapScrim}
        />
        <Pressable
          testID="back-btn"
          onPress={() => router.back()}
          style={[styles.backBtn, { top: insets.top + spacing.sm }]}
        >
          <Icon name="back" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={styles.typePill}>
            <Icon name={ACTIVITY_ICON[a.type]} size={18} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{meta.label}</Text>
            <Text style={styles.subtitle}>
              {a.author_name} · {timeAgo(a.created_at)}
              {a.zone ? ` · ${a.zone.name}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {grid.map((g) => (
            <View key={g.label} style={styles.gridItem}>
              <Icon name={g.icon} size={18} color={colors.brandPrimary} />
              <Text style={styles.gridValue}>{g.value}</Text>
              <Text style={styles.gridLabel}>{g.label}</Text>
            </View>
          ))}
        </View>

        {isMine ? (
          <PrimaryButton
            testID="delete-activity"
            label="Excluir atividade"
            variant="danger"
            onPress={() => del.mutate()}
            loading={del.isPending}
            style={{ marginTop: spacing.xl }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  mapWrap: { height: 320 },
  mapScrim: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0 },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1, marginTop: -spacing.xl },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  typePill: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 26 },
  subtitle: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  gridItem: {
    width: "47.5%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridValue: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 24 },
  gridLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 12 },
}));
