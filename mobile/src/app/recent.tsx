import { useRouter } from "expo-router";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { RECENT } from "@/i18n/messages/recent";
import { getListing, type Listing } from "@/lib/listings";
import { usePrefs } from "@/state/prefs";
import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { Button, Empty } from "@/ui/kit";
import { ListingCard } from "@/ui/listing";
import { PageBar } from "@/ui/screen";

/** Explore → Recently viewed → the arrow: every cottage opened on this phone, newest first. */
export default function Recent() {
  const { m, lang } = useT();
  const t = RECENT[lang];
  const { viewed, clearViewed } = usePrefs();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listings = viewed.map(getListing).filter((l): l is Listing => !!l);
  const columns = width >= 700 ? 3 : 2;
  const cardWidth = (width - space.xl * 2 - (columns - 1) * space.md) / columns;
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar
        title={t.title}
        right={listings.length ? <Button small kind="ghost" label={t.clear} onPress={clearViewed} /> : null}
      />
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }}>
        {listings.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: space.lg }}>
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} width={cardWidth} compact />
            ))}
          </View>
        ) : (
          <Empty icon="time-outline" title={t.title} action={<Button label={m.app.saved.browse} onPress={() => router.navigate("/explore")} />} />
        )}
      </ScrollView>
    </View>
  );
}
