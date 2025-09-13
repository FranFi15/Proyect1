import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput,
    useColorScheme, ActivityIndicator, RefreshControl, Switch,
    KeyboardAvoidingView, ScrollView, Platform, Button, Pressable
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

    // --- ESTADOS EXISTENTES ---
    const [classTypes, setClassTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingClassType, setEditingClassType] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', descripcion: '', price: '0', resetMensual: true });
    const [alertInfo, setAlertInfo] = useState({ visible: false });

    // --- NUEVOS ESTADOS PARA LA CONFIGURACIÓN ---
    const [hasSecurityKey, setHasSecurityKey] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [oldSecurityKey, setOldSecurityKey] = useState('');
    const [newSecurityKey, setNewSecurityKey] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [securityKeyForToken, setSecurityKeyForToken] = useState('');
    
    // --- LÓGICA DE DATOS ---
    const fetchData = useCallback(async () => {
        try {
            // Hacemos las dos llamadas a la API en paralelo
            const [typesRes, settingsRes] = await Promise.all([
                apiClient.get('/tipos-clase'),
                apiClient.get('/settings/security-key')
            ]);

            if (typesRes.data && Array.isArray(typesRes.data.tiposClase)) {
                setClassTypes(typesRes.data.tiposClase);
            }
            setHasSecurityKey(settingsRes.data.hasSecurityKey);

        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos.' });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { setIsLoading(true); fetchData(); }, [fetchData]));
    const onRefresh = useCallback(() => { setIsRefreshing(true); fetchData(); }, [fetchData]);

    // --- NUEVAS FUNCIONES PARA MANEJAR LA CONFIGURACIÓN ---
    const handleUpdateKey = async () => {
        setIsLoading(true);
        try {
            await apiClient.put('/settings/security-key', {
                currentPassword,
                oldSecurityKey: hasSecurityKey ? oldSecurityKey : undefined,
                newSecurityKey,
            });
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Clave de seguridad actualizada.' });
            // Limpiamos los campos y recargamos el estado
            setCurrentPassword('');
            setOldSecurityKey('');
            setNewSecurityKey('');
            await fetchData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar la clave.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateToken = async () => {
        setIsLoading(true);
        try {
            await apiClient.put('/settings/mercadopago', {
                accessToken,
                securityKey: securityKeyForToken,
            });
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Token de Mercado Pago actualizado.' });
            setAccessToken('');
            setSecurityKeyForToken('');
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el token.' });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClassTypes = useMemo(() => {
        if (!searchTerm) {
            return classTypes;
        }
        return classTypes.filter(type =>
            type.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [classTypes, searchTerm]);

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
            setAlertInfo({ visible: true, title: 'Campo Requerido', message: 'El nombre del tipo de turno es obligatorio.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }

        const payload = { ...formData, price: Number(formData.price) || 0 };
        const apiCall = editingClassType ? apiClient.put(`/tipos-clase/${editingClassType._id}`, payload) : apiClient.post('/tipos-clase', payload);

        try {
            await apiCall;
            setAlertInfo({ visible: true, title: 'Éxito', message: `Tipo de Turno ${editingClassType ? 'actualizado' : 'añadido'} exitosamente.`, buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
            setIsModalVisible(false);
            fetchData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || `Error al ${editingClassType ? 'actualizar' : 'añadir'}.`, buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
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
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.delete(`/tipos-clase/${type._id}`);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'Tipo de turno eliminado.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchData();
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'Error al eliminar.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    },
                },
            ]
        });
    };
    
     


    const renderHeader = () => (
        <>
            <View style={styles.card}>
                <ThemedText style={styles.cardTitle}>
                    {hasSecurityKey ? 'Cambiar Clave de Seguridad' : 'Crear Clave de Seguridad'}
                </ThemedText>
                <ThemedText style={styles.inputLabel}>Tu Contraseña de Administrador</ThemedText>
                <TextInput style={styles.input} placeholder="..." secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
                {hasSecurityKey && (
                    <>
                        <ThemedText style={styles.inputLabel}>Clave de Seguridad Actual</ThemedText>
                        <TextInput style={styles.input} placeholder="..." secureTextEntry value={oldSecurityKey} onChangeText={setOldSecurityKey} />
                    </>
                )}
                <ThemedText style={styles.inputLabel}>Nueva Clave de Seguridad</ThemedText>
                <TextInput style={styles.input} placeholder="..." secureTextEntry value={newSecurityKey} onChangeText={setNewSecurityKey} />
                <Button title={hasSecurityKey ? 'Cambiar Clave' : 'Crear Clave'} onPress={handleUpdateKey} color={gymColor} />
            </View>

            {hasSecurityKey && (
                <View style={styles.card}>
                    <ThemedText style={styles.cardTitle}>Integración con Mercado Pago</ThemedText>
                    <ThemedText style={styles.inputLabel}>Tu Clave de Seguridad</ThemedText>
                    <TextInput style={styles.input} placeholder="Ingresa tu clave para confirmar" secureTextEntry value={securityKeyForToken} onChangeText={setSecurityKeyForToken} />
                    <ThemedText style={styles.inputLabel}>Access Token de Mercado Pago</ThemedText>
                    <TextInput style={styles.input} placeholder="Pega aquí tu Access Token" value={accessToken} onChangeText={setAccessToken} />
                    <Button title="Guardar Token" onPress={handleUpdateToken} color={gymColor} />
                </View>
            )}
            
            <View style={styles.listHeaderContainer}>
                <ThemedText style={styles.listTitle}>Créditos</ThemedText>
                <View style={styles.searchInputContainer}>
                    <TextInput style={styles.searchInput} placeholder="Buscar..." value={searchTerm} onChangeText={setSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />
                    <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
                </View>
            </View>
        </>
    );
    
    const renderClassType = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.cardContent}>
                <ThemedText style={styles.itemTitle}>{item.nombre}</ThemedText>
                <Text style={styles.priceText}>Precio: ${item.price?.toFixed(2) || '0.00'}</Text>
                <ThemedText style={[styles.cardDescription, { fontStyle: 'italic' }]}>
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
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }
    
    return (
        <ThemedView style={styles.container}>
            <FlatList
                ListHeaderComponent={renderHeader}
                data={filteredClassTypes}
                renderItem={renderClassType}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay créditos registrados.</ThemedText>}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[gymColor]} />}
            />

            <TouchableOpacity style={styles.fab} onPress={handleAdd}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {isModalVisible && (
                // 1. El overlay ahora es un KeyboardAvoidingView para mover todo el modal hacia arriba
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    {/* El Pressable para cerrar el modal al tocar fuera sigue aquí */}
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsModalVisible(false)} />
                    
                    {/* El contenedor del modal */}
                    <Pressable style={styles.modalContainer}>
                        {/* 2. El contenido del modal se envuelve en un ScrollView */}
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
                                <ThemedText style={styles.inputLabel}>¿Reiniciar créditos mensualmente?</ThemedText>
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
                    </Pressable>
                </KeyboardAvoidingView>
            )}

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
    content: { padding: 20 },
    listContainer: { paddingBottom: 80 },
    card: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 12,
        padding: 20,
        marginHorizontal: 15,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border, paddingBottom: 10 },
    inputLabel: { fontSize: 16, marginBottom: 8, opacity: 0.9, color: Colors[colorScheme].text },
    input: {
        height: 50,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        backgroundColor: Colors[colorScheme].background,
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    listHeaderContainer: { borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 20, marginHorizontal: 15 },
    listTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, borderWidth: 1, borderColor: Colors[colorScheme].border },
    searchInput: { flex: 1, height: 50, paddingHorizontal: 15, color: Colors[colorScheme].text, fontSize: 16 },
    searchIcon: { marginRight: 15 },
    itemCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 8,
        padding: 15,
        marginVertical: 8,
        marginHorizontal: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
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
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
});

export default ClassTypeManagementScreen;

