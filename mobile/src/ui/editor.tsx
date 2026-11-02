// Building blocks of the listing editor: a page with a save bar, number and money fields,
// yes/no rows and the listing's load/error states.
import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";

import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { styles as formStyles } from "@/ui/form";
import { Button, Loading, Problem, Text } from "@/ui/kit";
import { ModalFoot, PageBar } from "@/ui/screen";

/** An editor page: the title bar, the form, and a Save bar at the bottom while something changed. */
export function EditorPage({
  title,
  children,
  dirty = false,
  saving = false,
  problem,
  onSave,
  loading = false,
  failed,
  retry,
}: {
  title: string;
  children?: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  problem?: string | null;
  onSave?: () => void;
  loading?: boolean;
  failed?: string | null;
  retry?: () => void;
}) {
  const { m } = useT();
  const l = m.listings;
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={title} />
      {failed ? (
        <View style={{ padding: space.xl }}>
          <Problem text={failed} retry={retry} retryLabel={m.dashboard.retry} />
        </View>
      ) : loading ? (
        <Loading />
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {onSave && (dirty || problem) ? (
            <ModalFoot style={styles.foot}>
              {problem ? <Problem text={problem} /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Text v="small" style={{ flex: 1 }}>
                  {dirty ? l.unsaved : l.allSaved}
                </Text>
                <Button label={saving ? l.saving : l.save} busy={saving} onPress={onSave} disabled={!dirty} style={{ paddingHorizontal: space.xxl }} />
              </View>
            </ModalFoot>
          ) : null}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

/** A label with a short input beside it: numbers, prices, times. */
export function InlineField({
  label,
  hint,
  value,
  onChange,
  suffix,
  placeholder,
  error,
  keyboard = "decimal-pad",
  width = 110,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
  error?: string | null;
  keyboard?: "decimal-pad" | "number-pad" | "numbers-and-punctuation" | "default";
  width?: number;
}) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Text v="body">{label}</Text>
          {hint ? <Text v="small">{hint}</Text> : null}
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          accessibilityLabel={label}
          style={[formStyles.input, { width, textAlign: "right" }, error ? { borderColor: colors.error } : null]}
        />
        {suffix ? (
          <Text v="small" style={{ minWidth: 34 }}>
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text v="small" color={colors.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The page around a useEditor() form: loading and error states, the save bar and its messages. */
export function EditorShell({
  title,
  editor,
  children,
}: {
  title: string;
  editor: { listing: unknown; failed: string | null; load: () => void; dirty: boolean; saving: boolean; problem: "invalid" | "network" | null; submit: () => void };
  children?: ReactNode;
}) {
  const { m } = useT();
  const l = m.listings;
  return (
    <EditorPage
      title={title}
      loading={!editor.listing}
      failed={!editor.listing && editor.failed ? (editor.failed === "missing" ? l.notFound : m.dashboard.error) : null}
      retry={editor.load}
      dirty={editor.dirty}
      saving={editor.saving}
      problem={editor.problem === "invalid" ? l.saveError : editor.problem === "network" ? l.networkError : null}
      onSave={editor.submit}
    >
      {editor.listing ? children : null}
    </EditorPage>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.inline}>
      <View style={{ flex: 1 }}>
        <Text v="body">{label}</Text>
        {hint ? <Text v="small">{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.green, false: colors.line }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
}

export function Group({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text v="h2">{title}</Text>
      {lead ? <Text v="small">{lead}</Text> : null}
      <View style={{ gap: space.md, marginTop: space.xs }}>{children}</View>
    </View>
  );
}

/** "12.50" → "12.5"; empty stays empty. Money is sent to the server as text. */
export const moneyText = (v: string | null | undefined) => (v == null || v === "" ? "" : String(Number(v)));
/** The input's text as the server wants it: "" → null, "12,5" → "12.50". */
export function toMoney(v: string): string | null {
  const t = v.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n.toFixed(2) : t;
}
export function toInt(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : NaN;
}

const styles = StyleSheet.create({
  foot: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.page,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: space.md },
  group: { gap: space.xs, paddingBottom: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, borderRadius: radius.sm },
});
