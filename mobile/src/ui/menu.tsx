// Profile and Account settings, laid out like Airbnb's: a profile card, then plain rows with an icon and a chevron.
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "@/api";
import type { Owner } from "@/state/session";
import { useT } from "@/text/i18n";
import { colors, radius, shadowFloat, space } from "@/theme";
import { Avatar, Icon, IconButton, type IconName, Text } from "@/ui/kit";

/** One row: an icon, a label (and an optional line under it), a value or badge, a chevron. */
export function MenuRow({
  icon,
  label,
  detail,
  value,
  badge,
  badgeTone = "alert",
  onPress,
  right,
  danger,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  value?: string;
  badge?: string;
  /** "alert" for something missing, "quiet" for a plain note like "Coming soon". */
  badgeTone?: "alert" | "quiet";
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      <Icon name={icon} size={26} color={danger ? colors.error : colors.ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label} color={danger ? colors.error : undefined}>
          {label}
        </Text>
        {detail ? <Text v="small">{detail}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, badgeTone === "quiet" && { backgroundColor: colors.ground }]}>
          <Text v="tiny" color={badgeTone === "quiet" ? colors.soft : colors.error}>
            {badge}
          </Text>
        </View>
      ) : null}
      {value ? <Text v="small">{value}</Text> : null}
      {right}
      {onPress && !right ? <Icon name="chevron-forward" size={20} color={colors.soft} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  );
}

export const MenuDivider = () => <View style={styles.divider} />;

/** The card at the top of Profile: photo, name and where they live. */
export function ProfileCard({ owner, onPress }: { owner: Owner; onPress: () => void }) {
  const { country } = useT();
  const d = owner.details;
  const place = [d?.city, d?.address_country ? country(d.address_country) : ""].filter(Boolean).join(", ");
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, shadowFloat, pressed && { transform: [{ scale: 0.99 }] }]}>
      <Avatar name={owner.name} size={104} photo={owner.photo ? mediaUrl(owner.photo) : null} />
      <Text v="title" style={{ textAlign: "center", marginTop: space.sm }} numberOfLines={1}>
        {owner.name}
      </Text>
      <Text v="small" style={{ textAlign: "center" }} numberOfLines={1}>
        {place || owner.email}
      </Text>
    </Pressable>
  );
}

/** A settings page: a round back button, a big title, then the content. */
export function SettingsPage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const router = useRouter();
  const { m } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg }}>
        <View style={styles.back}>
          <IconButton name="arrow-back" label={m.app.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        </View>
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
          <Text v="display" accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40 }}>
            {title}
          </Text>
          {lead ? (
            <Text v="small" style={{ marginTop: space.sm }}>
              {lead}
            </Text>
          ) : null}
          <View style={{ marginTop: space.lg }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: 18 },
  label: { fontSize: 17, lineHeight: 23 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "#fdecea" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space.md },
  card: {
    alignItems: "center",
    gap: 2,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg + 8,
    backgroundColor: colors.page,
  },
  back: { alignSelf: "flex-start" },
});
