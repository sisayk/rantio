import { ScrollView, View } from "react-native";

import { useT } from "@/text/i18n";
import { colors, space } from "@/theme";
import { MonitorDetails } from "@/ui/monitor";
import { PageBar } from "@/ui/screen";

/** Menu → Mökki monitor: the cottage alert box, coming soon, and its waitlist. */
export default function Monitor() {
  const { m } = useT();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <PageBar title={m.owner.monitor.title.split(":")[0]} />
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl * 2 }}>
        <MonitorDetails />
      </ScrollView>
    </View>
  );
}
