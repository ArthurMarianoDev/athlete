import { useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import {
  ACTIVITY_META,
  fmtDistance,
  fmtDistanceUnit,
  fmtDuration,
  fmtPace,
  timeAgo,
  type Activity,
  type User,
} from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Avatar, EmptyState, LoadingView, PrimaryButton } from "@/src/components/ui";
import { RouteMap } from "@/src/components/route-map";
import { Icon, ACTIVITY_ICON } from "@/src/components/icons";
import { useAuth } from "@/src/auth/auth-context";
import { usesNativeTabs } from "@/src/navigation";

type Records = {
  longest_distance_m: number;
  longest_duration_s: number;
  best_pace_s_per_km: number | null;
  max_speed_kmh: number;
};

type Stats = {
  user: User;
  total_distance_m: number;
  total_duration_s: number;
  activity_count: number;
  by_type: Record<string, number>;
  records: Records;
  weekly_goal_km: number;
  week_distance_m: number;
};

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, signOut } = useAuth();

  const [goalModal, setGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const statsQuery = useQuery({
    queryKey: ["profile-stats"],
    queryFn: async () => (await api.get<Stats>("/profile/stats")),
  });

  const activitiesQuery = useQuery({
    queryKey: ["activities", "me"],
    queryFn: async () => (await api.get<{ activities: Activity[] }>("/activities?scope=me")).activities,
  });

  const saveGoal = useMutation({
    mutationFn: async () => {
      const km = Math.max(0, parseFloat(goalInput.replace(",", ".")) || 0);
      return api.put("/profile/goal", { weekly_goal_km: km });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-stats"] });
      setGoalModal(false);
    },
  });

  const stats = statsQuery.data;
  const activities = activitiesQuery.data ?? [];

  const goalKm = stats?.weekly_goal_km ?? 20;
  const weekKm = (stats?.week_distance_m ?? 0) / 1000;
  const progress = goalKm > 0 ? Math.min(weekKm / goalKm, 1) : 0;
  const rec = stats?.records;

  const openGoal = () => {
    setGoalInput(String(goalKm));
    setGoalModal(true);
  };

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

      {/* Weekly goal */}
      <View style={styles.goalCard} testID="weekly-goal-card">
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleRow}>
            <Icon name="flag" size={18} color={colors.brandPrimary} />
            <Text style={styles.goalTitle}>Meta semanal</Text>
          </View>
          <Pressable testID="edit-goal-btn" onPress={openGoal} hitSlop={8}>
            <Text style={styles.goalEdit}>Editar</Text>
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.goalText}>
          <Text style={styles.goalTextStrong}>{weekKm.toFixed(1)} km</Text> de {goalKm} km esta semana
          {progress >= 1 ? "  ✅" : ""}
        </Text>
      </View>

      {/* Personal records */}
      <View style={styles.recordsHeader}>
        <Icon name="medal" size={18} color={colors.brandPrimary} />
        <Text style={styles.recordsTitle}>Recordes pessoais</Text>
      </View>
      <View style={styles.recordsGrid}>
        <View style={styles.recordBox}>
          <Text style={styles.recordValue}>
            {rec ? `${fmtDistance(rec.longest_distance_m)} ${fmtDistanceUnit(rec.longest_distance_m)}` : "--"}
          </Text>
          <Text style={styles.recordLabel}>Maior distância</Text>
        </View>
        <View style={styles.recordBox}>
          <Text style={styles.recordValue}>
            {rec && rec.best_pace_s_per_km ? `${fmtPace(rec.best_pace_s_per_km)} /km` : "--"}
          </Text>
          <Text style={styles.recordLabel}>Melhor ritmo</Text>
        </View>
        <View style={styles.recordBox}>
          <Text style={styles.recordValue}>{rec ? fmtDuration(rec.longest_duration_s) : "--"}</Text>
          <Text style={styles.recordLabel}>Maior duração</Text>
        </View>
        <View style={styles.recordBox}>
          <Text style={styles.recordValue}>
            {rec && rec.max_speed_kmh ? `${rec.max_speed_kmh.toFixed(1)} km/h` : "--"}
          </Text>
          <Text style={styles.recordLabel}>Velocidade máx.</Text>
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

      <Modal visible={goalModal} transparent animationType="fade" onRequestClose={() => setGoalModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setGoalModal(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Meta semanal</Text>
          <Text style={styles.sheetSub}>Quantos quilômetros você quer percorrer por semana?</Text>
          <TextInput
            testID="goal-input"
            value={goalInput}
            onChangeText={setGoalInput}
            placeholder="Ex: 20"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
            autoFocus
          />
          <PrimaryButton
            testID="save-goal"
            label="Salvar meta"
            onPress={() => saveGoal.mutate()}
            loading={saveGoal.isPending}
          />
        </View>
      </Modal>
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
  goalCard: {
    width: "100%",
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  goalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalTitle: { fontFamily: fonts.bodyBold, color: colors.onSurface, fontSize: 15 },
  goalEdit: { fontFamily: fonts.bodySemi, color: colors.brandPrimary, fontSize: 13 },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  progressFill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  goalText: { fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  goalTextStrong: { fontFamily: fonts.bodyBold, color: colors.onSurface },
  recordsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: spacing.xl,
  },
  recordsTitle: { fontFamily: fonts.displaySemi, color: colors.onSurface, fontSize: 18 },
  recordsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, width: "100%", marginTop: spacing.sm },
  recordBox: {
    width: "47.5%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  recordValue: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 22 },
  recordLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 12 },
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 22 },
  sheetSub: { fontFamily: fonts.body, color: colors.muted, fontSize: 14 },
  input: {
    height: 52,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.xs,
  },
}));
