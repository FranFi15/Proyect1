import React, { useState, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    useColorScheme,
    ActivityIndicator,
    RefreshControl,
    Switch
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext'; 
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado

const ClassTypeManagementScreen = () => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [classTypes, setClassTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingClassType, setEditingClassType] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', descripcion: '', price: '0', resetMensual: true });

    // Estado para manejar la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    const fetchClassTypes = useCallback(async () => {
        try {
            const response = await apiClient.get('/tipos-clase');
            if (response.data && Array.isArray(response.data.tiposClase)) {
                setClassTypes(response.data.tiposClase);
            } else {
                setClassTypes([]);
            }
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron obtener los tipos de turno.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            setClassTypes([]);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setIsLoading(true);
            fetchClassTypes();
        }, [fetchClassTypes])
    );

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchClassTypes();
    }, [fetchClassTypes]);

    const handleFormChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
    };

    const handleAdd = () => {
        setEditingClassType(null);
        setFormData({ nombre: '', descripcion: '', price: '0', resetMensual: true });
        setIsModalVisible(true);
    };

    const handleEdit = (type) => {
        setEditingClassType(type);
        setFormData({ 
            nombre: type.nombre, 
            descripcion: type.descripcion || '', 
            price: type.price?.toString() || '0',
            resetMensual: type.resetMensual ?? true, 
        });
        setIsModalVisible(true);
    };

    const handleFormSubmit = async () => {
        if (!formData.nombre) {
            setAlertInfo({
                visible: true,
                title: 'Campo Requerido',
                message: 'El nombre del tipo de turno es obligatorio.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            return;
        }

        const payload = {
            ...formData,
            price: Number(formData.price) || 0,
        };

        const apiCall = editingClassType
            ? apiClient.put(`/tipos-clase/${editingClassType._id}`, payload)
            : apiClient.post('/tipos-clase', payload);

        try {
            await apiCall;
            setAlertInfo({
                visible: true,
                title: 'Éxito',
                message: `Tipo de Turno ${editingClassType ? 'actualizado' : 'añadido'} exitosamente.`,
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            setIsModalVisible(false);
            fetchClassTypes();
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || `Error al ${editingClassType ? 'actualizar' : 'añadir'}.`,
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        }
    };

    const handleDelete = (type) => {
        setAlertInfo({
            visible: true,
            title: 'Confirmar Eliminación',
            message: `¿Estás seguro de que quieres eliminar "${type.nombre}"?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setAlertInfo({ visible: false }); // Cierra la alerta de confirmación
                        try {
                            await apiClient.delete(`/tipos-clase/${type._id}`);
                            setAlertInfo({
                                visible: true,
                                title: 'Éxito',
                                message: 'Tipo de turno eliminado.',
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
                            });
                            fetchClassTypes();
                        } catch (error) {
                            setAlertInfo({
                                visible: true,
                                title: 'Error',
                                message: error.response?.data?.message || 'Error al eliminar.',
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
                            });
                        }
                    },
                },
            ]
        });
    };

    const renderClassType = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <ThemedText style={styles.cardTitle}>{item.nombre}</ThemedText>
                <Text style={styles.priceText}>
                    Precio: ${item.price?.toFixed(2) || '0.00'}
                </Text>
                <ThemedText style={[styles.cardDescription, { marginTop: 8, fontStyle: 'italic' }]}>
                    Créditos: {item.resetMensual ? 'Vencimiento Mensual' : 'Sin Vencimiento'}
                </ThemedText>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                    <FontAwesome6 name="edit" size={21} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                    <Octicons name="trash" size={24} color={Colors[colorScheme].text} />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator size="large" color={gymColor} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={classTypes}
                renderItem={renderClassType}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <ThemedView style={styles.centered}>
                        <ThemedText>No hay tipos de turnos registrados.</ThemedText>
                    </ThemedView>
                }
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[gymColor]} />
                }
            />

            <TouchableOpacity style={styles.fab} onPress={handleAdd}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContainer}>
                        <ThemedText style={styles.modalTitle}>
                            {editingClassType ? 'Editar Tipo de Turno' : 'Añadir Tipo de Turno'}
                        </ThemedText>
                        
                        <ThemedText style={styles.inputLabel}>Nombre</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Crossfit"
                            value={formData.nombre}
                            onChangeText={(text) => handleFormChange('nombre', text)}
                        />

                        <ThemedText style={styles.inputLabel}>Precio</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            value={formData.price}
                            onChangeText={(text) => handleFormChange('price', text)}
                            keyboardType="numeric"
                        />
                        <View style={styles.switchContainer}>
                            <ThemedText style={styles.inputLabel}>¿Reiniciar créditos mensualmente?</ThemedText>
                            <Switch
                                trackColor={{ false: "#767577", true: gymColor || '#81b0ff' }}
                                thumbColor={formData.resetMensual ? '#f4f3f4' : '#f4f3f4'}
                                ios_backgroundColor="#3e3e3e"
                                onValueChange={(value) => handleFormChange('resetMensual', value)}
                                value={formData.resetMensual}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                                <Text style={styles.buttonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, { backgroundColor: '#1a5276' }]} onPress={handleFormSubmit}>
                                <Text style={styles.buttonText}>{editingClassType ? 'Actualizar' : 'Guardar'}</Text>
                            </TouchableOpacity>
                        </View>
                    </ThemedView>
                </View>
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
    listContainer: { padding: 10, paddingBottom: 80 },
    card: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 8,
        padding: 15,
        marginVertical: 8,
        marginHorizontal: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 18, fontWeight: 'bold' },
    cardDescription: { fontSize: 14, opacity: 0.7, marginTop: 4 },
    priceText: {
        fontSize: 16,
        fontWeight: '600',
        color: gymColor,
        marginTop: 8,
    },
    cardActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 },
    actionButton: { marginLeft: 8, padding: 1 },
    fab: {
        position: 'absolute',
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        right: 20,
        bottom: 20,
        backgroundColor: '#1a5276',
        borderRadius: 30,
        elevation: 8,
    },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { width: '100%', height: '85%', borderRadius: 2, padding: 25, elevation: 5 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    inputLabel: { fontSize: 16, marginBottom: 8, opacity: 0.9 },
    input: {
        height: 50,
        backgroundColor: Colors[colorScheme].background,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    textArea: { height: 100, textAlignVertical: 'top', paddingTop: 15 },
    switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20, 
},
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5 },
    cancelButton: { backgroundColor: '#6c757d' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    
});

export default ClassTypeManagementScreen;
