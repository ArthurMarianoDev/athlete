import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { api, clearToken, loadToken, persistToken, setToken } from "@/src/api/client";
import type { User } from "@/src/lib/format";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const EMERGENT_AUTH = "https://auth.emergentagent.com/";

function extractSessionId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const handledSessions = useRef<Set<string>>(new Set());

  const exchangeSession = useCallback(async (sessionId: string) => {
    if (handledSessions.current.has(sessionId)) return;
    handledSessions.current.add(sessionId);
    try {
      const res = await api.post<{ token: string; user: User }>("/auth/session", {
        session_id: sessionId,
      });
      await persistToken(res.token);
      setUser(res.user);
    } catch (e) {
      console.error("google session exchange failed", e);
    }
  }, []);

  // Bootstrap: existing token, plus cold-start deep link on native.
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Cold-start deep link (native) — process session first.
      if (Platform.OS !== "web") {
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial);
        if (sid) await exchangeSession(sid);
      } else {
        const sid =
          extractSessionId(window.location.hash) || extractSessionId(window.location.search);
        if (sid) {
          await exchangeSession(sid);
          const clean = window.location.pathname;
          window.history.replaceState(window.history.state, "", clean);
        }
      }

      const token = await loadToken();
      if (token) {
        try {
          const res = await api.get<{ user: User }>("/auth/me");
          if (mounted) setUser(res.user);
        } catch {
          await clearToken();
          setToken(null);
          if (mounted) setUser(null);
        }
      }
      if (mounted) setLoading(false);
    })();

    // Hot deep link (native)
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchangeSession(sid);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [exchangeSession]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    await persistToken(res.token);
    setUser(res.user);
  }, []);

  const signUpEmail = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/register", {
      name,
      email,
      password,
    });
    await persistToken(res.token);
    setUser(res.user);
  }, []);

  const signInGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `${EMERGENT_AUTH}?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let sid: string | null = null;
    if (result.type === "success" && result.url) {
      sid = extractSessionId(result.url);
    }
    if (!sid) {
      const initial = await Linking.getInitialURL();
      sid = extractSessionId(initial);
    }
    if (sid) await exchangeSession(sid);
  }, [exchangeSession]);

  const signOut = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInEmail, signUpEmail, signInGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
