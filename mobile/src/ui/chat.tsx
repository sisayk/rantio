// A conversation: messages by day, the reader's own on the right, and a reply box.
import { type ComponentRef, type ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChatMessage } from "@/api";
import type { Lang } from "@/i18n/locales";
import { DAY_LONG, formatDate, TIME } from "@/text/dates";
import { colors, fonts, radius, space } from "@/theme";
import { Icon, tap, Text } from "@/ui/kit";

export function Messages({
  lang,
  messages,
  mine,
  theirName,
  header,
  footer,
}: {
  lang: Lang;
  messages: ChatMessage[];
  mine: "guest" | "host";
  theirName: string;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const count = messages.length;
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollToEnd({ animated: count > 0 }), 50);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <ScrollView ref={ref} contentContainerStyle={{ padding: space.lg, gap: space.sm }} keyboardDismissMode="interactive" onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}>
      {header}
      {messages.map((msg, i) => {
        const showDay = i === 0 || messages[i - 1].at.slice(0, 10) !== msg.at.slice(0, 10);
        const own = msg.sender === mine;
        return (
          <View key={msg.id}>
            {showDay ? (
              <Text v="tiny" style={{ textAlign: "center", marginVertical: space.md, textTransform: "capitalize" }}>
                {formatDate(lang, msg.at, DAY_LONG)}
              </Text>
            ) : null}
            <View style={[styles.bubbleRow, own ? { justifyContent: "flex-end" } : null]}>
              <View style={[styles.bubble, own ? styles.own : styles.theirs]}>
                {!own ? (
                  <Text v="tiny" color={colors.soft} style={{ marginBottom: 2 }}>
                    {theirName}
                  </Text>
                ) : null}
                <Text v="body" color={own ? "#fff" : colors.ink} selectable>
                  {msg.body}
                </Text>
                <Text v="tiny" color={own ? "rgba(255,255,255,0.75)" : colors.faint} style={{ alignSelf: "flex-end", marginTop: 2 }}>
                  {formatDate(lang, msg.at, TIME)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      {footer}
    </ScrollView>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  busy,
  placeholder,
  sendLabel,
  above,
}: {
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  busy: boolean;
  placeholder: string;
  sendLabel: string;
  above?: ReactNode;
}) {
  const can = !!value.trim() && !busy;
  return (
    <SafeAreaView edges={["bottom"]} style={styles.composerWrap}>
      {above}
      <View style={styles.composer}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          multiline
          style={styles.input}
          accessibilityLabel={placeholder}
        />
        <Pressable
          disabled={!can}
          onPress={() => {
            tap();
            onSend();
          }}
          style={[styles.send, !can && { backgroundColor: colors.line }]}
          accessibilityRole="button"
          accessibilityLabel={sendLabel}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Icon name="arrow-up" size={20} color="#fff" />}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Keeps the reply box above the keyboard. */
export function ChatFrame({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "82%", paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg },
  own: { backgroundColor: colors.green, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.ground, borderBottomLeftRadius: 6 },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.page, paddingBottom: space.sm },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    paddingHorizontal: space.lg,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
});
