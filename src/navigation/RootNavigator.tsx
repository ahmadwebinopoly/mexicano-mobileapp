import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { rootNavigationRef } from './rootNavigationRef';
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
import LoginRegisterScreen from '../screens/auth/LoginRegisterScreen';
import ViewOrderDetailsScreen from '../screens/order/ViewOrderDetailsScreen.tsx';
import type { ItemDetailParamItem } from '../screens/main/ItemDetailScreen';
import { CartProvider } from '../contexts/CartContext';

const isAuthenticated = true;

export type RootStackParamList = {
  Splash: undefined;
  OnBoarding: undefined;
  Main: undefined;
  ItemDetail: { item: ItemDetailParamItem };
  Checkout: undefined;
  Cart: undefined;
  Address: { savedAddress?: { latitude: number; longitude: number; address: string; city?: string; state?: string; zipCode?: string; customerLocation?: string } } | undefined;
  Map: {
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  LoginRegister: { returnTo?: 'Checkout' } | undefined;
  Orders: { showOrderSuccessToast?: boolean } | undefined;
  ViewOrderDetails: { orderId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <CartProvider>
      <NavigationContainer ref={rootNavigationRef}>
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
        <Stack.Screen name="LoginRegister" component={LoginRegisterScreen} />
        <Stack.Screen name="Address" component={AddressScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="ViewOrderDetails" component={ViewOrderDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </CartProvider>
  );
}
