/* eslint-disable @next/next/no-img-element -- small favicons loaded from each listing site */
import { CHANNELS, type ChannelId, channelIcon } from "@/lib/catalog";
import styles from "./owner.module.css";

/** A booking site's own icon and name; Rantio's own enquiries and the owner's own bookings get a letter. */
export default function SiteIcon({
  channel,
  label,
  ownBooking,
  showName = true,
}: {
  channel: string;
  label: string;
  ownBooking: string;
  showName?: boolean;
}) {
  const known = channel in CHANNELS ? (channel as ChannelId) : null;
  const name = known ? CHANNELS[known].name : channel === "owner" ? ownBooking : channel === "direct" ? "Rantio" : label;
  return (
    <span className={styles.site} title={showName ? undefined : name}>
      <span className={styles.siteIcon} aria-hidden="true">
        <span>{name.charAt(0)}</span>
        {known ? <img src={channelIcon(known)} alt="" width={18} height={18} loading="lazy" referrerPolicy="no-referrer" /> : null}
      </span>
      {showName ? name : <span className="visually-hidden">{name}</span>}
    </span>
  );
}
