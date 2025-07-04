// MOVIL-APP/app/(tabs)/calendar.js
import React, { useState, useCallback, useMemo } from 'react';
import { 
    StyleSheet, 
    Alert, 
    ActivityIndicator, 
    TouchableOpacity, 
    Platform,
    useColorScheme, 
    SectionList,
    FlatList,
    Button, // Make sure Button is imported for the "Notificarme si hay lugar" button
    View, 
    Text, 
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// --- COMPONENTES Y CONSTANTES TEMÁTICAS ---
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';

// --- IMPORT NEW SERVICES ---
import classService from '../../services/classService'; // Ensure this service is created
import userService from '../../services/userService';   // Ensure this service is created with getUserProfile
// --- END IMPORT NEW SERVICES ---


// --- CONFIGURACIÓN DE IDIOMA (SIN CAMBIOS) ---
LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
    today: "Hoy"
};
LocaleConfig.defaultLocale = 'es';

const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    const formattedStr = str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return formattedStr.replace(' De ', ' de ');
};

// --- TEMA DEL CALENDARIO AHORA ES UNA FUNCIÓN DINÁMICA ---
const getCalendarTheme = (colorScheme) => ({
    calendarBackground: Colors[colorScheme].background,
    textSectionTitleColor: Colors[colorScheme].text,
    selectedDayBackgroundColor: Colors.light.tint, 
    selectedDayTextColor: '#ffffff',
    todayTextColor: Colors.light.tint,
    dayTextColor: Colors[colorScheme].text,
    textDisabledColor: Colors[colorScheme].icon,
    dotColor: Colors.light.tint,
    selectedDotColor: '#ffffff',
    arrowColor: Colors.light.tint,
    disabledArrowColor: Colors[colorScheme].icon,
    monthTextColor: Colors[colorScheme].text,
    textDayFontWeight: '400',
    textMonthFontWeight: 'bold',
    textDayHeaderFontWeight: '500',
    textDayFontSize: 16,
    textMonthFontSize: 20,
    textDayHeaderFontSize: 14,
});


