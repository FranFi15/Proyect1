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

    // Configuración y Cortesía
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [visibilityDays, setVisibilityDays] = useState('0');
    const [courtesyConfig, setCourtesyConfig] = useState({ isActive: false, amount: '1', tipoClase: '' });

    const performDataFetch = useCallback(async () => {
        try {
            const [typesRes, settingsRes] = await Promise.all([
                apiClient.get('/tipos-clase'),
                apiClient.get('/settings')
            ]);
            setClassTypes(typesRes.data?.tiposClase || []);
            setVisibilityDays(settingsRes.data.classVisibilityDays.toString());
            
            if (settingsRes.data.courtesyCredit) {
                setCourtesyConfig({
                    isActive: settingsRes.data.courtesyCredit.isActive,
                    amount: settingsRes.data.courtesyCredit.amount.toString(),
                    tipoClase: settingsRes.data.courtesyCredit.tipoClase?._id || settingsRes.data.courtesyCredit.tipoClase || ''
                });
            }
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos.' });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

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
            const payload = { 
                classVisibilityDays: Number(visibilityDays) || 0,
                courtesyCredit: {
                    isActive: courtesyConfig.isActive,
                    amount: Number(courtesyConfig.amount) || 1,
                    tipoClase: courtesyConfig.tipoClase
                }
            };
            await apiClient.put('/settings', payload);
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
        <View>   
            <ThemedText style={styles.listTitle}>Créditos</ThemedText>
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
        </View>
    ), [searchTerm, colorScheme, gymColor]);

    const renderClassTypeItem = ({ item }) => (
        <View style={styles.itemCard}>
            <View style={styles.cardContent}>
                <ThemedText style={styles.itemTitle}>{item.nombre} {item.esUniversal && <FontAwesome6 name="shield" size={14} color="#f39c12" style={{ marginLeft: 10 }}/>}</ThemedText>
                <ThemedText style={styles.cardDescription}>
                    {item.resetMensual ? 'Vencimiento Mensual' : 'Sin Vencimiento'}
                </ThemedText>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                    <FontAwesome6 name="edit" size={21} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                {!item.esUniversal && (
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
                        <Octicons name="trash" size={24} color={Colors[colorScheme].text} />
                    </TouchableOpacity>
                )}
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
            
            {/* --- FAB DE CONFIGURACIÓN (Nuevo) --- */}
            <TouchableOpacity 
                style={styles.fabSettings} 
                onPress={() => setIsSettingsModalVisible(true)}
            >
                <FontAwesome5 name="cog" size={24} color="#fff" />
            </TouchableOpacity>

            {/* --- FAB DE AGREGAR (Existente) --- */}
            <TouchableOpacity 
                style={styles.fabAdd} 
                onPress={handleAdd}
            >
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* ... (Resto de Modales: Configuración y Editar) ... */}
            <Modal 
                visible={isSettingsModalVisible}  
                transparent={true} 
                animationType="fade" 
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
                    <ScrollView>
                        <ThemedText style={styles.modalTitle}>Configuración General</ThemedText>
                        
                        <ThemedText style={styles.sectionTitle}>Calendario</ThemedText>
                        <ThemedText style={styles.cardDescription}>
                            Define cuántos días hacia el futuro podrán ver y reservar tus clientes.
                        </ThemedText>
                        <ThemedText style={styles.inputLabel}>Días visibles (0 = sin límite):</ThemedText>
                        <TextInput 
                            style={styles.input} 
                            value={visibilityDays} 
                            onChangeText={setVisibilityDays} 
                            keyboardType="number-pad"
                            placeholder="0"
                        />

                        {/* Configuración de Cortesía */}
                        <View style={{borderTopWidth:1, borderColor: Colors[colorScheme].border, paddingTop: 15, marginTop: 10}}>
                            <ThemedText style={styles.sectionTitle}>Crédito de Bienvenida</ThemedText>
                            
                            <View style={styles.switchContainer}>
                                <ThemedText style={styles.inputLabel}>¿Activar crédito de bienvenida al registrarse?</ThemedText>
                                <Switch
                                    trackColor={{ false: "#767577", true: gymColor }}
                                    thumbColor={'#f4f3f4'}
                                    onValueChange={(val) => setCourtesyConfig(prev => ({...prev, isActive: val}))}
                                    value={courtesyConfig.isActive}
                                />
                            </View>

                            {courtesyConfig.isActive && (
                                <>
                                    <ThemedText style={styles.inputLabel}>¿Qué crédito dar?</ThemedText>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                                        {classTypes.map(type => (
                                            <TouchableOpacity 
                                                key={type._id} 
                                                onPress={() => setCourtesyConfig(prev => ({...prev, tipoClase: type._id}))}
                                                style={[
                                                    styles.dayChip, 
                                                    courtesyConfig.tipoClase === type._id && { backgroundColor: gymColor }
                                                ]}
                                            >
                                                <Text style={{ 
                                                    color: courtesyConfig.tipoClase === type._id ? '#fff' : Colors[colorScheme].text,
                                                    padding: 8 
                                                }}>
                                                    {type.nombre}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    <ThemedText style={styles.inputLabel}>Cantidad de créditos:</ThemedText>
                                    <TextInput 
                                        style={styles.input} 
                                        value={courtesyConfig.amount} 
                                        onChangeText={(text) => setCourtesyConfig(prev => ({...prev, amount: text}))} 
                                        keyboardType="number-pad"
                                    />
                                </>
                            )}
                        </View>

                        <Button title="Guardar Configuración" onPress={handleSaveSettings} color={gymColor} />
                    </ScrollView>
                </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal 
                visible={isModalVisible} 
                transparent={true} 
                animationType="fade" 
                onRequestClose={() => setIsModalVisible(false)}
            >
                {/* ... (Contenido del modal de editar crédito igual que antes) ... */}
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
    listContainer: { paddingBottom: 100 }, // Aumentamos paddingBottom para que la lista no quede tapada por los FABs
    headerContainer: { padding: 15, alignItems: 'center' },
    listTitle: {
       backgroundColor: gymColor,
       paddingVertical: 10,
       paddingHorizontal: 20,
       alignItems: 'center',
       alignSelf: 'center',
       width: '100%',
       textAlign: 'center',
       fontWeight: 'bold',
       color: '#fff',
       fontSize: 18,
    },
    searchInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 5, 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].border,
        marginTop: 15,
        marginHorizontal: 15, // Agregado para margen lateral
        marginBottom: 10
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
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { padding: 8, marginLeft: 10 },
    
    // --- ESTILOS DE LOS FABS ---
    fabAdd: {
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
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.2, 
        shadowRadius: 1.41,
        zIndex: 999
    },
    fabSettings: {
        position: 'absolute', 
        width: 60, // Un poco más chico que el principal
        height: 60, 
        alignItems: 'center', 
        justifyContent: 'center', 
        right: 20, // Centrado respecto al de abajo (60-50)/2 + 20
        bottom: 90, // Encima del otro (20 bottom + 60 height + 10 margin)
        backgroundColor: '#7f8c8d', // Gris para diferenciarlo (configuración), o usa gymColor si prefieres
        borderRadius: 30, 
        elevation: 8,
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.2, 
        shadowRadius: 1.41,
        zIndex: 999
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
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 10 },
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
    
    // Estilos para los chips en el modal de configuración
    dayChip: { 
        paddingVertical: 6, 
        paddingHorizontal: 10, 
        borderRadius: 5, 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].border, 
        marginRight: 8,
        backgroundColor: Colors[colorScheme].cardBackground
    },
});

export default ClassTypeManagementScreen;