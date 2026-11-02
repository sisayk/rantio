// The Mökki monitor (cottage alert box), coming soon: a card for Today and the full page
// behind Menu → Mökki monitor. One tap puts the owner on the waitlist with their sign-in email.
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ownerApi } from "@/api";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Button, Card, Icon, type IconName, Pill, Text } from "@/ui/kit";

export const MONITOR_PHOTO = require("@/assets/images/mokki-monitor.jpg");

const ICONS: Record<string, IconName> = {
  frost: "snow-outline",
  power: "flash-outline",
  leak: "water-outline",
  door: "enter-outline",
  probes: "thermometer-outline",
};

function useWaitlist() {
  const [joined, setJoined] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      ownerApi.monitor().then((r) => setJoined(r.joined), () => setJoined(false));
    }, []),
  );
  const join = async () => {
    setWorking(true);
    setFailed(false);
    try {
      setJoined((await ownerApi.joinMonitor()).joined);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };
  return { joined, working, failed, join };
}

function Join({ w }: { w: ReturnType<typeof useWaitlist> }) {
  const { m } = useT();
  const t = m.owner.monitor;
  if (w.joined) {
    return (
      <View style={styles.done}>
        <Icon name="checkmark-circle" size={20} color={colors.green} />
        <Text v="smallMedium" color={colors.green} style={{ flex: 1 }}>
          {t.done}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      <Button label={w.working ? t.sending : t.submit} busy={w.working} disabled={w.joined === null} onPress={w.join} />
      <Text v="tiny">{w.failed ? t.errors.network : t.consent}</Text>
    </View>
  );
}

/** Today: the box in short, with "Tell me when it's ready". */
export function MonitorCard({ onMore }: { onMore: () => void }) {
  const { m } = useT();
  const t = m.owner.monitor;
  const w = useWaitlist();
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <Image source={MONITOR_PHOTO} style={styles.photo} contentFit="cover" accessibilityLabel={t.photoAlt} />
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Pill label={t.badge} tone="green" style={{ alignSelf: "flex-start" }} />
        <Text v="h3">{t.title}</Text>
        <Text v="small">{t.lead}</Text>
        <Pressable onPress={onMore} accessibilityRole="button" style={({ pressed }) => [styles.more, pressed && { opacity: 0.6 }]}>
          <Text v="smallMedium" color={colors.ink} style={{ flex: 1 }}>
            {t.features.map((f) => f.title).join(" · ")}
          </Text>
          <Icon name="chevron-forward" size={18} color={colors.soft} />
        </Pressable>
        <Join w={w} />
      </View>
    </Card>
  );
}

/** Menu → Mökki monitor: everything the box does. */
export function MonitorDetails() {
  const { m } = useT();
  const t = m.owner.monitor;
  const w = useWaitlist();
  return (
    <View style={{ gap: space.lg }}>
      <View>
        <Image source={MONITOR_PHOTO} style={[styles.photo, { borderRadius: radius.lg }]} contentFit="cover" accessibilityLabel={t.photoAlt} />
        <Text v="tiny" style={styles.caption}>
          {t.caption}
        </Text>
      </View>
      <Pill label={t.badge} tone="green" style={{ alignSelf: "flex-start" }} />
      <Text v="title">{t.title}</Text>
      <Text v="body">{t.lead}</Text>
      <View style={{ gap: space.md }}>
        {t.features.map((f) => (
          <View key={f.key} style={styles.feature}>
            <View style={styles.icon}>
              <Icon name={ICONS[f.key] ?? "ellipse-outline"} size={22} color={colors.ink} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text v="bodyMedium">{f.title}</Text>
              <Text v="small">{f.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text v="small">{t.app}</Text>
      <Join w={w} />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.ground },
  caption: { position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(255,255,255,0.85)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  feature: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.ground, alignItems: "center", justifyContent: "center" },
  more: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  done: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.greenTint },
});
