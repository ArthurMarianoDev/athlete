import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { storage } from "@/src/utils/storage";
import type { Zone } from "@/src/lib/format";

const KEY = "zonetrack_selected_zone";

type ZoneState = {
  zone: Zone | null;
  ready: boolean;
  select: (zone: Zone) => void;
  clear: () => void;
};

const ZoneContext = createContext<ZoneState | null>(null);

export function ZoneProvider({ children }: PropsWithChildren) {
  const [zone, setZone] = useState<Zone | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(KEY, "");
      if (saved) {
        try {
          setZone(JSON.parse(saved));
        } catch {
          /* ignore */
        }
      }
      setReady(true);
    })();
  }, []);

  const select = (z: Zone) => {
    setZone(z);
    storage.setItem(KEY, JSON.stringify(z));
  };
  const clear = () => {
    setZone(null);
    storage.removeItem(KEY);
  };

  return (
    <ZoneContext.Provider value={{ zone, ready, select, clear }}>
      {children}
    </ZoneContext.Provider>
  );
}

export function useSelectedZone(): ZoneState {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("useSelectedZone must be used within ZoneProvider");
  return ctx;
}
