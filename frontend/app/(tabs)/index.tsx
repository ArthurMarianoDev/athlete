import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { fmtDistanceAway, type Zone } from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, LoadingView, PrimaryButton } from "@/src/components/ui";
import { ScreenHeader } from "@/src/components/screen-header";
import { Icon } from "@/src/components/icons";
import { getCurrentCoords } from "@/src/hooks/use-location";
import { useSelectedZone } from "@/src/state/zone-context";

const ZONE_BG =
  "https://images.pexels.com/photos/36603885/pexels-photo-36603885.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function ZonesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { zone: selected, select } = useSelectedZone();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const coordsQuery = useQuery({
    queryKey: ["my-coords"],
    queryFn: async () => {
      const c = await getCurrentCoords();
      setCoords(c);
      return c;
    },
    staleTime: 5 * 60 * 1000,
  });

  const zonesQuery = useQuery({
    queryKey: ["zones", coords?.latitude ?? null, coords?.longitude ?? null],
    queryFn: async () => {
      const qs = coords ? `?lat=${coords.latitude}&lng=${coords.longitude}` : "";
      const res = await api.get<{ zones: Zone[] }>(`/zones${qs}`);
      return res.zones;
    },
  });

  const createZone = useMutation({
    mutationFn: async () => {
      const c = coords ?? (await getCurrentCoords());
      if (!c) throw new Error("Ative a localização para criar uma zona ao seu redor.");
      const res = await api.post<{ zone: Zone }>("/zones", {
        name: zoneName.trim() || "Minha zona",
        latitude: c.latitude,
        longitude: c.longitude,
        radius_m: 3000,
      });
      return res.zone;
    },
    onSuccess: (zone) => {
      qc.invalidateQueries({ queryKey: ["zones"] });
      select(zone);
      setModalOpen(false);
      setZoneName("");
      setCreateError(null);
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const loading = zonesQuery.isLoading;
  const zones = zonesQuery.data ?? [];

  const bottomPad = useMemo(() => spacing.xl + spacing["2xl"], []);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Zonas"
        subtitle={coords ? "Zonas de competição perto de você" : "Ative o GPS para ordenar por distância"}
        right={
          <Pressable
            testID="create-zone-btn"
            onPress={() => setModalOpen(true)}
            style={styles.headerBtn}
          >
            <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        }
      />

      {loading ? (
        <LoadingView label="Carregando zonas..." />
      ) : (
        <FlatList
          data={zones}
          keyExtractor={(z) => z.zone_id}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: bottomPad, gap: spacing.lg }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={zonesQuery.isFetching && !loading}
              onRefresh={() => {
                coordsQuery.refetch();
                zonesQuery.refetch();
              }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={{ marginTop: spacing["3xl"] }}>
              <EmptyState
                icon="🏟️"
                title="Nenhuma zona por perto"
                message="Crie uma zona automática ao seu redor para começar a competir."
                testID="zones-empty"
              />
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selected?.zone_id === item.zone_id;
            return (
              <Pressable
                testID={`zone-card-${item.zone_id}`}
                onPress={() => router.push(`/zone/${item.zone_id}`)}
                style={({ pressed }) => [
                  styles.card,
                  isSelected && styles.cardSelected,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Image source={{ uri: ZONE_BG }} style={styles.cardImg} contentFit="cover" />
                <LinearGradient
                  colors={["rgba(13,14,18,0.15)", "rgba(13,14,18,0.55)", colors.surfaceSecondary]}
                  style={styles.cardScrim}
                />
                <View style={styles.cardTopRow}>
                  <View style={styles.typeBadge}>
                    <Icon name={item.type === "auto" ? "pin" : "target"} size={13} color={colors.onBrandTertiary} />
                    <Text style={styles.typeBadgeText}>
                      {item.type === "auto" ? "Auto" : "Pré-definida"}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedText}>ATIVA</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaChip}>
                      <Icon name="user" size={13} color={colors.brandPrimary} />
                      <Text style={styles.metaText}>{item.participant_count ?? 0} atletas</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Icon name="bolt" size={13} color={colors.brandPrimary} />
                      <Text style={styles.metaText}>{item.activity_count ?? 0} atividades</Text>
                    </View>
                    {item.distance_m !== null && item.distance_m !== undefined ? (
                      <View style={styles.metaChip}>
                        <Icon name="pin" size={13} color={colors.brandPrimary} />
                        <Text style={styles.metaText}>{fmtDistanceAway(item.distance_m)}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Nova zona automática</Text>
          <Text style={styles.sheetSub}>
            Uma zona de 3 km ao redor da sua localização atual. Convide o bairro para competir.
          </Text>
          <TextInput
            testID="zone-name-input"
            value={zoneName}
            onChangeText={setZoneName}
            placeholder="Nome da zona (ex: Meu bairro)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
          />
          {createError ? <Text style={styles.error}>{createError}</Text> : null}
          <PrimaryButton
            testID="confirm-create-zone"
            label="Criar zona"
            onPress={() => createZone.mutate()}
            loading={createZone.isPending}
          />
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    height: 200,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: { borderColor: colors.brandPrimary, borderWidth: 2 },
  cardImg: { position: "absolute", width: "100%", height: "100%" },
  cardScrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  typeBadgeText: { fontFamily: fonts.bodySemi, color: colors.onBrandTertiary, fontSize: 11 },
  selectedBadge: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  selectedText: { fontFamily: fonts.bodyBold, color: colors.onBrandPrimary, fontSize: 11, letterSpacing: 1 },
  cardBottom: { marginTop: "auto", padding: spacing.lg },
  cardTitle: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 26 },
  cardMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: fonts.bodyMedium, color: colors.onSurfaceSecondary, fontSize: 12 },
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
  error: { color: colors.error, fontFamily: fonts.bodyMedium, fontSize: 13 },
}));
