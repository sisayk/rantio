// Building blocks every screen uses: text, buttons, rows, cards, empty and error states.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { type ComponentProps, type ReactNode, useId } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text as RNText,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { MARK, WORDMARK } from "@/lib/brand";

import { ANDROID_TEXT_SCALE, colors, fonts, radius, shadow, space, textSize } from "@/theme";

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
  const styles = [variants[v], color ? { color } : null, style];
  if (Platform.OS !== "android") return <RNText {...rest} style={styles} />;
  // Android: the same sizes a little smaller (see ANDROID_TEXT_SCALE), including sizes a screen sets itself.
  const flat = StyleSheet.flatten(styles) as TextStyle;
  return (
    <RNText
      {...rest}
      style={{
        ...flat,
        fontSize: flat.fontSize ? textSize(flat.fontSize) : undefined,
        lineHeight: flat.lineHeight ? Math.round(flat.lineHeight * ANDROID_TEXT_SCALE) : undefined,
      }}
    />
  );
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

export function Avatar({ name, size = 44, photo }: { name: string; size?: number; photo?: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (photo) {
    return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={120} />;
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text v="h3" color="#fff" style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

/** Rantio's mark: the app icon (green square, R with a house, orange pin), as on the website. */
export function Logo({ size = 32 }: { size?: number }) {
  // Each copy gets its own gradient id: one in a hidden screen would otherwise blank the others.
  const id = `rantio-green-${useId().replace(/\W/g, "")}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={MARK.green[0]} />
          <Stop offset="1" stopColor={MARK.green[1]} />
        </LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={MARK.radius} fill={`url(#${id})`} />
      <G transform={MARK.transform}>
        <Path d={MARK.white} fill="#fff" fillRule="evenodd" />
        <Path d={MARK.pin} fill={MARK.orange} fillRule="evenodd" />
      </G>
    </Svg>
  );
}

/** "Rantio" with a pin for the dot of the i. */
export function Wordmark({ height = 32 }: { height?: number }) {
  return (
    <Svg width={(height * WORDMARK.width) / WORDMARK.height} height={height} viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} accessibilityRole="image" accessibilityLabel="Rantio">
      <Path d={WORDMARK.word} fill={WORDMARK.green} fillRule="evenodd" />
      <Path d={WORDMARK.pin} fill={WORDMARK.yellow} fillRule="evenodd" />
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
  iconButtonFilled: { backgroundColor: "#fff", ...shadow }, // opaque, so iOS can draw the shadow efficiently
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
