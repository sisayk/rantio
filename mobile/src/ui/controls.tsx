// Small inputs: choice chips and a number stepper.
import { Pressable, StyleSheet, View } from "react-native";

import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Icon, tap, Text } from "@/ui/kit";

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text v="smallMedium" color={on ? "#fff" : colors.ink}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Stepper({ value, min = 0, max, onChange, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; label: string }) {
  const { m } = useT();
  const btn = (name: "remove" | "add", disabled: boolean, next: number, a11y: string) => (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onChange(next);
      }}
      style={[styles.stepButton, disabled && { opacity: 0.3 }]}
      accessibilityRole="button"
      accessibilityLabel={`${a11y}: ${label}`}
    >
      <Icon name={name} size={18} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      {btn("remove", value <= min, value - 1, m.guest.guestPicker.less)}
      <Text v="h3" style={{ minWidth: 28, textAlign: "center" }}>
        {value}
      </Text>
      {btn("add", value >= max, value + 1, m.guest.guestPicker.more)}
    </View>
  );
}

/** Two or three choices side by side in a pill, the chosen one raised (Dates | Flexible). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.segment, on && styles.segmentOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text v="bodyMedium" color={on ? colors.ink : colors.soft}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.ground },
  segment: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  segmentOn: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chip: { paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  stepButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.faint, alignItems: "center", justifyContent: "center" },
});
