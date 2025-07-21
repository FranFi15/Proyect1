// MOVIL-APP/app/(tabs)/calendar.js
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
     RefreshControl,
     Linking,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { es, tr } from 'date-fns/locale';

// --- COMPONENTES Y CONSTANTES TEMÁTICAS ---
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

// --- IMPORT NEW SERVICES ---
import classService from '../../services/classService'; 
import userService from '../../services/userService';   
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
const getCalendarTheme = (colorScheme, gymColor) => ({
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

    const ActionButton = ({ onPress, iconName, title, color, iconColor = '#fff' }) => (
    <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: color }]}
        onPress={onPress}
    >
        <FontAwesome5 name={iconName} size={16} color={iconColor} />
        <Text style={styles.actionButtonText}>{title}</Text>
    </TouchableOpacity>
);


    // --- ESTADOS ---
    const [activeView, setActiveView] = useState('calendar');
    const [allClasses, setAllClasses] = useState([]); // All classes fetched from API
    const [selectedDate, setSelectedDate] = useState(null); // For calendar selected date
    const [markedDates, setMarkedDates] = useState({}); // For calendar dots/styles
    const [isLoading, setIsLoading] = useState(true);
    const { user, refreshUser , gymColor } = useAuth(); // User data from AuthContext
    const [classTypes, setClassTypes] = useState([]); // For picker filter
    const [selectedClassType, setSelectedClassType] = useState('all'); // For picker filter
    const [error, setError] = useState(null)
    const [isRefreshing, setIsRefreshing] = useState(false); 
    const [adminPhoneNumber, setAdminPhoneNumber] = useState(null);

    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);
    const calendarTheme = getCalendarTheme(colorScheme);

    useEffect(() => {
    // Esta función se ejecuta cada vez que el objeto 'user' cambia.
    if (user && user.adminPhoneNumber) {
        console.log("Número de admin encontrado en el contexto:", user.adminPhoneNumber);
        setAdminPhoneNumber(user.adminPhoneNumber);
    }
}, [user]);

     const handleWhatsAppPress = (phoneNumber) => {
    // Ya no necesita buscar en 'user', recibe el número directamente
    if (phoneNumber) {
        const message = 'Hola, tengo una consulta sobre los turnos.';
        const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Asegúrate de tener WhatsApp instalado.');
        });
    }
};

    const fetchData = useCallback(async () => {
        if (!user) {
            Alert.alert("Error", "Usuario no autenticado.");
            return;
        }
        try {
            await refreshUser();
            const [classesResponse, typesResponse] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/tipos-clase')
            ]);
            
            setAllClasses(classesResponse.data);
            setClassTypes(typesResponse.data.tiposClase || []);
            
            const markers = {};
            classesResponse.data.forEach(cls => {
                if (cls.estado !== 'cancelada') {
                    const dateString = cls.fecha.substring(0, 10);
                    if (!markers[dateString]) {
                        markers[dateString] = { customStyles: { container: { backgroundColor: colorScheme === 'dark' ? '#333' : '#e9ecef', borderRadius: 10 } } };
                    }
                    if (user && (cls.usuariosInscritos || []).includes(user._id)) {
                        markers[dateString].marked = true;
                        markers[dateString].dotColor = gymColor;
                    }
                }
            });
            setMarkedDates(markers);
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudieron cargar los datos.');
            console.error('Error fetching data for CalendarScreen:', error);
        }
    }, [user, colorScheme, gymColor, refreshUser]);

    // --- 4. Modificar useFocusEffect para manejar la carga inicial ---
    useFocusEffect(useCallback(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            await fetchData();
            setIsLoading(false);
        };
        loadInitialData();
    }, [fetchData]));

    // --- 5. Crear la función onRefresh ---
    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchData();
        setIsRefreshing(false);
    }, [fetchData]);

    // --- Lógica de filtrado (ya estaba correcta) ---
    const visibleClasses = useMemo(() => {
        const now = new Date();
        const nowTime = now.getTime();

        return allClasses
            .filter(cls => {
                if (activeView === 'list' && selectedDate) {
                    return cls.fecha.substring(0, 10) === selectedDate;
                }
                const classDateTime = parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`);
                return classDateTime.getTime() >= nowTime;
            })
            .filter(cls => selectedClassType === 'all' || cls.tipoClase?._id === selectedClassType)
            .map(cls => ({
                ...cls,
                isEnrolled: (cls.usuariosInscritos || []).includes(user?._id),
                isWaiting: (cls.waitlist || []).includes(user?._id),
                isFull: (cls.usuariosInscritos || []).length >= cls.capacidad,
                isCancelled: cls.estado === 'cancelada',
                isFinished: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaFin}:00`).getTime() < nowTime,
                dateTime: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`),
            }))
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
    }, [allClasses, selectedDate, selectedClassType, activeView, user]);

    // --- LÓGICA DE MANEJO DE ACCIONES ---
    const handleEnroll = async (classId) => {
        try {
            await apiClient.post(`/classes/${classId}/enroll`);
            Alert.alert('¡Éxito!', 'Te has inscrito en el turno.');
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

    const handleSubscribe = useCallback(async (classId) => {
        try {
            const response = await classService.subscribeToWaitlist(classId);
            Alert.alert('¡Listo!', response.data.message);
            fetchData(); // Recargamos datos para que el botón cambie de estado
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'No se pudo procesar la solicitud.');
        }
    }, [fetchData]);

    const handleUnsubscribe = useCallback(async (classId) => {
        try {
            const response = await classService.unsubscribeFromWaitlist(classId);
            Alert.alert('Hecho', response.data.message);
            fetchData(); // Recargamos datos
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'No se pudo procesar la solicitud.');
        }
    }, [fetchData]);

    // --- MANEJO DE CALENDARIO ---
    const handleDayPress = (day) => {
        setSelectedDate(day.dateString); // 'YYYY-MM-DD'
        setActiveView('list'); // Switch to list view for the selected day
    };

    const formattedDateTitle = useMemo(() => {
        if (activeView === 'calendar' || !selectedDate) {
            return 'Próximos Turnos'; 
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
        // Ahora usamos las propiedades seguras que calculamos en `visibleClasses`
        const { isEnrolled, isFull, isWaiting, isCancelled, isFinished } = item;
        const dynamicStyle = getClassStyle(item);

        return (
            <ThemedView style={[styles.classItem, dynamicStyle, isFinished && styles.finishedClass]}>
                {/* ... ThemedTexts para nombre, horario, etc. (sin cambios) ... */}
                <ThemedText style={[styles.className, (isCancelled || isFinished) && styles.disabledText]}>
                    {item.nombre} - {item.tipoClase?.nombre || ''}
                </ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>A cargo de : {item.profesor?.nombre || 'A confirmar'} {item.profesor?.apellido || ''}</ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Cupos: {(item.usuariosInscritos || []).length}/{item.capacidad}</ThemedText>

                <View style={styles.buttonContainer}>
    {isCancelled ? (
        <Text style={styles.badgeCancelled}>CANCELADO</Text>
    ) : isFinished ? (
        <Text style={styles.badgeFinished}>TERMINADO</Text>
    ) : isEnrolled ? (
        // Botón para anular
        <ActionButton
            title="Anular Inscripción"
            onPress={() => handleUnenroll(item._id)}
            iconName="calendar-times"
            color="#e74c3c" // Rojo
        />
    ) : isFull ? (
        isWaiting ? (
            // Botón para salir de la lista de espera
            <ActionButton
                title="En lista de espera"
                onPress={() => handleUnsubscribe(item._id)}
                iconName="check-circle"
                color="#f0ad4e" 
            />
        ) : (
            // Botón para unirse a la lista de espera
            <ActionButton
                title="Notificarme Disponibilidad"
                onPress={() => handleSubscribe(item._id)}
                iconName="bell"
                color="#1a5276" 
            />
        )
    ) : (
        // Botón para inscribirse
        <ActionButton
            title="Inscribirme"
            onPress={() => handleEnroll(item._id)}
            iconName="calendar-check"
            color="#2ecc71" 
        />
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
        <View style={{ flex: 1 }}>
        <ThemedView style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => { setActiveView('calendar'); setSelectedDate(null); }} style={[styles.tab, activeView === 'calendar' && styles.activeTab]}>
                    <Text style={styles.tabText}>Calendario</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveView('list')} style={[styles.tab, activeView === 'list' && styles.activeTab]}>
                    <Text style={styles.tabText}>Turnos</Text>
                </TouchableOpacity>
            </View>

            {activeView === 'calendar' && (
                <Calendar 
                    onDayPress={handleDayPress} 
                    markedDates={markedDates} 
                    markingType={'custom'} 
                    theme={calendarTheme} 
                    hideArrows={true}
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
                            <Picker.Item label="Todos los Turnos" value="all" color={Colors[colorScheme].text} />
                            {classTypes.map(type => (
                                <Picker.Item key={type._id} label={type.nombre} value={type._id} color={Colors[colorScheme].text} />
                            ))}
                        </Picker>
                    </View>

                    {visibleClasses.length === 0 && !isLoading ? ( // Show empty text only if not loading and no classes
                         <ThemedText style={styles.emptyText}>No hay turnos para los filtros seleccionados.</ThemedText>
                    ) : (
                        selectedDate ? ( // If specific date selected, use FlatList
                            <FlatList
                                data={visibleClasses}
                                keyExtractor={item => item._id}
                                renderItem={renderClassItem}
                                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay turnos para este día.</ThemedText>}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />
                    }
                                
                            />
                        ) : ( // If no date selected, use SectionList for upcoming classes grouped by day
                            <SectionList
                                sections={sectionedClasses}
                                keyExtractor={(item, index) => item._id + index}
                                renderItem={renderClassItem}
                                renderSectionHeader={({ section: { title } }) => (
                                    <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
                                )}
                                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay próximos turnos.</ThemedText>}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />
                    }
                            />
                        )
                    )}
                </>
            )}
        </ThemedView>
        {adminPhoneNumber && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => handleWhatsAppPress(adminPhoneNumber)}
                >
                    <FontAwesome5 name="whatsapp" size={30} color="#fff" />
                </TouchableOpacity>
            )}
            </View>
    );

};

const getStyles = (colorScheme, gymColor) => {
    const shadowProp = {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    };

    

    return StyleSheet.create({
        actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        ...shadowProp, // Reutilizamos la sombra que ya tienes
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 10,
        fontSize: 14,
    },
        container: { flex: 1 },
        tabContainer: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingTop: Platform.OS === 'android' ? 10 : 0,
            backgroundColor: gymColor,
        },
        tab: { paddingBottom: 10, paddingHorizontal: 10, paddingTop: 10 },
        activeTab: { borderBottomWidth: 3, borderBottomColor: '#ffffff' },
        tabText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
        pickerContainer: {
            marginHorizontal: 15,
            marginVertical: 10,
            borderRadius: 8,
            borderWidth: 0,
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
            borderRadius: 2,
            borderWidth: 0,
            backgroundColor: Colors[colorScheme].cardBackground,
            ...shadowProp,
        },
        className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
        classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
        buttonContainer: { marginTop: 12, alignSelf: 'flex-start' },
        emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
        cancelledClass: { backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5', borderColor: colorScheme === 'dark' ? '#555' : '#e0e0e0', borderLeftWidth: 0, borderWidth: 1 },
        finishedClass: { opacity: 0.6 },
        disabledText: { color: Colors[colorScheme].icon },
        badgeCancelled: { color: Colors[colorScheme].error, fontStyle: 'italic', fontWeight: 'bold' },
        badgeFinished: { color: Colors[colorScheme].icon, fontStyle: 'italic', fontWeight: 'bold' },
        requestedBadge: {
            backgroundColor: '#f0ad4e',
            color: 'white',
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 5,
            fontWeight: 'bold',
            fontSize: 12
        },
        availableBadge: {
            backgroundColor: '#5cb85c',
            color: 'white',
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 5,
            fontWeight: 'bold',
            fontSize: 12
        },
        emptyClass: { borderLeftWidth: 15, borderColor: '#006400', backgroundColor: colorScheme === 'dark' ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9' },
        almostEmptyClass: { borderLeftWidth: 15, borderColor: '#FFC107', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 193, 7, 0.2)' : '#fffde7' },
        almostFullClass: { borderLeftWidth: 15, borderColor: '#ff7707', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 119, 7, 0.2)' : '#fff3e0' },
        fullClass: { borderLeftWidth: 15, borderColor: '#F44336', backgroundColor: colorScheme === 'dark' ? 'rgba(244, 67, 54, 0.2)' : '#ffebee' },
        fab: {
            position: 'absolute',
            width: 50,
            height: 50,
            alignItems: 'center',
            justifyContent: 'center',
            right: 20,
            bottom: 20,
            backgroundColor: '#25D366',
            borderRadius: 30,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.23,
            shadowRadius: 2.62,
            zIndex: 999,
        },
    });
};
export default CalendarScreen;