import React, { useState, useCallback } from 'react';
import { 
    View, Text, Button, StyleSheet, Alert, ActivityIndicator, ScrollView, 
    Modal, TextInput, TouchableOpacity, SafeAreaView, Platform 
} from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';

const ProfileScreen = () => {
    const { logout, user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados para el modal de edición
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editableProfile, setEditableProfile] = useState({});
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

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
            fechaNacimiento: parseISO(profile.fechaNacimiento),
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
            // 1. Actualiza los datos del perfil (todos excepto la contraseña)
            await apiClient.put(`/users/profile`, {
                ...editableProfile,
                fechaNacimiento: editableProfile.fechaNacimiento.toISOString(),
            });

            // 2. Si se ingresó una nueva contraseña, la actualiza por separado
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

            await fetchProfileData(); // Recarga los datos para ver los cambios
            setEditModalVisible(false);
            Alert.alert('Éxito', 'Tu perfil ha sido actualizado.');

        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar el perfil.');
        }
    };

    if (loading) {
        return <ActivityIndicator size="large" style={styles.centered} />;
    }

    if (!profile) {
        return <Text style={styles.centered}>No se pudo cargar el perfil.</Text>;
    }
    
    const creditosDisponibles = profile.creditosPorTipo 
        ? Object.entries(profile.creditosPorTipo).map(([typeId, amount]) => {
            const classType = classTypes.find(ct => ct._id === typeId);
            return { name: classType?.nombre || 'Clase Desconocida', amount };
          }) : [];

    const planInfo = profile.plan;
    let planVence = null;
    let diasRestantes = null;
    if (planInfo && planInfo.estado === 'activo' && planInfo.fechaInicio) {
        const fechaInicio = parseISO(planInfo.fechaInicio);
        planVence = new Date(fechaInicio.setDate(fechaInicio.getDate() + 30));
        diasRestantes = differenceInDays(planVence, new Date());
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                <View style={styles.header}>
                    <Text style={styles.title}>{profile.nombre} {profile.apellido}</Text>
                    <Text style={styles.subtitle}>{profile.email}</Text>
                </View>

                {/* --- TARJETA DE PLAN --- */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Mi Plan</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Estado:</Text>
                        <Text style={[styles.infoValue, styles.status, planInfo?.estado === 'activo' ? styles.statusActive : styles.statusInactive]}>
                            {planInfo?.estado ? capitalize(planInfo.estado.replace('_', ' ')) : 'Inactivo'}
                        </Text>
                    </View>
                    {planInfo?.estado === 'activo' && planVence && (
                        <>
                            <View style={styles.infoRow}><Text style={styles.infoLabel}>Vence el:</Text><Text style={styles.infoValue}>{format(planVence, 'dd/MM/yyyy')}</Text></View>
                            <View style={styles.infoRow}><Text style={styles.infoLabel}>Días restantes:</Text><Text style={styles.infoValue}>{diasRestantes > 0 ? diasRestantes : 0}</Text></View>
                        </>
                    )}
                </View>

                {/* --- TARJETA DE CRÉDITOS --- */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Mis Créditos</Text>
                    {creditosDisponibles.length > 0 ? (
                        creditosDisponibles.map((credit, index) => (
                            <View key={index} style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{credit.name}:</Text>
                                <Text style={styles.infoValue}>{credit.amount}</Text>
                            </View>
                        ))
                    ) : <Text style={styles.infoLabel}>No tienes créditos disponibles.</Text>}
                </View>

                {/* --- TARJETA DE DATOS PERSONALES --- */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Mis Datos Personales</Text>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>DNI:</Text><Text style={styles.infoValue}>{profile.dni}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Nacimiento:</Text><Text style={styles.infoValue}>{format(parseISO(profile.fechaNacimiento), 'dd/MM/yyyy')}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Sexo:</Text><Text style={styles.infoValue}>{profile.sexo || '-'}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Teléfono:</Text><Text style={styles.infoValue}>{profile.numeroTelefono || '-'}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Obra Social:</Text><Text style={styles.infoValue}>{profile.obraSocial || '-'}</Text></View>
                    <View style={styles.infoRow}><Text style={styles.infoLabel}>Contacto Emergencia:</Text><Text style={styles.infoValue}>{profile.telefonoEmergencia}</Text></View>
                </View>

                <View style={styles.buttonSection}>
                    <Button title="Editar Mis Datos" onPress={openEditModal} color="#6f5c94" />
                    <View style={{ marginVertical: 8 }} />
                    <Button title="Cerrar Sesión" color="#e74c3c" onPress={logout} />
                </View>

                {/* --- MODAL DE EDICIÓN --- */}
                <Modal visible={isEditModalVisible} onRequestClose={() => setEditModalVisible(false)} transparent={true} animationType="slide">
                    <View style={styles.modalContainer}>
                        <ScrollView contentContainerStyle={styles.modalScrollView}>
                            <View style={styles.modalView}>
                                <Text style={styles.modalTitle}>Editar Perfil</Text>
                                
                                <Text style={styles.inputLabel}>Nombre</Text>
                                <TextInput style={styles.input} value={editableProfile.nombre} onChangeText={text => setEditableProfile(p => ({ ...p, nombre: text }))} />
                                
                                <Text style={styles.inputLabel}>Apellido</Text>
                                <TextInput style={styles.input} value={editableProfile.apellido} onChangeText={text => setEditableProfile(p => ({ ...p, apellido: text }))} />

                                <Text style={styles.inputLabel}>Email</Text>
                                <TextInput style={styles.input} value={editableProfile.email} onChangeText={text => setEditableProfile(p => ({ ...p, email: text }))} keyboardType="email-address" autoCapitalize="none" />

                                <Text style={styles.inputLabel}>DNI</Text>
                                <TextInput style={styles.input} value={editableProfile.dni} onChangeText={text => setEditableProfile(p => ({ ...p, dni: text }))} keyboardType="numeric" />

                                <Text style={styles.inputLabel}>Fecha de Nacimiento</Text>
                                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
                                    <Text>{format(editableProfile.fechaNacimiento || new Date(), 'dd/MM/yyyy')}</Text>
                                </TouchableOpacity>
                                {showDatePicker && <DateTimePicker value={editableProfile.fechaNacimiento} mode="date" display="default" onChange={handleDateChange} />}

                                <Text style={styles.inputLabel}>Sexo</Text>
                                <TextInput style={styles.input} value={editableProfile.sexo} onChangeText={text => setEditableProfile(p => ({ ...p, sexo: text }))} />

                                <Text style={styles.inputLabel}>Teléfono</Text>
                                <TextInput style={styles.input} value={editableProfile.numeroTelefono} onChangeText={text => setEditableProfile(p => ({ ...p, numeroTelefono: text }))} keyboardType="phone-pad" />

                                <Text style={styles.inputLabel}>Obra Social</Text>
                                <TextInput style={styles.input} value={editableProfile.obraSocial} onChangeText={text => setEditableProfile(p => ({ ...p, obraSocial: text }))} />

                                <Text style={styles.inputLabel}>Contacto de Emergencia</Text>
                                <TextInput style={styles.input} value={editableProfile.telefonoEmergencia} onChangeText={text => setEditableProfile(p => ({ ...p, telefonoEmergencia: text }))} keyboardType="phone-pad" />

                                <Text style={styles.sectionTitle}>Cambiar Contraseña (opcional)</Text>
                                <TextInput style={styles.input} placeholder="Contraseña Actual" secureTextEntry onChangeText={setCurrentPassword} placeholderTextColor="#aaa"/>
                                <TextInput style={styles.input} placeholder="Nueva Contraseña" secureTextEntry onChangeText={setNewPassword} placeholderTextColor="#aaa"/>
                                <TextInput style={styles.input} placeholder="Confirmar Nueva Contraseña" secureTextEntry onChangeText={setConfirmPassword} placeholderTextColor="#aaa"/>
                                
                                <View style={styles.modalButtonContainer}>
                                    <Button title="Cancelar" onPress={() => setEditModalVisible(false)} color="#6c757d" />
                                    <View style={{width: 10}}/>
                                    <Button title="Guardar" onPress={handleUpdateProfile} color="#6f5c94" />
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {  alignItems: 'center', backgroundColor: '#150224', },
    title: { fontSize: 26, fontWeight: 'bold', color: '#ffffff' },
    subtitle: { fontSize: 16, color: '#ffffff', marginTop: 4, marginBottom: 4 },
    card: { backgroundColor: 'white', borderRadius: 1, padding: 20, marginHorizontal: 16, marginTop: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
    cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#343a40', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', paddingBottom: 10 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    infoLabel: { fontSize: 16, color: '#495057' },
    infoValue: { fontSize: 16, fontWeight: '500', color: '#212529', flexShrink: 1, textAlign: 'right' },
    status: { fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, overflow: 'hidden', textTransform: 'capitalize' },
    statusActive: { backgroundColor: 'rgba(40, 167, 69, 0.1)', color: '#155724' },
    statusInactive: { backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#721c24' },
    buttonSection: { paddingHorizontal: 16, paddingVertical: 30, paddingBottom: 50 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalScrollView: { width: '100%', },
    modalView: { margin: 10, backgroundColor: 'white', borderRadius: 1, padding: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, marginVertical: 50 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    inputLabel: { fontSize: 16, fontWeight: '500', color: '#495057', alignSelf: 'flex-start', marginBottom: 5, marginLeft: 5 },
    input: { width: '100%', borderWidth: 1, borderColor: '#ddd', padding: 12, marginBottom: 15, borderRadius: 8, fontSize: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', borderTopWidth: 1, paddingTop: 15, marginTop: 15, marginBottom: 10, borderColor: '#eee', textAlign: 'center', width: '100%' },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
});

export default ProfileScreen;