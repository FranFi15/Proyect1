import { Tabs } from 'expo-router';
import React from 'react';
import { Image, View, Text, useColorScheme, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';

function HeaderLogoTitle() {
  const { gymLogo } = useAuth();
  if (!gymLogo) return null;
  return <Image style={{ width: 120, height: 70, resizeMode: 'contain' }} source={{ uri: gymLogo }} />;
}

export default function ProfessorTabsLayout() {
  const { user, gymColor } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: gymColor, 
        tabBarInactiveTintColor: Colors[colorScheme].icon,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].cardBackground,
        },
        headerStyle: {
          backgroundColor: gymColor,
          shadowColor: 'transparent',
          // 2. Añade la altura condicional aquí
          height: Platform.select({
            ios: 120, 
            android: 80, 
          }),
        },
        headerTitleAlign: 'center',
        headerTitle: (props) => <HeaderLogoTitle {...props} />, 
      }}
    >
      <Tabs.Screen 
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
       <Tabs.Screen 
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
      <Tabs.Screen 
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
      <Tabs.Screen 
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
                <View style={{
                  position: 'absolute', right: -6, top: -3,
                  backgroundColor: 'red', borderRadius: 8,
                  width: 16, height: 16,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                    {user.unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }} 
      />
      <Tabs.Screen 
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
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
