import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput,
    useColorScheme, ActivityIndicator, RefreshControl, Switch,
    KeyboardAvoidingView, ScrollView, Platform, Button, Pressable,Modal,Linking
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons, FontAwesome5 } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';

const ClassTypeManagementScreen = () => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [alertInfo, setAlertInfo] = useState({ visible: false });

    const [viewMode, setViewMode] = useState('types');
   
    const [classTypes, setClassTypes] = useState([]);
    const [isClassTypeModalVisible, setIsClassTypeModalVisible] = useState(false);
    const [editingClassType, setEditingClassType] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', descripcion: '', price: '0', resetMensual: true });

    const [packages, setPackages] = useState([]);
    const [isPackageModalVisible, setIsPackageModalVisible] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    const [packageFormData, setPackageFormData] = useState({ name: '', tipoClase: '', price: '0', creditsToReceive: '0', isActive: true });
    const [mpConnected, setMpConnected] = useState(false);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);


    const [isPickerModalVisible, setPickerModalVisible] = useState(false);
    
    const fetchData = useCallback(async () => {
        try {
            // Hacemos las dos llamadas a la API en paralelo
            const [typesRes, statusRes, packagesRes] = await Promise.all([
                apiClient.get('/tipos-clase'),
                apiClient.get('/clients/status'),
                apiClient.get('/packages'),
            ]);

            if (typesRes.data && Array.isArray(typesRes.data.tiposClase)) {
                setClassTypes(typesRes.data.tiposClase);
            }
            setMpConnected(statusRes.data.mpConnected);
            setPackages(packagesRes.data || []);

        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos.' });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { setIsLoading(true); fetchData(); }, [fetchData]));
    const onRefresh = useCallback(() => { setIsRefreshing(true); fetchData(); }, [fetchData]);

    const handleAddPackage = () => {
        setEditingPackage(null);
        setPackageFormData({ name: '', tipoClase: '', price: '0', creditsToReceive: '0', isActive: true });
        setIsPackageModalVisible(true);
    };

    const handleEditPackage = (pkg) => {
        setEditingPackage(pkg);
        setPackageFormData({
            name: pkg.name,
            tipoClase: pkg.tipoClase._id,
            price: pkg.price.toString(),
            creditsToReceive: pkg.creditsToReceive.toString(),
            isActive: pkg.isActive,
        });
        setIsPackageModalVisible(true);
    };

    const handlePackageFormSubmit = async () => {
        const { name, tipoClase, price, creditsToReceive } = packageFormData;
        if (!name || !tipoClase || !price || !creditsToReceive) {
            return setAlertInfo({ visible: true, title: 'Error', message: 'Todos los campos son obligatorios.' });
        }
        const payload = { ...packageFormData, price: Number(price), creditsToReceive: Number(creditsToReceive) };
        const apiCall = editingPackage ? apiClient.put(`/packages/${editingPackage._id}`, payload) : apiClient.post('/packages', payload);
        try {
            await apiCall;
            setAlertInfo({ visible: true, title: 'Éxito', message: `Paquete ${editingPackage ? 'actualizado' : 'creado'} exitosamente.` });
            setIsPackageModalVisible(false);
            fetchData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'Error al guardar el paquete.' });
        }
    };

    const handleDeletePackage = (pkg) => {
        setAlertInfo({
            visible: true,
            title: 'Confirmar Eliminación',
            message: `¿Seguro que quieres eliminar el paquete "${pkg.name}"?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/packages/${pkg._id}`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Paquete eliminado.' });
                        fetchData();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar.' });
                    }
                }}
            ]
        });
    };
   
    const handleConnectMercadoPago = async () => {
        try {
            const platform = Platform.OS === 'web' ? 'web' : 'mobile';
            const { data } = await apiClient.post('/connect/mercadopago/url', { platform });

            if (data.authUrl) {
                Linking.openURL(data.authUrl);
            }
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo iniciar la conexión con Mercado Pago.' });
        }
    };

    const filteredData = useMemo(() => {
        const data = viewMode === 'types' ? classTypes : packages;
        if (!searchTerm) return data;
        return data.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [viewMode, classTypes, packages, searchTerm]);

    const handleFormChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
    };

    const handleAdd = () => {
        setEditingClassType(null);
        setFormData({ nombre: '', descripcion: '', price: '0', resetMensual: true });
        setIsClassTypeModalVisible(true);
    };

    const handleEdit = (type) => {
        setEditingClassType(type);
        setFormData({
            nombre: type.nombre,
            descripcion: type.descripcion || '',
            price: type.price?.toString() || '0',
            resetMensual: type.resetMensual ?? true,
        });
        setIsClassTypeModalVisible(true);
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
            setIsClassTypeModalVisible(false);
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
            <View style={styles.listHeaderContainer}>
                <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterButton, viewMode === 'types' && styles.filterButtonActive]}
                    onPress={() => setViewMode('types')}
                >
                    <Text style={[styles.filterButtonText, viewMode === 'types' && styles.filterButtonTextActive]}>Tipos de Crédito</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, viewMode === 'packages' && styles.filterButtonActive]}
                    onPress={() => setViewMode('packages')}
                >
                    <Text style={[styles.filterButtonText, viewMode === 'packages' && styles.filterButtonTextActive]}>Paquetes</Text>
                </TouchableOpacity>
            </View>
                <View style={styles.listTitleContainer}>
                    <ThemedText style={styles.listTitle}>Créditos</ThemedText>
                    <TouchableOpacity onPress={() => setIsSettingsModalVisible(true)} style={styles.settingsButton}>
                        <FontAwesome6 name="handshake-simple" size={22} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>
                </View>
                 <View style={styles.searchInputContainer}>
                 <TextInput style={styles.searchInput} placeholder={`Buscar ${viewMode === 'types' ? 'créditos...' : 'paquetes...'}`} value={searchTerm} onChangeText={setSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />
                 <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
            </View>
            </View>
        </>
    );
    
    const renderPackageItem = ({ item }) => (
        <View style={[styles.itemCard, !item.isActive && styles.inactiveCard]}>
            <View style={styles.cardContent}>
                <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
                <Text style={styles.priceText}>Precio: ${item.price?.toFixed(2) || '0.00'}</Text>
                <ThemedText style={styles.cardDescription}>
                    Otorga: {item.creditsToReceive} créditos de {item.tipoClase?.nombre || 'N/A'}
                </ThemedText>
                <ThemedText style={[styles.cardDescription, { fontStyle: 'italic', color: item.isActive ? "#078b00ff" : "#7d7d7dff" }]}>
                    {item.isActive ? 'Activo' : 'Inactivo'}
                </ThemedText>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => handleEditPackage(item)} style={styles.actionButton}>
                    <FontAwesome6 name="edit" size={21} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeletePackage(item)} style={styles.actionButton}>
                    <Octicons name="trash" size={24} color={Colors[colorScheme].text} />
                </TouchableOpacity>
            </View>
        </View>
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
                data={filteredData}
                renderItem={viewMode === 'types' ? renderClassType : renderPackageItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay {viewMode === 'types' ? 'créditos' : 'paquetes'} registrados.</ThemedText>}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[gymColor]} />}
            />

            <TouchableOpacity style={styles.fab} onPress={viewMode === 'types' ? handleAdd : handleAddPackage}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
            <Modal
                animationType="slide"
                transparent={true}
                visible={isSettingsModalVisible}
                onRequestClose={() => setIsSettingsModalVisible(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsSettingsModalVisible(false)} />
                    <View style={styles.modalContainer}>
                         <TouchableOpacity onPress={() => setIsSettingsModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView>
                            <ThemedText style={styles.modalTitle}>Configuración</ThemedText>
                            
                            <View style={styles.card}>
                                <ThemedText style={styles.cardTitle}>Integración con Mercado Pago</ThemedText>
                                {mpConnected ? (
                                    <View style={styles.connectedContainer}>
                                        <Ionicons name="checkmark-circle" size={24} color="green" />
                                        <Text style={styles.connectedText}>Tu cuenta de Mercado Pago está conectada.</Text>
                                    </View>
                                ) : (
                                    <>
                                        <ThemedText style={styles.cardDescription}>Conecta tu cuenta de Mercado Pago para recibir los pagos de tus clientes directamente.</ThemedText>
                                        <TouchableOpacity style={styles.mpButton} onPress={handleConnectMercadoPago}>
                                            <Text style={styles.mpButtonText}>Conectar con Mercado Pago</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            <Modal
                animationType="slide"
                transparent={true}
                visible={isClassTypeModalVisible}
                onRequestClose={() => setIsClassTypeModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlayWrapper}
                >
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsClassTypeModalVisible(false)} />
                    
                    <View style={styles.modalContainer}>
                        <TouchableOpacity onPress={() => setIsClassTypeModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView showsVerticalScrollIndicator={false}>
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
                                    thumbColor={'#f4f3f4'}
                                    ios_backgroundColor="#3e3e3e"
                                    onValueChange={(value) => handleFormChange('resetMensual', value)}
                                    value={formData.resetMensual}
                                />
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setIsClassTypeModalVisible(false)}>
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
            <Modal visible={isPackageModalVisible} transparent={true} animationType="slide" onRequestClose={() => setIsPackageModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsPackageModalVisible(false)} />
                    <View style={styles.modalContainer}>
                        <TouchableOpacity onPress={() => setIsPackageModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView>
                            <ThemedText style={styles.modalTitle}>{editingPackage ? 'Editar Paquete' : 'Crear Paquete'}</ThemedText>
                            
                            <ThemedText style={styles.inputLabel}>Nombre del Paquete</ThemedText>
                            <TextInput style={styles.input} value={packageFormData.name} onChangeText={(text) => setPackageFormData(p => ({...p, name: text}))} placeholder="Ej: Promo Invierno" placeholderTextColor={Colors[colorScheme].text}/>
                            
                            <ThemedText style={styles.inputLabel}>Tipo de Crédito que otorga</ThemedText>
                            <TouchableOpacity style={styles.input} onPress={() => {
                                    setIsPackageModalVisible(false); 
                                    setPickerModalVisible(true);      
                                }}>
                                <Text style={styles.inputText}>{classTypes.find(c => c._id === packageFormData.tipoClase)?.nombre || 'Seleccionar...'}</Text>
                            </TouchableOpacity>

                            <ThemedText style={styles.inputLabel}>Precio del Paquete (ARS)</ThemedText>
                            <TextInput style={styles.input} value={packageFormData.price} onChangeText={(text) => setPackageFormData(p => ({...p, price: text}))} keyboardType="numeric" placeholder="Ej: 8000"/>

                            <ThemedText style={styles.inputLabel}>Cantidad de Créditos que Otorga</ThemedText>
                            <TextInput style={styles.input} value={packageFormData.creditsToReceive} onChangeText={(text) => setPackageFormData(p => ({...p, creditsToReceive: text}))} keyboardType="numeric" placeholder="Ej: 12"/>
                            
                            <View style={styles.switchContainer}>
                                <ThemedText style={styles.inputLabel}>Paquete Activo</ThemedText>
                                <Switch value={packageFormData.isActive} onValueChange={(value) => setPackageFormData(p => ({...p, isActive: value}))} trackColor={{ false: "#767577", true: gymColor }}/>
                            </View>
                            
                            <Button title={editingPackage ? "Actualizar Paquete" : "Crear Paquete"} onPress={handlePackageFormSubmit} color={gymColor} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            <FilterModal 
                visible={isPickerModalVisible}
               onClose={() => {
                    setPickerModalVisible(false);   
                    setIsPackageModalVisible(true);
                }}
                onSelect={(id) => {
                    setPackageFormData(p => ({...p, tipoClase: id}));
                    setPickerModalVisible(false);
                    setIsPackageModalVisible(true);
                }}
                title="Seleccionar Tipo de Crédito"
                options={classTypes.map(ct => ({ _id: ct._id, nombre: ct.nombre }))}
                selectedValue={packageFormData.tipoClase}
                theme={{ colors: Colors[colorScheme], gymColor }}
            />
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
    cardTitle: { 
        fontSize: 18, 
        fontWeight: '600', 
        marginBottom: 20, 
        borderBottomWidth: 1, 
        borderBottomColor: Colors[colorScheme].border, 
        paddingBottom: 10,
        color: Colors[colorScheme].text,
    },
    inputLabel: { 
        fontSize: 16, 
        marginBottom: 8, 
        opacity: 0.9, 
        color: Colors[colorScheme].text 
    },
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
        justifyContent: 'center', // Para alinear el texto del TouchableOpacity
    },
    inputText: { // Estilo para el texto dentro del input "falso" (TouchableOpacity)
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    headerContainer: { 
        paddingHorizontal: 15, 
        paddingTop: 15 
    },
    filterContainer: { 
        flexDirection: 'row', 
        marginBottom: 15, 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 8, 
        padding: 4, 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].border 
    },
    filterButton: { 
        flex: 1, 
        paddingVertical: 10, 
        borderRadius: 6 
    },
    filterButtonActive: { 
        backgroundColor: gymColor 
    },
    filterButtonText: { 
        textAlign: 'center', 
        fontWeight: '600', 
        color: Colors[colorScheme].text 
    },
    filterButtonTextActive: { 
        color: '#fff' 
    },
    listHeaderContainer: { 
        borderTopWidth: 1, 
        borderTopColor: Colors[colorScheme].border, 
        paddingTop: 20, 
        marginHorizontal: 15 
    },
    listTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    listTitle: { 
        fontSize: 24, 
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
    },
    settingsButton: { 
        padding: 8 
    },
    searchInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 8, 
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
    searchIcon: { 
        marginRight: 15 
    },
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
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,
    },
    inactiveCard: { 
        opacity: 0.5 
    },
    cardContent: { flex: 1 },
    itemTitle: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: Colors[colorScheme].text 
    },
    cardDescription: { 
        fontSize: 14, 
        opacity: 0.7, 
        marginTop: 4, 
        color: Colors[colorScheme].text 
    },
    priceText: { 
        fontSize: 16, 
        fontWeight: '600', 
        color: gymColor, 
        marginTop: 8 
    },
    cardActions: { 
        flexDirection: 'row', 
        alignItems: 'center' 
    },
    actionButton: { 
        padding: 8, 
        marginLeft: 10 
    },
    fab: {
        position: 'absolute', 
        width: 60, 
        height: 60, 
        alignItems: 'center', 
        justifyContent: 'center', 
        right: 20, 
        bottom: 20,
        backgroundColor: gymColor || '#1a5276', 
        borderRadius: 30, 
        elevation: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,
    },
    emptyText: { 
        textAlign: 'center', 
        marginTop: 50, 
        fontSize: 16,
        color: Colors[colorScheme].text,
    },
    modalOverlayWrapper: { 
        ...StyleSheet.absoluteFillObject, 
        zIndex: 1000, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    modalBackdrop: { 
        ...StyleSheet.absoluteFillObject, 
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContainer: { 
        width: '100%',
        maxHeight: '85%',
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 12,
        padding: 25,
        elevation: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,
    },
    modalView: { 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '90%',
        backgroundColor: Colors[colorScheme].background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    modalTitle: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        marginBottom: 20, 
        textAlign: 'center',
        color: Colors[colorScheme].text,
    },
    closeButton: { 
        position: 'absolute', 
        top: 15, 
        right: 15, 
        zIndex: 10 
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
    },
    modalActions: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        marginTop: 10,
        gap: 10, 
    },
    button: { 
        flex: 1, 
        paddingVertical: 12, 
        borderRadius: 8, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    cancelButton: { 
        backgroundColor: '#6c757d' 
    },
    mpButton: {
        backgroundColor: '#009EE3', 
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: { 
        color: '#fff', 
        fontSize: 16, 
        fontWeight: 'bold' 
    },
    mpButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    connectedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 10,
    },
    connectedText: {
        fontSize: 16,
        color: 'green',
        fontWeight: '500',
        flexShrink: 1,
    },
});

export default ClassTypeManagementScreen;

