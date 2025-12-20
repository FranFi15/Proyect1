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
   ThemedText,
    RefreshControl 
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import TrainingPlanModal from '../../components/profesor/TrainingPlanModal';
import CustomAlert from '@/components/CustomAlert';
import { FontAwesome5 } from '@expo/vector-icons';

const ProfessorClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [planModalVisible, setPlanModalVisible] = useState(false);
    // --- 2. Add state for refreshing ---
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    const fetchData = useCallback(async () => {
        // No setLoading(true) here, handled by loading/isRefreshing states
        try {
            const response = await apiClient.get('/users?role=cliente');
            setUsers(response.data);
        } catch (error) {
            console.error("Error fetching clients:", error.response?.data || error.message);
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar los clientes.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // --- 3. Create onRefresh function ---
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

    const handleOpenPlanModal = (client) => {
        setSelectedClient(client);
        setPlanModalVisible(true);
    };

    const handleCloseModal = () => {
        setPlanModalVisible(false);
        setSelectedClient(null);
    };

    const filteredData = useMemo(() => {
        if (!searchTerm) return users;
        return users.filter(user =>
            `${user.nombre} ${user.apellido}`.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const renderUserCard = ({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleOpenPlanModal(item)}>
            <View>
                <Text style={styles.cardTitle}>{item.nombre} {item.apellido}</Text>
                <Text style={styles.cardSubtitle}>{item.email}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Planes</Text>
            </View>
            {loading ? <ActivityIndicator style={{ marginTop: 20 }} size="large" color={gymColor} /> : (
                
                <ThemedView>
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
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={gymColor}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {searchTerm ? "No se encontraron clientes con ese nombre." : "Aún no tienes clientes asignados."}
                            </Text>
                        </View>
                    }
                />
                </ThemedView>
            )}
            
            {selectedClient && (
                <TrainingPlanModal
                    visible={planModalVisible}
                    client={selectedClient}
                    onClose={handleCloseModal}
                />
            )}
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
    headerContainer: {
        backgroundColor: gymColor,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    searchInputContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginVertical: 10, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, borderWidth: 1, borderColor: Colors[colorScheme].border },
    searchInput: { flex: 1, height: 50, paddingHorizontal: 15, color: Colors[colorScheme].text, fontSize: 16 },
    searchIcon: { marginRight: 15 },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, padding: 20, marginVertical: 8, marginHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,  },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
    emptyContainer: {
        flex: 1,
        marginTop: 50,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyText: {
        fontSize: 16,
        color: Colors[colorScheme].icon,
        textAlign: 'center',
    },
});

export default ProfessorClientsScreen;