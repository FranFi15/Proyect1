import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    useColorScheme,
    Modal,
    Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons, Octicons } from '@expo/vector-icons';
import { format, parseISO, isValid } from 'date-fns';
import es from 'date-fns/locale/es';
import * as Notifications from 'expo-notifications';
import {registerForPushNotificationsAsync} from '../../services/notificationService';
import apiClient from '../../services/apiClient';

// Importamos los componentes para los modales
import BalanceModal from '@/components/client/BalanceModal';
import PlansAndCreditsModal from '@/components/client/PlansAndCreditsModal';
import EditProfileModal from '@/components/client/EditProfileModal';
import CustomAlert from '@/components/CustomAlert'; 

const ProfileScreen = () => {
    const { logout, user, gymColor, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState(user);
    
    // Estado para manejar la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

     const [activeModal, setActiveModal] = useState(null);

     const [notificationsEnabled, setNotificationsEnabled] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    useFocusEffect(
        useCallback(() => {
            setProfile(user);
        }, [user])
    );

    useEffect(() => {
        const checkNotificationStatus = async () => {
            const { status } = await Notifications.getPermissionsAsync();
            setNotificationsEnabled(status === 'granted');
        };
        checkNotificationStatus();
    }, []);

     const handleNotificationsPress = async () => {
        if (notificationsEnabled) {
            // INTENTO DE DESACTIVAR
            setAlertInfo({
                visible: true,
                title: "Desactivar Notificaciones",
                message: "Hemos guardado tu preferencia. Para dejar de recibir notificaciones por completo, también debes desactivarlas en los ajustes de tu teléfono.",
                buttons: [
                    { 
                        text: "Cancelar", 
                        style: "cancel",
                        onPress: () => setAlertInfo({ visible: false })
                    },
                    { 
                        text: "Ir a Ajustes", 
                        style: "primary",
                        onPress: async () => {
                            try {
                                // Solo si el usuario confirma, actualizamos el backend y el estado
                                await apiClient.put('/users/profile/push-token', { token: null });
                                setNotificationsEnabled(false);
                                Linking.openSettings();
                                setAlertInfo({ visible: false })
                            } catch (error) {
                                console.error("Error al anular el token de push en el backend:", error);
                            }
                        }
                    }
                ]
            });
        } else { 
            // INTENTO DE ACTIVAR
            try {
                const result = await registerForPushNotificationsAsync();

                if (result.status === 'granted') {
                    setNotificationsEnabled(true);
                    setAlertInfo({ 
                        visible: true, 
                        title: '¡Listo!', 
                        message: 'Has activado las notificaciones.' 
                    });
                } else if (result.status === 'denied') {
                    // El usuario ya había denegado el permiso. Lo guiamos a los ajustes.
                    setAlertInfo({
                        visible: true,
                        title: "Permiso Requerido",
                        message: "Para activar las notificaciones, necesitas conceder el permiso desde los ajustes de tu teléfono.",
                        buttons: [
                            { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                            { 
                                text: "Ir a Ajustes", 
                                style: "primary",
                                onPress: () => {
                                    Linking.openSettings();
                                    setAlertInfo({ visible: false });
                                }
                            }
                        ]
                    });
                }
            } catch (error) {
                setAlertInfo({ visible: true, title: 'Error', message: error.message });
            }
        }
    };


    const handleDeleteAccount = () => {
        setAlertInfo({
            visible: true,
            title: "Eliminar Cuenta",
            message: "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es permanente y no se puede deshacer.",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { 
                    text: "Sí, Eliminar", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            await apiClient.delete('/users/me'); // Llama al nuevo endpoint del backend
                            setAlertInfo({
                                visible: true,
                                title: "Cuenta Eliminada",
                                message: "Tu cuenta ha sido eliminada exitosamente.",
                                buttons: [{ text: "OK", onPress: logout }] // Desloguea al usuario
                            });
                        } catch (error) {
                            setAlertInfo({
                                visible: true,
                                title: "Error",
                                message: "No se pudo eliminar la cuenta. Inténtalo de nuevo."
                            });
                        }
                    }
                }
            ]
        });
    };

    const handleLogout = () => {
        setAlertInfo({
            visible: true,
            title: "Cerrar Sesión",
            message: "¿Estás seguro de que quieres salir?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Salir", style: "destructive", onPress: () => {
                    setAlertInfo({ visible: false });
                    logout();
                }}
            ]
        });
    };

    if (authLoading || !profile) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView>
                <View style={styles.headerContainer}>
                    <ThemedText style={styles.headerTitle}>{profile.nombre} {profile.apellido}</ThemedText>
                </View>
                  <ThemedView style={styles.card}>
                      <ThemedText style={styles.cardTitle}>Mis Datos</ThemedText>
                      <View style={styles.infoRow}>
                          <Ionicons name="id-card" size={20} color={Colors[colorScheme].icon} />
                          <ThemedText style={styles.infoLabel}>DNI</ThemedText>
                          <ThemedText style={styles.infoValue}>{profile.dni}</ThemedText>
                      </View>
                      {profile.fechaNacimiento && isValid(parseISO(profile.fechaNacimiento)) && (
                          <View style={styles.infoRow}>
                              <Ionicons name="calendar" size={20} color={Colors[colorScheme].icon} />
                              <ThemedText style={styles.infoLabel}>Fecha de Nacimiento</ThemedText>
                              <ThemedText style={styles.infoValue}>
                                  {format(parseISO(profile.fechaNacimiento), 'dd/MM/yyyy')}
                              </ThemedText>
                          </View>
                          
                      )}
                      <View style={styles.infoRow}>
                          <Ionicons name="phone-portrait" size={20} color={Colors[colorScheme].icon} />
                          <ThemedText style={styles.infoLabel}>Telefono</ThemedText>
                          <ThemedText style={styles.infoValue}>{profile.numeroTelefono}</ThemedText>
                      </View>
                      <View style={styles.infoRow}>
                          <Ionicons name="call" size={20} color={Colors[colorScheme].icon} />
                          <ThemedText style={styles.infoLabel}>Telefono Emergencia</ThemedText>
                          <ThemedText style={styles.infoValue}>{profile.telefonoEmergencia}</ThemedText>
                      </View>
                       <View style={styles.infoRow}>
                          <Ionicons name="mail" size={20} color={Colors[colorScheme].icon} />
                          <ThemedText style={styles.infoLabel}>Email</ThemedText>
                          <ThemedText style={styles.infoValue}>{profile.email}</ThemedText>
                      </View>
                      <View style={styles.infoRow}>
                          <Ionicons name="home" size={20} color={Colors[colorScheme].icon} />
                          <ThemedText style={styles.infoLabel}>Direccion</ThemedText>
                          <ThemedText style={styles.infoValue}>{profile.direccion}</ThemedText>
                      </View>
                      <View style={styles.infoRow}>
                          <Ionicons name="fitness" size={20} color={Colors[colorScheme].icon} />
                          <ThemedText style={styles.infoLabel}>Obra Social</ThemedText>
                          <ThemedText style={styles.infoValue}>{profile.obraSocial}</ThemedText>
                      </View>
                      <View style={styles.infoRow}>
                          <Ionicons name="male-female-sharp" size={20} color={Colors[colorScheme].icon} />
                          <ThemedText style={styles.infoLabel}>Sexo</ThemedText>
                          <ThemedText style={styles.infoValue}>{profile.sexo}</ThemedText>
                      </View>
                  </ThemedView>
                {/* Botones para abrir los modales */}
                <View style={styles.menuContainer}>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setActiveModal('edit')}>
                        <Ionicons name="person" size={24} color={Colors[colorScheme].icon}/>
                        <ThemedText style={styles.menuButtonText}>Editar Mis Datos</ThemedText>
                    </TouchableOpacity>

                     <TouchableOpacity style={styles.menuButton} onPress={handleNotificationsPress}>
                        <Ionicons name={notificationsEnabled ? "notifications" : "notifications-off"} size={24} color={Colors[colorScheme].icon} />
                        <ThemedText style={styles.menuButtonText}>
                            {notificationsEnabled ? 'Desactivar Notificaciones' : 'Activar Notificaciones'}
                        </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuButton} onPress={handleDeleteAccount}>
                        <Octicons name="trash" size={20} color={'#ff4040ff'} />
                        <ThemedText style={[styles.menuButtonText, { color: '#ff4040ff'}]}>Eliminar mi Cuenta</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
                        <Ionicons name="log-out" size={24} color={Colors[colorScheme].icon} />
                        <ThemedText style={[styles.menuButtonText]}>Cerrar Sesión</ThemedText>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Renderizado de los Modales */}
            <Modal visible={activeModal === 'balance'} transparent={true} animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <BalanceModal onClose={() => setActiveModal(null)} />
            </Modal>

            <Modal visible={activeModal === 'plans'} transparent={true} animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <PlansAndCreditsModal onClose={() => setActiveModal(null)} />
            </Modal>

            <Modal visible={activeModal === 'edit'} transparent={true} animationType="fade" onRequestClose={() => setActiveModal(null)}>
                <EditProfileModal userProfile={profile} onClose={() => setActiveModal(null)} />
            </Modal>

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={gymColor} 
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerContainer: {
        backgroundColor: gymColor,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.9,
        marginTop: 4,
    },
    menuContainer: {
        marginTop: 20,
        paddingHorizontal: 15,
    },
    menuButton: {
        backgroundColor: Colors[colorScheme].cardBackground,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 15,
        borderRadius: 5, // Borde redondeado
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
         borderWidth: 1, borderColor: Colors[colorScheme].border
    },
    menuButtonText: {
        flex: 1,
        marginLeft: 15,
        fontSize: 16,
        fontWeight: '500',
    },
    card: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 5, // Borde redondeado
        padding: 20,
        marginHorizontal: 15,
        marginVertical: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
         borderWidth: 1, borderColor: Colors[colorScheme].border
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: Colors[colorScheme].text,
        paddingBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: Colors[colorScheme].text,
        marginLeft: 5,
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors[colorScheme].text,
        opacity: 0.8,
    },
    logoutButtonContainer: {
        paddingHorizontal: 15,
        marginTop: 10,
        marginBottom: 30,
    },
    settingRow: { 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '100%',
        margin: 0,
        padding: 0,
    },
});

export default ProfileScreen;
