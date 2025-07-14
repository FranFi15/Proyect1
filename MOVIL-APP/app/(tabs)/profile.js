import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO, differenceInDays, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- COMPONENTES Y CONSTANTES TEMÁTICAS ---
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const ProfileScreen = () => {
    // --- ESTADOS (SIN CAMBIOS) ---
    const { logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editableProfile, setEditableProfile] = useState({});
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);

    const fetchProfileData = async () => {
        if (!loading) setLoading(true);
        try {
            const [profileResponse, typesResponse] = await Promise.all([
                apiClient.get('/users/me'),
                apiClient.get('/tipos-clase')
            ]);
            setProfile(profileResponse.data);
            setClassTypes(typesResponse.data.tiposClase || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar tu perfil.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchProfileData(); }, []));

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

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setEditableProfile(p => ({ ...p, fechaNacimiento: selectedDate }));
        }
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

            await fetchProfileData();
            setEditModalVisible(false);
            Alert.alert('Éxito', 'Tu perfil ha sido actualizado.');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar el perfil.');
        }
    };

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={Colors[colorScheme].tint} /></ThemedView>;
    }

    if (!profile) {
        return <ThemedView style={styles.centered}><ThemedText>No se pudo cargar el perfil.</ThemedText></ThemedView>;
    }
    
    const creditosDisponibles = profile.creditosPorTipo ? Object.entries(profile.creditosPorTipo).map(([typeId, amount]) => {
        const classType = classTypes.find(ct => ct._id === typeId);
        return { name: classType?.nombre || 'Clase Desconocida', amount };
    }) : [];

    const monthlySubscriptions = profile.monthlySubscriptions || [];
    const fixedPlans = profile.planesFijos || [];

    return (
        <ThemedView style={styles.container}>
            <ScrollView>
               

                {monthlySubscriptions.length > 0 &&
                    <ThemedView style={styles.card}>
                        <ThemedText style={styles.cardTitle}>Mis Suscripciones</ThemedText>
                        {monthlySubscriptions.map((sub, index) => (
                            <View key={sub._id || index} style={styles.planItem}>
                                <View style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabelBold}>{sub.tipoClase?.nombre || 'Suscripción'}</ThemedText>
                                    <ThemedText style={styles.infoValue}>{sub.autoRenewAmount} Créditos por Mes</ThemedText>
                                </View>
                            </View>
                        ))}
                    </ThemedView>
                }

                {fixedPlans.length > 0 && (
                     <ThemedView style={styles.card}>
                        <ThemedText style={styles.cardTitle}>Mis Horarios Fijos</ThemedText>
                        {fixedPlans.map((plan, index) => (
                             <View key={plan._id || index} style={styles.planItem}>
                                <ThemedText style={styles.infoLabelBold}>{plan.tipoClase?.nombre || 'Clase Fija'}</ThemedText>
                                <ThemedText style={styles.infoValue}>{plan.diasDeSemana?.join(', ') || ''} a las {plan.horaInicio}hs</ThemedText>
                             </View>
                        ))}
                     </ThemedView>
                )}


                <ThemedView style={styles.card}>
                    <ThemedText style={styles.cardTitle}>Mis Créditos</ThemedText>
                    {creditosDisponibles.length > 0 ? (
                        creditosDisponibles.map((credit, index) => (
                            <View key={index} style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>{credit.name}:</ThemedText>
                                <ThemedText style={styles.infoValue}>{credit.amount} Créditos</ThemedText>
                            </View>
                        ))
                    ) : <ThemedText style={styles.infoLabel}>No tienes créditos disponibles.</ThemedText>}
                </ThemedView>

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
                    <View style={styles.infoRow}><ThemedText style={styles.infoLabel}>Obra Social:</ThemedText><ThemedText style={styles.infoValue}>{profile.obraSocial || '-'}</ThemedText></View>
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
                                
                                {/* ... Otros inputs ... */}

                                <ThemedText style={styles.sectionTitle}>Cambiar Contraseña (opcional)</ThemedText>
                                <TextInput style={styles.input} placeholder="Contraseña Actual" secureTextEntry onChangeText={setCurrentPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                                <TextInput style={styles.input} placeholder="Nueva Contraseña" secureTextEntry onChangeText={setNewPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                                <TextInput style={styles.input} placeholder="Confirmar Nueva Contraseña" secureTextEntry onChangeText={setConfirmPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                                
                                <View style={styles.modalButtonContainer}>
                                    <Button title="Cancelar" onPress={() => setEditModalVisible(false)} color="#6c757d" />
                                    <View style={{width: 10}}/>
                                    <Button title="Guardar" onPress={handleUpdateProfile} color="#6f5c94" />
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
        header: { alignItems: 'center', backgroundColor: '#150224', paddingVertical: 20 },
        title: { fontSize: 26, fontWeight: 'bold', color: '#ffffff' },
        subtitle: { fontSize: 16, color: '#ffffff', opacity: 0.8 },
        card: {
            backgroundColor: Colors[colorScheme].cardBackground,
            borderRadius: 8,
            padding: 20,
            marginHorizontal: 16,
            marginVertical: 10,
            borderWidth: 0, // Clave: Sin borde
            ...shadowProp
        },
        cardTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 15,
            borderBottomWidth: 1,
            borderBottomColor: Colors[colorScheme].border,
            paddingBottom: 10
        },
        planItem: {
            marginBottom: 15,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: Colors[colorScheme].border,
        },
        infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
        infoLabel: { fontSize: 16, opacity: 0.8 },
        infoLabelBold: { fontSize: 16, fontWeight: 'bold' },
        infoValue: { fontSize: 16, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
        status: { fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, overflow: 'hidden', textTransform: 'capitalize' },
        statusActive: {
            backgroundColor: colorScheme === 'dark' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(40, 167, 69, 0.1)',
            color: colorScheme === 'dark' ? '#58d68d' : '#155724'
        },
        statusInactive: {
            backgroundColor: colorScheme === 'dark' ? 'rgba(220, 53, 69, 0.2)' : 'rgba(220, 53, 69, 0.1)',
            color: colorScheme === 'dark' ? '#f5b7b1' : '#721c24'
        },
        buttonSection: { paddingHorizontal: 16, paddingVertical: 30, paddingBottom: 50 },
        modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
        modalScrollView: { width: '100%' },
        modalView: { margin: 20, borderRadius: 10, padding: 25, width: '90%', maxHeight: '85%' },
        modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
        inputLabel: { fontSize: 16, fontWeight: '500', alignSelf: 'flex-start', marginBottom: 5, marginLeft: 5, opacity: 0.9 },
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
        sectionTitle: { fontSize: 18, fontWeight: 'bold', borderTopWidth: 1, paddingTop: 15, marginTop: 15, marginBottom: 10, borderColor: Colors[colorScheme].border, textAlign: 'center', width: '100%' },
        modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
    });
};

export default ProfileScreen;