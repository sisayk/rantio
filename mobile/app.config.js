// app.json, plus the Google Maps key for Android from mobile/.env (GOOGLE_MAPS_ANDROID_KEY),
// so the key stays out of git. Set it with: bash ~/stugora/deploy/set-android-maps-key.sh
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY;
  if (!key) return config;
  return {
    ...config,
    android: { ...config.android, config: { ...(config.android?.config ?? {}), googleMaps: { apiKey: key } } },
  };
};
