// Rantio's look on phones: the website's green, white surfaces and Hanken Grotesk,
// laid out the way Airbnb's apps are (large titles, photo cards, a calm tab bar).
import { Platform } from "react-native";

export const colors = {
  ink: "#1d2a2e",
  soft: "#5d6a6e",
  faint: "#8a9598",
  line: "#e3e7e5",
  ground: "#f6f7f6",
  page: "#ffffff",
  green: "#1d4c3c",
  greenDeep: "#143a2d",
  greenTint: "#e4efe9",
  lake: "#1b6e8c",
  berry: "#e39a2f",
  berryTint: "#fbefdc",
  error: "#b42318",
  errorTint: "#fdecea",
  heart: "#e0484f",
  scrim: "rgba(29, 42, 46, 0.45)",
};

/** Colours of the calendar's kinds of dates, as on the website's calendar. */
export const calendarColors = {
  booking: colors.green,
  site: "#3d7a64",
  block: "#9aa4a7",
  request: colors.berry,
  clash: colors.error,
};

export const fonts = {
  regular: "HankenGrotesk_400Regular",
  medium: "HankenGrotesk_500Medium",
  semibold: "HankenGrotesk_600SemiBold",
  bold: "HankenGrotesk_800ExtraBold",
};

export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = Platform.select({
  ios: { shadowColor: "#1d2a2e", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 3 },
});

export const shadowFloat = Platform.select({
  ios: { shadowColor: "#1d2a2e", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  default: { elevation: 8 },
});
