// app/class-list.js
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, useFocusEffect} from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';

const ClassListScreen = () => {
    // 1. Recibimos la fecha que nos mandó el calendario
    const { date } = useLocalSearchParams();
    const { user, login } = useAuth();

    // 2. Todos los estados que antes estaban en CalendarScreen, ahora viven aquí
    const [allClasses, setAllClasses] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [selectedClassType, setSelectedClassType] = useState('all');
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        // ... (La función fetchData es la misma que tenías antes, la traemos aquí)
        try {
            setIsLoading(true);
            const [classesResponse, typesResponse] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/tipos-clase')
            ]);
            setAllClasses(classesResponse.data);
            setClassTypes(typesResponse.data.tiposClase || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los datos.');
        } finally {
            setIsLoading(false);
        }
    };

    // Refresca los datos cada vez que esta pantalla se enfoca
    useFocusEffect(useCallback(() => { fetchData(); }, []));

    // 3. Toda la lógica de la lista (filtrado, ordenamiento) vive aquí
    const visibleClasses = useMemo(() => {
        return allClasses
            .filter(cls => cls.fecha.substring(0, 10) === date)
            .filter(cls => selectedClassType === 'all' || cls.tipoClase?._id === selectedClassType)
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }, [allClasses, date, selectedClassType]);

    // 4. Los handlers para inscribirse y anular también se mueven aquí
    const handleEnroll = async (classId) => { /* ... (Pega aquí tu función handleEnroll) ... */ };
    const handleUnenroll = async (classId) => { /* ... (Pega aquí tu función handleUnenroll) ... */ };
    const getClassStyle = (clase) => { /* ... (Pega aquí tu función getClassStyle) ... */ };


    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: `Clases para el ${date}` }} />

            {/* Filtro de Tipo de Clase */}
            <View style={styles.pickerContainer}>
                <Picker selectedValue={selectedClassType} onValueChange={itemValue => setSelectedClassType(itemValue)}>
                    <Picker.Item label="-- Todas las clases --" value="all" />
                    {classTypes.map(type => (
                        <Picker.Item key={type._id} label={type.nombre} value={type._id} />
                    ))}
                </Picker>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color="#6f5c94" />
            ) : (
                <FlatList
                    data={visibleClasses}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => {
                        const isEnrolled = user?.clasesInscritas?.includes(item._id);
                        const isCancelled = item.estado === 'cancelada';
                        const dynamicStyle = getClassStyle(item);

                        return (
                            <View style={[styles.classItem, dynamicStyle]}>
                                {/* ... (Pega aquí el JSX de tu renderItem para mostrar la clase) ... */}
                                <Text style={styles.className}>{item.nombre}</Text>
                                {/* ... más detalles ... */}
                                 <View style={styles.buttonContainer}>
                                    {isCancelled ? (
                                        <View style={styles.badge}><Text style={styles.badgeText}>CANCELADA</Text></View>
                                    ) : isEnrolled ? (
                                        <Button title="Anular Inscripción" color="#e74c3c" onPress={() => handleUnenroll(item._id)} />
                                    ) : (
                                        <Button title="Inscribirme" color="#2ecc71" onPress={() => handleEnroll(item._id)} disabled={item.usuariosInscritos.length >= item.capacidad} />
                                    )}
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay clases que coincidan con los filtros.</Text>}
                />
            )}
        </View>
    );
};

// Pega aquí el objeto de estilos completo que tenías en CalendarScreen
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    pickerContainer: {
        marginHorizontal: 10,
        marginTop: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    classItem: {
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderColor: '#eee',
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 8,
    },
     emptyClass: {
        backgroundColor: '#e8f5e9', // Verde muy claro (tranquilo)
    },
    almostEmptyClass: {
        backgroundColor: '#fffde7', // Amarillo muy claro (tranquilo)
    },
    almostFullClass: {
        backgroundColor: '#fff3e0', // Naranja muy claro (tranquilo)
    },
    fullClass: {
        backgroundColor: '#ffebee', // Rojo muy claro (tranquilo)
    }
});

export default ClassListScreen;