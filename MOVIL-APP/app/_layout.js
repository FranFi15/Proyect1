import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';

const RootLayout = () => {
    const { user, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        // No hacemos nada hasta que el estado de autenticación esté cargado
        if (isLoading) {
            return;
        }

        // Verificamos si la ruta actual está dentro del grupo principal de la app
        const inTabsGroup = segments[0] === '(tabs)';

        // Si el usuario está logueado pero NO está en el área de pestañas,
        // lo redirigimos a la pantalla principal de la app.
        if (user && !inTabsGroup) {
            router.replace('/(tabs)/calendar');
        } 
        // Si el usuario NO está logueado pero está intentando acceder
        // al área de pestañas, lo expulsamos al login.
        else if (!user && inTabsGroup) {
            router.replace('/(auth)/login');
        }

    }, [user, isLoading, segments]); // El efecto se ejecuta si cambia alguno de estos valores

    // Mientras se verifica el estado, mostramos un indicador de carga.
    // Esto es crucial para evitar que se muestre una pantalla incorrecta por un instante.
    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }
    
    // El componente <Slot /> renderizará el layout correspondiente: (auth) o (tabs).
    return <Slot />;
};

// Envolvemos toda la aplicación en el AuthProvider
export default function AppLayout() {
    return (
        <AuthProvider>
            <RootLayout />
        </AuthProvider>
    );
}