/* eslint-disable @next/next/no-img-element -- small favicons loaded from each listing site */
import { CHANNELS, type ChannelId, channelIcon } from "@/lib/catalog";
import styles from "./guest.module.css";

const SHOWN = 6;

/** Where a cottage can be booked, as each site's own icon; the name shows on hover. */
export default function ChannelIcons({ ids, label, more }: { ids: ChannelId[]; label: string; more: (n: number) => string }) {
  const names = ids.map((id) => CHANNELS[id].name);
  const extra = ids.length - SHOWN;
  return (
    <p className={styles.channels} aria-label={`${label}: ${names.join(", ")}`}>
      {ids.slice(0, SHOWN).map((id) => (
        <span key={id} className={styles.channelIcon} title={CHANNELS[id].name}>
          <span className={styles.channelLetter} aria-hidden="true">
            {CHANNELS[id].name.charAt(0)}
          </span>
          <img src={channelIcon(id)} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />
        </span>
      ))}
      {extra > 0 ? (
        <span className={styles.channelMore} title={names.slice(SHOWN).join(", ")}>
          {more(extra)}
        </span>
      ) : null}
    </p>
  );
}
