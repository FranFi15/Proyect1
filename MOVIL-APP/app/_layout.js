import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';

// Prevenir que la pantalla de carga nativa se oculte automáticamente.
SplashScreen.preventAutoHideAsync();

const InitialLayout = () => {
    // Simplificamos los hooks: ya no necesitamos useRootNavigationState
    const { user, clientId, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        // El único chequeo de preparación que necesitamos es si el estado de autenticación ya cargó.
        if (loading) {
            return;
        }

        // Una vez que 'loading' es false, estamos listos para navegar. Ocultamos la pantalla de carga.
        SplashScreen.hideAsync();

        const inAuthGroup = segments[0] === '(auth)';

        // Prioridad 1: Si no hay un ID de cliente, forzamos su selección.
        if (!clientId) {
            router.replace('/(auth)/gymIdentifier');
            return;
        }

        // Prioridad 2: Si hay cliente pero no usuario, y no estamos en una pantalla de auth, forzamos el login.
        if (!user && !inAuthGroup) {
            router.replace('/(auth)/login');
            return;
        }

        // Prioridad 3: Si hay usuario y está en una pantalla de auth, lo llevamos a la app.
        if (user && inAuthGroup) {
            router.replace('/(tabs)');
            return;
        }

    // La dependencia de 'navigationReady' se ha eliminado.
    }, [loading, user, clientId, segments]);

    // Siempre renderizamos <Slot />. La SplashScreen se encarga de la carga visual.
    // Esto resuelve el error "Attempted to navigate before mounting".
    return <Slot />;
};

// Componente principal del Layout
export default function AppLayout() {
    return (
        <AuthProvider>
            <InitialLayout />
        </AuthProvider>
    );
}
