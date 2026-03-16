// Read projectId from eas.json (required for push notifications)
let projectId;
try {
  const eas = require('./eas.json');
  projectId = eas?.projectId;
} catch {
  projectId = null;
}

module.exports = {
  expo: {
    name: 'MEXICANO',
    slug: 'MexicanoApp',
    plugins: ['expo-notifications'],
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/Masterlogo.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    jsEngine: 'hermes',
    scheme: 'mexicanoapp',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/Masterlogo.png',
        backgroundColor: '#0B5D3C',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || null,
      eas: {
        projectId: projectId || null,
      },
    },
  },
};
