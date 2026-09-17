// Shared types + formatting helpers + activity metadata.

export type ActivityType = "run" | "cycle" | "walk";

export type User = {
  user_id: string;
  name: string;
  email?: string;
  picture?: string | null;
  created_at?: string;
};

export type RoutePoint = { latitude: number; longitude: number; t?: number };

export type Zone = {
  zone_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  type: "predefined" | "auto";
  owner_id?: string | null;
  participant_count?: number;
  activity_count?: number;
  distance_m?: number | null;
};

export type Activity = {
  activity_id: string;
  user_id: string;
  author_name?: string;
  type: ActivityType;
  zone_id?: string | null;
  distance_m: number;
  duration_s: number;
  avg_pace_s_per_km?: number | null;
  avg_speed_kmh?: number | null;
  calories?: number | null;
  route: RoutePoint[];
  started_at?: string;
  created_at?: string;
  zone?: Zone | null;
};

export type LeaderboardEntry = {
  user_id: string;
  name: string;
  picture?: string | null;
  rank: number;
  total_distance_m: number;
  total_duration_s: number;
  activity_count: number;
  best_pace_s_per_km: number | null;
  is_current_user: boolean;
};

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: string; verb: string }
> = {
  run: { label: "Corrida", icon: "🏃", verb: "correu" },
  cycle: { label: "Ciclismo", icon: "🚴", verb: "pedalou" },
  walk: { label: "Caminhada", icon: "🚶", verb: "caminhou" },
};

export function fmtDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)}`;
  return `${Math.round(m)}`;
}
export function fmtDistanceUnit(m: number): string {
  return m >= 1000 ? "km" : "m";
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function fmtPace(sPerKm?: number | null): string {
  if (!sPerKm || !isFinite(sPerKm) || sPerKm <= 0) return "--:--";
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtSpeed(kmh?: number | null): string {
  if (!kmh || !isFinite(kmh)) return "0.0";
  return kmh.toFixed(1);
}

export function fmtDistanceAway(m?: number | null): string {
  if (m === null || m === undefined) return "";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
