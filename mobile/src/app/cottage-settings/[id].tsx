import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Switch, View } from "react-native";

import { type CalendarCottage, type CalendarFeed, ownerApi } from "@/api";
import { CHANNELS } from "@/lib/catalog";
import { formatDate, monthStart, todayISO } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Field } from "@/ui/form";
import { SiteIcon } from "@/ui/host";
import { Button, Card, Loading, Problem, Section, Text } from "@/ui/kit";
import { PageBar } from "@/ui/screen";
import { OtherListings } from "@/ui/otherListings";

const SITES = ["airbnb", "booking", "vrbo", "agoda"] as const;

/** One cottage's booking link and the calendar links that tie it to each booking site. */
export default function CottageSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);
  const { m, lang } = useT();
  const c = m.dashboard.calendar;
  const [cottage, setCottage] = useState<CalendarCottage | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    ownerApi
      .calendar(monthStart(todayISO()), 1)
      .then((d) => setCottage(d.cottages.find((x) => x.id === pk) ?? null))
      .catch(() => setFailed(true));
  }, [pk]);

  useEffect(load, [load]);

  const copy = async (text: string, what: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(what);
    setTimeout(() => setCopied((cur) => (cur === what ? null : cur)), 2000);
  };

  const setOpen = async (open: boolean) => {
    if (!cottage) return;
    setBusy(true);
    try {
      setCottage({ ...cottage, ...(await ownerApi.setBookingLink(cottage.id, open)) });
    } finally {
      setBusy(false);
    }
  };

  const renew = () =>
    Alert.alert(c.link.renew, c.link.renewConfirm, [
      { text: m.app.common.cancel, style: "cancel" },
      {
        text: c.link.renew,
        style: "destructive",
        onPress: async () => {
          if (!cottage) return;
          setCottage({ ...cottage, ...(await ownerApi.renewBookingLink(cottage.id)) });
        },
      },
    ]);

  const updateFeed = (feed: CalendarFeed | null, channel: string) =>
    setCottage((cur) => (cur ? { ...cur, feeds: [...cur.feeds.filter((x) => x.channel !== channel), ...(feed ? [feed] : [])] } : cur));

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={cottage?.name ?? m.app.menu.settings} />
      {!cottage ? (
        failed ? (
          <View style={{ padding: space.xl }}>
            <Problem text={m.dashboard.error} retry={load} retryLabel={m.dashboard.retry} />
          </View>
        ) : (
          <Loading />
        )
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
            <Text v="title">{c.link.title}</Text>
            <Text v="small" style={{ marginTop: space.sm }}>
              {c.link.lead}
            </Text>
            <Card style={{ marginTop: space.lg, gap: space.md }}>
              <Text v="bodyMedium" selectable style={styles.link}>
                {cottage.booking_link}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <Button small icon="copy-outline" label={copied === "link" ? c.link.copied : c.link.copy} onPress={() => copy(cottage.booking_link, "link")} />
                <Button
                  small
                  kind="secondary"
                  icon="share-outline"
                  label={m.app.common.share}
                  onPress={() => Share.share(Platform.OS === "ios" ? { url: cottage.booking_link } : { message: cottage.booking_link })}
                />
                <Button small kind="secondary" icon="open-outline" label={c.link.view} onPress={() => WebBrowser.openBrowserAsync(cottage.booking_link).catch(() => undefined)} />
              </View>
              <View style={styles.toggle}>
                <Text v="bodyMedium" style={{ flex: 1 }}>
                  {cottage.booking_requests_open ? c.link.on : c.link.off}
                </Text>
                <Switch
                  value={cottage.booking_requests_open}
                  onValueChange={setOpen}
                  disabled={busy}
                  trackColor={{ true: colors.green, false: colors.line }}
                  thumbColor="#ffffff"
                  accessibilityLabel={cottage.booking_requests_open ? c.link.turnOff : c.link.turnOn}
                />
              </View>
              <Button small kind="ghost" label={c.link.renew} onPress={renew} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
            </Card>

            <Section title={c.sites.title}>
              <Text v="small" style={{ marginBottom: space.lg }}>
                {c.sites.lead}
              </Text>
              {SITES.map((site) => (
                <SiteFeed
                  key={site}
                  site={site}
                  cottage={cottage}
                  feed={cottage.feeds.find((x) => x.channel === site) ?? null}
                  copied={copied === site}
                  onCopy={() => copy(cottage.export[site], site)}
                  onChange={(feed) => updateFeed(feed, site)}
                  lang={lang}
                />
              ))}
            </Section>

            <OtherListings
              cottage={cottage.id}
              forwardingAddress={cottage.forwarding_address}
              copiedMail={copied === "mail"}
              onCopyMail={() => copy(cottage.forwarding_address, "mail")}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function SiteFeed({
  site,
  cottage,
  feed,
  copied,
  onCopy,
  onChange,
  lang,
}: {
  site: (typeof SITES)[number];
  cottage: CalendarCottage;
  feed: CalendarFeed | null;
  copied: boolean;
  onCopy: () => void;
  onChange: (feed: CalendarFeed | null) => void;
  lang: ReturnType<typeof useT>["lang"];
}) {
  const { m, f } = useT();
  const s = m.dashboard.calendar.sites;
  const name = CHANNELS[site].name;
  const [url, setUrl] = useState(feed?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!url.trim().startsWith("https://")) return setError(s.https);
    setBusy(true);
    setError("");
    try {
      onChange(await ownerApi.saveFeed(cottage.id, site, url.trim()));
    } catch {
      setError(s.error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!feed) return;
    setBusy(true);
    try {
      await ownerApi.removeFeed(feed.id);
      onChange(null);
      setUrl("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: space.md, marginBottom: space.md }}>
      <SiteIcon channel={site} label={name} />
      <Text v="smallMedium">{f(s.ours, { site: name })}</Text>
      <Text v="tiny">{f(s.oursHelp, { site: name })}</Text>
      <View style={styles.exportRow}>
        <Text v="small" numberOfLines={1} style={{ flex: 1 }} selectable>
          {cottage.export[site]}
        </Text>
        <Button small kind="secondary" icon="copy-outline" label={copied ? m.dashboard.calendar.link.copied : m.dashboard.calendar.link.copy} onPress={onCopy} />
      </View>
      <Field
        label={f(s.theirs, { site: name })}
        hint={f(s.theirsHelp, { site: name })}
        value={url}
        onChangeText={setUrl}
        placeholder={s.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={error || (feed?.last_error ? s.error : null)}
      />
      {feed ? (
        <Text v="tiny">{feed.last_synced_at ? f(s.read, { when: formatDate(lang, feed.last_synced_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }) : s.notRead}</Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button small label={busy ? s.saving : s.save} busy={busy} disabled={!url.trim() || url.trim() === feed?.url} onPress={save} />
        {feed ? <Button small kind="danger" label={s.remove} disabled={busy} onPress={remove} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  link: { padding: space.md, borderRadius: radius.sm, backgroundColor: colors.ground },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  exportRow: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, paddingLeft: space.md, borderRadius: radius.sm, backgroundColor: colors.ground },
});
