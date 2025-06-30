import React from 'react';
import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext'; // Asegúrate de que la ruta sea correcta

// Componente personalizado que busca y muestra el logo del gimnasio.
function HeaderLogoTitle() {
  const { gymLogo } = useAuth();

  // Si no hay logo, no mostramos nada. La cabecera aparecerá vacía.
  if (!gymLogo) {
    return null;
  }

  // Si hay logo, mostramos el componente Image.
  return (
    <Image
      style={{ width: 120, height: 40, resizeMode: 'contain' }}
      source={{ uri: gymLogo }}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: '#150224',
        // --- OPCIONES DE CABECERA AÑADIDAS ---
        headerTitleAlign: 'center',
        headerTitle: (props) => <HeaderLogoTitle {...props} />, 
        headerStyle: {
          backgroundColor: '#150224', 
        },
      }}
    >
      <Tabs.Screen 
        name="calendar" 
        options={{ 
          title: 'Calendario',
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
        name="my-classes" 
        options={{ 
          title: 'Mis Clases',
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
        name="notifications" 
        options={{ 
          title: 'Notificaciones',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'notifications' : 'notifications-outline'} 
              size={size} 
              color={color} 
            />
          ),
        }} 
      />
    </Tabs>
  );
}