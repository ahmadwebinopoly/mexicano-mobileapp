import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import MenuScreen from '../screens/main/MenuScreen';
import ContactScreen from '../screens/extra/ContactScreen';
import StoryScreen from '../screens/extra/StoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_BAR_BG = '#152C29';

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BAR_BG,
    height: 80,
    paddingBottom: 5,
    paddingTop: 5,
    paddingLeft: 5,
    paddingRight: 5,
    borderTopWidth: 0,
    position: 'absolute',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarActiveTintColor: '#FFC107',
        tabBarInactiveTintColor: '#FFFFFF',
        tabBarIcon: ({ color }) => {
          let icon;

          switch (route.name) {
            case 'Discover':
              icon = <FontAwesome5 name="compass" size={20} color={color} />;
              break;
            case 'Menu':
              icon = <MaterialIcons name="menu-book" size={20} color={color} />;
              break;
            case 'Story':
              icon = <Ionicons name="book-outline" size={20} color={color} />;
              break;
            case 'Contact':
              icon = <Ionicons name="chatbubble-outline" size={20} color={color} />;
              break;
            case 'Profile':
              icon = <Ionicons name="person-outline" size={20} color={color} />;
              break;
            default:
              icon = null;
          }

          return <View style={styles.iconContainer}>{icon}</View>;
        },
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Story" component={StoryScreen} />
      <Tab.Screen name="Contact" component={ContactScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
