import React, { useState, useCallback, useMemo } from 'react';
import { 
    StyleSheet, 
    ActivityIndicator, 
    TouchableOpacity, 
    Platform,
    useColorScheme, 
    SectionList,
    View, 
    Text, 
    RefreshControl,
    useWindowDimensions // <-- AÑADIDO
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import apiClient from '../../services/apiClient';
import CustomAlert from '@/components/CustomAlert';
import { FontAwesome5 } from '@expo/vector-icons';

// --- AÑADIDO: Importaciones para TabView ---
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';

const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    const formattedStr = str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return formattedStr.replace(' De ', ' de ');
};

const formatTeachers = (clase) => {
    // 1. Prioridad: Array de profesores (Nueva estructura)
    if (clase.profesores && Array.isArray(clase.profesores) && clase.profesores.length > 0) {
        return clase.profesores
            .map(p => p ? `${p.nombre} ${p.apellido || ''}`.trim() : '')
            .filter(name => name !== '')
            .join(', ');
    }
    
    // 2. Fallback: Profesor único (Estructura antigua)
    if (clase.profesor && clase.profesor.nombre) {
        return `${clase.profesor.nombre} ${clase.profesor.apellido || ''}`.trim();
    }

    // 3. Default
    return 'Sin profesor asignado';
};

const MyClassesScreen = () => {
    // --- STATE MANAGEMENT ---
    const layout = useWindowDimensions();
    const [index, setIndex] = useState(0); // <-- NUEVO ESTADO PARA TABVIEW
    const [routes] = useState([        // <-- NUEVO ESTADO PARA TABVIEW
        { key: 'upcoming', title: 'Próximo Turnos' },
        { key: 'past', title: 'Historial' },
    ]);
    
    // const [activeTab, setActiveTab] = useState('upcoming'); // <-- ELIMINADO

    const [enrolledClasses, setEnrolledClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, refreshUser, gymColor } = useAuth();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

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
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar tus turnos.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        }
    }, []);

    useFocusEffect(useCallback(() => {
        const loadData = async () => {
            setLoading(true);
            await fetchMyClasses();
            setLoading(false);
        };
        loadData();
    }, [fetchMyClasses]));

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchMyClasses();
        setIsRefreshing(false);
    }, [fetchMyClasses]);

    const handleUnenroll = (classId) => {
        const performUnenroll = async () => {
            try {
                const response = await apiClient.post(`/classes/${classId}/unenroll`);
                await refreshUser();
                await fetchMyClasses();
                setAlertInfo({
                    visible: true,
                    title: 'Anulación Procesada',
                    message: response.data.message,
                    buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
                });
            } catch (error) {
                setAlertInfo({
                    visible: true,
                    title: 'Error',
                    message: error.response?.data?.message || 'No se pudo anular la inscripción.',
                    buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
                });
            }
        };

        setAlertInfo({
            visible: true,
            title: "Confirmar Anulación",
            message: "¿Estás seguro de que quieres anular tu inscripción?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Sí, Anular", onPress: () => {
                    setAlertInfo({ visible: false });
                    performUnenroll();
                }, style: 'destructive' }
            ]
        });
    };
    
    const upcomingClasses = useMemo(() => {
        const now = new Date();
        const filtered = enrolledClasses
            .map(cls => ({ ...cls, dateTime: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`) }))
            .filter(cls => cls.dateTime >= now)
            .sort((a, b) => a.dateTime - b.dateTime);

        if (filtered.length === 0) return [];

        const grouped = filtered.reduce((acc, clase) => {
            const dateKey = capitalize(format(clase.dateTime, "EEEE, d 'de' MMMM", { locale: es }));
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(clase);
            return acc;
        }, {});

        return Object.keys(grouped).map(dateKey => ({ title: dateKey, data: grouped[dateKey] }));
    }, [enrolledClasses]);

    const pastClasses = useMemo(() => {
        const now = new Date();
        const filtered = enrolledClasses
            .map(cls => ({ ...cls, dateTime: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`) }))
            .filter(cls => cls.dateTime < now)
            .sort((a, b) => b.dateTime - a.dateTime);

        if (filtered.length === 0) return [];
        
        const grouped = filtered.reduce((acc, clase) => {
            const dateKey = capitalize(format(clase.dateTime, "EEEE, d 'de' MMMM", { locale: es }));
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(clase);
            return acc;
        }, {});

        return Object.keys(grouped).map(dateKey => ({ title: dateKey, data: grouped[dateKey] }));
    }, [enrolledClasses]);

    const renderClassItem = ({ item }) => {
        const now = new Date();
        const canUnenroll = item.dateTime >= now;
        const isCancelled = item.estado === 'cancelada';

        return (
            <ThemedView style={styles.classItem}>
                <ThemedText style={styles.className}>{item.nombre || 'Turno'} - {item.tipoClase?.nombre || ''}</ThemedText>
                <ThemedText style={styles.classInfoText}>
                                    A cargo de: {formatTeachers(item)}
                                </ThemedText>
                <ThemedText style={styles.classInfoText}>Horario: {item.horaInicio}hs - {item.horaFin}hs</ThemedText>
                
                <View style={styles.buttonContainer}>
                    {isCancelled ? <Text style={styles.badgeCancelled}>CANCELADA</Text>
                    : index === 0 && canUnenroll && ( // <-- LÓGICA ACTUALIZADA
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

  const UpcomingScene = () => (
        <SectionList
            sections={upcomingClasses}
            keyExtractor={(item, index) => item._id + index}
            renderItem={renderClassItem}
            renderSectionHeader={({ section: { title } }) => <ThemedText style={styles.sectionHeader}>{title}</ThemedText>}
            ListEmptyComponent={<ThemedText style={styles.emptyText}>No tienes próximos turnos.</ThemedText>}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />}
        />
    );

    const PastScene = () => (
        <SectionList
            sections={pastClasses}
            keyExtractor={(item, index) => item._id + index}
            renderItem={renderClassItem}
            renderSectionHeader={({ section: { title } }) => <ThemedText style={styles.sectionHeader}>{title}</ThemedText>}
            ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay turnos en el historial.</ThemedText>}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />}
        />
    );

    const renderScene = SceneMap({
      upcoming: UpcomingScene,
      past: PastScene,
    });

    if (loading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <TabView
                navigationState={{ index, routes }}
                renderScene={renderScene}
                onIndexChange={setIndex}
                initialLayout={{ width: layout.width }}
                renderTabBar={props => (
                    <TabBar
                        {...props}
                        style={{ backgroundColor: gymColor, paddingTop: 10 }}
                        indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }}
                         labelStyle={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', textTransform:'none'  }}
                    />
                )}
            />
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

const getStyles = (colorScheme, gymColor) => {

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
            borderRadius: 5,
            elevation: 2,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, 
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
            color: Colors.light.error,
            fontWeight: 'bold',
            fontStyle: 'italic',
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 15,
            borderRadius: 5,
            elevation: 2,
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
