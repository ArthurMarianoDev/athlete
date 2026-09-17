import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { radius as radiusTokens, useTheme } from "@/src/theme";
import type { RoutePoint } from "@/src/lib/format";

// Lightweight route visualization: normalizes GPS points into an SVG polyline
// on a dark grid. Reliable in Expo Go without any map API keys.
export function RouteMap({
  points,
  height = 200,
  padding = 16,
  rounded = true,
  showEndpoints = true,
  fill = false,
}: {
  points: RoutePoint[];
  height?: number;
  padding?: number;
  rounded?: boolean;
  showEndpoints?: boolean;
  fill?: boolean;
}) {
  const { colors } = useTheme();
  const W = 1000;
  const H = 1000;

  const valid = (points || []).filter(
    (p) => typeof p.latitude === "number" && typeof p.longitude === "number",
  );

  let d = "";
  let start: { x: number; y: number } | null = null;
  let end: { x: number; y: number } | null = null;

  if (valid.length >= 1) {
    const lats = valid.map((p) => p.latitude);
    const lngs = valid.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const spanLat = Math.max(maxLat - minLat, 0.00001);
    const spanLng = Math.max(maxLng - minLng, 0.00001);
    const span = Math.max(spanLat, spanLng);

    // center within a square so aspect ratio stays true
    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;

    const usable = W - padding * 2 * (W / 400);
    const project = (lat: number, lng: number) => {
      const x = padding + ((lng - (cLng - span / 2)) / span) * usable;
      const y = padding + ((cLat + span / 2 - lat) / span) * usable;
      return { x, y };
    };

    valid.forEach((p, i) => {
      const { x, y } = project(p.latitude, p.longitude);
      if (i === 0) {
        d = `M ${x} ${y}`;
        start = { x, y };
      } else {
        d += ` L ${x} ${y}`;
      }
      end = { x, y };
    });
  }

  const grid = [200, 400, 600, 800];

  return (
    <View
      style={
        fill
          ? { flex: 1, borderRadius: rounded ? radiusTokens.md : 0, overflow: "hidden" }
          : { height, borderRadius: rounded ? radiusTokens.md : 0, overflow: "hidden" }
      }
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <Rect x={0} y={0} width={W} height={H} fill={colors.surfaceSecondary} />
        {grid.map((g) => (
          <Line key={`h${g}`} x1={0} y1={g} x2={W} y2={g} stroke={colors.border} strokeWidth={1.5} />
        ))}
        {grid.map((g) => (
          <Line key={`v${g}`} x1={g} y1={0} x2={g} y2={H} stroke={colors.border} strokeWidth={1.5} />
        ))}
        {d ? (
          <Path
            d={d}
            stroke={colors.brandPrimary}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {showEndpoints && start ? (
          <Circle cx={start.x} cy={start.y} r={16} fill={colors.brandPrimary} />
        ) : null}
        {showEndpoints && end && valid.length > 1 ? (
          <Circle
            cx={end.x}
            cy={end.y}
            r={16}
            fill={colors.surface}
            stroke={colors.brandPrimary}
            strokeWidth={6}
          />
        ) : null}
      </Svg>
    </View>
  );
}
