import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Image } from "expo-image";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { Icon } from "@/src/components/icons";
import { buildShareHTML } from "@/src/lib/share-card-html";
import type { Activity } from "@/src/lib/format";

// Native-only modules loaded lazily so importing this file never crashes web,
// where these native modules do not exist. Static require literals (Metro
// needs them) each wrapped so a missing native module never blocks the flow.
function loadModule(kind: "media" | "sharing" | "fs"): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (kind === "media") return require("expo-media-library");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (kind === "sharing") return require("expo-sharing");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-file-system/legacy");
  } catch {
    return null;
  }
}
function nativeModules() {
  return {
    MediaLibrary: loadModule("media"),
    Sharing: loadModule("sharing"),
    FileSystem: loadModule("fs"),
  };
}

type Phase = "generating" | "ready" | "error" | "web";

export function ShareActivityModal({
  visible,
  activity,
  athleteName,
  onClose,
}: {
  visible: boolean;
  activity: Activity | null;
  athleteName: string;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("generating");
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const autoShared = useRef(false);

  useEffect(() => {
    if (visible) {
      setPhase(Platform.OS === "web" ? "web" : "generating");
      setDataUri(null);
      setFileUri(null);
      setSavedMsg(null);
      autoShared.current = false;
    }
  }, [visible]);

  const persistAndShare = async (uri: string) => {
    if (Platform.OS === "web") return;
    const { MediaLibrary, Sharing } = nativeModules();
    // Save to gallery (best-effort, non-blocking for share)
    if (MediaLibrary) {
      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.granted) {
          await MediaLibrary.saveToLibraryAsync(uri);
          setSavedMsg("Imagem salva na galeria ✅");
        } else if (!perm.canAskAgain) {
          setSavedMsg("Permita o acesso às Fotos para salvar na galeria");
        }
      } catch {
        /* ignore gallery errors */
      }
    }
    // Open share sheet
    try {
      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartilhar treino" });
      }
    } catch {
      /* user dismissed */
    }
  };

  const onMessage = async (raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "image" && typeof msg.data === "string") {
        setDataUri(msg.data);
        const { FileSystem } = nativeModules();
        if (FileSystem) {
          const base64 = msg.data.replace(/^data:image\/png;base64,/, "");
          const uri = `${FileSystem.cacheDirectory}zonetrack_${activity?.activity_id ?? "share"}.png`;
          await FileSystem.writeAsStringAsync(uri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setFileUri(uri);
          if (!autoShared.current) {
            autoShared.current = true;
            persistAndShare(uri);
          }
        }
        setPhase("ready");
      } else if (msg.type === "error") {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Compartilhar treino</Text>

          {/* Hidden generator WebView (native only) */}
          {visible && phase !== "web" && activity ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: buildShareHTML(activity, athleteName) }}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              onMessage={(e) => onMessage(e.nativeEvent.data)}
              style={styles.hiddenWeb}
              pointerEvents="none"
            />
          ) : null}

          <View style={styles.preview}>
            {phase === "generating" ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brandPrimary} size="large" />
                <Text style={styles.hint}>Gerando imagem estilo Strava...</Text>
              </View>
            ) : null}

            {phase === "web" ? (
              <View style={styles.center}>
                <Icon name="share" size={40} color={colors.brandPrimary} />
                <Text style={styles.hint}>
                  A imagem compartilhável funciona no app do celular (Expo Go ou build). Abra pelo QR
                  code para gerar e compartilhar.
                </Text>
              </View>
            ) : null}

            {phase === "error" ? (
              <View style={styles.center}>
                <Text style={styles.hint}>Não foi possível gerar a imagem. Tente novamente.</Text>
              </View>
            ) : null}

            {phase === "ready" && dataUri ? (
              <Image source={{ uri: dataUri }} style={styles.previewImg} contentFit="contain" />
            ) : null}
          </View>

          {savedMsg ? <Text style={styles.saved}>{savedMsg}</Text> : null}
          {savedMsg?.includes("Permita") ? (
            <Pressable onPress={() => Linking.openSettings()} testID="open-photos-settings">
              <Text style={styles.settingsLink}>Abrir configurações</Text>
            </Pressable>
          ) : null}

          {phase === "ready" && fileUri ? (
            <PrimaryButton
              testID="share-again"
              label="Compartilhar"
              onPress={() => persistAndShare(fileUri)}
            />
          ) : null}
          <PrimaryButton testID="close-share" label="Fechar" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center" },
  title: { fontFamily: fonts.display, color: colors.onSurface, fontSize: 22, textAlign: "center" },
  hiddenWeb: { position: "absolute", width: 2, height: 2, opacity: 0, top: -10, left: -10 },
  preview: {
    height: 420,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImg: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  hint: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, textAlign: "center" },
  saved: { fontFamily: fonts.bodyMedium, color: colors.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  settingsLink: { fontFamily: fonts.bodySemi, color: colors.brandPrimary, fontSize: 14, textAlign: "center" },
}));
