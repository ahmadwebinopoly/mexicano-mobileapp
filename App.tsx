import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/montserrat';
import { Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import RootNavigator from './src/navigation/RootNavigator';
import * as Notifications from 'expo-notifications';
import { getToken } from './src/storagetank';
import { registerForPushNotifications } from './src/services/pushNotifications';

export default function App() {
  useEffect(() => {
    const initPush = async () => {
      const token = await getToken();
      if (token) {
        void registerForPushNotifications();
      }
    };
    void initPush();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      // User tapped notification – app opens
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
    <>
      <RootNavigator />
      <StatusBar style="light" />
    </>
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
