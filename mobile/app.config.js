const app = require('./app.json');

module.exports = () => {
  const config = { ...app.expo };
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    config.plugins = [...(config.plugins || []), ['@react-native-google-signin/google-signin', {
      iosUrlScheme: iosClientId.split('.').reverse().join('.'),
    }]];
  }
  return config;
};
