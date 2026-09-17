import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import {
  ACTIVITY_META,
  fmtDistance,
  fmtDistanceUnit,
  fmtDuration,
  timeAgo,
  type Activity,
  type User,
} from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Avatar, EmptyState, LoadingView } from "@/src/components/ui";
import { RouteMap } from "@/src/components/route-map";
import { Icon, ACTIVITY_ICON } from "@/src/components/icons";
import { useAuth } from "@/src/auth/auth-context";
import { usesNativeTabs } from "@/src/navigation";

type Stats = {
  user: User;
  total_distance_m: number;
  total_duration_s: number;
  activity_count: number;
  by_type: Record<string, number>;
};

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const statsQuery = useQuery({
    queryKey: ["profile-stats"],
    queryFn: async () => (await api.get<Stats>("/profile/stats")),
  });

  const activitiesQuery = useQuery({
    queryKey: ["activities", "me"],
    queryFn: async () => (await api.get<{ activities: Activity[] }>("/activities?scope=me")).activities,
  });

  const stats = statsQuery.data;
  const activities = activitiesQuery.data ?? [];

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable testID="logout-btn" onPress={signOut} style={styles.logout}>
        <Icon name="logout" size={20} color={colors.onSurfaceSecondary} />
      </Pressable>
      <Avatar name={user?.name} size={84} />
      <Text style={styles.name}>{user?.name}</Text>
      {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {stats ? fmtDistance(stats.total_distance_m) : "0"}
          </Text>
          <Text style={styles.statLabel}>
            {stats ? fmtDistanceUnit(stats.total_distance_m) : "km"} total
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats?.activity_count ?? 0}</Text>
          <Text style={styles.statLabel}>atividades</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats ? fmtDuration(stats.total_duration_s) : "0:00"}</Text>
          <Text style={styles.statLabel}>tempo</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Atividades recentes</Text>
    </View>
  );

  if (statsQuery.isLoading && activitiesQuery.isLoading) {
    return (
      <View style={styles.root}>
        <LoadingView label="Carregando perfil..." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={activities}
        keyExtractor={(a) => a.activity_id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing["2xl"] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statsQuery.isFetching || activitiesQuery.isFetching}
            onRefresh={() => {
              statsQuery.refetch();
              activitiesQuery.refetch();
            }}
            tintColor={colors.brandPrimary}
          />
        }
        ListEmptyComponent={
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState
              icon="👟"
              title="Nenhuma atividade ainda"
              message="Vá para a aba Registrar e comece sua primeira corrida."
            />
          </View>
        }
        renderItem={({ item }) => {
          const meta = ACTIVITY_META[item.type];
          return (
            <Pressable
              testID={`activity-${item.activity_id}`}
              onPress={() => router.push(`/activity/${item.activity_id}`)}
              style={({ pressed }) => [styles.actCard, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.thumb}>
                <RouteMap points={item.route} height={72} rounded showEndpoints={false} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.actTitleRow}>
                  <Icon name={ACTIVITY_ICON[item.type]} size={16} color={colors.brandPrimary} />
                  <Text style={styles.actTitle}>{meta.label}</Text>
                  <Text style={styles.actDate}>· {timeAgo(item.created_at)}</Text>
                </View>
                <View style={styles.actMetaRow}>
                  <Text style={styles.actMetric}>
                    {fmtDistance(item.distance_m)} {fmtDistanceUnit(item.distance_m)}
                  </Text>
                  <Text style={styles.actMetricSub}>{fmtDuration(item.duration_s)}</Text>
                </View>
              </View>
              <Icon name="chevron" size={18} color={colors.muted} strokeWidth={2} />
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, alignItems: "center", gap: spacing.sm, paddingBottom: spacing.lg },
  logout: {
    position: "absolute",
    right: spacing.xl,
    top: spacing.xl,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 26, marginTop: spacing.sm },
  email: { fontFamily: fonts.body, color: colors.muted, fontSize: 14 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: "100%",
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: fonts.display, color: colors.brandPrimary, fontSize: 26 },
  statLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  sectionTitle: {
    fontFamily: fonts.displaySemi,
    color: colors.onSurface,
    fontSize: 18,
    alignSelf: "flex-start",
    marginTop: spacing.xl,
  },
  actCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, overflow: "hidden" },
  actTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  actTitle: { fontFamily: fonts.bodyBold, color: colors.onSurface, fontSize: 15 },
  actDate: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  actMetaRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: 4 },
  actMetric: { fontFamily: fonts.displaySemi, color: colors.onSurface, fontSize: 18 },
  actMetricSub: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 13 },
}));
