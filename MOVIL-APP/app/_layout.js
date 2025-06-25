// app/_layout.js
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router'; // 1. Importa useRouter y useSegments
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ActivityIndicator } from 'react-native';

const RootLayout = () => {
  const { user, isLoading } = useAuth();
  const segments = useSegments(); // 2. Obtiene los segmentos de la ruta actual
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return; // No hagas nada mientras se está cargando el estado inicial
    }

    const inTabsGroup = segments[0] === '(tabs)'; // 3. Verifica si estás en el área principal de la app

    if (user && !inTabsGroup) {
      // 4. Si hay usuario PERO NO estás en las pestañas, redirige a ellas
      router.replace('/calendar');
    } else if (!user && inTabsGroup) {
      // 5. Si NO hay usuario PERO SÍ estás en las pestañas, redirige al login
      router.replace('/');
    }
  }, [user, segments, isLoading]); // El efecto se ejecuta cuando cambia el usuario o la ruta

  // Mientras se decide a dónde ir, podemos mostrar un indicador de carga
  if (isLoading) {
    return <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center' }} />;
  }
  
  // Devuelve el Stack para que Expo Router maneje el renderizado de las pantallas
  return <Stack screenOptions={{ headerShown: false }} />;
};

export default function AppLayout() {
  return (
    <AuthProvider>
      <RootLayout />
    </AuthProvider>
  );
}