const CalendarScreen = () => {
    // --- ESTADOS ---
    const [activeView, setActiveView] = useState('calendar');
    const [allClasses, setAllClasses] = useState([]); // All classes fetched from API
    const [selectedDate, setSelectedDate] = useState(null); // For calendar selected date
    const [markedDates, setMarkedDates] = useState({}); // For calendar dots/styles
    const [isLoading, setIsLoading] = useState(true);
    const { user, refreshUser } = useAuth(); // User data from AuthContext
    const [classTypes, setClassTypes] = useState([]); // For picker filter
    const [selectedClassType, setSelectedClassType] = useState('all'); // For picker filter
    const [error, setError] = useState(null)
    
    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);
    const calendarTheme = getCalendarTheme(colorScheme);

    // --- LÓGICA DE DATOS: Fetch Classes, Class Types, and User Profile (for requestedSpotNotifications) ---
    const fetchData = useCallback(async () => {
        if (!user) { // Ensure user is logged in before fetching data
            Alert.alert("Error", "Usuario no autenticado. Por favor, reinicia la app.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            // Fetch all classes (assuming this endpoint provides capacity and enrolled users)
            const classesResponse = await apiClient.get('/classes'); 
            // Fetch all class types for the picker
            const typesResponse = await apiClient.get('/tipos-clase');
            // --- NEW: Fetch the user's complete profile to get their requestedSpotNotifications ---
            const userProfileResponse = await userService.getUserProfile(); 
            const requestedSpotClassIds = new Set(userProfileResponse.data.requestedSpotNotifications.map(req => req.class));
            // --- END NEW ---

            setAllClasses(classesResponse.data);
            setClassTypes(typesResponse.data.tiposClase || []); // Adjust based on your API response structure for tiposClase
            
            // Mark dates on the calendar
            const markers = {};
            classesResponse.data.forEach(cls => {
                if (cls.estado !== 'cancelada') {
                    const dateString = cls.fecha.substring(0, 10);
                    if (!markers[dateString]) {
                        markers[dateString] = {
                            customStyles: {
                                container: {
                                    backgroundColor: colorScheme === 'dark' ? '#333' : '#e9ecef',
                                    borderRadius: 10,
                                }
                            }
                        };
                    }
                    // Mark if user is enrolled in any class on that day
                    if (user && cls.usuariosInscritos.includes(user._id)) { // Check if the current user is enrolled
                        markers[dateString].marked = true;
                        markers[dateString].dotColor = Colors.light.tint; // Use active color for enrolled days
                    }
                }
            });
            setMarkedDates(markers);

        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudieron cargar los datos.');
            console.error('Error fetching data for CalendarScreen:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, colorScheme]); // Depend on user and colorScheme for re-fetching/re-marking

    // --- useFocusEffect para recargar datos cada vez que la pantalla se enfoca ---
    useFocusEffect(useCallback(() => { 
        fetchData(); 
        // No cleanup needed unless you have specific listeners to remove
    }, [fetchData]));


    // --- LÓGICA DE FILTRADO Y ORDENAMIENTO DE CLASES VISIBLES ---
    const visibleClasses = useMemo(() => {
        const now = new Date();
        const nowTime = now.getTime(); // Get timestamp for easier comparison

        const currentRequestedSpotClassIds = new Set(
            user?.requestedSpotNotifications?.map(req => req.class) || []
        );

        return allClasses
            .filter(cls => {
                // Filter by selected date (if in list view and date selected)
                if (activeView === 'list' && selectedDate) {
                    return cls.fecha.substring(0, 10) === selectedDate;
                }
                // Always show upcoming classes if no specific date is selected in list view
                // For calendar view, all classes on the selected day are shown
                const classDateTime = parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`);
                return classDateTime.getTime() >= nowTime; // Only upcoming classes
            })
            // Filter by class type picker
            .filter(cls => selectedClassType === 'all' || cls.tipoClase?._id === selectedClassType)
            .map(cls => ({
                ...cls,
                isFull: cls.usuariosInscritos.length >= cls.capacidad,
                isRequestedForSpot: currentRequestedSpotClassIds.has(cls._id),
                dateTime: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`),
                isCancelled: cls.estado === 'cancelada', // Add isCancelled flag
                isFinished: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaFin}:00`).getTime() < nowTime, // Add isFinished flag
            }))
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Sort by date and time
    }, [allClasses, selectedDate, selectedClassType, activeView, user]); // Depend on user for requestedSpotNotifications update


    // --- LÓGICA DE MANEJO DE ACCIONES ---
    const handleEnroll = async (classId) => {
        try {
            await apiClient.post(`/classes/${classId}/enroll`);
            Alert.alert('¡Éxito!', 'Te has inscrito en la clase.');
            await refreshUser(); // Update user's enrolled classes in AuthContext
            fetchData(); // Refresh all data to update class capacities and user's enrollment status
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo procesar la inscripción.');
        }
    };

    const handleUnenroll = useCallback(async (classId) => {
        Alert.alert("Confirmar Anulación", "¿Estás seguro de que quieres anular tu inscripción?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Sí, Anular",
                onPress: async () => {
                    try {
                        const response = await apiClient.post(`/classes/${classId}/unenroll`);
                        Alert.alert('Anulación Procesada', response.data.message);
                        await refreshUser(); // Update user's enrolled classes and credits
                        fetchData(); // Refresh all data
                    } catch (error) {
                        Alert.alert('Error', error.response?.data?.message || 'No se pudo anular la inscripción.');
                    }
                },
                style: 'destructive'
            }
        ]);
    }, [refreshUser, fetchData]);

    // --- NUEVA FUNCIÓN: Unirse a la lista de espera ---
    const handleRequestSpotNotification = useCallback(async (classId) => {
        try {
            const response = await classService.requestSpotNotification(classId); // Call the new service method
            Alert.alert('Solicitud enviada', response.message || 'Recibirás una notificación si un lugar se desocupa.');
            fetchData(); // Re-fetch data to update button/badge state immediately after request
            refreshUser(); // To ensure user data (with new requestedSpotNotifications) is refreshed in AuthContext
        } catch (err) {
            Alert.alert('Error', err.message || 'No se pudo solicitar la notificación.');
            console.error('Error requesting spot notification:', err);
        }
    }, [fetchData, refreshUser]);

    // --- MANEJO DE CALENDARIO ---
    const handleDayPress = (day) => {
        setSelectedDate(day.dateString); // 'YYYY-MM-DD'
        setActiveView('list'); // Switch to list view for the selected day
    };

    const formattedDateTitle = useMemo(() => {
        if (activeView === 'calendar' || !selectedDate) {
            return 'Próximas Clases'; 
        }
        try {
            const date = parseISO(selectedDate);
            return capitalize(format(date, "EEEE, d 'de' MMMM", { locale: es }));
        } catch (e) {
            return 'Clases'; 
        }
    }, [selectedDate, activeView]);

    const sectionedClasses = useMemo(() => {
        // If a specific date is selected in list view, FlatList is used, so SectionList is not needed.
        if (activeView === 'list' && selectedDate) return []; 

        const grouped = visibleClasses.reduce((acc, clase) => {
            const dateKey = clase.fecha.substring(0, 10); // Group by YYYY-MM-DD
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(clase);
            return acc;
        }, {});

        // Convert grouped object to SectionList format, sort by date
        return Object.keys(grouped)
            .sort((a, b) => new Date(a) - new Date(b)) // Sort sections chronologically
            .map(dateKey => ({
                title: capitalize(format(parseISO(dateKey), "EEEE, d 'de' MMMM", { locale: es })),
                data: grouped[dateKey]
            }));
    }, [visibleClasses, activeView, selectedDate]); // Depend on visibleClasses and activeView

    // --- RENDERIZADO DE ITEM DE CLASE ---
    const renderClassItem = ({ item }) => {
        const isEnrolled = user?.clasesInscritas?.includes(item._id);
        const dynamicStyle = getClassStyle(item); // To show full/almost full etc.
        const isCurrentlyFull = item.usuariosInscritos.length >= item.capacidad;

        return (
            <ThemedView style={[styles.classItem, dynamicStyle, item.isFinished && styles.finishedClass]}>
                <ThemedText style={[styles.className, (item.isCancelled || item.isFinished) && styles.disabledText]}>
                    {item.nombre} - {item.tipoClase?.nombre || ''}
                </ThemedText>
                <ThemedText style={[styles.classInfoText, (item.isCancelled || item.isFinished) && styles.disabledText]}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
                <ThemedText style={[styles.classInfoText, (item.isCancelled || item.isFinished) && styles.disabledText]}>Profesor: {item.profesor?.nombre || 'A confirmar'} {item.profesor?.apellido || ''}</ThemedText>
                <ThemedText style={[styles.classInfoText, (item.isCancelled || item.isFinished) && styles.disabledText]}>Cupos: {item.usuariosInscritos.length}/{item.capacidad}</ThemedText>
                
                <View style={styles.buttonContainer}>
                    {item.isCancelled ? (
                        <Text style={styles.badgeCancelled}>CANCELADA</Text>
                    ) : item.isFinished ? (
                        <Text style={styles.badgeFinished}>TERMINADA</Text>
                    ) : isEnrolled ? (
                        <Button title="Anular" color="#e74c3c" onPress={() => handleUnenroll(item._id)} />
                    ) : isCurrentlyFull ? ( // If class is full and not enrolled
                        item.isRequestedForSpot ? ( // And already requested for spot
                            <ThemedText style={styles.requestedBadge}>Notificación Solicitada</ThemedText>
                        ) : ( // Not full, not enrolled, has space -> button to notify if spot available
                            <Button 
                                title="Notificarme si hay lugar" 
                                color={Colors[colorScheme].tint} 
                                onPress={() => handleRequestSpotNotification(item._id)} 
                            />
                        )
                    ) : ( // Not enrolled and not full -> button to enroll
                        <Button title="Inscribirme" color="#2ecc71" onPress={() => handleEnroll(item._id)} />
                    )}
                </View>
            </ThemedView>
        );
    };

    // Helper to determine class visual style based on fullness
    const getClassStyle = (clase) => {
        if (clase.estado === 'cancelada') {
            return styles.cancelledClass;
        }
        const fillRatio = clase.capacidad > 0 ? clase.usuariosInscritos.length / clase.capacidad : 0;
        if (fillRatio === 1) return styles.fullClass;
        if (fillRatio >= 0.8) return styles.almostFullClass;
        if (fillRatio < 0.4) return styles.emptyClass;
        if (fillRatio < 0.7) return styles.almostEmptyClass;
        return {}; 
    };

    if (isLoading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
                <ThemedText style={styles.loadingText}>Cargando clases...</ThemedText>
            </ThemedView>
        );
    }

    if (error) {
        return (
            <ThemedView style={styles.centered}>
                <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
                <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                    <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => { setActiveView('calendar'); setSelectedDate(null); }} style={[styles.tab, activeView === 'calendar' && styles.activeTab]}>
                    <Text style={styles.tabText}>Calendario</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveView('list')} style={[styles.tab, activeView === 'list' && styles.activeTab]}>
                    <Text style={styles.tabText}>Clases</Text>
                </TouchableOpacity>
            </View>

            {activeView === 'calendar' && (
                <Calendar 
                    onDayPress={handleDayPress} 
                    markedDates={markedDates} 
                    markingType={'custom'} 
                    theme={calendarTheme} 
                />
            )}

            {activeView === 'list' && (
                <>
                    <ThemedText style={styles.listHeader}>{formattedDateTitle}</ThemedText>
                    
                    <View style={styles.pickerContainer}>
                        <Picker 
                            selectedValue={selectedClassType} 
                            onValueChange={itemValue => setSelectedClassType(itemValue)}
                            style={{ color: Colors[colorScheme].text }}
                            dropdownIconColor={Colors[colorScheme].text}
                        >
                            <Picker.Item label="Todas las Clases" value="all" color={Colors[colorScheme].text} />
                            {classTypes.map(type => (
                                <Picker.Item key={type._id} label={type.nombre} value={type._id} color={Colors[colorScheme].text} />
                            ))}
                        </Picker>
                    </View>

                    {visibleClasses.length === 0 && !isLoading ? ( // Show empty text only if not loading and no classes
                         <ThemedText style={styles.emptyText}>No hay clases para los filtros seleccionados.</ThemedText>
                    ) : (
                        selectedDate ? ( // If specific date selected, use FlatList
                            <FlatList
                                data={visibleClasses}
                                keyExtractor={item => item._id}
                                renderItem={renderClassItem}
                                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay clases para este día.</ThemedText>}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        ) : ( // If no date selected, use SectionList for upcoming classes grouped by day
                            <SectionList
                                sections={sectionedClasses}
                                keyExtractor={(item, index) => item._id + index}
                                renderItem={renderClassItem}
                                renderSectionHeader={({ section: { title } }) => (
                                    <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
                                )}
                                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay próximas clases.</ThemedText>}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        )
                    )}
                </>
            )}
        </ThemedView>
    );
};

// --- FUNCIÓN QUE GENERA LOS ESTILOS DINÁMICOS ---
const getStyles = (colorScheme) => StyleSheet.create({
    container: { flex: 1 },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: Platform.OS === 'android' ? 10 : 0,
        backgroundColor: '#150224',
    },
    tab: { paddingBottom: 10, paddingHorizontal: 10, paddingTop: 10 },
    activeTab: { borderBottomWidth: 3, borderBottomColor: '#9282b3' },
    tabText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
    pickerContainer: { 
        marginHorizontal: 15, 
        marginVertical: 10, 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].icon,
        backgroundColor: Colors[colorScheme].background,
        justifyContent: 'center', 
    },
    listHeader: { textAlign: 'center', fontSize: 22, fontWeight: 'bold', padding: 15, color: Colors[colorScheme].text },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: Colors[colorScheme].background, opacity: 0.9, color: Colors[colorScheme].text },
    classItem: {
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors[colorScheme].icon,
        backgroundColor: Colors[colorScheme].cardBackground, // Ensure themed background
    },
    className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
    classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
    buttonContainer: { marginTop: 12, alignSelf: 'flex-start' },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
    
    // Estilos de estado de clase que respetan el modo oscuro
    cancelledClass: { backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5', borderColor: colorScheme === 'dark' ? '#555' : '#e0e0e0', borderLeftWidth: 0, borderWidth: 1 },
    finishedClass: { opacity: 0.6 },
    disabledText: { color: Colors[colorScheme].icon },
    badgeCancelled: { color: Colors[colorScheme].error, fontStyle: 'italic', fontWeight: 'bold' },
    badgeFinished: { color: Colors[colorScheme].icon, fontStyle: 'italic', fontWeight: 'bold' },

    // --- NEW BADGE STYLES FOR SPOT NOTIFICATION ---
    requestedBadge: { 
        backgroundColor: '#f0ad4e', // Orange for requested
        color: 'white', 
        paddingVertical: 5, 
        paddingHorizontal: 10, 
        borderRadius: 5, 
        fontWeight: 'bold', 
        fontSize: 12 
    },
    availableBadge: {
        backgroundColor: '#5cb85c', // Green for available
        color: 'white',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 5,
        fontWeight: 'bold',
        fontSize: 12
    },
    // --- END NEW BADGE STYLES ---

    // Estilos de ocupación adaptados para Dark Mode
    emptyClass: { borderLeftWidth: 15, borderColor: '#4CAF50', backgroundColor: colorScheme === 'dark' ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9' },
    almostEmptyClass: { borderLeftWidth: 15, borderColor: '#FFC107', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 193, 7, 0.2)' : '#fffde7' },
    almostFullClass: { borderLeftWidth: 15, borderColor: '#ff7707', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 119, 7, 0.2)' : '#fff3e0' },
    fullClass: { borderLeftWidth: 15, borderColor: '#F44336', backgroundColor: colorScheme === 'dark' ? 'rgba(244, 67, 54, 0.2)' : '#ffebee' },
});

export default CalendarScreen;