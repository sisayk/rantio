// The app shares the website's words, cottages and formatting code (frontend/src),
// so Metro watches that folder too. Imports "@/…" look in mobile/src first, then in
// frontend/src (see tsconfig.json).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../frontend/src")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
