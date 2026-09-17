import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import {
  fmtDistance,
  fmtDistanceUnit,
  fmtPace,
  type LeaderboardEntry,
} from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, LoadingView, Segmented, PrimaryButton, Avatar } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/screen-header";
import { Icon } from "@/src/components/icons";
import { useSelectedZone } from "@/src/state/zone-context";
import { usesNativeTabs } from "@/src/navigation";

type Metric = "distance" | "pace";
type TypeFilter = "all" | "run" | "cycle" | "walk";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "run", label: "Corrida" },
  { value: "cycle", label: "Ciclismo" },
  { value: "walk", label: "Caminhada" },
];

export default function LeaderboardScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { zone } = useSelectedZone();

  const [metric, setMetric] = useState<Metric>("distance");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const query = useQuery({
    queryKey: ["leaderboard", zone?.zone_id, metric, typeFilter],
    enabled: !!zone,
    queryFn: async () => {
      const typeQs = typeFilter === "all" ? "" : `&type=${typeFilter}`;
      const res = await api.get<{ entries: LeaderboardEntry[]; me: LeaderboardEntry | null }>(
        `/zones/${zone!.zone_id}/leaderboard?metric=${metric}${typeQs}`,
      );
      return res;
    },
  });

  const metricValue = (e: LeaderboardEntry) =>
    metric === "distance"
      ? `${fmtDistance(e.total_distance_m)} ${fmtDistanceUnit(e.total_distance_m)}`
      : `${fmtPace(e.best_pace_s_per_km)} /km`;

  if (!zone) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Ranking" subtitle="Escolha uma zona para competir" />
        <View style={styles.centerFill}>
          <EmptyState
            icon="🏁"
            title="Nenhuma zona selecionada"
            message="Escolha uma zona na aba Zonas para ver o ranking."
          />
          <PrimaryButton
            testID="go-to-zones"
            label="Ver zonas"
            onPress={() => router.push("/(tabs)")}
            style={{ marginTop: spacing.lg, alignSelf: "center", paddingHorizontal: spacing["2xl"] }}
          />
        </View>
      </View>
    );
  }

  const entries = query.data?.entries ?? [];
  const me = query.data?.me ?? null;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Ranking" subtitle={zone.name} />

      <View style={styles.controls}>
        <Segmented<Metric>
          testIDPrefix="metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "distance", label: "Distância" },
            { value: "pace", label: "Ritmo" },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
          style={styles.chipRow}
        >
          {TYPE_OPTIONS.map((o) => {
            const active = o.value === typeFilter;
            return (
              <Pressable
                key={o.value}
                testID={`filter-${o.value}`}
                onPress={() => setTypeFilter(o.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {query.isLoading ? (
        <LoadingView label="Carregando ranking..." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.user_id}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.sm,
            paddingBottom: bottomChrome + 96,
            gap: spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={{ marginTop: spacing["2xl"] }}>
              <EmptyState
                icon="⚡"
                title="Seja o primeiro"
                message="Ninguém competiu nesta zona ainda. Registre uma atividade e assuma a liderança."
              />
            </View>
          }
          renderItem={({ item }) => {
            const top3 = item.rank <= 3;
            return (
              <View
                testID={`rank-row-${item.rank}`}
                style={[styles.row, item.is_current_user && styles.rowMe]}
              >
                <Text style={[styles.rank, top3 && styles.rankTop]}>{item.rank}</Text>
                <Avatar name={item.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                    {item.is_current_user ? " (você)" : ""}
                  </Text>
                  <Text style={styles.sub}>{item.activity_count} atividades</Text>
                </View>
                <Text style={styles.metricVal}>{metricValue(item)}</Text>
              </View>
            );
          }}
        />
      )}

      {me ? (
        <View style={[styles.pinned, { paddingBottom: bottomChrome + spacing.md }]}>
          <View style={[styles.row, styles.rowMe, styles.pinnedRow]}>
            <Text style={[styles.rank, styles.rankTop]}>{me.rank}</Text>
            <Avatar name={me.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {me.name} (você)
              </Text>
              <Text style={styles.sub}>Sua posição</Text>
            </View>
            <Text style={styles.metricVal}>{metricValue(me)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  centerFill: { flex: 1, justifyContent: "center" },
  controls: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  chipRow: { height: 40 },
  chipRowContent: { gap: spacing.sm, alignItems: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  chipText: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 13 },
  chipTextActive: { color: colors.onBrandTertiary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { backgroundColor: colors.surfaceTertiary, borderColor: colors.brandPrimary },
  rank: { fontFamily: fonts.display, color: colors.onSurfaceSecondary, fontSize: 20, width: 28, textAlign: "center" },
  rankTop: { color: colors.brandPrimary },
  name: { fontFamily: fonts.bodyBold, color: colors.onSurface, fontSize: 15 },
  sub: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 1 },
  metricVal: { fontFamily: fonts.displaySemi, color: colors.onSurface, fontSize: 18 },
  pinned: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pinnedRow: { borderWidth: 2 },
}));
