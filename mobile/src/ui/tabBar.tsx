// The bottom tab bar's look, shared by the travelling and hosting tabs. On Android it's the
// system's own bar: every name shown, small labels in the app's font, and no round highlight
// behind the selected icon (that pill pushed the names down), so it reads like the iPhone's.
import { Platform } from "react-native";

import { colors, fonts } from "@/theme";

const android = Platform.OS === "android";

export const TAB_BAR = {
  tintColor: colors.green,
  backgroundColor: colors.page,
  indicatorColor: colors.greenTint,
  labelVisibilityMode: "labeled" as const,
  disableIndicator: android,
  labelStyle: {
    default: android ? { fontFamily: fonts.medium, fontSize: 11 } : {},
    selected: android ? { fontFamily: fonts.medium, fontSize: 11, color: colors.green } : { color: colors.green },
  },
};
