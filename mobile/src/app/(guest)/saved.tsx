import { useRouter } from "expo-router";
import { useWindowDimensions, View } from "react-native";

import { getListing, type Listing } from "@/lib/listings";
import { usePrefs } from "@/state/prefs";
import { useT } from "@/text/i18n";
import { space } from "@/theme";
import { Button, Empty } from "@/ui/kit";
import { ListingCard } from "@/ui/listing";
import { TabScreen } from "@/ui/screen";

export default function Saved() {
  const { m } = useT();
  const { saved } = usePrefs();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listings = saved.map(getListing).filter((l): l is Listing => !!l);
  const columns = width >= 700 ? 2 : 1;
  const cardWidth = (width - space.xl * 2 - (columns - 1) * space.lg) / columns;
  return (
    <TabScreen title={m.app.tabs.saved}>
      {listings.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.lg }}>
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} width={cardWidth} />
          ))}
        </View>
      ) : (
        <Empty
          icon="heart-outline"
          title={m.app.saved.empty}
          lead={m.app.saved.emptyLead}
          action={<Button label={m.app.saved.browse} onPress={() => router.navigate("/explore")} />}
        />
      )}
    </TabScreen>
  );
}
