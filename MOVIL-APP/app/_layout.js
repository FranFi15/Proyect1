import React, { useEffect, useState, useCallback, useRef } from 'react';
// ---> CORRECCIÓN: Se elimina 'Stack' y se mantiene 'Slot'
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import notificationService from '../services/notificationService';
import userService from '../services/userService';
import ImportantNotificationModal from '../components/ImportantNotificationModal';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

const findMostRecentImportantUnread = (notifications) => {
    if (!notifications || notifications.length === 0) return null;
    const unreadImportant = notifications.filter(n => !n.read && n.isImportant);
    if (unreadImportant.length === 0) return null;
    return unreadImportant.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
};

async function registerForPushNotificationsAsync(userId, updatePushTokenBackend) {
    let token;
    if (!Device.isDevice) {
        Alert.alert('Funcionalidad no disponible', 'Las notificaciones push solo funcionan en dispositivos físicos.');
        return;
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        Alert.alert('Permiso de Notificaciones', 'No se concedió permiso para recibir notificaciones push.');
        return;
    }
    
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            throw new Error("El ID del proyecto de Expo no se encuentra en app.json. Asegúrate de que extra.eas.projectId esté configurado.");
        }
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('Expo Push Token:', token);
    } catch (e) {
        console.error('Error obteniendo el Expo Push Token:', e);
        Alert.alert("Error de Notificaciones", `No se pudo obtener el token para notificaciones: ${e.message}`);
        return;
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (token && userId) {
        try {
            await updatePushTokenBackend(token);
        } catch (error) {
            console.error('Failed to send push token to backend:', error);
        }
    }
    return token;
}


export default function RootLayout() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

function AppContent() {
    const { user, clientId, loading, refreshUser } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const [modalVisible, setModalVisible] = useState(false);
    const [currentImportantNotification, setCurrentImportantNotification] = useState(null);
    const notificationListener = useRef();
    const responseListener = useRef();

    const updatePushTokenBackend = useCallback(async (token) => {
        try {
            await userService.updateUserPushToken(token); 
            console.log("Token de push enviado al backend con éxito.");
        } catch (error) {
            console.error("Error al enviar el token de push al backend:", error);
        }
    }, []);

    const handleModalClose = useCallback(async () => {
        if (currentImportantNotification) {
            try {
                await notificationService.markNotificationAsRead(currentImportantNotification._id);
                refreshUser(); 
            } catch (error) {
                console.error("Error marking important notification as read:", error);
            }
        }
        setModalVisible(false);
        setCurrentImportantNotification(null);
    }, [currentImportantNotification, refreshUser]);

    useEffect(() => {
        if (loading) return;

        SplashScreen.hideAsync();

        const inAuthGroup = segments[0] === '(auth)';
        
        if (!user) {
            if (!clientId) {
                router.replace('/(auth)/gymIdentifier');
            } else if (!inAuthGroup) {
                router.replace('/(auth)/login');
            }
        } else {
            const isAdmin = user.roles && user.roles.includes('admin');
            const isProfessor = user.roles && user.roles.includes('profesor');

            if (isAdmin) {
                const inAdminTabs = segments[0] === '(admin-tabs)';
                if (!inAdminTabs) {
                    router.replace('/(admin-tabs)');
                }
            } else if (isProfessor) {
                const inProfessorTabs = segments[0] === '(profesor-tabs)';
                if (!inProfessorTabs) {
                    router.replace('/(profesor-tabs)');
                }
            } else {
                const inClientTabs = segments[0] === '(tabs)';
                if (!inClientTabs) {
                    router.replace('/(tabs)');
                }
            }
        }
    }, [loading, user, clientId, segments, router]); 

    useEffect(() => {
        if (user && !loading) {
            registerForPushNotificationsAsync(user._id, updatePushTokenBackend);
        }

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notificación recibida en primer plano:', notification);
            refreshUser();
            
            const { data } = notification.request.content;
            if (data && data.isImportant) { 
                setCurrentImportantNotification({ _id: data.notificationId, ...data });
                setModalVisible(true);
            }
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('El usuario ha interactuado con una notificación:', response);
            const data = response.notification.request.content.data;
            
            if (data?.isImportant && data?.notificationId) {
                handleModalClose();
            }

            if (data?.classId) {
                router.push('/(tabs)/calendar');
            } else {
                router.push('/(tabs)/notifications');
            }
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [user, loading, updatePushTokenBackend, handleModalClose, router, refreshUser]);

   useEffect(() => {
        let intervalId;
        if (user && !loading) {
          const checkImportantNotificationsPolling = async () => { 
            try {
              const notifications = await notificationService.getNotifications();
              const mostRecentImportantUnread = findMostRecentImportantUnread(notifications);
              if (mostRecentImportantUnread) {
                setCurrentImportantNotification(mostRecentImportantUnread);
                setModalVisible(true);
              }
            } catch (error) {
              console.error("Error checking for important notifications (polling):", error);
            }
          };

          checkImportantNotificationsPolling();
          intervalId = setInterval(checkImportantNotificationsPolling, 5 * 60 * 1000);
        }
        return () => {
          if (intervalId) clearInterval(intervalId);
        };
   }, [user, loading, refreshUser]); 

    return (
        <>
            {/* ---> CORRECCIÓN: Se reemplaza el <Stack> por <Slot />.
                 Slot renderizará el layout hijo correcto ((auth), (tabs), etc.)
                 basado en la URL, que es manejada por la lógica de redirección de arriba. */}
            <Slot />
            
            <ImportantNotificationModal
                visible={modalVisible}
                notification={currentImportantNotification}
                onClose={handleModalClose}
            />
        </>
    );
}
