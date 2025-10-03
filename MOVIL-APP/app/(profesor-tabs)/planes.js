import React, { useState, useCallback, useMemo } from 'react';
import {
    StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, useColorScheme, Modal, Pressable, Button, ScrollView
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome5, Octicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

// Modal para Crear/Editar Ejercicios
const EjercicioModal = ({ visible, onClose, onSave, ejercicio, theme, gymColor }) => {
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');

    useEffect(() => {
        if (ejercicio) {
            setNombre(ejercicio.nombre);
            setDescripcion(ejercicio.descripcion || '');
        } else {
            setNombre('');
            setDescripcion('');
        }
    }, [ejercicio]);

    const handleSave = () => {
        onSave({ nombre, descripcion });
    };

    return (
        <Modal visible={visible} transparent={true} animationType="slide">
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
                    <ThemedText style={styles.modalTitle}>{ejercicio ? 'Editar Ejercicio' : 'Crear Ejercicio'}</ThemedText>
                    <TextInput style={styles.input} placeholder="Nombre del Ejercicio" value={nombre} onChangeText={setNombre} />
                    <TextInput style={[styles.input, styles.textArea]} placeholder="Descripción (opcional)" value={descripcion} onChangeText={setDescripcion} multiline />
                    <Button title="Subir Video (Próximamente)" onPress={() => {}} disabled={true} color={gymColor} />
                    <View style={{ marginTop: 20 }}>
                        <Button title={ejercicio ? 'Guardar Cambios' : 'Crear Ejercicio'} onPress={handleSave} color={gymColor} />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const PlanesProfesionalScreen = () => {
    const { user, gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [ejercicios, setEjercicios] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingEjercicio, setEditingEjercicio] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ visible: false });

    const fetchEjercicios = useCallback(async () => {
        try {
            const response = await apiClient.get('/ejercicios');
            setEjercicios(response.data);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo cargar la biblioteca de ejercicios.' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        setIsLoading(true);
        fetchEjercicios();
    }, [fetchEjercicios]));

    const handleSaveEjercicio = async (data) => {
        try {
            if (editingEjercicio) {
                await apiClient.put(`/ejercicios/${editingEjercicio._id}`, data);
            } else {
                await apiClient.post('/ejercicios', data);
            }
            setIsModalVisible(false);
            fetchEjercicios();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo guardar el ejercicio.' });
        }
    };
    
    const handleDeleteEjercicio = (ejercicio) => {
        setAlertInfo({
            visible: true,
            title: 'Confirmar Eliminación',
            message: `¿Seguro que quieres eliminar "${ejercicio.nombre}"?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/ejercicios/${ejercicio._id}`);
                        fetchEjercicios();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar.' });
                    }
                }}
            ]
        });
    };

    const renderEjercicioItem = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.itemContent}>
                <ThemedText style={styles.itemTitle}>{item.nombre}</ThemedText>
                <ThemedText style={styles.itemDescription}>{item.descripcion}</ThemedText>
            </View>
            {user?.puedeGestionarEjercicios && (
                <View style={styles.itemActions}>
                    <TouchableOpacity onPress={() => { setEditingEjercicio(item); setIsModalVisible(true); }}>
                        <FontAwesome5 name="edit" size={20} color={Colors[colorScheme].text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => handleDeleteEjercicio(item)}>
                        <Octicons name="trash" size={22} color={Colors.light.error} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    if (isLoading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={styles.container}>
            {/* Por ahora, mostramos directamente la Biblioteca. Luego aquí irá la TabView */}
            <ThemedText style={styles.title}>Biblioteca de Ejercicios</ThemedText>
            <FlatList
                data={ejercicios}
                renderItem={renderEjercicioItem}
                keyExtractor={item => item._id}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay ejercicios creados.</ThemedText>}
            />
            {user?.puedeGestionarEjercicios && (
                <TouchableOpacity style={styles.fab} onPress={() => { setEditingEjercicio(null); setIsModalVisible(true); }}>
                    <Ionicons name="add" size={30} color="#fff" />
                </TouchableOpacity>
            )}

            <EjercicioModal 
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                onSave={handleSaveEjercicio}
                ejercicio={editingEjercicio}
                theme={Colors[colorScheme]}
                gymColor={gymColor}
            />

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons || [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }]}
                gymColor={gymColor}
                onClose={() => setAlertInfo({ visible: false })}
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, padding: 15 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
    itemCard: { padding: 15, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, marginVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemContent: { flex: 1 },
    itemTitle: { fontSize: 18, fontWeight: '500' },
    itemDescription: { fontSize: 14, opacity: 0.7, marginTop: 5 },
    itemActions: { flexDirection: 'row' },
    emptyText: { textAlign: 'center', marginTop: 50 },
    fab: {
        position: 'absolute', width: 60, height: 60, alignItems: 'center', 
        justifyContent: 'center', right: 20, bottom: 20,
        backgroundColor: gymColor, borderRadius: 30, elevation: 8,
    },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { width: '90%', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, color: Colors[colorScheme].text },
    textArea: { height: 100, textAlignVertical: 'top', paddingTop: 10 },
});

export default PlanesProfesionalScreen;