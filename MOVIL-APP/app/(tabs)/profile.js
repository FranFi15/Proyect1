import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    useColorScheme,
    Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isValid } from 'date-fns';
import es from 'date-fns/locale/es';

// Importamos los componentes para los modales
import BalanceModal from '@/components/client/BalanceModal';
import PlansAndCreditsModal from '@/components/client/PlansAndCreditsModal';
import EditProfileModal from '@/components/client/EditProfileModal';
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado

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

    // Estados para controlar la visibilidad de cada modal
    const [isBalanceModalVisible, setBalanceModalVisible] = useState(false);
    const [isPlansModalVisible, setPlansModalVisible] = useState(false);
    const [isEditModalVisible, setEditModalVisible] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    useFocusEffect(
        useCallback(() => {
            setProfile(user);
        }, [user])
    );

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
                    <TouchableOpacity style={styles.menuButton} onPress={() => setBalanceModalVisible(true)}>
                        <Ionicons name="logo-usd" size={24} color={Colors[colorScheme].icon} />
                        <ThemedText style={styles.menuButtonText}>Mi Saldo y Movimientos</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuButton} onPress={() => setPlansModalVisible(true)}>
                        <Ionicons name="document-text" size={24} color={Colors[colorScheme].icon} />
                        <ThemedText style={styles.menuButtonText}>Mis Planes y Créditos</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuButton} onPress={() => setEditModalVisible(true)}>
                        <Ionicons name="person" size={24} color={Colors[colorScheme].icon}/>
                        <ThemedText style={styles.menuButtonText}>Editar Mis Datos</ThemedText>
                    </TouchableOpacity>
                </View>

               

                <View style={styles.logoutButtonContainer}>
                    <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
                        <Ionicons name="log-out" size={24} color={Colors[colorScheme].icon} />
                        <ThemedText style={[styles.menuButtonText]}>Cerrar Sesión</ThemedText>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Renderizado de los Modales */}
            <Modal visible={isBalanceModalVisible} transparent={true} animationType="slide" onRequestClose={() => setBalanceModalVisible(false)}>
                <BalanceModal onClose={() => setBalanceModalVisible(false)} />
            </Modal>

            <Modal visible={isPlansModalVisible} transparent={true} animationType="slide" onRequestClose={() => setPlansModalVisible(false)}>
                <PlansAndCreditsModal onClose={() => setPlansModalVisible(false)} />
            </Modal>

            <Modal visible={isEditModalVisible} transparent={true} animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
                <EditProfileModal userProfile={profile} onClose={() => setEditModalVisible(false)} />
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
        paddingVertical: 30,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
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
        borderRadius: 8, // Borde redondeado
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    menuButtonText: {
        flex: 1,
        marginLeft: 15,
        fontSize: 16,
        fontWeight: '500',
    },
    card: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 8, // Borde redondeado
        padding: 20,
        marginHorizontal: 15,
        marginVertical: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    cardTitle: {
        fontSize: 18,
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
        fontSize: 16,
        color: Colors[colorScheme].text,
        marginLeft: 10,
        flex: 1,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors[colorScheme].text,
        opacity: 0.8,
    },
    logoutButtonContainer: {
        paddingHorizontal: 15,
        marginTop: 10,
        marginBottom: 30,
    }
});

export default ProfileScreen;
