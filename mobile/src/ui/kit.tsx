// Building blocks every screen uses: text, buttons, rows, cards, empty and error states.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text as RNText,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts, radius, shadow, space } from "@/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export const Icon = ({ name, size = 22, color = colors.ink }: { name: IconName; size?: number; color?: string }) => (
  <Ionicons name={name} size={size} color={color} />
);

const variants = StyleSheet.create({
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: colors.ink },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4, color: colors.ink },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, color: colors.ink },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.ink },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.soft },
  smallMedium: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  tiny: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.soft },
});

export type Variant = keyof typeof variants;

export function Text({ v = "body", color, style, ...rest }: TextProps & { v?: Variant; color?: string }) {
  return <RNText {...rest} style={[variants[v], color ? { color } : null, style]} />;
}

export const tap = () => Haptics.selectionAsync().catch(() => undefined);

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  busy?: boolean;
  small?: boolean;
  style?: ViewStyle;
};

export function Button({ label, kind = "primary", icon, busy, small, disabled, style, onPress, ...rest }: ButtonProps) {
  const fg = kind === "primary" ? "#fff" : kind === "danger" ? colors.error : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      onPress={(e) => {
        tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        kind === "primary" && { backgroundColor: pressed ? colors.greenDeep : colors.green },
        kind === "secondary" && { borderWidth: 1, borderColor: colors.ink, backgroundColor: pressed ? colors.ground : "#fff" },
        kind === "danger" && { borderWidth: 1, borderColor: colors.error, backgroundColor: pressed ? colors.errorTint : "#fff" },
        kind === "ghost" && { backgroundColor: pressed ? colors.ground : "transparent", paddingHorizontal: space.sm },
        (disabled || busy) && { opacity: 0.55 },
        style,
      ]}
      {...rest}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text v={small ? "smallMedium" : "bodyMedium"} color={fg} style={kind === "ghost" ? { textDecorationLine: "underline" } : null}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A round icon button, e.g. back, share or save over a photo. */
export function IconButton({
  name,
  onPress,
  label,
  color = colors.ink,
  filled = true,
  size = 20,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  filled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.iconButton, filled && styles.iconButtonFilled, pressed && { opacity: 0.7 }]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  return <View style={[styles.card, padded && { padding: space.lg }, style]}>{children}</View>;
}

/** A tappable settings-style row. */
export function Row({
  icon,
  label,
  value,
  detail,
  onPress,
  danger,
  last,
  right,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  right?: ReactNode;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowLine]}>
      {icon ? <Icon name={icon} size={22} color={danger ? colors.error : colors.ink} /> : null}
      <View style={{ flex: 1 }}>
        <Text v="body" color={danger ? colors.error : undefined}>
          {label}
        </Text>
        {detail ? <Text v="small">{detail}</Text> : null}
      </View>
      {value ? <Text v="small">{value}</Text> : null}
      {right}
      {onPress && !right ? <Icon name="chevron-forward" size={18} color={colors.faint} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: colors.ground }}>
      {content}
    </Pressable>
  );
}

export function Section({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ marginTop: space.xl }, style]}>
      {title ? (
        <Text v="h2" style={{ marginBottom: space.sm }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Empty({ icon, title, lead, action }: { icon: IconName; title: string; lead?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={34} color={colors.ink} />
      <Text v="h2" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {lead ? (
        <Text v="small" style={{ textAlign: "center", maxWidth: 320 }}>
          {lead}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

export function Problem({ text, retry, retryLabel }: { text: string; retry?: () => void; retryLabel?: string }) {
  return (
    <View style={styles.problem}>
      <Icon name="cloud-offline-outline" size={22} color={colors.error} />
      <Text v="small" color={colors.ink} style={{ flex: 1 }}>
        {text}
      </Text>
      {retry && retryLabel ? <Button small kind="secondary" label={retryLabel} onPress={retry} /> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: space.xxl * 2, alignItems: "center" }}>
      <ActivityIndicator color={colors.green} size="large" />
    </View>
  );
}

export function Pill({ label, tone = "neutral", style }: { label: string; tone?: "neutral" | "green" | "berry" | "error"; style?: TextStyle }) {
  const bg = { neutral: colors.ground, green: colors.greenTint, berry: colors.berryTint, error: colors.errorTint }[tone];
  const fg = { neutral: colors.soft, green: colors.green, berry: "#8a5410", error: colors.error }[tone];
  return (
    <Text v="tiny" color={fg} style={[styles.pill, { backgroundColor: bg }, style]}>
      {label}
    </Text>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text v="h3" color="#fff" style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

/** Stugora's mark: a pine and a cabin over water, as on the website. */
export function Logo({ size = 32, color = colors.green }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M15 4 6 17h4.5L5 25h20l-5.5-8H24L15 4Z" fill={color} />
      <Path d="M14 25v4h2v-4" fill={color} />
      <Path d="M21 25V17l6.5-5 6.5 5v8" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path
        d="M3 31c2.5-1.6 5-1.6 7.5 0s5 1.6 7.5 0 5-1.6 7.5 0 5 1.6 7.5 0 3.5-1.6 4 0M7 35.5c2-1.2 4-1.2 6 0s4 1.2 6 0 4-1.2 6 0 4 1.2 6 0"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.sm,
    paddingHorizontal: space.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  iconButtonFilled: { backgroundColor: "rgba(255,255,255,0.94)", ...shadow },
  card: { backgroundColor: colors.page, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg, minHeight: 56 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl * 2, paddingHorizontal: space.xl },
  problem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.errorTint,
    marginVertical: space.md,
  },
  pill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  avatar: { backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
});
