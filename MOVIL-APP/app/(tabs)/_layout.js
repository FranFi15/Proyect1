// app/(tabs)/_layout.js
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
        tabBarActiveTintColor: '#150224',
      }}>
      <Tabs.Screen 
        name="calendar" 
        options={{ 
          title: 'Calendario',
          // 2. Usamos la opción tabBarIcon, que es una función
          tabBarIcon: ({ color, size, focused }) => (
            // 3. Renderizamos un icono diferente si la pestaña está activa (focused) o no
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
              name={focused ? 'list-circle' : 'list-outline'} 
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