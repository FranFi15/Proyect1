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
    Text,
} from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const ProfileScreen = () => {
    const { logout, user, refreshUser, gymColor, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState(user);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalVisible, setEditModalVisible] = useState(false);
    const [editableProfile, setEditableProfile] = useState({});
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // --- ESTADOS PARA LOS INPUTS DE FECHA ---
    const [editDay, setEditDay] = useState('');
    const [editMonth, setEditMonth] = useState('');
    const [editYear, setEditYear] = useState('');

    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    useFocusEffect(
        useCallback(() => {
            const fetchProfileData = async () => {
                if (authLoading) return;
                setLoading(true);
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
            fetchProfileData();
        }, [authLoading])
    );

    // --- EFFECT PARA SINCRONIZAR LOS INPUTS DE FECHA ---
    useEffect(() => {
        // Solo intenta construir la fecha si todos los campos tienen la longitud correcta
        if (editDay.length === 2 && editMonth.length === 2 && editYear.length === 4) {
            const dateString = `${editYear}-${editMonth}-${editDay}`;
            const newDate = parseISO(dateString);
            if (isValid(newDate)) {
                setEditableProfile(p => ({ ...p, fechaNacimiento: newDate }));
            }
        }
    }, [editDay, editMonth, editYear]);

    const openEditModal = () => {
        if (!profile) return;

        // Descomponer la fecha de nacimiento en día, mes y año para los inputs
        if (profile.fechaNacimiento) {
            const date = parseISO(profile.fechaNacimiento);
            setEditDay(format(date, 'dd'));
            setEditMonth(format(date, 'MM'));
            setEditYear(format(date, 'yyyy'));
        } else {
            setEditDay('');
            setEditMonth('');
            setEditYear('');
        }

        setEditableProfile({
            nombre: profile.nombre,
            apellido: profile.apellido,
            email: profile.email,
            dni: profile.dni,
            sexo: profile.sexo,
            numeroTelefono: profile.numeroTelefono,
            obraSocial: profile.obraSocial,
            telefonoEmergencia: profile.telefonoEmergencia,
            fechaNacimiento: profile.fechaNacimiento ? parseISO(profile.fechaNacimiento) : null,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setEditModalVisible(true);
    };

    const handleUpdateProfile = async () => {
        try {
            // Validar que la fecha de nacimiento sea válida antes de enviar
            if (!editableProfile.fechaNacimiento || !isValid(editableProfile.fechaNacimiento)) {
                Alert.alert('Error', 'Por favor, introduce una fecha de nacimiento válida.');
                return;
            }

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

    if (loading || authLoading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={Colors[colorScheme].tint} /></ThemedView>;
    }

    if (!profile) {
        return <ThemedView style={styles.centered}><ThemedText>No se pudo cargar el perfil.</ThemedText></ThemedView>;
    }
    
    const creditosDisponibles = profile.creditosPorTipo ? Object.entries(profile.creditosPorTipo)
        .map(([typeId, amount]) => {
            const classType = classTypes.find(ct => ct._id === typeId);
            return amount > 0 ? { name: classType?.nombre || 'Clase Desconocida', amount } : null;
        })
        .filter(Boolean)
        : [];

    const monthlySubscriptions = profile.monthlySubscriptions || [];
    const fixedPlans = profile.planesFijos || [];

    return (
        <ThemedView style={styles.container}>
            <ScrollView>
                {/* ... (secciones de suscripciones, planes y créditos sin cambios) ... */}

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

                                <ThemedText style={styles.inputLabel}>DNI</ThemedText>
                                <TextInput style={styles.input} value={editableProfile.dni} onChangeText={text => setEditableProfile(p => ({ ...p, dni: text }))} keyboardType="numeric" placeholderTextColor={Colors[colorScheme].icon} />

                                {/* --- CAMBIO EN EL SELECTOR DE FECHA --- */}
                                <ThemedText style={styles.inputLabel}>Fecha de Nacimiento</ThemedText>
                                <View style={styles.dateInputContainer}>
                                    <TextInput style={styles.dateInput} placeholder="DD" value={editDay} onChangeText={setEditDay} keyboardType="number-pad" maxLength={2} />
                                    <TextInput style={styles.dateInput} placeholder="MM" value={editMonth} onChangeText={setEditMonth} keyboardType="number-pad" maxLength={2} />
                                    <TextInput style={styles.dateInput} placeholder="AAAA" value={editYear} onChangeText={setEditYear} keyboardType="number-pad" maxLength={4} />
                                </View>

                                <ThemedText style={styles.inputLabel}>Sexo</ThemedText>
                                <View style={styles.genderSelector}>
                                    {['Femenino', 'Masculino', 'Otro'].map((option) => (
                                        <TouchableOpacity
                                            key={option}
                                            style={[styles.genderButton, editableProfile.sexo === option && styles.genderButtonSelected]}
                                            onPress={() => setEditableProfile(p => ({ ...p, sexo: option }))}
                                        >
                                            <Text style={[styles.genderButtonText, editableProfile.sexo === option && styles.genderButtonTextSelected]}>{option}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <ThemedText style={styles.inputLabel}>Teléfono</ThemedText>
                                <TextInput style={styles.input} value={editableProfile.numeroTelefono} onChangeText={text => setEditableProfile(p => ({ ...p, numeroTelefono: text }))} keyboardType="phone-pad" placeholderTextColor={Colors[colorScheme].icon} />

                                <ThemedText style={styles.inputLabel}>Obra Social</ThemedText>
                                <TextInput style={styles.input} value={editableProfile.obraSocial} onChangeText={text => setEditableProfile(p => ({ ...p, obraSocial: text }))} placeholderTextColor={Colors[colorScheme].icon} />
                                
                                <ThemedText style={styles.inputLabel}>Teléfono de Emergencia</ThemedText>
                                <TextInput style={styles.input} value={editableProfile.telefonoEmergencia} onChangeText={text => setEditableProfile(p => ({ ...p, telefonoEmergencia: text }))} keyboardType="phone-pad" placeholderTextColor={Colors[colorScheme].icon} />

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

const getStyles = (colorScheme, gymColor) => {
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
        planItem: {
            marginBottom: 15,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: Colors[colorScheme].border,
        },
        infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
        infoLabel: { fontSize: 16, opacity: 0.8, color: Colors[colorScheme].text },
        infoLabelBold: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text },
        infoValue: { fontSize: 16, fontWeight: '500', flexShrink: 1, textAlign: 'right', color: Colors[colorScheme].text },
        buttonSection: { paddingHorizontal: 16, paddingVertical: 30, paddingBottom: 50 },
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
        genderSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
        genderButton: { 
            paddingVertical: 10, 
            paddingHorizontal: 20, 
            borderWidth: 1, 
            borderColor: Colors[colorScheme].icon, 
            borderRadius: 20 
        },
        genderButtonSelected: { 
            backgroundColor: gymColor,
            borderColor: gymColor,
        },
        genderButtonText: { 
            color: Colors[colorScheme].text 
        },
        genderButtonTextSelected: { 
            color: '#fff',
            fontWeight: 'bold'
        },
        // --- NUEVOS ESTILOS PARA LOS INPUTS DE FECHA ---
        dateInputContainer: { 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            marginBottom: 15 
        },
        dateInput: {
            borderWidth: 1,
            borderColor: Colors[colorScheme].border,
            padding: 12,
            borderRadius: 8,
            fontSize: 16,
            color: Colors[colorScheme].text,
            backgroundColor: Colors[colorScheme].background,
            textAlign: 'center',
            flex: 1,
            marginHorizontal: 4,
        },
    });
};

export default ProfileScreen;
