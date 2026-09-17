import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/auth/auth-context";
import { ApiError } from "@/src/api/client";

const HERO =
  "https://images.pexels.com/photos/38693175/pexels-photo-38693175.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await signInEmail(email.trim().toLowerCase(), password);
      else await signUpEmail(name.trim(), email.trim().toLowerCase(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInGoogle();
    } catch {
      setError("Não foi possível entrar com o Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={styles.heroImg} contentFit="cover" />
          <LinearGradient
            colors={["transparent", "rgba(13,14,18,0.6)", colors.surface]}
            style={styles.heroScrim}
          />
          <View style={[styles.heroText, { paddingTop: insets.top + spacing.lg }]}>
            <Text style={styles.brandTag}>ZONETRACK</Text>
            <Text style={styles.title}>Domine sua{"\n"}zona de competição</Text>
            <Text style={styles.subtitle}>Corra, pedale e caminhe. Suba no ranking do seu bairro.</Text>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.toggle}>
            <Pressable
              testID="tab-login"
              onPress={() => setMode("login")}
              style={[styles.toggleItem, mode === "login" && styles.toggleActive]}
            >
              <Text style={[styles.toggleLabel, mode === "login" && styles.toggleLabelActive]}>
                Entrar
              </Text>
            </Pressable>
            <Pressable
              testID="tab-signup"
              onPress={() => setMode("signup")}
              style={[styles.toggleItem, mode === "signup" && styles.toggleActive]}
            >
              <Text style={[styles.toggleLabel, mode === "signup" && styles.toggleLabelActive]}>
                Criar conta
              </Text>
            </Pressable>
          </View>

          {mode === "signup" ? (
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                testID="input-name"
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              testID="input-email"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              testID="input-password"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.muted}
              style={styles.input}
              secureTextEntry
            />
          </View>

          {error ? (
            <Text style={styles.error} testID="auth-error">
              {error}
            </Text>
          ) : null}

          <PrimaryButton
            testID="submit-auth"
            label={mode === "login" ? "Entrar" : "Criar conta"}
            onPress={submit}
            loading={loading}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.divider} />
          </View>

          <PrimaryButton
            testID="google-auth"
            label="Continuar com Google"
            onPress={google}
            loading={googleLoading}
            variant="secondary"
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingBottom: spacing["2xl"] },
  hero: { height: 320 },
  heroImg: { width: "100%", height: "100%" },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0 },
  heroText: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl },
  brandTag: {
    fontFamily: fonts.display,
    color: colors.brandPrimary,
    fontSize: 14,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  title: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 30, lineHeight: 34 },
  subtitle: { fontFamily: fonts.body, color: colors.onSurfaceTertiary, fontSize: 14, marginTop: spacing.sm },
  form: { padding: spacing.xl, gap: spacing.lg },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  toggleItem: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  toggleActive: { backgroundColor: colors.brandPrimary },
  toggleLabel: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 15 },
  toggleLabelActive: { color: colors.onBrandPrimary },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.bodySemi, color: colors.onSurfaceTertiary, fontSize: 13 },
  input: {
    height: 52,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  error: { color: colors.error, fontFamily: fonts.bodyMedium, fontSize: 14 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
}));
