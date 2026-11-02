// Page frames: a tab page with a large title, and a pushed page with a back bar.
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { IconButton, Text } from "@/ui/kit";

type Props = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  background?: string;
};

/** A tab's page: large title at the top, content that scrolls and pulls to refresh. */
export function TabScreen({ title, subtitle, right, children, refreshing = false, onRefresh, scroll = true, contentStyle, background = colors.page }: Props) {
  const head = title ? (
    <View style={styles.head}>
      <View style={{ flex: 1 }}>
        <Text v="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text v="small">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: background }}>
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} /> : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>
          <View style={{ paddingHorizontal: space.xl }}>{head}</View>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

/** A pushed page: a back button and a title in a slim bar. */
export function PageBar({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const router = useRouter();
  const { m } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
      <IconButton name="chevron-back" filled={false} label={m.app.common.back} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))} />
      <Text v="h3" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
        {title ?? ""}
      </Text>
      <View style={{ minWidth: 36, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

/** A modal sheet's top: a title and a close button. */
export function SheetBar({ title, onClose }: { title: string; onClose: () => void }) {
  const { m } = useT();
  return (
    <View style={styles.sheetBar}>
      <IconButton name="close" filled={false} label={m.guest.contact.close} onPress={onClose} />
      <Text v="h3" style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

export const styles = StyleSheet.create({
  switchWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  switchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: space.xl,
    height: 52,
    borderRadius: 26,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl * 2 },
  head: { flexDirection: "row", alignItems: "flex-end", gap: space.md, paddingTop: space.lg, paddingBottom: space.lg },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.page,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  sheetBar: {
    backgroundColor: colors.page, // also a sticky header in the language and currency sheets
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});

/** The dark "Switch to hosting / travelling" pill floating above the tab bar, as in Airbnb's app. */
export function SwitchPill({ label, onPress }: { label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.switchWrap, { bottom: insets.bottom + space.lg }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.switchPill, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Ionicons name="swap-horizontal" size={20} color="#fff" />
        <Text v="bodyMedium" color="#fff">
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

/** The button row at the bottom of a modal sheet, kept clear of the home indicator.
 *  (SafeAreaView doesn't pad inside a modal, so the screen's insets are used.) */
export function ModalFoot({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return <View style={[style, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{children}</View>;
}
