import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#152C29' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontSize: 18, fontWeight: '600' },
        animation: 'fade_from_bottom',
        animationDuration: 300,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={({ navigation }) => ({
          headerTitle: 'Login / Register',
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.getParent()?.goBack()}
              style={styles.backButton}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          headerTitle: 'Register',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: 8,
    padding: 4,
  },
});
