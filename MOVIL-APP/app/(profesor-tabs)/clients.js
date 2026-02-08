import React, { useState, useCallback, useMemo } from 'react';
import { 
    StyleSheet, 
    FlatList, 
    View, 
    TextInput, 
    ActivityIndicator, 
    TouchableOpacity, 
    useColorScheme, 
    Text,
    RefreshControl 
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import TrainingPlanModal from '../../components/profesor/TrainingPlanModal';
import CustomAlert from '@/components/CustomAlert';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const ProfessorClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // selectedClient: Array de objetos cliente para pasar al modal
    // Si es null, el modal asume modo "Global/Todos"
    const [selectedClient, setSelectedClient] = useState(null); 
    const [planModalVisible, setPlanModalVisible] = useState(false);
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Estados Selección Múltiple (Para asignación masiva)
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedClientIds, setSelectedClientIds] = useState([]);

    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    const closeAlert = () => setAlertInfo(prev => ({ ...prev, visible: false }));

    const fetchData = useCallback(async () => {
        try {
            const response = await apiClient.get('/users?role=cliente');
            setUsers(response.data);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar los clientes.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }]
            });
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchData();
    }, [fetchData]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchData();
        }, [fetchData])
    );

    // --- Lógica Selección Múltiple ---
    const toggleSelectionMode = (clientId) => {
        setIsSelectionMode(true);
        handleSelectClient(clientId);
    };

    const handleSelectClient = (clientId) => {
        if (selectedClientIds.includes(clientId)) {
            const newSelection = selectedClientIds.filter(id => id !== clientId);
            setSelectedClientIds(newSelection);
            if (newSelection.length === 0) setIsSelectionMode(false);
        } else {
            setSelectedClientIds([...selectedClientIds, clientId]);
        }
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedClientIds([]);
    };

    // --- Manejadores de Apertura del Modal ---
    
    // 1. Click simple en tarjeta: Abre historial de ESE cliente
    const handleCardPress = (client) => {
        if (isSelectionMode) {
            handleSelectClient(client._id);
        } else {
            setSelectedClient([client]); // Pasamos array con 1 elemento
            setPlanModalVisible(true);
        }
    };

    // 2. Click en FAB (Check): Abre asignación masiva para SELECCIONADOS
    const handleOpenBulkSelectionModal = () => {
        const clientsSelected = users.filter(u => selectedClientIds.includes(u._id));
        setSelectedClient(clientsSelected);
        setPlanModalVisible(true);
    };

    // 3. Click en FAB (Usuarios): Abre asignación masiva GLOBAL
    const handleOpenGlobalModal = () => {
        setSelectedClient(null); // null indica modo global/clase
        setPlanModalVisible(true);
    };

    const handleCloseModal = (shouldRefresh) => {
        setPlanModalVisible(false);
        setSelectedClient(null);
        if (shouldRefresh === true) { 
            cancelSelectionMode();
            onRefresh();
        }
    };

    // --- Filtrado ---
    const filteredData = useMemo(() => {
        if (!searchTerm) return users;
        return users.filter(user =>
            `${user.nombre} ${user.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.dni?.includes(searchTerm)
        );
    }, [users, searchTerm]);

    const renderUserCard = ({ item }) => {
        const isSelected = selectedClientIds.includes(item._id);
        return (
            <TouchableOpacity 
                style={[styles.card, isSelected && styles.cardSelected]} 
                onPress={() => handleCardPress(item)}
                onLongPress={() => toggleSelectionMode(item._id)}
                delayLongPress={300}
                activeOpacity={0.7}
            >
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View>
                        <Text style={styles.cardTitle}>{item.nombre} {item.apellido}</Text>
                        <Text style={styles.cardSubtitle}>{item.email}</Text>
                    </View>
                    {isSelectionMode && (
                        <MaterialCommunityIcons 
                            name={isSelected ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
                            size={24} 
                            color={isSelected ? gymColor : Colors[colorScheme].icon} 
                        />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ThemedView style={styles.container}>
            {/* Header: Muestra título o contador de selección */}
            <View style={[styles.headerContainer, isSelectionMode && {backgroundColor: '#333'}]}>
                {isSelectionMode ? (
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 10}}>
                        <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>
                            {selectedClientIds.length} seleccionados
                        </Text>
                        <TouchableOpacity onPress={cancelSelectionMode}>
                            <FontAwesome5 name="times" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={styles.headerTitle}>Planes</Text>
                )}
            </View>

            {loading ? <ActivityIndicator style={{ marginTop: 20 }} size="large" color={gymColor} /> : (
                <ThemedView style={{flex: 1}}>
                    <View style={styles.searchInputContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar cliente por nombre o DNI..."
                            placeholderTextColor={Colors[colorScheme].icon}
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                        <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
                    </View>
            
                    <FlatList
                        data={filteredData}
                        renderItem={renderUserCard}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>{searchTerm ? "No se encontraron clientes." : "Aún no tienes clientes asignados."}</Text>
                            </View>
                        }
                    />
                </ThemedView>
            )}
            
            {!loading && (
                isSelectionMode ? (
                    // Botón Flotante: Asignar Plan a Seleccionados
                    <TouchableOpacity style={styles.fab} onPress={handleOpenBulkSelectionModal}>
                        <FontAwesome5 name="check" size={24} color="#fff" />
                    </TouchableOpacity>
                ) : (
                    // Botón Flotante: Asignar Plan Global / Por Clase
                    <TouchableOpacity style={[styles.fab]} onPress={handleOpenGlobalModal}>
                        <Ionicons name="documents" size={26} color="#fff" />
                    </TouchableOpacity>
                )
            )}

            {/* Modal para Ver Historial o Asignar Planes */}
            <TrainingPlanModal 
                visible={planModalVisible} 
                clients={selectedClient} 
                onClose={handleCloseModal} 
            />
            
            <CustomAlert 
                visible={alertInfo.visible} 
                title={alertInfo.title} 
                message={alertInfo.message} 
                buttons={alertInfo.buttons} 
                onClose={closeAlert} 
                gymColor={gymColor} 
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { backgroundColor: gymColor, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', width: '100%', elevation: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    searchInputContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginVertical: 10, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, borderWidth: 1, borderColor: Colors[colorScheme].border },
    searchInput: { flex: 1, height: 50, paddingHorizontal: 15, color: Colors[colorScheme].text, fontSize: 16 },
    searchIcon: { marginRight: 15 },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, padding: 20, marginVertical: 6, marginHorizontal: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,  borderWidth: 1, borderColor: Colors[colorScheme].border},
    cardSelected: { borderColor: gymColor, backgroundColor: gymColor + '10' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
    emptyContainer: { flex: 1, marginTop: 50, alignItems: 'center', paddingHorizontal: 20 },
    emptyText: { fontSize: 16, color: Colors[colorScheme].icon, textAlign: 'center' },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: gymColor, borderRadius: 30, elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }
});

export default ProfessorClientsScreen;