import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api/client";
import {
  ACTIVITY_META,
  fmtDistance,
  fmtDistanceUnit,
  fmtDuration,
  fmtPace,
  fmtSpeed,
  type ActivityType,
  type RoutePoint,
} from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { Icon, ACTIVITY_ICON } from "@/src/components/icons";
import { SatelliteMap } from "@/src/components/satellite-map";
import { useLocationPermission, getCurrentCoords } from "@/src/hooks/use-location";
import { useSelectedZone } from "@/src/state/zone-context";
import { usesNativeTabs } from "@/src/navigation";

type Status = "idle" | "tracking" | "paused" | "saving";

const MET: Record<ActivityType, number> = { run: 9.8, cycle: 7.5, walk: 3.5 };
const WEIGHT_KG = 70;

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000;
  const p1 = (a.latitude * Math.PI) / 180;
  const p2 = (b.latitude * Math.PI) / 180;
  const dphi = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dl = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function RecordScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const perm = useLocationPermission();
  const { zone } = useSelectedZone();

  const [type, setType] = useState<ActivityType>("run");
  const [status, setStatus] = useState<Status>("idle");
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [distance, setDistance] = useState(0); // meters
  const [elapsed, setElapsed] = useState(0); // seconds
  const [gpsReady, setGpsReady] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastPoint = useRef<RoutePoint | null>(null);
  const startTs = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  // Elapsed timer
  useEffect(() => {
    if (status === "tracking") {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const startWatch = async () => {
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
      (loc) => {
        setGpsReady(true);
        const pt: RoutePoint = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          t: Date.now() - startTs.current,
        };
        if (lastPoint.current) {
          const d = haversine(lastPoint.current, pt);
          const acc = loc.coords.accuracy ?? 999;
          if (d >= 3 && d < 100 && acc < 40) {
            setDistance((prev) => prev + d);
            lastPoint.current = pt;
            setPoints((prev) => [...prev, pt]);
          }
        } else {
          lastPoint.current = pt;
          setPoints((prev) => [...prev, pt]);
        }
      },
    );
  };

  const stopWatch = () => {
    watchRef.current?.remove();
    watchRef.current = null;
  };

  useEffect(() => () => stopWatch(), []);

  // Center the satellite map on the athlete once location is available.
  useEffect(() => {
    if (perm.status === "granted" && !mapCenter) {
      getCurrentCoords().then((c) => {
        if (c) setMapCenter(c);
      });
    }
  }, [perm.status, mapCenter]);

  const handleStart = async () => {
    const res = await perm.check();
    if (!res.granted) {
      const req = await perm.request();
      if (!req.granted) return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startTs.current = Date.now();
    setStatus("tracking");
    await startWatch();
  };

  const handlePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStatus("paused");
    stopWatch();
  };

  const handleResume = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    lastPoint.current = points.length ? points[points.length - 1] : null;
    setStatus("tracking");
    await startWatch();
  };

  const reset = () => {
    setStatus("idle");
    setPoints([]);
    setDistance(0);
    setElapsed(0);
    setGpsReady(false);
    lastPoint.current = null;
  };

  const handleStop = async () => {
    stopWatch();
    setStatus("saving");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const distKm = distance / 1000;
    const pace = distKm > 0 ? elapsed / distKm : null;
    const speed = elapsed > 0 ? distKm / (elapsed / 3600) : 0;
    const calories = MET[type] * WEIGHT_KG * (elapsed / 3600);
    try {
      const res = await api.post<{ activity: { activity_id: string } }>("/activities", {
        type,
        zone_id: zone?.zone_id ?? null,
        distance_m: Math.round(distance),
        duration_s: elapsed,
        avg_pace_s_per_km: pace,
        avg_speed_kmh: speed,
        calories: Math.round(calories),
        route: points,
        started_at: new Date(startTs.current).toISOString(),
      });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["profile-stats"] });
      qc.invalidateQueries({ queryKey: ["zones"] });
      const id = res.activity.activity_id;
      reset();
      router.push(`/activity/${id}`);
    } catch {
      setStatus("paused");
    }
  };

  const distKm = distance / 1000;
  const pace = distKm > 0 ? elapsed / distKm : null;
  const speed = elapsed > 0 ? distKm / (elapsed / 3600) : 0;
  const isMoving = type === "cycle";

  // ------- Permission gate -------
  if (perm.checked && perm.status !== "granted" && status === "idle") {
    const blocked = perm.status === "denied" && !perm.canAskAgain;
    return (
      <View style={[styles.root, styles.permWrap, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.permIcon}>
          <Icon name="pin" size={40} color={colors.brandPrimary} />
        </View>
        <Text style={styles.permTitle}>Precisamos do seu GPS</Text>
        <Text style={styles.permText}>
          Usamos sua localização para medir distância, ritmo e traçar seu percurso durante a
          atividade.
        </Text>
        {blocked ? (
          <PrimaryButton
            testID="open-settings"
            label="Abrir configurações"
            onPress={() => Linking.openSettings()}
          />
        ) : (
          <PrimaryButton testID="grant-location" label="Permitir localização" onPress={perm.request} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Top overlay: zone + gps + type */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.topRow}>
          <View style={styles.zoneChip}>
            <Icon name="target" size={14} color={colors.brandPrimary} />
            <Text style={styles.zoneChipText} numberOfLines={1}>
              {zone ? zone.name : "Nenhuma zona"}
            </Text>
          </View>
          <View style={styles.gpsChip}>
            <View
              style={[
                styles.dot,
                { backgroundColor: gpsReady ? colors.brandPrimary : colors.warning },
              ]}
            />
            <Text style={styles.gpsText}>{gpsReady ? "GPS" : "Buscando"}</Text>
          </View>
        </View>

        {status === "idle" ? (
          <View style={styles.typeRow}>
            {(Object.keys(ACTIVITY_META) as ActivityType[]).map((t) => {
              const active = t === type;
              return (
                <Pressable
                  key={t}
                  testID={`type-${t}`}
                  onPress={() => setType(t)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                >
                  <Icon
                    name={ACTIVITY_ICON[t]}
                    size={18}
                    color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary}
                  />
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {ACTIVITY_META[t].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Map area */}
      <View style={styles.mapArea}>
        <SatelliteMap
          points={points}
          fill
          rounded={false}
          follow={status === "tracking" || status === "paused"}
          interactive
          initialCenter={mapCenter}
        />
        {status !== "idle" ? null : (
          <View style={styles.mapHint} pointerEvents="none">
            <Text style={styles.mapHintText}>
              {zone ? "Toque em iniciar para começar" : "Selecione uma zona na aba Zonas"}
            </Text>
          </View>
        )}
      </View>

      {/* Metrics + controls */}
      <View style={[styles.panel, { paddingBottom: bottomChrome + spacing.lg }]}>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{fmtDistance(distance)}</Text>
            <Text style={styles.metricLabel}>{fmtDistanceUnit(distance)}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{fmtDuration(elapsed)}</Text>
            <Text style={styles.metricLabel}>tempo</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{isMoving ? fmtSpeed(speed) : fmtPace(pace)}</Text>
            <Text style={styles.metricLabel}>{isMoving ? "km/h" : "min/km"}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          {status === "idle" ? (
            <Pressable
              testID="start-btn"
              onPress={handleStart}
              style={({ pressed }) => [styles.bigBtn, pressed && styles.pressed]}
            >
              <Icon name="play" size={30} color={colors.onBrandPrimary} />
              <Text style={styles.bigBtnText}>Iniciar</Text>
            </Pressable>
          ) : null}

          {status === "tracking" ? (
            <Pressable
              testID="pause-btn"
              onPress={handlePause}
              style={({ pressed }) => [styles.bigBtn, styles.pauseBtn, pressed && styles.pressed]}
            >
              <Icon name="pause" size={28} color={colors.onWarning} />
              <Text style={[styles.bigBtnText, { color: colors.onWarning }]}>Pausar</Text>
            </Pressable>
          ) : null}

          {status === "paused" ? (
            <View style={styles.pausedRow}>
              <Pressable
                testID="resume-btn"
                onPress={handleResume}
                style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
              >
                <Icon name="play" size={26} color={colors.onBrandPrimary} />
              </Pressable>
              <Pressable
                testID="stop-btn"
                onPress={handleStop}
                style={({ pressed }) => [styles.roundBtn, styles.stopBtn, pressed && styles.pressed]}
              >
                <Icon name="stop" size={24} color={colors.onError} />
              </Pressable>
            </View>
          ) : null}

          {status === "saving" ? (
            <View style={styles.bigBtn}>
              <Text style={styles.bigBtnText}>Salvando...</Text>
            </View>
          ) : null}
        </View>
        {status === "paused" ? (
          <Text style={styles.pausedHint}>Retomar ou finalizar e salvar a atividade</Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  permWrap: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  permIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  permTitle: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 24 },
  permText: { fontFamily: fonts.body, color: colors.muted, fontSize: 15, textAlign: "center", marginBottom: spacing.md },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.md,
    zIndex: 2,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  zoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 1,
  },
  zoneChipText: { fontFamily: fonts.bodySemi, color: colors.onSurface, fontSize: 13, flexShrink: 1 },
  gpsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontFamily: fonts.bodyMedium, color: colors.onSurfaceSecondary, fontSize: 12 },
  typeRow: { flexDirection: "row", gap: spacing.sm },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  typeChipText: { fontFamily: fonts.bodySemi, color: colors.onSurfaceSecondary, fontSize: 13 },
  typeChipTextActive: { color: colors.onBrandPrimary },
  mapArea: { flex: 1, backgroundColor: colors.surfaceSecondary },
  mapHint: { position: "absolute", left: 0, right: 0, bottom: spacing.lg, alignItems: "center" },
  mapHintText: {
    fontFamily: fonts.bodyMedium,
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  panel: {
    backgroundColor: colors.surface,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  metricsRow: { flexDirection: "row", alignItems: "center" },
  metric: { flex: 1, alignItems: "center" },
  metricDivider: { width: 1, height: 40, backgroundColor: colors.border },
  metricValue: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 34, lineHeight: 38 },
  metricLabel: { fontFamily: fonts.bodyMedium, color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  controls: { alignItems: "center" },
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 60,
    minWidth: 200,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  pauseBtn: { backgroundColor: colors.warning },
  bigBtnText: { fontFamily: fonts.bodyBold, color: colors.onBrandPrimary, fontSize: 18 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  pausedRow: { flexDirection: "row", gap: spacing.xl },
  roundBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: { backgroundColor: colors.error },
  pausedHint: { fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: "center" },
}));
