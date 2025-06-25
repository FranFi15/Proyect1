// app/(tabs)/_layout.js
import { Tabs } from 'expo-router';
// Opcional: Importar íconos
// import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="calendar" options={{ title: 'Calendario' /*, tabBarIcon: ... */ }} />
      <Tabs.Screen name="my-classes" options={{ title: 'Mis Clases' }} />
      <Tabs.Screen name="profile" options={{ title: 'Mi Perfil' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notificaciones' }} />
    </Tabs>
  );
}