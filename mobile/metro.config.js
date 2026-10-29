const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Notification read-state helpers are shared with the admin web app.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../shared')];
module.exports = config;
