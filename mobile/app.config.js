// app.json, plus the Google Maps key for Android from mobile/.env (GOOGLE_MAPS_ANDROID_KEY),
// so the key stays out of git. Set it with: bash ~/stugora/deploy/set-android-maps-key.sh
// The key goes to react-native-maps' own plugin (which otherwise removes it from the manifest),
// and to android.config.googleMaps; extra.googleMapsAndroid tells the app to use it (ui/maps.android.tsx).
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY;
  if (!key) return config;
  const plugins = (config.plugins ?? []).map((p) =>
    p === "react-native-maps" || (Array.isArray(p) && p[0] === "react-native-maps")
      ? ["react-native-maps", { ...(Array.isArray(p) ? p[1] : {}), androidGoogleMapsApiKey: key }]
      : p,
  );
  return {
    ...config,
    plugins,
    android: { ...config.android, config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } } },
    // Expo leaves android.config out of the settings the app can read, so the app is told by a flag.
    extra: { ...(config.extra ?? {}), googleMapsAndroid: true },
  };
};
