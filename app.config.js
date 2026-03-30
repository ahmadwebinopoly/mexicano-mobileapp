// Project ID for EAS / push notifications (required for builds and notifications)
const EAS_PROJECT_ID = 'f2eabc34-f5c5-4951-b986-f073deb5d948';

// Default API base URL (used when EXPO_PUBLIC_API_BASE_URL is not set, e.g. in APK builds)
const DEFAULT_API_BASE_URL = 'https://phpstack-1046663-6238875.cloudwaysapps.com';

module.exports = {
  expo: {
    name: 'MEXICANO',
    slug: 'MexicanoApp',
    plugins: ['expo-notifications'],
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/Masterlogo-icon.png',
    userInterfaceStyle: 'light',

    // ✅ ADD THIS
    updates: {
      url: 'https://u.expo.dev/f2eabc34-f5c5-4951-b986-f073deb5d948',
    },

    // ✅ ADD THIS
    runtimeVersion: {
      policy: 'appVersion',
    },

    // Stripe CardField has known Android device crashes with Fabric/new architecture in some setups.
    newArchEnabled: false,
    jsEngine: 'hermes',
    scheme: 'mexicanoapp',

    splash: {
      image: './assets/Splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },

    ios: {
      supportsTablet: true,
    },

    android: {
      package: 'com.mexicanoapp',
      adaptiveIcon: {
        foregroundImage: './assets/Masterlogo-icon.png',
        backgroundColor: '#0B5D3C',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'resize',
    },

    web: {
      favicon: './assets/favicon.png',
    },

    extra: {
      apiBaseUrl:
        process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },
  },
};