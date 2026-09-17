import React from 'react';
import { View, Text, useColorScheme } from 'react-native';
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
  initialRouteName: 'my-classes',
};

export default function ProfessorTabsLayout() {
  const { user, gymColor } = useAuth();
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
          name="my-classes"
          options={{
            title: 'Mis Turnos',
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
          name="clients"
          options={{
            title: 'Planes',
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
          name="notificar"
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
          name="notifications"
          options={{
            title: 'Notificaciones',
            tabBarIcon: ({ color, size, focused }) => (
              <View>
                <Ionicons
                  name={focused ? 'notifications' : 'notifications-outline'}
                  size={size}
                  color={color}
                />
                {user?.unreadNotificationsCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: -3,
                      backgroundColor: 'red',
                      borderRadius: 8,
                      width: 16,
                      height: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    >
                      {user.unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </View>
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
