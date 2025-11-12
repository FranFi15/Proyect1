import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput,
    useColorScheme, ActivityIndicator, RefreshControl, Switch,
    KeyboardAvoidingView, ScrollView, Platform, Button, Pressable, Modal
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons, FontAwesome5 } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

const ClassTypeManagementScreen = () => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [classTypes, setClassTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingClassType, setEditingClassType] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', price: '0', resetMensual: true });
    const [alertInfo, setAlertInfo] = useState({ visible: false });

    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [visibilityDays, setVisibilityDays] = useState('0');

    const performDataFetch = useCallback(async () => {
        try {
            const [typesRes, settingsRes] = await Promise.all([
                apiClient.get('/tipos-clase'),
                apiClient.get('/settings')
            ]);
            setClassTypes(typesRes.data?.tiposClase || []);
            setVisibilityDays(settingsRes.data.classVisibilityDays.toString());
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los tipos de crédito.' });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []); // Empty dependency array as it doesn't depend on props or state

    useFocusEffect(
        useCallback(() => {
            setIsLoading(true);
            performDataFetch();
        }, [performDataFetch])
    );

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        performDataFetch();
    }, [performDataFetch]);
    
    const handleFormChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleAdd = () => {
        setEditingClassType(null);
        setFormData({ nombre: '', price: '0', resetMensual: true });
        setIsModalVisible(true);
    };

    const handleEdit = (type) => {
        setEditingClassType(type);
        setFormData({
            nombre: type.nombre,
            price: type.price?.toString() || '0',
            resetMensual: type.resetMensual ?? true,
        });
        setIsModalVisible(true);
    };

    const handleFormSubmit = async () => {
        if (!formData.nombre) {
            return setAlertInfo({ visible: true, title: 'Campo Requerido', message: 'El nombre del tipo de crédito es obligatorio.' });
        }

        const payload = { ...formData, price: Number(formData.price) || 0 };
        const apiCall = editingClassType 
            ? apiClient.put(`/tipos-clase/${editingClassType._id}`, payload) 
            : apiClient.post('/tipos-clase', payload);

        try {
            await apiCall;
            setAlertInfo({ visible: true, title: 'Éxito', message: `Crédito ${editingClassType ? 'actualizado' : 'añadido'} exitosamente.` });
            setIsModalVisible(false);
            performDataFetch();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || `Error al ${editingClassType ? 'actualizar' : 'añadir'}.` });
        }
    };
    
    const handleDelete = (type) => {
        setAlertInfo({
            visible: true,
            title: 'Confirmar Eliminación',
            message: `¿Estás seguro de que quieres eliminar "${type.nombre}"?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/tipos-clase/${type._id}`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Tipo de crédito eliminado.' });
                        performDataFetch();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar.' });
                    }
                }}
            ]
        });
    };

    const handleSaveSettings = async () => {
        try {
           await apiClient.put('/settings', { classVisibilityDays: Number(visibilityDays) || 0 });
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Configuración guardada.' });
            setIsSettingsModalVisible(false);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo guardar la configuración.' });
        }
    };

    const filteredClassTypes = useMemo(() => {
        if (!searchTerm) return classTypes;
        return classTypes.filter(type =>
            type.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [classTypes, searchTerm]);

    const renderHeader = useCallback(() => (
        <View style={styles.headerContainer}>
            <ThemedText style={styles.listTitle}>Gestión de Créditos</ThemedText>
            <View style={styles.searchInputContainer}>
                <TextInput 
                    style={styles.searchInput} 
                    placeholder="Buscar créditos..." 
                    placeholderTextColor={Colors[colorScheme].icon}
                    value={searchTerm} 
                    onChangeText={setSearchTerm} 
                />
                <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
            </View>
            <TouchableOpacity onPress={() => setIsSettingsModalVisible(true)}>
                <FontAwesome5 name="cog" size={22} color={Colors[colorScheme].icon} style={styles.settingsIcon} />
            </TouchableOpacity>
        </View>
    ), [searchTerm, colorScheme, gymColor]);

    const renderClassTypeItem = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.cardContent}>
                <ThemedText style={styles.itemTitle}>{item.nombre}</ThemedText>
                <Text style={styles.priceText}>Precio: ${item.price?.toFixed(2) || '0.00'}</Text>
                <ThemedText style={styles.cardDescription}>
                    {item.resetMensual ? 'Vencimiento Mensual' : 'Sin Vencimiento'}
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
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }
    
    return (
        <ThemedView style={styles.container}>
            <FlatList
                ListHeaderComponent={renderHeader}
                data={filteredClassTypes}
                renderItem={renderClassTypeItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay tipos de crédito registrados.</ThemedText>}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[gymColor]} />}
            />
            <TouchableOpacity style={styles.fab} onPress={handleAdd}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            <Modal 
                visible={isSettingsModalVisible}  
                transparent={true} 
                animationType="slide" 
                onRequestClose={() => setIsSettingsModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlayWrapper}
                >
                <Pressable style={styles.modalBackdrop} onPress={() => setIsSettingsModalVisible(false)} />
                <View style={styles.modalContainer}>
                    <TouchableOpacity onPress={() => setIsSettingsModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                    <ThemedText style={styles.modalTitle}>Visibilidad del Calendario</ThemedText>
                    <ThemedText style={styles.cardDescription}>
                        Define cuántos días hacia el futuro podrán ver y reservar tus clientes. (Pon 0 para no tener límite).
                    </ThemedText>
                    <ThemedText style={styles.inputLabel}>Mostrar turnos de los próximos (días):</ThemedText>
                    <TextInput 
                        style={styles.input} 
                        value={visibilityDays} 
                        onChangeText={setVisibilityDays} 
                        keyboardType="number-pad"
                        placeholder="0"
                    />
                    <Button title="Guardar Configuración" onPress={handleSaveSettings} color={gymColor} />
                </View>
                </KeyboardAvoidingView>
            </Modal>
            <Modal 
                visible={isModalVisible} 
                transparent={true} 
                animationType="slide" 
                onRequestClose={() => setIsModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlayWrapper}
                >
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsModalVisible(false)} />
                    <View style={styles.modalContainer}>
                        <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <ThemedText style={styles.modalTitle}>
                                {editingClassType ? 'Editar Crédito' : 'Añadir Crédito'}
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
                                <ThemedText style={styles.inputLabel}>¿Reiniciar mensualmente?</ThemedText>
                                <Switch
                                    trackColor={{ false: "#767577", true: gymColor || '#81b0ff' }}
                                    thumbColor={'#f4f3f4'}
                                    ios_backgroundColor="#3e3e3e"
                                    onValueChange={(value) => handleFormChange('resetMensual', value)}
                                    value={formData.resetMensual}
                                />
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                                    <Text style={styles.buttonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, { backgroundColor: gymColor || '#1a5276' }]} onPress={handleFormSubmit}>
                                    <Text style={styles.buttonText}>{editingClassType ? 'Actualizar' : 'Guardar'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                onClose={() => setAlertInfo({ visible: false })}
                buttons={alertInfo.buttons || [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }]}
                gymColor={gymColor}
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { paddingBottom: 80 },
    headerContainer: { padding: 15 },
    listTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: Colors[colorScheme].text },
    searchInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 5, 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].border 
    },
    searchInput: { 
        flex: 1, 
        height: 50, 
        paddingHorizontal: 15, 
        color: Colors[colorScheme].text, 
        fontSize: 16 
    },
    searchIcon: { marginRight: 15 },
    itemCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 5,
        padding: 15,
        marginVertical: 8,
        marginHorizontal: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 
    },
    cardContent: { flex: 1 },
    itemTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardDescription: { fontSize: 14, opacity: 0.7, marginTop: 4, color: Colors[colorScheme].text },
    priceText: { fontSize: 16, fontWeight: '600', color: gymColor, marginTop: 8 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { padding: 8, marginLeft: 10 },
    fab: {
        position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20,
        backgroundColor: gymColor || '#1a5276', borderRadius: 30, elevation: 8,
    },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: Colors[colorScheme].text },
    modalOverlayWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContainer: {
        width: '90%',
        maxHeight: '85%',
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 5,
        padding: 25,
        elevation: 5
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    inputLabel: { fontSize: 16, marginBottom: 8, opacity: 0.9, color: Colors[colorScheme].text },
    input: {
        height: 50,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 15,
        marginBottom: 20,
        backgroundColor: Colors[colorScheme].cardBackground,
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
    button: { flex: 1, paddingVertical: 12, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#6c757d' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    settingsIcon: {marginTop: 20, marginLeft: 10 }
    
});

export default ClassTypeManagementScreen;