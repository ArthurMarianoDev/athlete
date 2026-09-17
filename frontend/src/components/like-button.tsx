import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api/client";
import { Icon } from "@/src/components/icons";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function LikeButton({
  activityId,
  likeCount = 0,
  liked = false,
  testID,
}: {
  activityId: string;
  likeCount?: number;
  liked?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [state, setState] = useState({ count: likeCount, liked });

  const mutation = useMutation({
    mutationFn: async () =>
      api.post<{ like_count: number; liked_by_me: boolean }>(`/activities/${activityId}/like`),
    onSuccess: (res) => {
      setState({ count: res.like_count, liked: res.liked_by_me });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["activity", activityId] });
    },
  });

  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // optimistic
    setState((s) => ({ count: s.liked ? s.count - 1 : s.count + 1, liked: !s.liked }));
    mutation.mutate();
  };

  return (
    <Pressable
      testID={testID ?? `like-${activityId}`}
      onPress={onPress}
      style={[styles.btn, state.liked && styles.btnActive]}
      hitSlop={8}
    >
      <Icon
        name={state.liked ? "heartFilled" : "heart"}
        size={16}
        color={state.liked ? colors.brandPrimary : colors.muted}
      />
      <Text style={[styles.count, state.liked && styles.countActive]}>{state.count}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  count: { fontFamily: fonts.bodySemi, color: colors.muted, fontSize: 13 },
  countActive: { color: colors.onBrandTertiary },
}));
