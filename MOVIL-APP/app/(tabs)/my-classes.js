import React, { useState, useCallback, useMemo } from 'react';
import { 
    StyleSheet, 
    Alert, 
    ActivityIndicator, 
    TouchableOpacity, 
    Platform,
    useColorScheme, 
    SectionList,
    View, 
    Text, 
    RefreshControl,
} from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons'; // 1. Importar los íconos

const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    const formattedStr = str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return formattedStr.replace(' De ', ' de ');
};

const MyClassesScreen = () => {
    // --- ESTADOS (SIN CAMBIOS) ---
    const [enrolledClasses, setEnrolledClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming'); 
    const { user, refreshUser, gymColor } = useAuth();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // 2. Definir el componente del botón con ícono DENTRO de MyClassesScreen
    const ActionButton = ({ onPress, iconName, title, color, iconColor = '#fff' }) => (
        <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: color }]}
            onPress={onPress}
        >
            <FontAwesome5 name={iconName} size={16} color={iconColor} />
            <Text style={styles.actionButtonText}>{title}</Text>
        </TouchableOpacity>
    );

     const fetchMyClasses = useCallback(async () => {
        try {
            const userResponse = await apiClient.get('/users/me');
            const enrolledIds = new Set(userResponse.data.clasesInscritas || []);

            const classesResponse = await apiClient.get('/classes');
            
            const myClasses = classesResponse.data.filter(cls => enrolledIds.has(cls._id));
            
            const sortedClasses = myClasses.sort((a, b) => {
                const dateComparison = new Date(a.fecha) - new Date(b.fecha);
                if (dateComparison !== 0) return dateComparison;
                return a.horaInicio.localeCompare(b.horaInicio);
            });

            setEnrolledClasses(sortedClasses);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar tus turnos.');
        }
    }, []);

    // --- 4. Modificar useFocusEffect para manejar el estado de carga inicial ---
    useFocusEffect(useCallback(() => {
        const loadData = async () => {
            setLoading(true);
            await fetchMyClasses();
            setLoading(false);
        };
        loadData();
    }, [fetchMyClasses]));

    // --- 5. Crear la función onRefresh ---
    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchMyClasses();
        setIsRefreshing(false);
    }, [fetchMyClasses]);

    

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
    
    const sectionedClasses = useMemo(() => {
        const now = new Date();
        const sortedAndFilteredClasses = enrolledClasses
            .map(cls => ({
                ...cls,
                dateTime: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`)
            }))
            .filter(cls => activeTab === 'upcoming' ? cls.dateTime >= now : cls.dateTime < now)
            .sort((a, b) => activeTab === 'upcoming' ? a.dateTime - b.dateTime : b.dateTime - a.dateTime);

        if (sortedAndFilteredClasses.length === 0) return [];

        const grouped = sortedAndFilteredClasses.reduce((acc, clase) => {
            const dateKey = format(clase.dateTime, "EEEE, d 'de' MMMM", { locale: es });
            const capitalizedDateKey = capitalize(dateKey);
            if (!acc[capitalizedDateKey]) {
                acc[capitalizedDateKey] = [];
            }
            acc[capitalizedDateKey].push(clase);
            return acc;
        }, {});

        return Object.keys(grouped).map(dateKey => ({
            title: dateKey,
            data: grouped[dateKey]
        }));
    }, [activeTab, enrolledClasses]);

    const renderClassItem = ({ item }) => {
        const now = new Date();
        const canUnenroll = item.dateTime >= now;
        const isCancelled = item.estado === 'cancelada';

        return (
            <ThemedView style={styles.classItem}>
                <ThemedText style={styles.className}>{item.nombre} - {item.tipoClase?.nombre || ''}</ThemedText>
                {item.profesor ? (
                    <ThemedText style={styles.classInfoText}>A cargo de : {item.profesor.nombre} {item.profesor.apellido}</ThemedText>
                ) : (
                    <ThemedText style={styles.classInfoText}>A cargo de : A confirmar</ThemedText>
                )}
                <ThemedText style={styles.classInfoText}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
                
                {/* 3. Usar el nuevo ActionButton */}
                <View style={styles.buttonContainer}>
                    {isCancelled ? <Text style={styles.badgeCancelled}>CANCELADA</Text>
                    : activeTab === 'upcoming' && canUnenroll && (
                        <ActionButton 
                            title="Anular Inscripción" 
                            color="#e74c3c" 
                            onPress={() => handleUnenroll(item._id)}
                            iconName="calendar-times"
                        />
                    )}
                </View>
            </ThemedView>
        );
    };

    if (loading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('upcoming')} style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}>
                    <Text style={styles.tabText}>Próximas</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('past')} style={[styles.tab, activeTab === 'past' && styles.activeTab]}>
                    <Text style={styles.tabText}>Historial</Text>
                </TouchableOpacity>
            </View>
            
            <SectionList
                sections={sectionedClasses}
                keyExtractor={(item, index) => item._id + index}
                renderItem={renderClassItem}
                renderSectionHeader={({ section: { title } }) => (
                    <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
                )}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay turnos en esta sección.</ThemedText>}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={
                    <RefreshControl 
                        refreshing={isRefreshing} 
                        onRefresh={onRefresh} 
                        tintColor={gymColor} // Color del spinner de carga
                    />
                }
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => {
    const shadowProp = {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    };

    return StyleSheet.create({
        container: { flex: 1 },
        tabContainer: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingTop: 10,
            backgroundColor: gymColor,
        },
        tab: { paddingVertical: 10, paddingHorizontal: 10 },
        activeTab: { borderBottomWidth: 3, borderBottomColor: '#ffffff' },
        tabText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
        sectionHeader: {
            fontSize: 18,
            fontWeight: 'bold',
            paddingVertical: 10,
            paddingHorizontal: 16,
            marginTop: 10,
            color: Colors[colorScheme].text,
            backgroundColor: Colors[colorScheme].background,
        },
        classItem: {
            backgroundColor: Colors[colorScheme].cardBackground,
            padding: 20,
            marginHorizontal: 16,
            marginVertical: 8,
            borderRadius: 2,
            ...shadowProp
        },
        className: {
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 8,
            color: Colors[colorScheme].text,
        },
        classInfoText: {
            fontSize: 14,
            opacity: 0.8,
            marginBottom: 4,
            color: Colors[colorScheme].text,
        },
        buttonContainer: {
            marginTop: 12,
            alignSelf: 'flex-start'
        },
        emptyText: {
            textAlign: 'center',
            marginTop: 50,
            fontSize: 16,
            opacity: 0.7,
            color: Colors[colorScheme].text,
        },
        badgeCancelled: {
            color: Colors[colorScheme].error,
            fontWeight: 'bold',
            fontStyle: 'italic',
        },
        // 4. Añadir los estilos para el nuevo botón
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 15,
            borderRadius: 8,
            ...shadowProp,
        },
        actionButtonText: {
            color: '#fff',
            fontWeight: 'bold',
            marginLeft: 10,
            fontSize: 14,
        },
    });
};

export default MyClassesScreen;