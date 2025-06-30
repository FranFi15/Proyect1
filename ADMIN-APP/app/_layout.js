import React, { useEffect } from 'react';
import { useRouter, useSegments, Slot } from 'expo-router';
import { AdminAuthProvider, useAdminAuth } from '../contexts/AdminAuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const InitialLayout = () => {
  const { user, isLoading } = useAdminAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/gymIdentifier');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={layoutStyles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
};

export default function RootLayout() {
  return (
    <AdminAuthProvider>
      <InitialLayout />
    </AdminAuthProvider>
  );
}

const layoutStyles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});