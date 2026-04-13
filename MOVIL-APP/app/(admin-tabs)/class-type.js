import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput,
    useColorScheme, ActivityIndicator, RefreshControl, Switch,
    KeyboardAvoidingView, ScrollView, Platform, Button, Pressable, Modal, useWindowDimensions
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view'; // <-- Añadido para las pestañas
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons, FontAwesome5 } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';

// Importamos el componente específico para Web
import WebDatePicker from '@/components/WebDatePicker';

// --- COMPONENTE INTERNO: GESTIÓN DE SCOREBOARDS (MODAL) ---
// (Mantenido intacto como lo tenías)
const ScoreboardManagerModal = ({ visible, onClose, gymColor, colorScheme }) => {
    const styles = getStyles(colorScheme, gymColor);
    const [viewMode, setViewMode] = useState('list'); 
    const [scoreboards, setScoreboards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '', descripcion: '', metrics: [], metricUnit: '', hasDeadline: false, fechaLimite: new Date(), visible: true
    });
    const [editingId, setEditingId] = useState(null);
    const [datePickerConfig, setDatePickerConfig] = useState({ visible: false, currentValue: new Date() });

    const AVAILABLE_METRICS = [
        { id: 'peso', label: 'Peso', icon: 'dumbbell' },
        { id: 'tiempo', label: 'Tiempo', icon: 'stopwatch' },
        { id: 'distancia', label: 'Distancia', icon: 'road' },
        { id: 'repeticiones', label: 'Reps', icon: 'redo' },
    ];

    useEffect(() => {
        if (visible && viewMode === 'list') fetchScoreboards();
    }, [visible, viewMode]);

    const fetchScoreboards = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/scoreboards/active');
            setScoreboards(res.data || []);
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const handleEdit = (item) => {
        setEditingId(item._id);
        setFormData({
            nombre: item.nombre, descripcion: item.descripcion, metrics: item.metrics || [],
            metricUnit: item.metricUnit || '', hasDeadline: !!item.fechaLimite,
            fechaLimite: item.fechaLimite ? parseISO(item.fechaLimite) : new Date(), visible: item.visible
        });
        setViewMode('form');
    };

    const handleCreate = () => {
        setEditingId(null);
        setFormData({ nombre: '', descripcion: '', metrics: ['tiempo'], metricUnit: '', hasDeadline: false, fechaLimite: new Date(), visible: true });
        setViewMode('form');
    };

    const handleSubmit = async () => {
        if (!formData.nombre) return alert('El nombre es obligatorio');
        const payload = { ...formData, fechaLimite: formData.hasDeadline ? formData.fechaLimite : null };
        try {
            if (editingId) await apiClient.put(`/scoreboards/${editingId}`, payload);
            else await apiClient.post('/scoreboards', payload);
            setViewMode('list');
        } catch (e) { alert('Error al guardar'); }
    };

    const handleDelete = async (id) => {
        try {
            await apiClient.delete(`/scoreboards/${id}`);
            fetchScoreboards();
        } catch (e) { alert('Error al eliminar'); }
    };

    const toggleMetric = (id) => {
        setFormData(prev => {
            const exists = prev.metrics.includes(id);
            return { ...prev, metrics: exists ? prev.metrics.filter(m => m !== id) : [...prev.metrics, id] };
        });
    };

    const onDateChange = (event, selectedDate) => {
        if (event.type === 'dismissed') {
            setDatePickerConfig(prev => ({ ...prev, visible: false }));
            return;
        }
        const currentDate = selectedDate || datePickerConfig.currentValue;
        setDatePickerConfig(prev => ({ ...prev, visible: false }));
        setFormData(prev => ({ ...prev, fechaLimite: currentDate }));
    };

    const confirmIOSDate = () => {
        setFormData(prev => ({ ...prev, fechaLimite: datePickerConfig.currentValue }));
        setDatePickerConfig(prev => ({ ...prev, visible: false }));
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper}>
                <Pressable style={styles.modalBackdrop} onPress={onClose} />
                <View style={styles.modalContainerFull}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={viewMode === 'form' ? () => setViewMode('list') : onClose} style={{padding: 5}}>
                            <Ionicons name={viewMode === 'form' ? "arrow-back" : "close"} size={26} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                        <ThemedText style={styles.modalTitle}>
                            {viewMode === 'list' ? 'Desafios' : (editingId ? 'Editar Desafío' : 'Nuevo Desafío')}
                        </ThemedText>
                        <View style={{width: 26}} /> 
                    </View>

                    {viewMode === 'list' ? (
                        <>
                            {loading ? <ActivityIndicator color={gymColor} /> : (
                                <FlatList
                                    data={scoreboards}
                                    keyExtractor={item => item._id}
                                    contentContainerStyle={{paddingBottom: 80}}
                                    ListEmptyComponent={<Text style={styles.emptyText}>No hay desafíos activos.</Text>}
                                    renderItem={({ item }) => (
                                        <View style={styles.itemCard}>
                                            <View style={styles.cardContent}>
                                                <ThemedText style={styles.itemTitle}>{item.nombre}</ThemedText>
                                                <Text style={styles.cardDescription}>{item.descripcion || 'Sin descripción'}</Text>
                                                <View style={{flexDirection:'row', gap: 5, marginTop: 5}}>
                                                    {item.metrics.map(m => <View key={m} style={styles.miniChip}><Text style={{fontSize:10, color:Colors[colorScheme].text}}>{m}</Text></View>)}
                                                </View>
                                                <Text style={{fontSize: 12, color: item.fechaLimite ? (new Date(item.fechaLimite) < new Date() ? '#e74c3c' : Colors[colorScheme].icon) : Colors[colorScheme].icon, marginTop: 5}}>
                                                    {item.fechaLimite ? `Vence: ${format(parseISO(item.fechaLimite), 'dd/MM/yyyy')}` : '∞ Permanente'}
                                                </Text>
                                            </View>
                                            <View style={styles.cardActions}>
                                                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}><FontAwesome6 name="edit" size={20} color={Colors[colorScheme].text} /></TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.actionButton}><Octicons name="trash" size={22} color="#e74c3c" /></TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                />
                            )}
                            <TouchableOpacity style={styles.fabInsideModal} onPress={handleCreate}>
                                <Ionicons name="add" size={30} color="#fff" />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <ScrollView>
                            <ThemedText style={styles.inputLabel}>Nombre</ThemedText>
                            <TextInput style={styles.input} value={formData.nombre} onChangeText={t => setFormData({...formData, nombre: t})} placeholder="Ej: Murph" placeholderTextColor="#999"/>
                            
                            <ThemedText style={styles.inputLabel}>Descripción</ThemedText>
                            <TextInput style={[styles.input, {height: 80, textAlignVertical: 'top', paddingTop:10}]} value={formData.descripcion} onChangeText={t => setFormData({...formData, descripcion: t})} multiline placeholder="Detalles..." placeholderTextColor="#999"/>

                            <ThemedText style={styles.inputLabel}>Métricas</ThemedText>
                            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15}}>
                                {AVAILABLE_METRICS.map(m => (
                                    <TouchableOpacity key={m.id} onPress={() => toggleMetric(m.id)} style={[styles.dayChip, formData.metrics.includes(m.id) && {backgroundColor: gymColor, borderColor: gymColor}]}>
                                        <Text style={{color: formData.metrics.includes(m.id) ? '#fff' : Colors[colorScheme].text}}>{m.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.switchContainer}>
                                <ThemedText style={styles.inputLabel}>¿Tiene fecha límite?</ThemedText>
                                <Switch value={formData.hasDeadline} onValueChange={v => setFormData({...formData, hasDeadline: v})} trackColor={{true: gymColor}} />
                            </View>

                            {formData.hasDeadline && (
                                <>
                                    {Platform.OS === 'web' ? (
                                        <View style={{ marginBottom: 20, zIndex: 9999, position: 'relative'}}>
                                            <WebDatePicker
                                                selected={formData.fechaLimite}
                                                onChange={(date) => setFormData(prev => ({ ...prev, fechaLimite: date }))}
                                                dateFormat="dd/MM/yyyy"
                                                customInput={
                                                    <TouchableOpacity style={styles.input}>
                                                        <Text style={{color: Colors[colorScheme].text, marginTop: 12}}>
                                                            {format(formData.fechaLimite, 'dd/MM/yyyy')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                }
                                            />
                                        </View>
                                    ) : (
                                        <TouchableOpacity onPress={() => setDatePickerConfig({visible: true, currentValue: formData.fechaLimite})} style={styles.input}>
                                            <Text style={{color: Colors[colorScheme].text, marginTop: 12}}>
                                                {format(formData.fechaLimite, 'dd/MM/yyyy')}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}

                            <View style={styles.switchContainer}>
                                <ThemedText style={styles.inputLabel}>Visible</ThemedText>
                                <Switch value={formData.visible} onValueChange={v => setFormData({...formData, visible: v})} trackColor={{true: '#2ecc71'}} />
                            </View>

                            <Button title="Guardar" onPress={handleSubmit} color={gymColor} />
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>

            {datePickerConfig.visible && Platform.OS === 'android' && (
                <DateTimePicker value={datePickerConfig.currentValue} mode="date" display="default" onChange={onDateChange} />
            )}
            
            {datePickerConfig.visible && Platform.OS === 'ios' && (
                <Modal transparent animationType="fade">
                    <View style={styles.iosPickerOverlay}>
                        <View style={styles.iosPickerContainer}>
                            <View style={styles.iosPickerHeader}>
                                <Button title="Cancelar" onPress={() => setDatePickerConfig(p => ({...p, visible: false}))} />
                                <Button title="Confirmar" onPress={confirmIOSDate} />
                            </View>
                            <DateTimePicker value={datePickerConfig.currentValue} mode="date" display="inline" onChange={(e, d) => setDatePickerConfig(p => ({...p, currentValue: d || p.currentValue}))} />
                        </View>
                    </View>
                </Modal>
            )}
        </Modal>
    );
};


// --- PANTALLA PRINCIPAL ---
const ClassTypeManagementScreen = () => {
    const layout = useWindowDimensions();
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // --- ESTADOS TABVIEW ---
    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'credits', title: 'Créditos' },
        { key: 'packages', title: 'Paquetes ' },
    ]);

    // --- ESTADOS CRÉDITOS ---
    const [classTypes, setClassTypes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingClassType, setEditingClassType] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', price: '0', resetMensual: true });

    // --- ESTADOS PAQUETES ---
    const [packages, setPackages] = useState([]);
    const [searchPackageTerm, setSearchPackageTerm] = useState('');
    const [isPackageModalVisible, setIsPackageModalVisible] = useState(false);
    const [packageFormData, setPackageFormData] = useState({
        name: '', description: '', price: '', isPaseLibre: false, durationDays: '30', creditsAmount: '1', tipoClase: ''
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false });

    // Configuración y Cortesía
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [visibilityDays, setVisibilityDays] = useState('0');
    const [courtesyConfig, setCourtesyConfig] = useState({ isActive: false, amount: '1', tipoClase: '' });
    const [isScoreboardModalVisible, setIsScoreboardModalVisible] = useState(false);

    const [bankDetails, setBankDetails] = useState({ cbu: '', alias: '', bankName: '' });

    const performDataFetch = useCallback(async () => {
        try {
            const [typesRes, settingsRes, packagesRes] = await Promise.all([
                apiClient.get('/tipos-clase'),
                apiClient.get('/settings'),
                apiClient.get('/payments/packages') // Llamada para traer los paquetes
            ]);
            
            setClassTypes(typesRes.data?.tiposClase || []);
            setPackages(packagesRes.data || []);
            
            setVisibilityDays(settingsRes.data.classVisibilityDays.toString());

            if (settingsRes.data.bankDetails) {
                setBankDetails({
                    cbu: settingsRes.data.bankDetails.cbu || '',
                    alias: settingsRes.data.bankDetails.alias || '',
                    bankName: settingsRes.data.bankDetails.bankName || ''
                });
            }
            
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
    
    // --- LÓGICA CRÉDITOS ---
    const handleFormChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
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
        if (!formData.nombre) return setAlertInfo({ visible: true, title: 'Campo Requerido', message: 'El nombre es obligatorio.' });
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
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'Error al procesar.' });
        }
    };
    
    const handleDelete = (type) => {
        setAlertInfo({
            visible: true, title: 'Confirmar', message: `¿Eliminar "${type.nombre}"?`,
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

    // --- LÓGICA PAQUETES ---
    const handlePackageFormChange = (name, value) => {
        setPackageFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePackageSubmit = async () => {
        if (!packageFormData.name || !packageFormData.price) {
            return setAlertInfo({ visible: true, title: 'Atención', message: 'El nombre y el precio son obligatorios.' });
        }
        
        const payload = {
            name: packageFormData.name,
            description: packageFormData.description,
            price: Number(packageFormData.price),
            isPaseLibre: packageFormData.isPaseLibre,
            durationDays: Number(packageFormData.durationDays) || 30,
            creditsAmount: Number(packageFormData.creditsAmount) || 0,
            tipoClase: packageFormData.tipoClase || null
        };

        try {
            await apiClient.post('/payments/packages', payload);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Paquete de venta creado exitosamente.' });
            setIsPackageModalVisible(false);
            performDataFetch();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'Error al crear el paquete.' });
        }
    };

    // --- LÓGICA FAB MULTIUSO ---
    const handleAdd = () => {
        if (index === 0) {
            // Añadir Crédito Base
            setEditingClassType(null);
            setFormData({ nombre: '', price: '0', resetMensual: true });
            setIsModalVisible(true);
        } else {
            // Añadir Paquete
            setPackageFormData({ name: '', description: '', price: '', isPaseLibre: false, durationDays: '30', creditsAmount: '1', tipoClase: classTypes[0]?._id || '' });
            setIsPackageModalVisible(true);
        }
    };

    const handleSaveSettings = async () => {
        try {
            const payload = { 
                classVisibilityDays: Number(visibilityDays) || 0,
                courtesyCredit: { isActive: courtesyConfig.isActive, amount: Number(courtesyConfig.amount) || 1, tipoClase: courtesyConfig.tipoClase },
                bankDetails: bankDetails
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
        return classTypes.filter(type => type.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [classTypes, searchTerm]);

    const filteredPackages = useMemo(() => {
        if (!searchPackageTerm) return packages;
        return packages.filter(pkg => pkg.name.toLowerCase().includes(searchPackageTerm.toLowerCase()));
    }, [packages, searchPackageTerm]);

    // --- ESCENAS DE LAS PESTAÑAS ---
    const CreditsRoute = useCallback(() => (
        <View style={{flex: 1}}>
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
            <FlatList
                data={filteredClassTypes}
                renderItem={({ item }) => (
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
                )}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay créditos base registrados.</ThemedText>}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[gymColor]} />}
            />
        </View>
    ), [filteredClassTypes, searchTerm, colorScheme, gymColor, isRefreshing]);

    const PackagesRoute = useCallback(() => (
        <View style={{flex: 1}}>
            <View style={styles.searchInputContainer}>
                <TextInput 
                    style={styles.searchInput} 
                    placeholder="Buscar paquetes..." 
                    placeholderTextColor={Colors[colorScheme].icon}
                    value={searchPackageTerm} 
                    onChangeText={setSearchPackageTerm} 
                />
                <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
            </View>
            <FlatList
                data={filteredPackages}
                renderItem={({ item }) => (
                    <View style={styles.itemCard}>
                        <View style={styles.cardContent}>
                            <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
                            <ThemedText style={[styles.cardDescription, {fontWeight: 'bold', color: gymColor}]}>
                                ${item.price}
                            </ThemedText>
                            <ThemedText style={styles.cardDescription}>
                                {item.isPaseLibre ? `Pase Libre (${item.durationDays} días)` : `${item.creditsAmount} créditos de ${item.tipoClase?.nombre || 'Clase'}`}
                            </ThemedText>
                        </View>
                    </View>
                )}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay paquetes de venta creados.</ThemedText>}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[gymColor]} />}
            />
        </View>
    ), [filteredPackages, searchPackageTerm, colorScheme, gymColor, isRefreshing]);

    const renderScene = SceneMap({
        credits: CreditsRoute,
        packages: PackagesRoute,
    });

    if (isLoading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }
    
    return (
        <ThemedView style={styles.container}>
            <TabView 
                navigationState={{ index, routes }} 
                renderScene={renderScene} 
                onIndexChange={setIndex} 
                initialLayout={{ width: layout.width }} 
                renderTabBar={props => (
                    <TabBar 
                        {...props} 
                        style={{ backgroundColor: gymColor, paddingTop: Platform.OS === 'android' ? 10 : 0 }} 
                        indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }} 
                        labelStyle={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', textTransform:'none' }} 
                    />
                )} 
            />
            
            {/* --- FAB SCOREBOARD (Trofeo) --- */}
            <TouchableOpacity style={styles.fabScoreboard} onPress={() => setIsScoreboardModalVisible(true)}>
                <FontAwesome5 name="trophy" size={22} color="#fff" />
            </TouchableOpacity>

            {/* --- FAB SETTINGS --- */}
            <TouchableOpacity style={styles.fabSettings} onPress={() => setIsSettingsModalVisible(true)}>
                <FontAwesome5 name="cog" size={24} color="#fff" />
            </TouchableOpacity>

            {/* --- FAB ADD --- */}
            <TouchableOpacity style={styles.fabAdd} onPress={handleAdd}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* --- MODAL SCOREBOARD MANAGER --- */}
            <ScoreboardManagerModal 
                visible={isScoreboardModalVisible} 
                onClose={() => setIsScoreboardModalVisible(false)} 
                gymColor={gymColor}
                colorScheme={colorScheme}
            />

            {/* --- MODAL CREAR PAQUETE DE VENTA --- */}
            <Modal visible={isPackageModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsPackageModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsPackageModalVisible(false)} />
                    <View style={styles.modalContainer}>
                        <TouchableOpacity onPress={() => setIsPackageModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <ThemedText style={styles.modalTitle}>Crear Paquete de Venta</ThemedText>
                            
                            <ThemedText style={styles.inputLabel}>Nombre del Paquete</ThemedText>
                            <TextInput style={styles.input} placeholder="Ej: Promo 10 Clases" value={packageFormData.name} onChangeText={(text) => handlePackageFormChange('name', text)} placeholderTextColor="#999" />
                            
                            <ThemedText style={styles.inputLabel}>Precio ($)</ThemedText>
                            <TextInput style={styles.input} placeholder="Ej: 15000" keyboardType="numeric" value={packageFormData.price} onChangeText={(text) => handlePackageFormChange('price', text)} placeholderTextColor="#999" />
                            
                            <ThemedText style={styles.inputLabel}>Descripción (Opcional)</ThemedText>
                            <TextInput style={styles.input} placeholder="Ej: Incluye matricula gratis" value={packageFormData.description} onChangeText={(text) => handlePackageFormChange('description', text)} placeholderTextColor="#999" />

                            <View style={styles.switchContainer}>
                                <ThemedText style={styles.inputLabel}>¿Es un Pase Libre?</ThemedText>
                                <Switch trackColor={{ true: gymColor }} value={packageFormData.isPaseLibre} onValueChange={(value) => handlePackageFormChange('isPaseLibre', value)} />
                            </View>

                            {packageFormData.isPaseLibre ? (
                                <>
                                    <ThemedText style={styles.inputLabel}>Duración del Pase Libre (Días)</ThemedText>
                                    <TextInput style={styles.input} placeholder="Ej: 30" keyboardType="numeric" value={packageFormData.durationDays} onChangeText={(text) => handlePackageFormChange('durationDays', text)} placeholderTextColor="#999" />
                                </>
                            ) : (
                                <>
                                    <ThemedText style={styles.inputLabel}>Cantidad de Créditos</ThemedText>
                                    <TextInput style={styles.input} placeholder="Ej: 8" keyboardType="numeric" value={packageFormData.creditsAmount} onChangeText={(text) => handlePackageFormChange('creditsAmount', text)} placeholderTextColor="#999" />
                                    
                                    <ThemedText style={styles.inputLabel}>¿Qué crédito entrega?</ThemedText>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
                                        {classTypes.map(type => (
                                            <TouchableOpacity 
                                                key={type._id} 
                                                onPress={() => handlePackageFormChange('tipoClase', type._id)}
                                                style={[styles.dayChip, packageFormData.tipoClase === type._id && { backgroundColor: gymColor, borderColor: gymColor }]}
                                            >
                                                <Text style={{ color: packageFormData.tipoClase === type._id ? '#fff' : Colors[colorScheme].text }}>
                                                    {type.nombre}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setIsPackageModalVisible(false)}>
                                    <Text style={styles.buttonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, { backgroundColor: gymColor || '#1a5276' }]} onPress={handlePackageSubmit}>
                                    <Text style={styles.buttonText}>Crear</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- MODAL EDITAR CREDITO BASE --- */}
            <Modal visible={isModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsModalVisible(false)} />
                    <View style={styles.modalContainer}>
                        <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <ThemedText style={styles.modalTitle}>
                                {editingClassType ? 'Editar Crédito Base' : 'Añadir Crédito Base'}
                            </ThemedText>
                            
                            <ThemedText style={styles.inputLabel}>Nombre del Crédito</ThemedText>
                            <TextInput style={styles.input} placeholder="Ej: Crossfit" value={formData.nombre} onChangeText={(text) => handleFormChange('nombre', text)} placeholderTextColor="#999" />
                            
                            <View style={styles.switchContainer}>
                                <ThemedText style={styles.inputLabel}>¿Reiniciar mensualmente?</ThemedText>
                                <Switch trackColor={{ true: gymColor }} value={formData.resetMensual} onValueChange={(value) => handleFormChange('resetMensual', value)} />
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

            {/* --- MODAL SETTINGS --- */}
            <Modal visible={isSettingsModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsSettingsModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper}>
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
                        <TextInput style={styles.input} value={visibilityDays} onChangeText={setVisibilityDays} keyboardType="number-pad" placeholder="0"/>

                        <View style={{ paddingTop: 15, marginTop: 10}}>
                            <ThemedText style={styles.sectionTitle}>Crédito de Bienvenida</ThemedText>
                            <View style={styles.switchContainer}>
                                <ThemedText style={styles.inputLabel}>¿Activar crédito de bienvenida?</ThemedText>
                                <Switch trackColor={{ true: gymColor }} onValueChange={(val) => setCourtesyConfig(prev => ({...prev, isActive: val}))} value={courtesyConfig.isActive} />
                            </View>

                            {courtesyConfig.isActive && (
                                <>
                                    <ThemedText style={styles.inputLabel}>¿Qué crédito dar?</ThemedText>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15}}>
                                            {classTypes.map(type => (
                                                <TouchableOpacity key={type._id} onPress={() => setCourtesyConfig(prev => ({...prev, tipoClase: type._id}))} style={[styles.dayChip, courtesyConfig.tipoClase === type._id && { backgroundColor: gymColor }]}>
                                                    <Text style={{ color: courtesyConfig.tipoClase === type._id ? '#fff' : Colors[colorScheme].text }}>{type.nombre}</Text>
                                                </TouchableOpacity>
                                            ))}
                                    </ScrollView>

                                    <ThemedText style={styles.inputLabel}>Cantidad de créditos:</ThemedText>
                                    <TextInput style={styles.input} value={courtesyConfig.amount} onChangeText={(text) => setCourtesyConfig(prev => ({...prev, amount: text}))} keyboardType="number-pad"/>
                                </>
                            )}
                        </View>
                        <View style={{ paddingTop: 15, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border}}>
                            <ThemedText style={styles.sectionTitle}>Datos Bancarios (Transferencias)</ThemedText>
                            <ThemedText style={styles.cardDescription}>
                                Estos datos se mostrarán a los clientes cuando quieran informar un pago.
                            </ThemedText>
                            
                            <ThemedText style={styles.inputLabel}>CBU / CVU:</ThemedText>
                            <TextInput style={styles.input} value={bankDetails.cbu} onChangeText={(t) => setBankDetails(prev => ({...prev, cbu: t}))} placeholder="Ej: 0000003100000000000000" placeholderTextColor="#999"/>

                            <ThemedText style={styles.inputLabel}>Alias:</ThemedText>
                            <TextInput style={styles.input} value={bankDetails.alias} onChangeText={(t) => setBankDetails(prev => ({...prev, alias: t}))} placeholder="Ej: GIMNASIO.FIT" placeholderTextColor="#999"/>

                            <ThemedText style={styles.inputLabel}>Banco / Billetera (Opcional):</ThemedText>
                            <TextInput style={styles.input} value={bankDetails.bankName} onChangeText={(t) => setBankDetails(prev => ({...prev, bankName: t}))} placeholder="Ej: MercadoPago" placeholderTextColor="#999"/>
                        </View>

                        <Button title="Guardar Configuración" onPress={handleSaveSettings} color={gymColor} />
                    </ScrollView>
                </View>
                </KeyboardAvoidingView>
            </Modal>

            <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} onClose={() => setAlertInfo({ visible: false })} buttons={alertInfo.buttons || [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }]} gymColor={gymColor} />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { paddingBottom: 100, paddingTop: 10 }, 
    
    searchInputContainer: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 5, borderWidth: 1, borderColor: Colors[colorScheme].border,
        marginTop: 15, marginHorizontal: 15, marginBottom: 5
    },
    searchInput: { flex: 1, height: 50, paddingHorizontal: 15, color: Colors[colorScheme].text, fontSize: 16 },
    searchIcon: { marginRight: 15 },
    
    itemCard: {
        backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, padding: 15,
        marginVertical: 8, marginHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 
    },
    cardContent: { flex: 1 },
    itemTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardDescription: { fontSize: 14, opacity: 0.7, marginTop: 4, color: Colors[colorScheme].text },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { padding: 8, marginLeft: 10 },
    
    // FABs
    fabAdd: {
        position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', 
        right: 20, bottom: 20, backgroundColor: gymColor || '#1a5276', borderRadius: 30, 
        elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, zIndex: 999
    },
    fabSettings: {
        position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', 
        right: 90, bottom: 20, backgroundColor: '#7f8c8d', borderRadius: 30, 
        elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, zIndex: 999
    },
    fabScoreboard: {
        position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', 
        right: 160, bottom: 20, backgroundColor: '#f39c12', borderRadius: 30, 
        elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, zIndex: 999
    },
    fabInsideModal: {
        position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: gymColor, alignItems: 'center', justifyContent: 'center', elevation: 5
    },

    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: Colors[colorScheme].text },
    modalOverlayWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    
    modalContainer: { width: '100%', maxHeight: '80%', backgroundColor: Colors[colorScheme].background, borderRadius: 5, padding: 25, elevation: 5, },
    modalContainerFull: { width: '100%', height: '90%', marginTop: 50, backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 20, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border, paddingBottom: 10},

    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 10 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    inputLabel: { fontSize: 14, marginBottom: 8, opacity: 0.9, color: Colors[colorScheme].text, fontWeight: 'bold' },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 5, paddingHorizontal: 15, marginBottom: 20, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text, fontSize: 16 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingVertical: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
    button: { flex: 1, paddingVertical: 12, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#6c757d' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    dayChip: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 5, marginRight: 8, backgroundColor: Colors[colorScheme].cardBackground, borderWidth: 1, borderColor: Colors[colorScheme].border },
    miniChip: { backgroundColor: Colors[colorScheme].background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, borderWidth: 1, borderColor: Colors[colorScheme].border },
    
    iosPickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    iosPickerContainer: { backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 15, borderTopRightRadius: 15, paddingBottom: 20, paddingHorizontal: 10 },
    iosPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border, marginBottom: 10 },
});

export default ClassTypeManagementScreen;