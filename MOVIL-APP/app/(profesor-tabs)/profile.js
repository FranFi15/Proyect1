import React, { useState, useCallback, useEffect } from 'react';
import { 
    StyleSheet, 
    Alert, 
    ActivityIndicator, 
    ScrollView, 
    Modal, 
    TextInput, 
    TouchableOpacity, 
    Platform,
    useColorScheme,
    Button,
    View,
} from 'react-native';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

const ProfessorProfileScreen = () => {
    const { user, logout, refreshUser, loading: authLoading } = useAuth();
    
    // El estado del perfil se inicializa como null.
    const [profile, setProfile] = useState(null); 
    const [loading, setLoading] = useState(true);
    
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editableProfile, setEditableProfile] = useState({});
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);

    // --- LÓGICA DE CARGA DE DATOS MEJORADA ---
    useEffect(() => {
        const loadProfile = async () => {
            // Si el contexto de autenticación aún está cargando, esperamos.
            if (authLoading) {
                return;
            }
            // Si no hay usuario en el contexto, no hacemos nada.
            if (!user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Refrescamos los datos del usuario para tener la información más reciente.
                const updatedProfile = await refreshUser();
                setProfile(updatedProfile);
            } catch (error) {
                console.error("Error al refrescar el perfil:", error);
                // Si falla el refresh, al menos mostramos los datos que ya teníamos en el contexto.
                setProfile(user); 
                Alert.alert('Error', 'No se pudieron actualizar los datos del perfil.');
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [user, authLoading, refreshUser]); // Se ejecuta cuando el usuario o el estado de carga cambian.


    const openEditModal = () => {
        if (!profile) return;
        setEditableProfile({
            nombre: profile.nombre,
            apellido: profile.apellido,
            email: profile.email,
            dni: profile.dni,
            sexo: profile.sexo,
            numeroTelefono: profile.numeroTelefono,
            obraSocial: profile.obraSocial,
            telefonoEmergencia: profile.telefonoEmergencia,
            fechaNacimiento: profile.fechaNacimiento ? parseISO(profile.fechaNacimiento) : new Date(),
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setEditModalVisible(true);
    };

    const handleUpdateProfile = async () => {
        try {
            await apiClient.put(`/users/profile`, {
                ...editableProfile,
                fechaNacimiento: editableProfile.fechaNacimiento.toISOString(),
            });

            if (newPassword) {
                if (newPassword !== confirmPassword) {
                    Alert.alert('Error', 'Las nuevas contraseñas no coinciden.');
                    return;
                }
                if (!currentPassword) {
                    Alert.alert('Error', 'Debes ingresar tu contraseña actual para cambiarla.');
                    return;
                }
                await apiClient.put('/users/profile/change-password', {
                    currentPassword,
                    newPassword,
                });
            }

            const updatedProfile = await refreshUser(); 
            setProfile(updatedProfile);

            setEditModalVisible(false);
            Alert.alert('Éxito', 'Tu perfil ha sido actualizado.');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar el perfil.');
        }
    };

    // Muestra el indicador de carga si la pantalla está cargando.
    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={Colors[colorScheme].tint} /></ThemedView>;
    }

    // Muestra el mensaje de error si, después de cargar, no hay perfil.
    if (!profile) {
        return <ThemedView style={styles.centered}><ThemedText>No se pudo cargar el perfil.</ThemedText></ThemedView>;
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView>
                <ThemedView style={styles.card}>
                    <ThemedText style={styles.cardTitle}>Mis Datos Personales</ThemedText>
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Nombre:</ThemedText><ThemedText style={styles.infoValue}>{profile.nombre}</ThemedText></View>
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Apellido:</ThemedText><ThemedText style={styles.infoValue}>{profile.apellido}</ThemedText></View>
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>DNI:</ThemedText><ThemedText style={styles.infoValue}>{profile.dni}</ThemedText></View>
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Mail:</ThemedText><ThemedText style={styles.infoValue}>{profile.email}</ThemedText></View>
                    {profile.fechaNacimiento &&
                        <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Nacimiento:</ThemedText><ThemedText style={styles.infoValue}>{format(parseISO(profile.fechaNacimiento), 'dd/MM/yyyy')}</ThemedText></View>
                    }
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Sexo:</ThemedText><ThemedText style={styles.infoValue}>{profile.sexo || '-'}</ThemedText></View>
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Teléfono:</ThemedText><ThemedText style={styles.infoValue}>{profile.numeroTelefono || '-'}</ThemedText></View>
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Contacto Emergencia:</ThemedText><ThemedText style={styles.infoValue}>{profile.telefonoEmergencia}</ThemedText></View>
                </ThemedView>

                <View style={styles.buttonSection}>
                    <Button title="Editar Mis Datos" onPress={openEditModal} color="#1a5276" />
                    <View style={{ marginVertical: 8 }} />
                    <Button title="Cerrar Sesión" color="#e74c3c" onPress={logout} />
                </View>

                <Modal visible={isEditModalVisible} onRequestClose={() => setEditModalVisible(false)} transparent={true} animationType="slide">
                    <View style={styles.modalContainer}>
                        <ThemedView style={styles.modalView}>
                            <ScrollView contentContainerStyle={styles.modalScrollView}>
                                <ThemedText style={styles.modalTitle}>Editar Perfil</ThemedText>
                                
                                <ThemedText style={styles.inputLabel}>Nombre</ThemedText>
                                <TextInput style={styles.input} value={editableProfile.nombre} onChangeText={text => setEditableProfile(p => ({ ...p, nombre: text }))} placeholderTextColor={Colors[colorScheme].icon} />
                                
                                <ThemedText style={styles.inputLabel}>Apellido</ThemedText>
                                <TextInput style={styles.input} value={editableProfile.apellido} onChangeText={text => setEditableProfile(p => ({ ...p, apellido: text }))} placeholderTextColor={Colors[colorScheme].icon} />
                                
                                <ThemedText style={styles.sectionTitle}>Cambiar Contraseña (opcional)</ThemedText>
                                <TextInput style={styles.input} placeholder="Contraseña Actual" secureTextEntry onChangeText={setCurrentPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                                <TextInput style={styles.input} placeholder="Nueva Contraseña" secureTextEntry onChangeText={setNewPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                                <TextInput style={styles.input} placeholder="Confirmar Nueva Contraseña" secureTextEntry onChangeText={setConfirmPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                                
                                <View style={styles.modalButtonContainer}>
                                    <Button title="Cancelar" onPress={() => setEditModalVisible(false)} color="#6c757d" />
                                    <View style={{width: 10}}/>
                                    <Button title="Guardar" onPress={handleUpdateProfile} color="#28a745" />
                                </View>
                            </ScrollView>
                        </ThemedView>
                    </View>
                </Modal>
            </ScrollView>
        </ThemedView>
    );
};

const getStyles = (colorScheme) => {
    const shadowProp = {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    };
    
    return StyleSheet.create({
        container: { flex: 1 },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        card: {
            backgroundColor: Colors[colorScheme].cardBackground,
            borderRadius: 8,
            padding: 20,
            marginHorizontal: 16,
            marginVertical: 10,
            marginTop: 20,
            ...shadowProp
        },
        cardTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 15,
            borderBottomWidth: 1,
            borderBottomColor: Colors[colorScheme].border,
            paddingBottom: 10,
            color: Colors[colorScheme].text,
        },
        infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
        infoLabel: { fontSize: 16, opacity: 0.8, color: Colors[colorScheme].text },
        infoValue: { fontSize: 16, fontWeight: '500', flexShrink: 1, textAlign: 'right', color: Colors[colorScheme].text },
        buttonSection: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 40 },
        modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
        modalScrollView: { width: '100%' },
        modalView: { margin: 20, borderRadius: 10, padding: 25, width: '90%', maxHeight: '85%', backgroundColor: Colors[colorScheme].background },
        modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
        inputLabel: { fontSize: 16, fontWeight: '500', alignSelf: 'flex-start', marginBottom: 5, marginLeft: 5, opacity: 0.9, color: Colors[colorScheme].text },
        input: {
            width: '100%',
            borderWidth: 1,
            borderColor: Colors[colorScheme].border,
            padding: 12,
            marginBottom: 15,
            borderRadius: 8,
            fontSize: 16,
            color: Colors[colorScheme].text,
            backgroundColor: Colors[colorScheme].background,
        },
        sectionTitle: { fontSize: 18, fontWeight: 'bold', borderTopWidth: 1, paddingTop: 15, marginTop: 15, marginBottom: 10, borderColor: Colors[colorScheme].border, textAlign: 'center', width: '100%', color: Colors[colorScheme].text },
        modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
    });
};

export default ProfessorProfileScreen;
