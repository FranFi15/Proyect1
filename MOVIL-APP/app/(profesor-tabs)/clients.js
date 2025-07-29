import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, FlatList, View, TextInput, ActivityIndicator, TouchableOpacity, useColorScheme, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import TrainingPlanModal from '../../components/profesor/TrainingPlanModal';
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado

const ProfessorClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [planModalVisible, setPlanModalVisible] = useState(false);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // Estado para manejar la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/users?role=cliente');
            setUsers(response.data);
        } catch (error) {
            console.error("Error fetching clients:", error.response?.data || error.message);
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar los socios.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
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
            <TextInput style={styles.searchInput}placeholderTextColor={Colors[colorScheme].icon} placeholder="Buscar socio..." value={searchTerm} onChangeText={setSearchTerm} />
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
    searchInput: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, margin: 15, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, padding: 20, marginVertical: 8, marginHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
});

export default ProfessorClientsScreen;
