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
    RefreshControl,
    Image,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { TabView, TabBar } from 'react-native-tab-view';
import { useCachedFocusEffect } from '@/hooks/useCachedFocusEffect';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import TrainingPlanModal from '../../components/profesor/TrainingPlanModal';
import CustomAlert from '@/components/CustomAlert';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

const StarRow = ({ rating, accent, size = 14 }) => {
    if (!rating) return null;
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                    key={star}
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={size}
                    color={star <= rating ? accent : '#9aa0a6'}
                />
            ))}
        </View>
    );
};

const ProfessorClientsScreen = () => {
    const layout = useWindowDimensions();
    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'clients', title: 'Clientes' },
        { key: 'feedback', title: 'Feedback' },
    ]);

    const [users, setUsers] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [feedbackSearch, setFeedbackSearch] = useState('');
    
    // selectedClient: Array de objetos cliente para pasar al modal
    // Si es null, el modal asume modo "Global/Todos"
    const [selectedClient, setSelectedClient] = useState(null); 
    const [planModalVisible, setPlanModalVisible] = useState(false);
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Estados Selección Múltiple (Para asignación masiva)
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedClientIds, setSelectedClientIds] = useState([]);

    const { gymColor } = useAuth();
    const accent = gymColor || '#1a5276';
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, accent);

    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    const closeAlert = () => setAlertInfo(prev => ({ ...prev, visible: false }));

    const fetchClients = useCallback(async () => {
        const response = await apiClient.get('/users?role=cliente');
        setUsers(response.data || []);
    }, []);

    const fetchFeedbacks = useCallback(async () => {
        const response = await apiClient.get('/plans/feedback');
        setFeedbacks(response.data || []);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            await Promise.all([fetchClients(), fetchFeedbacks()]);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar los datos.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }]
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchClients, fetchFeedbacks]);

    const { refresh } = useCachedFocusEffect(
        async ({ isInitial }) => {
            if (isInitial) setLoading(true);
            try {
                await fetchData();
            } finally {
                if (isInitial) setLoading(false);
            }
        },
        { ttlMs: 45_000 }
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refresh();
    }, [refresh]);

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

    const filteredFeedbacks = useMemo(() => {
        if (!feedbackSearch.trim()) return feedbacks;
        const q = feedbackSearch.toLowerCase();
        return feedbacks.filter((fb) => {
            const name = `${fb.user?.nombre || ''} ${fb.user?.apellido || ''}`.toLowerCase();
            const planName = (fb.plan?.name || '').toLowerCase();
            const comment = (fb.comment || '').toLowerCase();
            return name.includes(q) || planName.includes(q) || comment.includes(q);
        });
    }, [feedbacks, feedbackSearch]);

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
                    <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                        {item.fotoPerfil ? (
                            <Image source={{ uri: item.fotoPerfil }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#eee' }} />
                        ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: accent, justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="person" size={22} color="#fff" />
                            </View>
                        )}
                        <View style={{flex: 1}}>
                            <Text style={styles.cardTitle}>{item.nombre} {item.apellido}</Text>
                            <Text style={styles.cardSubtitle}>{item.email}</Text>
                        </View>
                    </View>
                    {isSelectionMode && (
                        <MaterialCommunityIcons 
                            name={isSelected ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
                            size={24} 
                            color={isSelected ? accent : Colors[colorScheme].icon} 
                        />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderFeedbackCard = ({ item }) => {
        const clientName = item.user
            ? `${item.user.nombre || ''} ${item.user.apellido || ''}`.trim()
            : 'Cliente';
        const planName = item.plan?.name || 'Plan';
        const dateLabel = item.updatedAt
            ? format(new Date(item.updatedAt), 'dd/MM/yyyy HH:mm')
            : '';

        return (
            <View style={styles.feedbackCard}>
                <View style={styles.feedbackTopRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.feedbackClient} numberOfLines={1}>{clientName}</Text>
                        <Text style={styles.feedbackPlan} numberOfLines={1}>{planName}</Text>
                    </View>
                    <StarRow rating={item.rating} accent={accent} />
                </View>
                {!!item.comment && (
                    <Text style={styles.feedbackComment}>{item.comment}</Text>
                )}
                {!item.comment && !item.rating && (
                    <Text style={styles.feedbackCommentMuted}>Sin comentario</Text>
                )}
                {!!dateLabel && (
                    <Text style={styles.feedbackDate}>{dateLabel}</Text>
                )}
            </View>
        );
    };

    const renderClientsRoute = () => (
        <ThemedView style={{ flex: 1 }}>
            {isSelectionMode ? (
                <View style={[styles.selectionBar, { backgroundColor: '#333' }]}>
                    <Text style={styles.selectionText}>
                        {selectedClientIds.length} seleccionados
                    </Text>
                    <TouchableOpacity onPress={cancelSelectionMode}>
                        <FontAwesome5 name="times" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            ) : null}

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
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={accent} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{searchTerm ? "No se encontraron clientes." : "Aún no tienes clientes asignados."}</Text>
                    </View>
                }
            />

            {isSelectionMode ? (
                <TouchableOpacity style={styles.fab} onPress={handleOpenBulkSelectionModal}>
                    <FontAwesome5 name="check" size={24} color="#fff" />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.fab} onPress={handleOpenGlobalModal}>
                    <Ionicons name="documents" size={26} color="#fff" />
                </TouchableOpacity>
            )}
        </ThemedView>
    );

    const renderFeedbackRoute = () => (
        <ThemedView style={{ flex: 1 }}>
            <View style={styles.searchInputContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por cliente, plan o texto..."
                    placeholderTextColor={Colors[colorScheme].icon}
                    value={feedbackSearch}
                    onChangeText={setFeedbackSearch}
                />
                <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
            </View>

            <FlatList
                data={filteredFeedbacks}
                renderItem={renderFeedbackCard}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={accent} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors[colorScheme].icon} style={{ marginBottom: 12 }} />
                        <Text style={styles.emptyText}>
                            {feedbackSearch
                                ? 'No hay feedback que coincida.'
                                : 'Cuando un cliente finalice un plan y deje feedback, lo vas a ver acá.'}
                        </Text>
                    </View>
                }
            />
        </ThemedView>
    );

    const renderScene = ({ route }) => {
        switch (route.key) {
            case 'clients':
                return renderClientsRoute();
            case 'feedback':
                return renderFeedbackRoute();
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator size="large" color={accent} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <TabView
                navigationState={{ index, routes }}
                renderScene={renderScene}
                onIndexChange={(i) => {
                    setIndex(i);
                    if (i !== 0 && isSelectionMode) cancelSelectionMode();
                }}
                initialLayout={{ width: layout.width }}
                renderTabBar={(props) => (
                    <TabBar
                        {...props}
                        style={{
                            backgroundColor: accent,
                            paddingTop: Platform.OS === 'android' ? 10 : 0,
                            borderBottomLeftRadius: 20,
                            borderBottomRightRadius: 20,
                            elevation: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            marginBottom: 8,
                        }}
                        indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }}
                        renderLabel={({ route, focused }) => (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text
                                    style={{
                                        color: focused ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                        fontSize: 13,
                                        fontWeight: 'bold',
                                        textTransform: 'none',
                                    }}
                                >
                                    {route.title}
                                </Text>
                                {route.key === 'feedback' && feedbacks.length > 0 && (
                                    <View style={styles.tabBadge}>
                                        <Text style={styles.tabBadgeText}>{feedbacks.length}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    />
                )}
            />

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
                gymColor={accent} 
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    selectionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: 15,
        marginBottom: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
    },
    selectionText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    searchInputContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginVertical: 10, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 10, borderWidth: 1, borderColor: Colors[colorScheme].border },
    searchInput: { flex: 1, height: 50, paddingHorizontal: 15, color: Colors[colorScheme].text, fontSize: 16 },
    searchIcon: { marginRight: 15 },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 14, padding: 18, marginVertical: 6, marginHorizontal: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3,  borderWidth: 1, borderColor: Colors[colorScheme].border},
    cardSelected: { borderColor: gymColor, backgroundColor: gymColor + '10' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
    emptyContainer: { flex: 1, marginTop: 50, alignItems: 'center', paddingHorizontal: 20 },
    emptyText: { fontSize: 16, color: Colors[colorScheme].icon, textAlign: 'center' },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: gymColor, borderRadius: 30, elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    feedbackCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 14,
        padding: 16,
        marginVertical: 6,
        marginHorizontal: 15,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    feedbackTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    feedbackClient: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors[colorScheme].text,
    },
    feedbackPlan: {
        marginTop: 2,
        fontSize: 13,
        fontWeight: '600',
        color: gymColor,
    },
    feedbackComment: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors[colorScheme].text,
        opacity: 0.85,
    },
    feedbackCommentMuted: {
        fontSize: 13,
        fontStyle: 'italic',
        color: Colors[colorScheme].icon,
    },
    feedbackDate: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '600',
        color: Colors[colorScheme].icon,
    },
    tabBadge: {
        backgroundColor: '#e74c3c',
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
        paddingHorizontal: 4,
    },
    tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});

export default ProfessorClientsScreen;
