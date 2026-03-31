import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from '@expo-google-fonts/montserrat';
import { Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import RootNavigator from './src/navigation/RootNavigator';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from './src/services/pushNotifications';
import { navigateToOrderFromPush } from './src/navigation/rootNavigationRef';

export default function App() {
  useEffect(() => {
    const initPush = async () => {
      // Register token even before login; API will include auth header if available.
      void registerForPushNotifications();
    };
    void initPush();
  }, []);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = (response as any)?.notification?.request?.content?.data ?? {};
      const type = String((data as any)?.type ?? '');
      if (type !== 'order_status') return;
      const rawOrderId = String((data as any)?.orderId ?? '').trim();
      const parsedOrderId = rawOrderId.replace(/[^\d]/g, '') || rawOrderId.replace(/^#/, '');
      if (!parsedOrderId) return;
      navigateToOrderFromPush(parsedOrderId);
    };

    // Cold start: app opened by tapping a notification
    void Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) handleResponse(resp);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response);
    });
    return () => subscription.remove();
  }, []);

  const [fontsLoaded] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FECB4D" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#152C29',
  },
});
