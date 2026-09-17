import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/api/client";
import {
  ACTIVITY_META,
  fmtDistance,
  fmtDistanceUnit,
  fmtDuration,
  timeAgo,
  type Activity,
  type LeaderboardEntry,
  type Zone,
} from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { LoadingView, PrimaryButton, Avatar, EmptyState } from "@/src/components/ui";
import { Icon, ACTIVITY_ICON } from "@/src/components/icons";
import { useSelectedZone } from "@/src/state/zone-context";

const ZONE_BG =
  "https://images.pexels.com/photos/36603885/pexels-photo-36603885.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function ZoneDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { zone: selected, select } = useSelectedZone();

  const zoneQuery = useQuery({
    queryKey: ["zone", id],
    queryFn: async () => (await api.get<{ zone: Zone }>(`/zones/${id}`)).zone,
  });

  const lbQuery = useQuery({
    queryKey: ["leaderboard", id, "distance", "all"],
    queryFn: async () =>
      (await api.get<{ entries: LeaderboardEntry[] }>(`/zones/${id}/leaderboard?metric=distance`)).entries,
  });

  const actQuery = useQuery({
    queryKey: ["activities", "zone", id],
    queryFn: async () =>
      (await api.get<{ activities: Activity[] }>(`/activities?scope=zone&zone_id=${id}`)).activities,
  });

  if (zoneQuery.isLoading || !zoneQuery.data)
    return <View style={styles.root}><LoadingView /></View>;

  const zone = zoneQuery.data;
  const isSelected = selected?.zone_id === zone.zone_id;
  const top = (lbQuery.data ?? []).slice(0, 3);
  const activities = (actQuery.data ?? []).slice(0, 10);

  const compete = () => {
    select(zone);
    router.push("/(tabs)/record");
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      >
        <View style={styles.hero}>
          <Image source={{ uri: ZONE_BG }} style={styles.heroImg} contentFit="cover" />
          <LinearGradient
            colors={["rgba(13,14,18,0.2)", "rgba(13,14,18,0.5)", colors.surface]}
            style={styles.heroScrim}
          />
          <Pressable
            testID="back-btn"
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + spacing.sm }]}
          >
            <Icon name="back" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={styles.heroText}>
            <View style={styles.typeBadge}>
              <Icon name={zone.type === "auto" ? "pin" : "target"} size={13} color={colors.onBrandTertiary} />
              <Text style={styles.typeBadgeText}>{zone.type === "auto" ? "Auto" : "Pré-definida"}</Text>
            </View>
            <Text style={styles.heroTitle}>{zone.name}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{zone.participant_count ?? 0}</Text>
              <Text style={styles.statLabel}>atletas</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{zone.activity_count ?? 0}</Text>
              <Text style={styles.statLabel}>atividades</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{(zone.radius_m / 1000).toFixed(1)}</Text>
              <Text style={styles.statLabel}>km raio</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Top 3 · Distância</Text>
          {top.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Ninguém competiu aqui ainda.</Text>
            </View>
          ) : (
            top.map((e) => (
              <View key={e.user_id} style={styles.rankRow}>
                <Text style={styles.rank}>{e.rank}</Text>
                <Avatar name={e.name} size={36} />
                <Text style={styles.rankName} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={styles.rankVal}>
                  {fmtDistance(e.total_distance_m)} {fmtDistanceUnit(e.total_distance_m)}
                </Text>
              </View>
            ))
          )}

          <Pressable testID="view-full-ranking" onPress={() => { select(zone); router.push("/(tabs)/leaderboard"); }}>
            <Text style={styles.link}>Ver ranking completo →</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Atividades na zona</Text>
          {activities.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Sem atividades recentes.</Text>
            </View>
          ) : (
            activities.map((a) => (
              <Pressable
                key={a.activity_id}
                testID={`zone-activity-${a.activity_id}`}
                onPress={() => router.push(`/activity/${a.activity_id}`)}
                style={styles.actRow}
              >
                <Icon name={ACTIVITY_ICON[a.type]} size={18} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.actName} numberOfLines={1}>
                    {a.author_name} · {ACTIVITY_META[a.type].label}
                  </Text>
                  <Text style={styles.actSub}>{timeAgo(a.created_at)}</Text>
                </View>
                <Text style={styles.actVal}>
                  {fmtDistance(a.distance_m)} {fmtDistanceUnit(a.distance_m)}
                </Text>
                <Text style={styles.actDur}>{fmtDuration(a.duration_s)}</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="compete-btn"
          label={isSelected ? "Registrar atividade" : "Competir nesta zona"}
          onPress={compete}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 260 },
  heroImg: { width: "100%", height: "100%" },
  heroScrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
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
  heroText: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl, gap: spacing.sm },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  typeBadgeText: { fontFamily: fonts.bodySemi, color: colors.onBrandTertiary, fontSize: 11 },
  heroTitle: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 30 },
  content: { padding: spacing.xl, gap: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: fonts.display, color: colors.brandPrimary, fontSize: 24 },
  statLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 11, textTransform: "uppercase" },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.onSurface, fontSize: 18, marginTop: spacing.md },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rank: { fontFamily: fonts.display, color: colors.brandPrimary, fontSize: 18, width: 22, textAlign: "center" },
  rankName: { fontFamily: fonts.bodyBold, color: colors.onSurface, fontSize: 14, flex: 1 },
  rankVal: { fontFamily: fonts.displaySemi, color: colors.onSurface, fontSize: 16 },
  link: { fontFamily: fonts.bodySemi, color: colors.brandPrimary, fontSize: 14, marginTop: spacing.xs },
  emptyBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  emptyText: { fontFamily: fonts.body, color: colors.muted, fontSize: 14 },
  actRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actName: { fontFamily: fonts.bodySemi, color: colors.onSurface, fontSize: 14 },
  actSub: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  actVal: { fontFamily: fonts.displaySemi, color: colors.onSurface, fontSize: 15 },
  actDur: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 12, width: 52, textAlign: "right" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
