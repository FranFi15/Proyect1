import React from 'react';
import { View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import {
  SwipeableTabs,
  SwipeableTabsHeader,
  SwipeableBottomTabBar,
  getSwipeableTabScreenOptions,
} from '../../components/SwipeableTabs';

export const unstable_settings = {
  initialRouteName: 'clients',
};

export default function AdminTabsLayout() {
  const { gymColor } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const inactiveColor = Colors[colorScheme].icon;
  const backgroundColor = Colors[colorScheme].cardBackground;

  return (
    <View style={{ flex: 1 }}>
      <SwipeableTabsHeader backgroundColor={gymColor} />
      <SwipeableTabs
        style={{ flex: 1 }}
        tabBarPosition="bottom"
        screenOptions={getSwipeableTabScreenOptions()}
        tabBar={(props) => (
          <SwipeableBottomTabBar
            {...props}
            activeColor={gymColor}
            inactiveColor={inactiveColor}
            backgroundColor={backgroundColor}
          />
        )}
      >
        <SwipeableTabs.Screen
          name="clients"
          options={{
            title: 'Usuarios',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <SwipeableTabs.Screen
          name="class-type"
          options={{
            title: 'Créditos',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'list' : 'list-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <SwipeableTabs.Screen
          name="classes"
          options={{
            title: 'Turnos',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'calendar' : 'calendar-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <SwipeableTabs.Screen
          name="notifications"
          options={{
            title: 'Notificar',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <SwipeableTabs.Screen
          name="profile"
          options={{
            title: 'Mi Perfil',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
      </SwipeableTabs>
    </View>
  );
}
