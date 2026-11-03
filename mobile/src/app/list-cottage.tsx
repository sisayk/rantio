import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ApiError, guestApi, Offline } from "@/api";
import { countryName } from "@/i18n/format";
import { CONTACT_EMAIL } from "@/lib/content";
import { COUNTRIES, type Country } from "@/lib/listings";
import { regionLabel } from "@/lib/placeNames";
import { PLACES } from "@/lib/places";
import { useT } from "@/text/i18n";
import { colors, radius, space } from "@/theme";
import { Field } from "@/ui/form";
import { Button, Icon, Problem, Row, Text } from "@/ui/kit";
import { ModalFoot, SheetBar } from "@/ui/screen";
import { openSite } from "@/ui/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NETTIMOKKI = /^https?:\/\/([a-z0-9-]+\.)*nettimokki\.com(\/|$)/i;
// The country the form starts with, from the app's language (English: none chosen yet).
const LANG_COUNTRY: Record<string, Country> = { fi: "FI", sv: "SE", nb: "NO", nn: "NO", da: "DK", is: "IS", et: "EE", lv: "LV", lt: "LT" };

type Errors = Partial<Record<"name" | "email" | "country" | "region" | "nettimokki" | "consent" | "form", string>>;

/** "List your cottage" inside the app: the same sign-up as on rantio.fi/hosts. */
export default function ListCottage() {
  const { m, lang, f } = useT();
  const t = m.owner.form;
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country | "">(LANG_COUNTRY[lang] ?? "");
  const [region, setRegion] = useState("");
  const [place, setPlace] = useState("");
  const [count, setCount] = useState(1);
  const [nettimokki, setNettimokki] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  const regions = country
    ? [...PLACES[country]].sort((a, b) => regionLabel(a, country, lang).localeCompare(regionLabel(b, country, lang), lang))
    : [];
  const chosen = country ? PLACES[country].find((r) => r.id === region) : undefined;
  const towns = chosen?.cities.map((c) => c.name) ?? [];
  const close = () => (router.canGoBack() ? router.back() : router.replace("/explore"));

  const submit = async () => {
    const e: Errors = {};
    if (!name.trim()) e.name = t.errors.required;
    if (!EMAIL.test(email.trim())) e.email = email.trim() ? t.errors.email : t.errors.required;
    if (!country) e.country = t.errors.required;
    else if (!region) e.region = t.errors.required;
    if (country === "FI" && nettimokki.trim() && !NETTIMOKKI.test(nettimokki.trim())) e.nettimokki = t.errors.nettimokki;
    if (!consent) e.consent = t.errors.consent;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await guestApi.listCottage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        language: lang,
        country,
        region,
        place: place.trim().slice(0, 100),
        cottage_count: count,
        nettimokki_url: country === "FI" ? nettimokki.trim() : "",
        message: message.trim(),
        privacy_consent: true,
        source: "app",
        website: "",
      });
      setDone(true);
    } catch (err) {
      const detail = err instanceof ApiError && err.status === 400 ? err.body : {};
      setErrors(
        err instanceof ApiError && err.status === 429
          ? { form: t.errors.tooMany }
          : detail.email
            ? { email: t.errors.email }
            : detail.region
              ? { region: t.errors.required }
              : detail.nettimokki_url
                ? { nettimokki: t.errors.nettimokki }
                : { form: err instanceof Offline ? m.app.common.offline : t.errors.network.replace("{email}", CONTACT_EMAIL) },
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <SheetBar title={m.owner.nav.cta} onClose={close} />
        <View style={styles.done}>
          <Text style={{ fontSize: 56, lineHeight: 64 }}>🏡</Text>
          <Text v="title" style={{ textAlign: "center" }}>
            {t.successTitle}
          </Text>
          <Text v="body" color={colors.soft} style={{ textAlign: "center" }}>
            {f(t.success, { name: name.trim().split(" ")[0] })}
          </Text>
          <Button label={m.app.common.done} onPress={close} style={{ alignSelf: "stretch", marginTop: space.lg }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SheetBar title={m.owner.nav.cta} onClose={close} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
          <Text v="title">{m.owner.why.title}</Text>
          <View style={{ gap: space.md }}>
            {m.owner.why.items.map((item) => (
              <View key={item.title} style={styles.why}>
                <Icon name="checkmark-circle" size={22} color={colors.green} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text v="bodyMedium">{item.title}</Text>
                  <Text v="small">{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text v="h3">{t.title}</Text>
            <Text v="small">{t.lead}</Text>
            <Field label={t.name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} />
            <Field
              label={t.email}
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <Field label={t.phone} optional={t.optional} value={phone} onChangeText={setPhone} autoComplete="tel" keyboardType="phone-pad" />

            <Text v="bodyMedium" style={{ marginTop: space.sm }}>
              {t.region}
            </Text>
            <Text v="smallMedium">{t.country}</Text>
            <View style={styles.chips}>
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setCountry(c);
                    setRegion("");
                    setPlace("");
                  }}
                  style={[styles.chip, country === c && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: country === c }}
                >
                  <Text v="smallMedium" color={country === c ? "#fff" : colors.ink}>
                    {countryName(lang, c)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.country ? <Text v="small" color={colors.error}>{errors.country}</Text> : null}

            <Text v="smallMedium">{t.regionLabel}</Text>
            <Pressable
              onPress={() => country && setPicking(true)}
              style={[styles.select, !country && { backgroundColor: colors.ground }, errors.region ? { borderColor: colors.error } : null]}
              accessibilityRole="button"
              accessibilityLabel={t.regionLabel}
            >
              <Text v="body" color={chosen ? colors.ink : colors.faint} style={{ flex: 1 }}>
                {chosen && country ? regionLabel(chosen, country, lang) : country ? t.regionPlaceholder : t.regionFirst}
              </Text>
              <Icon name="chevron-down" size={18} color={colors.faint} />
            </Pressable>
            {errors.region ? <Text v="small" color={colors.error}>{errors.region}</Text> : null}

            {region ? (
              <>
                <Field label={t.place} optional={t.optional} value={place} onChangeText={setPlace} autoComplete="address-line2" />
                <View style={styles.chips}>
                  {towns.slice(0, 8).map((town) => (
                    <Pressable key={town} onPress={() => setPlace(town)} style={[styles.chip, place === town && styles.chipOn]}>
                      <Text v="small" color={place === town ? "#fff" : colors.ink}>
                        {town}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text v="smallMedium">{t.count}</Text>
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setCount(n)} style={[styles.chip, styles.countChip, count === n && styles.chipOn]}>
                  <Text v="smallMedium" color={count === n ? "#fff" : colors.ink}>
                    {n === 5 ? "5+" : n}
                  </Text>
                </Pressable>
              ))}
            </View>

            {country === "FI" ? (
              <Field
                label={t.nettimokki}
                optional={t.optional}
                value={nettimokki}
                onChangeText={setNettimokki}
                placeholder="https://www.nettimokki.com/…"
                keyboardType="url"
                autoCapitalize="none"
                error={errors.nettimokki}
              />
            ) : null}
            <Field label={t.message} optional={t.optional} value={message} onChangeText={setMessage} multiline maxLength={2000} />

            <Pressable onPress={() => setConsent(!consent)} style={styles.consent} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
              <Icon name={consent ? "checkbox" : "square-outline"} size={24} color={errors.consent ? colors.error : colors.green} />
              <Text v="small" style={{ flex: 1 }}>
                {t.consent}
              </Text>
            </Pressable>
            <Button kind="ghost" small label={t.privacyLink} onPress={() => openSite(`/${lang}/privacy`)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
            {errors.consent ? <Text v="small" color={colors.error}>{errors.consent}</Text> : null}
            {errors.form ? <Problem text={errors.form} /> : null}
            <Button label={busy ? t.sending : t.submit} busy={busy} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: colors.page }}>
          <SheetBar title={t.regionLabel} onClose={() => setPicking(false)} />
          <ScrollView>
            {regions.map((r, i) => (
              <Row
                key={r.id}
                label={regionLabel(r, country as Country, lang)}
                right={region === r.id ? <Icon name="checkmark" size={20} color={colors.green} /> : undefined}
                onPress={() => {
                  setRegion(r.id);
                  setPlace("");
                  setPicking(false);
                }}
                last={i === regions.length - 1}
              />
            ))}
          </ScrollView>
          <ModalFoot>
            <Button kind="ghost" label={m.app.common.cancel} onPress={() => setPicking(false)} />
          </ModalFoot>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  why: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  countChip: { minWidth: 48, alignItems: "center" },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  consent: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
});
