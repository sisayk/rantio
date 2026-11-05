// Text fields with labels, in the website's calm style.
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";

import { colors, fonts, radius, space, textSize } from "@/theme";
import { Text } from "@/ui/kit";

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string | null; optional?: string };

export function Field({ label, hint, error, optional, style, multiline, ...rest }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text v="smallMedium">
        {label}
        {optional ? <Text v="small"> ({optional})</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.faint}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, error ? { borderColor: colors.error } : null, style]}
        accessibilityLabel={label}
        {...rest}
      />
      {error ? (
        <Text v="small" color={colors.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text v="tiny">{hint}</Text>
      ) : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: textSize(16),
    color: colors.ink,
    backgroundColor: colors.page,
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
});
