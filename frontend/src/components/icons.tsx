import Svg, { Circle, Path, Polygon, Rect } from "react-native-svg";

export type IconName =
  | "target"
  | "play"
  | "pause"
  | "stop"
  | "trophy"
  | "user"
  | "plus"
  | "back"
  | "pin"
  | "bolt"
  | "clock"
  | "flame"
  | "route"
  | "run"
  | "bike"
  | "walk"
  | "chevron"
  | "logout"
  | "ruler";

export function Icon({
  name,
  size = 24,
  color = "#fff",
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const p = {
    stroke: color,
    strokeWidth,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const s = { width: size, height: size, viewBox: "0 0 24 24" };

  switch (name) {
    case "target":
      return (
        <Svg {...s}>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Circle cx={12} cy={12} r={5} {...p} />
          <Circle cx={12} cy={12} r={1.4} fill={color} stroke="none" />
        </Svg>
      );
    case "play":
      return (
        <Svg {...s}>
          <Polygon points="7,5 19,12 7,19" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
        </Svg>
      );
    case "pause":
      return (
        <Svg {...s}>
          <Rect x={6} y={5} width={4} height={14} rx={1.5} fill={color} />
          <Rect x={14} y={5} width={4} height={14} rx={1.5} fill={color} />
        </Svg>
      );
    case "stop":
      return (
        <Svg {...s}>
          <Rect x={6} y={6} width={12} height={12} rx={2} fill={color} />
        </Svg>
      );
    case "trophy":
      return (
        <Svg {...s}>
          <Path d="M7 4h10v4a5 5 0 0 1-10 0V4z" {...p} />
          <Path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M10 14h4M9 20h6M12 14v6" {...p} />
        </Svg>
      );
    case "user":
      return (
        <Svg {...s}>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" {...p} />
        </Svg>
      );
    case "plus":
      return (
        <Svg {...s}>
          <Path d="M12 5v14M5 12h14" {...p} />
        </Svg>
      );
    case "back":
    case "chevron":
      return (
        <Svg {...s}>
          <Path d="M15 5l-7 7 7 7" {...p} />
        </Svg>
      );
    case "pin":
      return (
        <Svg {...s}>
          <Path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" {...p} />
          <Circle cx={12} cy={10} r={2.5} {...p} />
        </Svg>
      );
    case "bolt":
      return (
        <Svg {...s}>
          <Path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" {...p} />
        </Svg>
      );
    case "clock":
      return (
        <Svg {...s}>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M12 7v5l3 2" {...p} />
        </Svg>
      );
    case "flame":
      return (
        <Svg {...s}>
          <Path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 .5-3-1-5 1-8z" {...p} />
        </Svg>
      );
    case "route":
      return (
        <Svg {...s}>
          <Circle cx={6} cy={7} r={2.5} {...p} />
          <Circle cx={18} cy={17} r={2.5} {...p} />
          <Path d="M8.5 7H14a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h5.5" {...p} />
        </Svg>
      );
    case "ruler":
      return (
        <Svg {...s}>
          <Path d="M4 15L15 4l5 5L9 20z" {...p} />
          <Path d="M8 8l2 2M11 5l2 2M5 11l2 2" {...p} />
        </Svg>
      );
    case "run":
      return (
        <Svg {...s}>
          <Circle cx={15} cy={5} r={2} {...p} />
          <Path d="M5 20l3-4 3-2-1-4-3 2-1 3M11 10l3 1 2 3 2-1M9 14l1 6" {...p} />
        </Svg>
      );
    case "bike":
      return (
        <Svg {...s}>
          <Circle cx={6} cy={17} r={3.5} {...p} />
          <Circle cx={18} cy={17} r={3.5} {...p} />
          <Path d="M6 17l4-7h5l-3 7M10 10L8 7H6M14 10l1.5-4h2" {...p} />
        </Svg>
      );
    case "walk":
      return (
        <Svg {...s}>
          <Circle cx={13} cy={5} r={2} {...p} />
          <Path d="M13 8l-1 5 2 2 1 5M12 13l-3 2-1 3M13 10l3 1" {...p} />
        </Svg>
      );
    case "logout":
      return (
        <Svg {...s}>
          <Path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M17 8l4 4-4 4M9 12h12" {...p} />
        </Svg>
      );
    default:
      return null;
  }
}

export const ACTIVITY_ICON: Record<string, IconName> = {
  run: "run",
  cycle: "bike",
  walk: "walk",
};
