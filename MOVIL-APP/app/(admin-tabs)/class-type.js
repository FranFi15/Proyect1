import React, { useState, useCallback, useMemo } from 'react';
import {
    StyleSheet, View, Text, FlatList, TouchableOpacity, TextInput,
    useColorScheme, ActivityIndicator, RefreshControl, Switch,
    ScrollView, Platform, Modal, useWindowDimensions
} from 'react-native';
import { useCachedFocusEffect } from '@/hooks/useCachedFocusEffect';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome5, Ionicons, Octicons, FontAwesome6 } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';
import PackageFormModal from '@/components/admin/PackageFormModal';
import FilterModal from '@/components/FilterModal';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';
import DesafiosAdminModal from '@/components/admin/DesafiosAdminModal';

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
    const [editingPackage, setEditingPackage] = useState(null);
    const [searchPackageTerm, setSearchPackageTerm] = useState('');
    const [packageFilter, setPackageFilter] = useState('all');
    const [isPackageFilterVisible, setIsPackageFilterVisible] = useState(false);
    const [isPackageModalVisible, setIsPackageModalVisible] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false });

    const [isScoreboardModalVisible, setIsScoreboardModalVisible] = useState(false);

    const performDataFetch = useCallback(async () => {
        try {
            const [typesRes, packagesRes] = await Promise.all([
                apiClient.get('/tipos-clase'),
                apiClient.get('/payments/packages') // Llamada para traer los paquetes
            ]);
            
            setClassTypes(typesRes.data?.tiposClase || []);
            setPackages(packagesRes.data || []);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos.' });
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    const { refresh } = useCachedFocusEffect(
        async ({ isInitial }) => {
            if (isInitial) setIsLoading(true);
            try {
                await performDataFetch();
            } finally {
                if (isInitial) setIsLoading(false);
            }
        },
        { ttlMs: 60_000 }
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refresh();
    }, [refresh]);
    
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
    const handleEditPackage = (pkg) => {
        setEditingPackage(pkg);
        setIsPackageModalVisible(true);
    };

    const handleDeletePackage = (pkg) => {
        setAlertInfo({
            visible: true, title: 'Confirmar', message: `¿Eliminar el paquete "${pkg.name}"?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/payments/packages/${pkg._id}`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Paquete eliminado.' });
                        performDataFetch();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo eliminar.' });
                    }
                }}
            ]
        });
    };

    const handlePackageSubmit = async (payload) => {
        if (editingPackage) {
            await apiClient.put(`/payments/packages/${editingPackage._id}`, payload);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Paquete actualizado exitosamente.' });
        } else {
            await apiClient.post('/payments/packages', payload);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Paquete de venta creado exitosamente.' });
        }
        setIsPackageModalVisible(false);
        setEditingPackage(null);
        performDataFetch();
    };

    // --- LÓGICA FAB MULTIUSO ---
    const handleAdd = () => {
        if (index === 0) {
            setEditingClassType(null);
            setFormData({ nombre: '', price: '0', resetMensual: true });
            setIsModalVisible(true);
        } else {
            // 🔥 Aseguramos limpiar el formulario al crear uno nuevo
            setEditingPackage(null);
            setIsPackageModalVisible(true);
        }
    };

    const filteredClassTypes = useMemo(() => {
        if (!searchTerm) return classTypes;
        return classTypes.filter(type => type.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [classTypes, searchTerm]);

    const filteredPackages = useMemo(() => {
        return packages.filter(pkg => {
            const matchesSearch = !searchPackageTerm || pkg.name.toLowerCase().includes(searchPackageTerm.toLowerCase());
            if (!matchesSearch) return false;
            if (packageFilter === 'pase') return !!pkg.isPaseLibre;
            if (packageFilter === 'membresia') return !!pkg.isMembresia;
            if (packageFilter === 'creditos') return !pkg.isPaseLibre && !pkg.isMembresia;
            return true;
        });
    }, [packages, searchPackageTerm, packageFilter]);

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
            <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setIsPackageFilterVisible(true)}
            >
                <ThemedText style={styles.filterButtonText} numberOfLines={1}>
                    {packageFilter === 'all' ? 'Todos' : packageFilter === 'creditos' ? 'Créditos' : packageFilter === 'pase' ? 'Pase Libre' : 'Membresía'}
                </ThemedText>
                <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
            </TouchableOpacity>
            <FlatList
                data={filteredPackages}
                renderItem={({ item }) => {
                    const kindLabel = item.isPaseLibre ? 'Pase Libre' : item.isMembresia ? 'Membresía' : 'Créditos';
                    const kindColor = item.isPaseLibre ? '#0e8a6f' : item.isMembresia ? '#7c3aed' : gymColor;
                    return (
                    <View style={styles.itemCard}>
                        <View style={styles.cardContent}>
                            <View style={[styles.kindBadge, { backgroundColor: kindColor + '18' }]}>
                                <Text style={{ color: kindColor, fontWeight: '800', fontSize: 11 }}>{kindLabel}</Text>
                            </View>
                            <ThemedText style={styles.itemTitle}>{item.name}</ThemedText>
                            <ThemedText style={[styles.cardDescription, {fontWeight: 'bold', color: gymColor}]}>
                                ${Number(item.price || 0).toLocaleString('es-AR')}
                            </ThemedText>
                            <ThemedText style={styles.cardDescription}>
                                {item.isPaseLibre ? `Acceso libre · ${item.durationDays} días` : item.isMembresia ? `Solo QR · ${item.durationDays} días` : `${item.creditsAmount} créditos de ${item.tipoClase?.nombre || 'clase'}`}
                            </ThemedText>
                            {item.description ? <ThemedText style={styles.cardDescription}>{item.description}</ThemedText> : null}
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
                )}}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay paquetes de venta creados.</ThemedText>}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[gymColor]} />}
            />
        </View>
    ), [filteredPackages, searchPackageTerm, packageFilter, colorScheme, gymColor, isRefreshing]);

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
                        style={{ backgroundColor: gymColor, paddingTop: Platform.OS === 'android' ? 10 : 0, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, marginBottom: 8 }} 
                        indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }} 
                        labelStyle={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', textTransform:'none' }} 
                    />
                )} 
            />
            
            {/* --- FAB SCOREBOARD (Trofeo) --- */}
            <TouchableOpacity style={styles.fabScoreboard} onPress={() => setIsScoreboardModalVisible(true)}>
                <FontAwesome5 name="trophy" size={22} color="#fff" />
            </TouchableOpacity>

            {/* --- FAB ADD --- */}
            <TouchableOpacity style={styles.fabAdd} onPress={handleAdd}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            <DesafiosAdminModal
                visible={isScoreboardModalVisible}
                onClose={() => setIsScoreboardModalVisible(false)}
                gymColor={gymColor}
            />

            <PackageFormModal
                visible={isPackageModalVisible}
                onClose={() => { setIsPackageModalVisible(false); setEditingPackage(null); }}
                onSubmit={handlePackageSubmit}
                editingPackage={editingPackage}
                classTypes={classTypes}
                gymColor={gymColor}
            />

            <FilterModal
                visible={isPackageFilterVisible}
                onClose={() => setIsPackageFilterVisible(false)}
                options={[
                    { _id: 'all', nombre: 'Todos' },
                    { _id: 'creditos', nombre: 'Créditos' },
                    { _id: 'pase', nombre: 'Pase Libre' },
                    { _id: 'membresia', nombre: 'Membresía' }
                ]}
                onSelect={(id) => {
                    setPackageFilter(id);
                    setIsPackageFilterVisible(false);
                }}
                selectedValue={packageFilter}
                title="Tipo de paquete"
                theme={{ colors: Colors[colorScheme], gymColor }}
            />

            {/* --- MODAL EDITAR CREDITO BASE --- */}
            <Modal
                visible={isModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsModalVisible(false)}
                statusBarTranslucent
                presentationStyle="overFullScreen"
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <KeyboardAwareSheet
                        onDismiss={() => setIsModalVisible(false)}
                        backgroundColor={Colors[colorScheme].background}
                        borderRadius={20}
                        style={styles.creditSheet}
                    >
                        <View style={styles.creditRoot}>
                            <View style={[styles.creditHeader, { backgroundColor: gymColor || '#1a5276' }]}>
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={styles.creditHeaderKicker}>
                                        {editingClassType ? 'Editar crédito' : 'Nuevo crédito'}
                                    </Text>
                                    <Text style={styles.creditHeaderTitle} numberOfLines={1}>
                                        {editingClassType?.nombre || formData.nombre || 'Crédito base'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setIsModalVisible(false)}
                                    style={styles.creditCloseBtn}
                                    hitSlop={10}
                                >
                                    <Ionicons name="close" size={22} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="interactive"
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.creditScroll}
                            >
                                <View style={styles.creditCard}>
                                    <Text style={styles.creditCardTitle}>Datos del crédito</Text>
                                    <Text style={styles.creditCardSub}>
                                        Definí el nombre y si se reinicia cada mes.
                                    </Text>

                                    <Text style={styles.creditLabel}>Nombre del crédito</Text>
                                    <TextInput
                                        style={styles.creditInput}
                                        placeholder="Ej: Crossfit"
                                        placeholderTextColor={Colors[colorScheme].icon}
                                        value={formData.nombre}
                                        onChangeText={(text) => handleFormChange('nombre', text)}
                                    />

                                    <View style={styles.creditSwitchRow}>
                                        <View style={{ flex: 1, paddingRight: 12 }}>
                                            <Text style={styles.creditSwitchTitle}>Reinicio mensual</Text>
                                            <Text style={styles.creditSwitchSub}>
                                                Los créditos vencen y se renuevan cada mes.
                                            </Text>
                                        </View>
                                        <Switch
                                            trackColor={{ false: '#767577', true: gymColor || '#1a5276' }}
                                            thumbColor="#f4f3f4"
                                            value={formData.resetMensual}
                                            onValueChange={(value) => handleFormChange('resetMensual', value)}
                                        />
                                    </View>

                                    <View style={[styles.creditStatusStrip, formData.resetMensual ? styles.creditStatusOk : styles.creditStatusNeutral]}>
                                        <Ionicons
                                            name={formData.resetMensual ? 'refresh-circle' : 'infinite'}
                                            size={18}
                                            color={formData.resetMensual ? '#1e7e34' : (gymColor || '#1a5276')}
                                        />
                                        <Text style={styles.creditStatusText}>
                                            {formData.resetMensual ? 'Vencimiento mensual activo' : 'Sin vencimiento automático'}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.creditPrimaryBtn, { backgroundColor: gymColor || '#1a5276' }]}
                                    onPress={handleFormSubmit}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name={editingClassType ? 'save-outline' : 'add-circle-outline'} size={18} color="#fff" />
                                    <Text style={styles.creditPrimaryBtnText}>
                                        {editingClassType ? 'Guardar cambios' : 'Crear crédito'}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAwareSheet>
                </View>
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
        borderRadius: 10, borderWidth: 1, borderColor: Colors[colorScheme].border,
        marginTop: 15, marginHorizontal: 15, marginBottom: 5
    },
    searchInput: { flex: 1, height: 50, paddingHorizontal: 15, color: Colors[colorScheme].text, fontSize: 16 },
    searchIcon: { marginRight: 15 },
    
    itemCard: {
        backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 14, padding: 18,
        marginVertical: 8, marginHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, borderWidth: 1, borderColor: Colors[colorScheme].border 
    },
    cardContent: { flex: 1 },
    itemTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardDescription: { fontSize: 14, opacity: 0.7, marginTop: 4, color: Colors[colorScheme].text },
    kindBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginBottom: 6 },
    filterButton: {
        height: 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 4,
        paddingHorizontal: 15,
        borderRadius: 10,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border
    },
    filterButtonText: { fontSize: 16, color: Colors[colorScheme].text },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { padding: 8, marginLeft: 10 },
    
    // FABs
    fabAdd: {
        position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', 
        right: 20, bottom: 20, backgroundColor: gymColor || '#1a5276', borderRadius: 30, 
        elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, zIndex: 999
    },
    fabScoreboard: {
        position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', 
        right: 90, bottom: 20, backgroundColor: '#f39c12', borderRadius: 30, 
        elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, zIndex: 999
    },

    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: Colors[colorScheme].text },
    modalOverlayWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    
    modalContainer: { width: '100%', maxHeight: '80%', backgroundColor: Colors[colorScheme].background, borderRadius: 5, padding: 25, elevation: 5, },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border, paddingBottom: 10},

    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 10 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    inputLabel: { fontSize: 14, marginBottom: 8, opacity: 0.9, color: Colors[colorScheme].text, fontWeight: 'bold' },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 5, paddingHorizontal: 15, marginBottom: 20, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text, fontSize: 16 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
    button: { flex: 1, paddingVertical: 12, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#6c757d' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    creditSheet: {
        width: '100%',
        height: '72%',
        maxHeight: '72%',
        overflow: 'hidden',
    },
    creditRoot: { flex: 1, width: '100%', backgroundColor: Colors[colorScheme].background },
    creditHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 18 },
    creditHeaderKicker: {
        color: '#fff',
        opacity: 0.8,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 4,
    },
    creditHeaderTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    creditCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    creditScroll: { padding: 14, paddingBottom: 36 },
    creditCard: {
        backgroundColor: colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    creditCardTitle: { fontSize: 16, fontWeight: '700', color: Colors[colorScheme].text },
    creditCardSub: { fontSize: 13, color: Colors[colorScheme].text, opacity: 0.6, marginTop: 4, marginBottom: 14 },
    creditLabel: { fontSize: 12, fontWeight: '600', color: Colors[colorScheme].text, opacity: 0.7, marginBottom: 6 },
    creditInput: {
        height: 48,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
        color: Colors[colorScheme].text,
        fontSize: 15,
        backgroundColor: Colors[colorScheme].background,
    },
    creditSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: Colors[colorScheme].border,
        marginTop: 8,
    },
    creditSwitchTitle: { fontSize: 14, fontWeight: '700', color: Colors[colorScheme].text, marginBottom: 2 },
    creditSwitchSub: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.55, lineHeight: 16 },
    creditStatusStrip: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    creditStatusOk: {
        backgroundColor: colorScheme === 'dark' ? '#13251a' : '#eefaf1',
        borderColor: colorScheme === 'dark' ? '#1e7e3466' : '#b7e4c7',
    },
    creditStatusNeutral: {
        backgroundColor: colorScheme === 'dark' ? '#1a2228' : '#eef3f7',
        borderColor: Colors[colorScheme].border,
    },
    creditStatusText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors[colorScheme].text },
    creditPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
        marginTop: 16,
    },
    creditPrimaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default ClassTypeManagementScreen;
