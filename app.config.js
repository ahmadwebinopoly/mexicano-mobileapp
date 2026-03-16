// Project ID for EAS / push notifications (required for builds and notifications)
const EAS_PROJECT_ID = 'f2eabc34-f5c5-4951-b986-f073deb5d948';

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
      package: 'com.mexicanoapp',
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
        projectId: EAS_PROJECT_ID,
      },
    },
  },
};
