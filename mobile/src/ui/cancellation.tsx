// The host's cancellation policy as a guest reads it: the dates for the chosen stay, or the
// policy's rule before dates are picked (lib/cancellation.ts, shared with the website).
import { View } from "react-native";

import { LANG_INFO } from "@/i18n/locales";
import { CANCELLATION } from "@/i18n/messages/cancellation";
import { guestLines, LONG_STAY_NIGHTS, type LongPolicy, type Policy } from "@/lib/cancellation";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Text } from "@/ui/kit";

/** Today as "YYYY-MM-DD" on this phone. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function useCancellationLines(o: { policy: Policy; longPolicy: LongPolicy; checkIn: string | null; checkOut: string | null; nights: number; today?: string; time?: string | null }) {
  const { lang } = useT();
  const t = CANCELLATION[lang];
  const fmt = new Intl.DateTimeFormat(LANG_INFO[lang].intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const lines = guestLines(t, {
    policy: o.policy,
    longPolicy: o.longPolicy,
    checkIn: o.checkIn && o.checkOut ? o.checkIn : null,
    nights: o.nights,
    today: o.today ?? localToday(),
    time: o.time ?? "15:00",
    day: (d) => fmt.format(new Date(`${d}T12:00Z`)),
  });
  return { title: t.title, name: o.nights >= LONG_STAY_NIGHTS ? t.longNames[o.longPolicy] : t.names[o.policy], lines, window: o.nights < LONG_STAY_NIGHTS ? t.window : null };
}

/** A titled block: the policy's name, its dates or rule, and the 24-hour window. */
export function CancellationInfo(props: Parameters<typeof useCancellationLines>[0] & { note?: string }) {
  const c = useCancellationLines(props);
  return (
    <View style={{ gap: space.xs }}>
      <Text v="h3">
        {c.title} · {c.name}
      </Text>
      {c.lines.map((line) => (
        <Text key={line} v="small">
          {line}
        </Text>
      ))}
      {c.window ? (
        <Text v="tiny" color={colors.soft}>
          {c.window}
        </Text>
      ) : null}
      {props.note ? (
        <Text v="tiny" color={colors.soft}>
          {props.note}
        </Text>
      ) : null}
    </View>
  );
}
