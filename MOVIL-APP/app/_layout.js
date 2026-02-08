import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Platform, Alert, AppState, View, ActivityIndicator, StyleSheet } from 'react-native';
import notificationService from '../services/notificationService';
import userService from '../services/userService';
import ImportantNotificationModal from '../components/ImportantNotificationModal';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';



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



export default function RootLayout() {
    const appState = useRef(AppState.currentState); 
    const [isReady, setIsReady] = useState(true);
     
    useEffect(() => {
        // Este código solo se ejecutará en la plataforma web.
        if (Platform.OS === 'web') {
            const style = document.createElement('style');
            style.textContent = `
                ::-webkit-scrollbar { display: none; }
                body { scrollbar-width: none; }
                body { -ms-overflow-style: none; }
            `;
            document.head.appendChild(style);
        }

        // 2. Lógica del UI Buffer para evitar Crash en Android
        const subscription = AppState.addEventListener('change', nextAppState => {
            // Detectamos si la app vuelve de 'background' o 'inactive' a 'active'
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                setIsReady(false); // Desmontamos la app
                
                // Esperamos 100ms para que Android prepare la vista
                setTimeout(() => {
                    setIsReady(true); // Volvemos a montar
                }, 100);
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);
    
    // 3. Renderizado condicional: Si no está lista, mostramos Spinner
    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.backgroundColor} />
            </View>
        );
    }

    return (
         <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </GestureHandlerRootView>
    );
}

function AppContent() {
    const { user, 
        clientId, 
        loading, 
        refreshUser, 
        sessionAlertVisible, 
        handleSessionExpiredConfirm,
        gymColor } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const [modalVisible, setModalVisible] = useState(false);
    const [currentImportantNotification, setCurrentImportantNotification] = useState(null);
    const notificationListener = useRef();
    const responseListener = useRef();

    const [isSplashHidden, setIsSplashHidden] = useState(false);

    const navigationState = useRootNavigationState();

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
        if (loading || !navigationState?.key) return;

        if (!isSplashHidden) {
            SplashScreen.hideAsync()
                .then(() => setIsSplashHidden(true))
                .catch((err) => {
                });
        }

        const isResetPasswordScreen = segments.some(s => s === 'reset-password');

        if (isResetPasswordScreen) {
            return;
        }

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
    }, [loading, user, clientId, segments, router, navigationState?.key]); 

    useEffect(() => {
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
              if (error.message === 'SESSION_EXPIRED' || error?.response?.status === 401) {
              } else {
                  console.error("Error polling notifications:", error);
              }
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
       <View
            style={{ flex: 1 }}
        >
            <Slot />
            
            <ImportantNotificationModal
                visible={modalVisible}
                notification={currentImportantNotification}
                onClose={handleModalClose}
            />
            {sessionAlertVisible && (
                <View style={styles.absoluteBlocker} />
            )}
            <CustomAlert
                visible={sessionAlertVisible}
                title="Sesión Expirada"
                message="Por seguridad, tu sesión ha caducado. Por favor, vuelve a iniciar sesión."
                onClose={() => {}} 
                gymColor={gymColor}
                buttons={[
                    {
                        text: "OK, Entendido",
                        style: "primary",
                        onPress: handleSessionExpiredConfirm
                    }
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({ // <--- NUEVO
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundColor, 
    },
    absoluteBlocker: {
        ...StyleSheet.absoluteFillObject, 
        backgroundColor: 'rgba(0,0,0,0.2)', 
        zIndex: 9999, 
        elevation: 10, 
    }
});
