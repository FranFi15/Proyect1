import React, { useState, useCallback, useMemo } from 'react';
import { 
    StyleSheet, 
    Alert, 
    ActivityIndicator, 
    TouchableOpacity, 
    Platform,
    useColorScheme, 
    SectionList,
    Button,
    View, 
    Text, 
} from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

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
    const { user, refreshUser } = useAuth();

    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);

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
                    <ThemedText style={styles.classInfoText}>Profesor: {item.profesor.nombre} {item.profesor.apellido}</ThemedText>
                ) : (
                    <ThemedText style={styles.classInfoText}>Profesor: A confirmar</ThemedText>
                )}
                <ThemedText style={styles.classInfoText}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
                
                <View style={styles.buttonContainer}>
                    {isCancelled ? <Text style={styles.badgeCancelled}>CANCELADA</Text>
                    : activeTab === 'upcoming' && canUnenroll && (
                        <Button title="Anular Inscripción" color="#e74c3c" onPress={() => handleUnenroll(item._id)} />
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
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay clases en esta sección.</ThemedText>}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme) => StyleSheet.create({
    container: { flex: 1 },
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
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginTop: 10,
        color: Colors[colorScheme].text,
        backgroundColor: Colors[colorScheme].background,
    },
    classItem: {
        backgroundColor: Colors[colorScheme].card,
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    className: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    classInfoText: {
        fontSize: 14,
        opacity: 0.8,
        marginBottom: 4,
    },
    buttonContainer: {
        marginTop: 12,
        alignSelf: 'flex-start'
    },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7 },
    badgeCancelled: {
        color: Colors[colorScheme].error,
        fontWeight: 'bold',
        fontStyle: 'italic',
    }
});

export default MyClassesScreen;
