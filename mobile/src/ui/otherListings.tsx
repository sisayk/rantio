import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { ApiError, ownerApi } from "@/api";
import { linkError, OTHER_LISTINGS, type OtherListing } from "@/i18n/messages/otherListings";
import { formatDate } from "@/text/dates";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Field } from "@/ui/form";
import { SiteIcon } from "@/ui/host";
import { Button, Card, Section, Text } from "@/ui/kit";

const DOT: Record<OtherListing["calendar_state"], string> = {
  none: colors.faint,
  pending: "#d48a12",
  connected: colors.green,
  failed: colors.error,
};

/** The owner's listings on other sites (Nettimökki, Lomarengas, Mökkivuokra…): add, add a calendar, remove. */
export function OtherListings({
  cottage,
  forwardingAddress,
  copiedMail,
  onCopyMail,
}: {
  cottage: number;
  forwardingAddress: string;
  copiedMail: boolean;
  onCopyMail: () => void;
}) {
  const { lang } = useT();
  const t = OTHER_LISTINGS[lang];
  const [links, setLinks] = useState<OtherListing[] | null>(null);
  const [url, setUrl] = useState("");
  const [cal, setCal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    ownerApi
      .otherListings(cottage)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [cottage]);
  useEffect(load, [load]);

  const add = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const row = await ownerApi.addOtherListing(cottage, url.trim(), cal.trim());
      setLinks((now) => [...(now ?? []), row]);
      setUrl("");
      setCal("");
    } catch (e) {
      setError(linkError(t, e instanceof ApiError ? e.body : null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t.title}>
      <Text v="small" style={{ marginBottom: space.lg }}>
        {t.lead}
      </Text>
      {links?.length === 0 ? (
        <Text v="small" color={colors.faint} style={{ marginBottom: space.md }}>
          {t.none}
        </Text>
      ) : null}
      {(links ?? []).map((k) => (
        <LinkCard
          key={k.id}
          link={k}
          forwardingAddress={forwardingAddress}
          copiedMail={copiedMail}
          onCopyMail={onCopyMail}
          onChange={(row) => setLinks((now) => (now ?? []).map((x) => (x.id === k.id ? row : x)))}
          onRemoved={() => setLinks((now) => (now ?? []).filter((x) => x.id !== k.id))}
        />
      ))}
      <Card style={{ gap: space.md }}>
        <Field
          label={t.url}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.lomarengas.fi/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={error || null}
        />
        <Field
          label={t.calendar}
          hint={t.calendarHint}
          value={cal}
          onChangeText={setCal}
          placeholder="https://….ics"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button small label={busy ? t.adding : t.add} busy={busy} disabled={!url.trim()} onPress={add} style={{ alignSelf: "flex-start" }} />
      </Card>
    </Section>
  );
}

function LinkCard({
  link,
  forwardingAddress,
  copiedMail,
  onCopyMail,
  onChange,
  onRemoved,
}: {
  link: OtherListing;
  forwardingAddress: string;
  copiedMail: boolean;
  onCopyMail: () => void;
  onChange: (row: OtherListing) => void;
  onRemoved: () => void;
}) {
  const { lang, f, m } = useT();
  const t = OTHER_LISTINGS[lang];
  const [editing, setEditing] = useState(false);
  const [cal, setCal] = useState(link.calendar_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nettimokki = link.site === "nettimokki";

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      onChange(await ownerApi.setOtherListingCalendar(link.id, cal.trim()));
      setEditing(false);
    } catch (e) {
      setError(linkError(t, e instanceof ApiError ? e.body : null));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await ownerApi.removeOtherListing(link.id);
      onRemoved();
    } catch (e) {
      setError(linkError(t, e instanceof ApiError ? e.body : null));
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: space.sm, marginBottom: space.md }}>
      <SiteIcon channel={link.site} label={link.name} />
      {nettimokki ? (
        <>
          <Text v="small" color={colors.ink} selectable>
            {f(t.nettimokki, { address: forwardingAddress })}
          </Text>
          <Button
            small
            kind="secondary"
            icon="copy-outline"
            label={copiedMail ? m.dashboard.calendar.link.copied : m.dashboard.calendar.link.copy}
            onPress={onCopyMail}
            style={{ alignSelf: "flex-start" }}
          />
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DOT[link.calendar_state] }} />
          <Text v="small" color={colors.ink}>
            {t.states[link.calendar_state]}
            {link.last_synced_at
              ? ` · ${f(t.lastRead, { time: formatDate(lang, link.last_synced_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}`
              : ""}
          </Text>
        </View>
      )}
      {link.calendar_error ? (
        <Text v="tiny" color={colors.error}>
          {link.calendar_error}
        </Text>
      ) : null}
      {editing ? (
        <>
          <Field
            label={t.calendar}
            hint={t.calendarHint}
            value={cal}
            onChangeText={setCal}
            placeholder="https://….ics"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={error || null}
          />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button small label={t.save} busy={busy} onPress={save} />
            <Button small kind="ghost" label={t.cancel} onPress={() => setEditing(false)} />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Button small kind="secondary" icon="open-outline" label={t.open} onPress={() => WebBrowser.openBrowserAsync(link.url).catch(() => undefined)} />
          {!nettimokki ? (
            <Button small kind="secondary" label={link.calendar_url ? t.calendar : t.addCalendar} onPress={() => setEditing(true)} />
          ) : null}
          <Button small kind="danger" label={t.remove} disabled={busy} onPress={remove} />
        </View>
      )}
      {!editing && error ? (
        <Text v="tiny" color={colors.error}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}
