import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";

export type PermStatus = "undetermined" | "granted" | "denied";

export function useLocationPermission() {
  const [status, setStatus] = useState<PermStatus>("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [checked, setChecked] = useState(false);

  const check = useCallback(async () => {
    const res = await Location.getForegroundPermissionsAsync();
    setStatus(res.granted ? "granted" : res.status === "denied" ? "denied" : "undetermined");
    setCanAskAgain(res.canAskAgain);
    setChecked(true);
    return res;
  }, []);

  const request = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    setStatus(res.granted ? "granted" : "denied");
    setCanAskAgain(res.canAskAgain);
    setChecked(true);
    return res;
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, canAskAgain, checked, check, request };
}

export async function getCurrentCoords(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await Location.getForegroundPermissionsAsync();
    if (!res.granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      if (!req.granted) return null;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}
