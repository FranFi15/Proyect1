import { Tabs } from 'expo-router';
import React from 'react';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

function HeaderLogoTitle() {
  const { gymLogo } = useAuth();
  if (!gymLogo) return null;
  return <Image style={{ width: 120, height: 40, resizeMode: 'contain' }} source={{ uri: gymLogo }} />;
}

export default function AdminTabsLayout() {
  const { gymColor } = useAuth();

  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: gymColor || '#007AFF',
        headerTitleAlign: 'center',
        headerTitle: (props) => <HeaderLogoTitle {...props} />,
        headerStyle: { backgroundColor: gymColor || '#FFFFFF' },
      }}
    >
      <Tabs.Screen 
        name="clients" 
        options={{ 
          title: 'Socios',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }} 
      />
      <Tabs.Screen 
        name="classes" 
        options={{ 
          title: 'Clases',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }} 
      />
      <Tabs.Screen 
        name="notifications" 
        options={{ 
          title: 'Notificar',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
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
