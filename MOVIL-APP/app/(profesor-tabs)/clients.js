import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, FlatList, View, TextInput, ActivityIndicator, Alert, TouchableOpacity, useColorScheme, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import TrainingPlanModal from '../../components/profesor/TrainingPlanModal';

const ProfessorClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [planModalVisible, setPlanModalVisible] = useState(false);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // --- CORRECCIÓN: Se pide al backend que filtre los usuarios por rol ---
            // Esto es más eficiente que traer todos los usuarios y filtrar en la app.
            const response = await apiClient.get('/users?role=cliente');
            setUsers(response.data);
        } catch (error) {
            console.error("Error fetching clients:", error.response?.data || error.message);
            Alert.alert('Error', 'No se pudieron cargar los socios.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleOpenPlanModal = (client) => {
        setSelectedClient(client);
        setPlanModalVisible(true);
    };

    const handleCloseModal = () => {
        setPlanModalVisible(false);
        setSelectedClient(null); // Limpiamos el cliente seleccionado al cerrar
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
            <Ionicons name="create-outline" size={24} color={gymColor} />
        </TouchableOpacity>
    );

    return (
        <ThemedView style={styles.container}>
            <TextInput style={styles.searchInput} placeholder="Buscar socio..." value={searchTerm} onChangeText={setSearchTerm} />
            {loading ? <ActivityIndicator color={gymColor} /> : (
                <FlatList
                    data={filteredData}
                    renderItem={renderUserCard}
                    keyExtractor={(item) => item._id}
                />
            )}
            
            {selectedClient && (
                 <TrainingPlanModal
                    visible={planModalVisible}
                    client={selectedClient}
                    onClose={handleCloseModal}
                />
            )}
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    searchInput: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 2, paddingHorizontal: 15, margin: 15, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 2, padding: 20, marginVertical: 8, marginHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
});

export default ProfessorClientsScreen;
