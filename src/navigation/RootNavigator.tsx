import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { rootNavigationRef, flushPendingPushNavigation } from './rootNavigationRef';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import SplashScreen from '../screens/SplashScreen';
import OnBoardingScreen from '../screens/OnBoardingScreen';
import ItemDetailScreen from '../screens/main/ItemDetailScreen';
import AddressScreen from '../screens/main/AddressScreen';
import MapScreen from '../screens/main/MapScreen';
import OrdersScreen from '../screens/main/OrdersScreen';
import CheckoutScreen from '../screens/order/CheckoutScreen';
import CartScreen from '../screens/main/CartScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import SetNewPasswordScreen from '../screens/auth/SetNewPasswordScreen';
import ViewOrderDetailsScreen from '../screens/order/ViewOrderDetailsScreen';
import RateYourFeastScreen from '../screens/main/RateYourFeastScreen';
import WishlistScreen from '../screens/main/WishlistScreen';
import type { ItemDetailParamItem } from '../screens/main/ItemDetailScreen';
import { CartProvider } from '../contexts/CartContext';

const isAuthenticated = true;

export type RootStackParamList = {
  Splash: undefined;
  OnBoarding: undefined;
  Main: undefined;
  ItemDetail: { item: ItemDetailParamItem; cartItemId?: string };
  Checkout: undefined;
  Cart: undefined;
  Address: { savedAddress?: { latitude: number; longitude: number; address: string; city?: string; state?: string; zipCode?: string; customerLocation?: string } } | undefined;
  Map: {
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  Login: { returnTo?: 'Checkout' } | undefined;
  Register: { returnTo?: 'Checkout' } | undefined;
  ForgotPassword: undefined;
  SetNewPassword: { token?: string } | undefined;
  Orders: { showOrderSuccessToast?: boolean; initialTab?: 'all' | 'current' | 'history' } | undefined;
  ViewOrderDetails: { orderId: string };
  Wishlist: undefined;
  RateYourFeast: { orderId: string; items: string; amount: string; orderType?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  // Support:
  // - app scheme links: mexicanoapp://reset-password?token=...
  // - https links from backend email: https://phpstack-...cloudwaysapps.com/reset-password?token=...
  prefixes: [
    'mexicanoapp://',
    Linking.createURL('/'),
    'https://phpstack-1046663-6238875.cloudwaysapps.com',
    'http://phpstack-1046663-6238875.cloudwaysapps.com',
  ],
  config: {
    screens: {
      SetNewPassword: {
        path: 'reset-password',
        parse: {
          token: (t: string) => String(t ?? ''),
        },
      },
    },
  },
};

export default function RootNavigator() {
  return (
    <CartProvider>
      <NavigationContainer
        ref={rootNavigationRef}
        linking={linking}
        onReady={() => {
          flushPendingPushNavigation();
        }}
      >
        <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 350,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Splash">
          {(props) => (
            <SplashScreen onFinish={() => props.navigation.replace('OnBoarding')} />
          )}
        </Stack.Screen>
        <Stack.Screen name="OnBoarding">
          {(props) => (
            <OnBoardingScreen onFinish={() => props.navigation.replace('Main')} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Main">
          {() => (isAuthenticated ? <MainTabNavigator /> : <AuthNavigator />)}
        </Stack.Screen>
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="SetNewPassword" component={SetNewPasswordScreen} />
        <Stack.Screen name="Address" component={AddressScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="ViewOrderDetails" component={ViewOrderDetailsScreen} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} />
        <Stack.Screen name="RateYourFeast" component={RateYourFeastScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </CartProvider>
  );
}
