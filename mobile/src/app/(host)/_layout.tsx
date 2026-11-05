import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";

import { useHost } from "@/state/host";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";
import { TAB_BAR } from "@/ui/tabBar";

/** Hosting: today's stays and requests, the one calendar, guests' messages, earnings. */
export default function HostTabs() {
  const { m } = useT();
  const { signedIn, owner } = useSession();
  const { unread } = useHost();
  if (!signedIn) return <Redirect href="/login" />;
  // Signed in but not hosting yet: listing a cottage comes first.
  if (owner && !owner.is_host) return <Redirect href="/list-cottage" />;
  const t = m.app.tabs;
  return (
    <NativeTabs {...TAB_BAR}>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label>{t.today}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>{t.calendar}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>{t.inbox}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "bubble.left", selected: "bubble.left.fill" }} md="chat" />
        {unread > 0 ? <NativeTabs.Trigger.Badge>{unread > 9 ? "9+" : String(unread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="earnings">
        <NativeTabs.Trigger.Label>{t.earnings}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu">
        <NativeTabs.Trigger.Label>{t.menu}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="line.3.horizontal" md="menu" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
