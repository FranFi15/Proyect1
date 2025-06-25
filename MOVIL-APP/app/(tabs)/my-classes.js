// app/(tabs)/my-classes.js
import React, { useState, useCallback } from 'react';
import { View, Text, Button, FlatList, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MyClassesScreen = () => {
    const [enrolledClasses, setEnrolledClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' o 'past'

    const fetchMyClasses = async () => {
        try {
            setLoading(true);
            // 1. Obtener los datos del usuario, incluyendo las clases inscritas
            const userResponse = await apiClient.get('/users/me');
            const enrolledIds = new Set(userResponse.data.clasesInscritas || []);

            // 2. Obtener todas las clases para tener los detalles
            const classesResponse = await apiClient.get('/classes');
            
            // 3. Filtrar para obtener solo las clases del usuario
            const myClasses = classesResponse.data.filter(cls => enrolledIds.has(cls._id));
            setEnrolledClasses(myClasses);

        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar tus clases.');
        } finally {
            setLoading(false);
        }
    };

    // useFocusEffect se ejecuta cada vez que la pantalla está en foco
    useFocusEffect(
        useCallback(() => {
            fetchMyClasses();
        }, [])
    );

    const handleUnenroll = async (classId) => {
        Alert.alert(
            "Confirmar Anulación",
            "¿Estás seguro de que quieres anular tu inscripción en esta clase?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sí, anular",
                    onPress: async () => {
                        try {
                            await apiClient.post(`/classes/${classId}/unenroll`);
                            Alert.alert('Éxito', 'Inscripción anulada correctamente.');
                            fetchMyClasses(); // Volver a cargar las clases
                        } catch (error) {
                            Alert.alert('Error', error.response?.data?.message || 'No se pudo anular la inscripción.');
                        }
                    },
                    style: 'destructive'
                }
            ]
        );
    };
    
    const now = new Date();
    const upcomingClasses = enrolledClasses.filter(cls => new Date(cls.fecha) >= now);
    const pastClasses = enrolledClasses.filter(cls => new Date(cls.fecha) < now);

    if (loading) {
        return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
    }

    return (
        <View style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('upcoming')} style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}>
                    <Text style={styles.tabText}>Próximas</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('past')} style={[styles.tab, activeTab === 'past' && styles.activeTab]}>
                    <Text style={styles.tabText}>Historial</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={activeTab === 'upcoming' ? upcomingClasses : pastClasses}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <View style={styles.classItem}>
                        <Text style={styles.className}>{item.nombre}</Text>
                        <Text>Fecha: {format(new Date(item.fecha), "EEEE, d 'de' MMMM", { locale: es })}</Text>
                        <Text>Horario: {item.horaInicio} - {item.horaFin}</Text>
                        {activeTab === 'upcoming' && (
                            <Button title="Anular Inscripción" color="#dc3545" onPress={() => handleUnenroll(item._id)} />
                        )}
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay clases en esta sección.</Text>}
            />
        </View>
    );
};

// ... (añade tus estilos en un objeto StyleSheet)
const styles = StyleSheet.create({
    container: { flex: 1 },
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', padding: 10 },
    tab: { padding: 10 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#6f5c94' },
    tabText: { fontSize: 16, fontWeight: 'bold' },
    classItem: { padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
    className: { fontSize: 18, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 }
});

export default MyClassesScreen;