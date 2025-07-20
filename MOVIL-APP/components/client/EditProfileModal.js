import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, TextInput, Button, useColorScheme, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isValid } from 'date-fns';
import apiClient from '../../services/apiClient';

const EditProfileModal = ({ userProfile, onClose }) => {
    const { refreshUser, gymColor } = useAuth();
    const [editableProfile, setEditableProfile] = useState({});
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [editDay, setEditDay] = useState('');
    const [editMonth, setEditMonth] = useState('');
    const [editYear, setEditYear] = useState('');
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    useEffect(() => {
        if (userProfile) {
            if (userProfile.fechaNacimiento && isValid(parseISO(userProfile.fechaNacimiento))) {
                const date = parseISO(userProfile.fechaNacimiento);
                setEditDay(format(date, 'dd'));
                setEditMonth(format(date, 'MM'));
                setEditYear(format(date, 'yyyy'));
            }
            setEditableProfile({
                nombre: userProfile.nombre,
                apellido: userProfile.apellido,
                email: userProfile.email,
                dni: userProfile.dni,
                sexo: userProfile.sexo || 'Otro',
                numeroTelefono: userProfile.numeroTelefono,
                obraSocial: userProfile.obraSocial,
                telefonoEmergencia: userProfile.telefonoEmergencia,
                fechaNacimiento: userProfile.fechaNacimiento ? parseISO(userProfile.fechaNacimiento) : null,
            });
        }
    }, [userProfile]);

    useEffect(() => {
        if (editDay.length === 2 && editMonth.length === 2 && editYear.length === 4) {
            const dateString = `${editYear}-${editMonth}-${editDay}`;
            const newDate = parseISO(dateString);
            if (isValid(newDate)) {
                setEditableProfile(p => ({ ...p, fechaNacimiento: newDate }));
            }
        }
    }, [editDay, editMonth, editYear]);

    const handleUpdateProfile = async () => {
        try {
            if (!editableProfile.fechaNacimiento || !isValid(editableProfile.fechaNacimiento)) {
                Alert.alert('Error', 'Introduce una fecha de nacimiento válida.');
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
                await apiClient.put('/users/profile/change-password', { currentPassword, newPassword });
            }
            await refreshUser();
            Alert.alert('Éxito', 'Tu perfil ha sido actualizado.');
            onClose();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar el perfil.');
        }
    };

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color="#ccc" />
                </TouchableOpacity>
                <ScrollView>
                    <Text style={styles.modalTitle}>Editar Mis Datos</Text>
                    
                    <Text style={styles.inputLabel}>Nombre</Text>
                    <TextInput style={styles.input} value={editableProfile.nombre} onChangeText={text => setEditableProfile(p => ({ ...p, nombre: text }))} />
                    
                    <Text style={styles.inputLabel}>Apellido</Text>
                    <TextInput style={styles.input} value={editableProfile.apellido} onChangeText={text => setEditableProfile(p => ({ ...p, apellido: text }))} />

                    <Text style={styles.inputLabel}>DNI</Text>
                    <TextInput style={styles.input} value={editableProfile.dni} onChangeText={text => setEditableProfile(p => ({ ...p, dni: text }))} keyboardType="numeric" />

                    <Text style={styles.inputLabel}>Fecha de Nacimiento</Text>
                    <View style={styles.dateInputContainer}>
                        <TextInput style={styles.dateInput} placeholder="DD" value={editDay} onChangeText={setEditDay} keyboardType="number-pad" maxLength={2} />
                        <TextInput style={styles.dateInput} placeholder="MM" value={editMonth} onChangeText={setEditMonth} keyboardType="number-pad" maxLength={2} />
                        <TextInput style={styles.dateInput} placeholder="AAAA" value={editYear} onChangeText={setEditYear} keyboardType="number-pad" maxLength={4} />
                    </View>

                    <Text style={styles.inputLabel}>Sexo</Text>
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

                    <Text style={styles.inputLabel}>Teléfono</Text>
                    <TextInput style={styles.input} value={editableProfile.numeroTelefono} onChangeText={text => setEditableProfile(p => ({ ...p, numeroTelefono: text }))} keyboardType="phone-pad" />

                     <Text style={styles.inputLabel}>Dirección</Text>
                    <TextInput style={styles.input} value={editableProfile.direccion} onChangeText={text => setEditableProfile(p => ({ ...p, direccion: text }))} />   
                    <Text style={styles.inputLabel}>Obra Social</Text>
                    <TextInput style={styles.input} value={editableProfile.obraSocial} onChangeText={text => setEditableProfile(p => ({ ...p, obraSocial: text }))} />
                    
                    <Text style={styles.inputLabel}>Teléfono de Emergencia</Text>
                    <TextInput style={styles.input} value={editableProfile.telefonoEmergencia} onChangeText={text => setEditableProfile(p => ({ ...p, telefonoEmergencia: text }))} keyboardType="phone-pad" />

                    <Text style={styles.sectionTitle}>Cambiar Contraseña (opcional)</Text>
                    <TextInput style={styles.input} placeholder="Contraseña Actual" secureTextEntry onChangeText={setCurrentPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                    <TextInput style={styles.input} placeholder="Nueva Contraseña" secureTextEntry onChangeText={setNewPassword} placeholderTextColor={Colors[colorScheme].icon}/>
                    <TextInput style={styles.input} placeholder="Confirmar Nueva Contraseña" secureTextEntry onChangeText={setConfirmPassword} placeholderTextColor={Colors[colorScheme].icon}/>

                    <View style={{ marginTop: 20 }}>
                        <Button title="Guardar Cambios" onPress={handleUpdateProfile} color={gymColor} />
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', backgroundColor: Colors[colorScheme].background, borderRadius: 2, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    inputLabel: { fontSize: 16, color: Colors[colorScheme].text, marginBottom: 8, marginLeft: 5 },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 2, paddingHorizontal: 15, marginBottom: 15, color: Colors[colorScheme].text, fontSize: 16 },
    dateInputContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    dateInput: { flex: 1, height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 2, paddingHorizontal: 15, marginBottom: 15, textAlign: 'center', color: Colors[colorScheme].text, marginHorizontal: 4, fontSize: 16 },
    genderSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
    genderButton: { 
        paddingVertical: 10, 
        paddingHorizontal: 20, 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].icon, 
        borderRadius: 2 
    },
    genderButtonSelected: { 
        backgroundColor: gymColor || '#00177d', 
        borderColor: gymColor || '#00177d'
    },
    genderButtonText: { 
        color: Colors[colorScheme].text 
    },
    genderButtonTextSelected: { 
        color: '#fff',
        fontWeight: 'bold'
    },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', borderTopWidth: 1, paddingTop: 15, marginTop: 15, marginBottom: 10, borderColor: Colors[colorScheme].border, textAlign: 'center', width: '100%', color: Colors[colorScheme].text },
});

export default EditProfileModal;
