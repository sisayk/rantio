import { Redirect } from "expo-router";

import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";

/** Opens where the person left off: travelling, or hosting when signed in as an owner. */
export default function Start() {
  const { mode } = usePrefs();
  const { signedIn } = useSession();
  return <Redirect href={mode === "hosting" && signedIn ? "/today" : "/explore"} />;
}
