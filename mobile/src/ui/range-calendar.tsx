// Picking a stay: months one under another, tap the arrival day and then the departure
// day, as in Airbnb's app. Taken nights can't be chosen and a stay can't cross them.
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { Lang } from "@/i18n/locales";
import { addDays, addMonths, formatDate, MONTH_YEAR, monthStart, parseISO, toISO, todayISO, weekdayNames } from "@/text/dates";
import { colors, space } from "@/theme";
import { tap, Text } from "@/ui/kit";

type Props = {
  lang: Lang;
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  /** Nights that are taken (a night is the day you sleep there). */
  takenNight?: (day: string) => boolean;
  months?: number;
  firstMonth?: string;
  /** Usually cheaper or pricier nights, tinted green and red as on Airbnb (lib/priceHints). */
  hint?: (day: string) => "low" | "high" | null;
};

export function monthDays(month: string): (string | null)[] {
  const first = parseISO(monthStart(month));
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days: (string | null)[] = Array(lead).fill(null);
  const d = new Date(first);
  while (d.getMonth() === first.getMonth()) {
    days.push(toISO(d));
    d.setDate(d.getDate() + 1);
  }
  while (days.length % 7) days.push(null);
  return days;
}

export function RangeCalendar({ lang, start, end, onChange, takenNight = () => false, months = 12, firstMonth, hint }: Props) {
  const today = todayISO();
  const from = monthStart(firstMonth ?? today);
  const weekdays = useMemo(() => weekdayNames(lang), [lang]);

  // With an arrival chosen, the departure can be any day up to the next taken night.
  const lastDeparture = useMemo(() => {
    if (!start || end) return null;
    let d = start;
    for (let i = 0; i < 400; i++) {
      if (takenNight(d)) return d;
      d = addDays(d, 1);
    }
    return d;
  }, [start, end, takenNight]);

  const pick = (day: string) => {
    tap();
    if (!start || end || day <= start) {
      if (takenNight(day)) return;
      onChange(day, null);
    } else if (lastDeparture && day > lastDeparture) {
      if (!takenNight(day)) onChange(day, null);
    } else onChange(start, day);
  };

  return (
    <View style={{ gap: space.xl }}>
      <View style={styles.week}>
        {weekdays.map((w, i) => (
          <Text key={i} v="tiny" style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: months }, (_, i) => addMonths(from, i)).map((month) => (
        <Month
          key={month}
          lang={lang}
          month={month}
          today={today}
          start={start}
          end={end}
          lastDeparture={lastDeparture}
          takenNight={takenNight}
          hint={hint}
          onPick={pick}
        />
      ))}
    </View>
  );
}

const Month = memo(function Month({
  lang,
  month,
  today,
  start,
  end,
  lastDeparture,
  takenNight,
  hint,
  onPick,
}: {
  lang: Lang;
  month: string;
  today: string;
  start: string | null;
  end: string | null;
  lastDeparture: string | null;
  takenNight: (d: string) => boolean;
  hint?: (d: string) => "low" | "high" | null;
  onPick: (d: string) => void;
}) {
  const days = monthDays(month);
  return (
    <View>
      <Text v="h3" style={{ marginBottom: space.sm, paddingHorizontal: 4, textTransform: "capitalize" }}>
        {formatDate(lang, month, MONTH_YEAR)}
      </Text>
      <View style={styles.grid}>
        {days.map((day, i) => {
          if (!day) return <View key={`b${i}`} style={styles.cell} />;
          const past = day < today;
          const choosingEnd = !!start && !end && day > start;
          const disabled = past || (choosingEnd ? !!lastDeparture && day > lastDeparture : takenNight(day));
          const isStart = day === start;
          const isEnd = day === end;
          const inside = !!start && !!end && day > start && day < end;
          const tint = !disabled && hint ? hint(day) : null;
          return (
            <Pressable
              key={day}
              disabled={disabled}
              onPress={() => onPick(day)}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: isStart || isEnd }}
              accessibilityLabel={formatDate(lang, day, { weekday: "long", day: "numeric", month: "long" })}
            >
              {(inside || (isStart && end) || isEnd) && (
                <View style={[styles.band, isStart && { left: "50%" }, isEnd && { right: "50%" }]} />
              )}
              <View style={[styles.day, tint && !inside && !isStart && !isEnd && styles[tint], (isStart || isEnd) && styles.dayOn]}>
                <Text
                  v="smallMedium"
                  color={isStart || isEnd ? "#fff" : disabled ? colors.faint : tint && !inside ? TINT_TEXT[tint] : colors.ink}
                  style={disabled && !past ? { textDecorationLine: "line-through" } : undefined}
                >
                  {parseISO(day).getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  week: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingBottom: space.sm },
  weekday: { width: `${100 / 7}%`, textAlign: "center", textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: "center", justifyContent: "center" },
  band: { position: "absolute", top: 4, bottom: 4, left: 0, right: 0, backgroundColor: colors.greenTint },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  dayOn: { backgroundColor: colors.green },
  low: { backgroundColor: "#e6f4ea" },
  high: { backgroundColor: "#fdecea" },
});

const TINT_TEXT = { low: "#1e7a3c", high: colors.error } as const;
