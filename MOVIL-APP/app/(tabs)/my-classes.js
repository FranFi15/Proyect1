// Archivo: MOVIL-APP/app/(tabs)/my-classes.js

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, SectionList, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';

// Función para capitalizar los títulos de las fechas
const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    const formattedStr = str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return formattedStr.replace(' De ', ' de ');
};


const MyClassesScreen = () => {
    const [enrolledClasses, setEnrolledClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming'); 
    const { user, refreshUser } = useAuth();

    const fetchMyClasses = async () => {
        try {
            setLoading(true);
            const userResponse = await apiClient.get('/users/me');
            const enrolledIds = new Set(userResponse.data.clasesInscritas || []);

            const classesResponse = await apiClient.get('/classes');
            
            const myClasses = classesResponse.data.filter(cls => enrolledIds.has(cls._id));
            
            // Ordenamos las clases por fecha y hora
            const sortedClasses = myClasses.sort((a, b) => {
                const dateComparison = new Date(a.fecha) - new Date(b.fecha);
                if (dateComparison !== 0) return dateComparison;
                return a.horaInicio.localeCompare(b.horaInicio);
            });

            setEnrolledClasses(sortedClasses);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar tus clases.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchMyClasses(); }, []));

    const handleUnenroll = (classId) => {
        const performUnenroll = async () => {
            try {
                const response = await apiClient.post(`/classes/${classId}/unenroll`);
                Alert.alert('Anulación Procesada', response.data.message);
                await refreshUser();
                fetchMyClasses();
            } catch (error) {
                Alert.alert('Error', error.response?.data?.message || 'No se pudo anular la inscripción.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("¿Estás seguro de que quieres anular tu inscripción?")) {
                performUnenroll();
            }
        } else {
            Alert.alert("Confirmar Anulación", "¿Estás seguro de que quieres anular tu inscripción?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Sí, Anular", onPress: performUnenroll, style: 'destructive' }
            ]);
        }
    };

    
    
    // --- INICIO DE LA SOLUCIÓN ---

    // 1. Filtramos y agrupamos las clases para la SectionList
    const sectionedClasses = useMemo(() => {
        const now = new Date();

        // 1. Filtra y ordena las clases según la pestaña activa
        const sortedAndFilteredClasses = enrolledClasses
            .map(cls => ({
                ...cls,
                // Creamos un objeto Date completo para poder ordenar correctamente
                dateTime: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`)
            }))
            .filter(cls => {
                // 'upcoming' incluye las de hoy que no han pasado y las futuras
                // 'past' incluye las de hoy que ya pasaron y las pasadas
                return activeTab === 'upcoming' ? cls.dateTime >= now : cls.dateTime < now;
            })
            .sort((a, b) => {
                // Ordenamos ascendentemente para 'upcoming' y descendentemente para 'past'
                return activeTab === 'upcoming' 
                    ? a.dateTime - b.dateTime 
                    : b.dateTime - a.dateTime;
            });

        if (sortedAndFilteredClasses.length === 0) return [];

        // 2. Agrupa las clases por fecha para la SectionList
        const grouped = sortedAndFilteredClasses.reduce((acc, clase) => {
            const dateKey = format(clase.dateTime, "EEEE, d 'de' MMMM", { locale: es });
            const capitalizedDateKey = capitalize(dateKey);
            if (!acc[capitalizedDateKey]) {
                acc[capitalizedDateKey] = [];
            }
            acc[capitalizedDateKey].push(clase);
            return acc;
        }, {});

        // 3. Convierte el objeto agrupado en un array para la SectionList
        return Object.keys(grouped).map(dateKey => ({
            title: dateKey,
            data: grouped[dateKey]
        }));
    }, [activeTab, enrolledClasses]);


    const renderClassItem = ({ item }) => {
        const now = new Date();
        const canUnenroll = item.dateTime >= now; // Solo se puede anular si la clase es futura

        return (
            <View style={styles.classItem}>
                <Text style={styles.className}>{item.nombre} - {item.tipoClase?.nombre || ''}</Text>
                {item.profesor ? (
                    <Text style={styles.classInfoText}>Profesor: {item.profesor.nombre} {item.profesor.apellido}</Text>
                ) : (
                    <Text style={styles.classInfoText}>Profesor: A confirmar</Text>
                )}
                <Text style={styles.classInfoText}>Horario: {item.horaInicio} - {item.horaFin}</Text>
                
                <View style={styles.buttonContainer}>
                    {activeTab === 'upcoming' && canUnenroll && (
                        <Button title="Anular Inscripción" color="#e74c3c" onPress={() => handleUnenroll(item._id)} />
                    )}
                </View>
            </View>
        );
    };

    // --- FIN DE LA SOLUCIÓN ---

    if (loading) {
        return <ActivityIndicator size="large" style={{ marginTop: 50, flex: 1 }} />;
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
            
            {/* 3. Reemplazamos FlatList por SectionList */}
            <SectionList
                sections={sectionedClasses}
                keyExtractor={(item, index) => item._id + index}
                renderItem={renderClassItem}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={styles.sectionHeader}>{title}</Text>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay clases en esta sección.</Text>}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};


// 4. Añadimos los nuevos estilos para las tarjetas y las secciones
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor:'#f7f7f7' },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 10,
        backgroundColor:'#150224',
        
    },
    tab: { paddingVertical: 10, paddingHorizontal: 10 },
    activeTab: { borderBottomWidth: 3, borderBottomColor: '#9282b3' },
    tabText: { fontSize: 16, fontWeight: '600', color:'#ffffff' },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#495057',
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginTop: 10,
    },
    classItem: {
        backgroundColor: '#ffffff',
        padding: 20,
        marginHorizontal: 8,
        marginVertical: 8,
        borderRadius: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2, },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    className: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#343a40',
        marginBottom: 8,
    },
    classInfoText: {
        fontSize: 14,
        color: '#6c757d',
        marginBottom: 4,
    },
    buttonContainer: {
        marginTop: 12,
        alignSelf: 'flex-start'
    },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#888' }
});

export default MyClassesScreen;