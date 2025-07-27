import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
    useColorScheme,
    SectionList,
    FlatList,
    View,
    Text,
    RefreshControl,
    Linking,
    useWindowDimensions, // <-- AÑADIDO
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// --- AÑADIDO: Importaciones para TabView ---
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';

// --- COMPONENTES Y CONSTANTES TEMÁTICAS ---
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';
import classService from '../../services/classService';

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

const getCalendarTheme = (colorScheme, gymColor) => ({
    calendarBackground: Colors[colorScheme].background,
    textSectionTitleColor: Colors[colorScheme].text,
    selectedDayBackgroundColor: gymColor || Colors.light.tint,
    selectedDayTextColor: '#ffffff',
    todayTextColor: gymColor || Colors.light.tint,
    dayTextColor: Colors[colorScheme].text,
    textDisabledColor: Colors[colorScheme].icon,
    dotColor: gymColor || Colors.light.tint,
    selectedDotColor: '#ffffff',
    arrowColor: gymColor || Colors.light.tint,
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
    // EL ESTADO 'activeView' SE REEMPLAZA POR EL SISTEMA DE 'react-native-tab-view'
    const layout = useWindowDimensions();
    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'calendar', title: 'Calendario' },
        { key: 'list', title: 'Turnos' },
    ]);

    const [allClasses, setAllClasses] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [markedDates, setMarkedDates] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { user, refreshUser , gymColor } = useAuth();
    const [classTypes, setClassTypes] = useState([]);
    const [selectedClassType, setSelectedClassType] = useState('all');
    const [error, setError] = useState(null)
    const [isRefreshing, setIsRefreshing] = useState(false); 
    const [adminPhoneNumber, setAdminPhoneNumber] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);
    const calendarTheme = getCalendarTheme(colorScheme, gymColor);
    
    // --- LÓGICA DE FUNCIONES (la mayoría sin cambios) ---

    useEffect(() => {
        if (user && user.adminPhoneNumber) {
            setAdminPhoneNumber(user.adminPhoneNumber);
        }
    }, [user]);

     const handleWhatsAppPress = (phoneNumber) => {
        if (phoneNumber) {
            const message = 'Hola, tengo una consulta sobre los turnos.';
            const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            Linking.openURL(url).catch(() => {
                setAlertInfo({ visible: true, title: 'Error', message: 'Asegúrate de tener WhatsApp instalado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            });
        }
    };

    const fetchData = useCallback(async () => {
        if (!user) return;
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
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudieron cargar los datos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    }, [user, colorScheme, gymColor, refreshUser]);

    useFocusEffect(useCallback(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            await fetchData();
            setIsLoading(false);
        };
        loadInitialData();
    }, [fetchData]));

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchData();
        setIsRefreshing(false);
    }, [fetchData]);

    const visibleClasses = useMemo(() => {
        const now = new Date();
        const nowTime = now.getTime();

        return allClasses
            .filter(cls => {
                // Si estamos en la vista de lista y hay una fecha seleccionada, filtramos por esa fecha
                if (index === 1 && selectedDate) {
                    return cls.fecha.substring(0, 10) === selectedDate;
                }
                // Si no, mostramos solo las clases futuras
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
    }, [allClasses, selectedDate, selectedClassType, index, user]); // <-- 'activeView' cambiado por 'index'

    const handleEnroll = useCallback(async (classId) => {
        const performEnroll = async () => {
            try {
                await apiClient.post(`/classes/${classId}/enroll`);
                await refreshUser();
                await fetchData();
                setAlertInfo({ 
                    visible: true, 
                    title: '¡Éxito!', 
                    message: 'Te has inscrito en el turno.', 
                    buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] 
                });
            } catch (error) {
                setAlertInfo({ 
                    visible: true, 
                    title: 'Error', 
                    message: error.response?.data?.message || 'No se pudo procesar la inscripción.', 
                    buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] 
                });
            }
        };

        setAlertInfo({
            visible: true,
            title: "Confirmar Inscripción",
            message: "¿Estás seguro de que quieres inscribirte en este turno?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Sí, Inscribirme", style: 'primary', onPress: () => {
                    setAlertInfo({ visible: false });
                    performEnroll();
                }}
            ]
        });
    }, [refreshUser, fetchData]);

    const handleUnenroll = useCallback(async (classId) => {
        const performUnenroll = async () => {
            try {
                const response = await apiClient.post(`/classes/${classId}/unenroll`);
                await refreshUser();
                await fetchData();
                setAlertInfo({ visible: true, title: 'Anulación Procesada', message: response.data.message, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            } catch (error) {
                setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo anular la inscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            }
        };
        setAlertInfo({
            visible: true,
            title: "Confirmar Anulación",
            message: "¿Estás seguro de que quieres anular tu inscripción?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Sí, Anular", style: 'destructive', onPress: () => {
                    setAlertInfo({ visible: false });
                    performUnenroll();
                }}
            ]
        });
    }, [refreshUser, fetchData]);

    // ... (handleSubscribe y handleUnsubscribe se mantienen igual)
    const handleSubscribe = useCallback(async (classId) => {
        try {
            const response = await classService.subscribeToWaitlist(classId);
            fetchData();
            setAlertInfo({ visible: true, title: '¡Listo!', message: response.data.message, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } catch (err) {
            setAlertInfo({ visible: true, title: 'Error', message: err.response?.data?.message || 'No se pudo procesar la solicitud.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    }, [fetchData]);

    const handleUnsubscribe = useCallback(async (classId) => {
        try {
            const response = await classService.unsubscribeFromWaitlist(classId);
            fetchData();
            setAlertInfo({ visible: true, title: 'Hecho', message: response.data.message, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } catch (err) {
            setAlertInfo({ visible: true, title: 'Error', message: err.response?.data?.message || 'No se pudo procesar la solicitud.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    }, [fetchData]);

    // --- MANEJADORES DE EVENTOS (MODIFICADOS) ---
    const handleDayPress = (day) => {
        setSelectedDate(day.dateString);
        setIndex(1); // Cambia al tab de "Turnos"
    };

    const handleIndexChange = (newIndex) => {
        // Si el usuario vuelve al calendario, limpiamos la fecha seleccionada
        if (newIndex === 0) {
            setSelectedDate(null);
        }
        setIndex(newIndex);
    };

    const formattedDateTitle = useMemo(() => {
        if (!selectedDate) {
            return 'Próximos Turnos'; 
        }
        try {
            const date = parseISO(selectedDate);
            return capitalize(format(date, "EEEE, d 'de' MMMM", { locale: es }));
        } catch (e) {
            return 'Clases'; 
        }
    }, [selectedDate]);

    const sectionedClasses = useMemo(() => {
        if (selectedDate) return []; // SectionList solo se usa para la vista general

        const grouped = visibleClasses.reduce((acc, clase) => {
            const dateKey = clase.fecha.substring(0, 10);
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(clase);
            return acc;
        }, {});

        return Object.keys(grouped)
            .sort((a, b) => new Date(a) - new Date(b))
            .map(dateKey => ({
                title: capitalize(format(parseISO(dateKey), "EEEE, d 'de' MMMM", { locale: es })),
                data: grouped[dateKey]
            }));
    }, [visibleClasses, selectedDate]);

    const renderClassItem = ({ item }) => {
        const { isEnrolled, isFull, isWaiting, isCancelled, isFinished } = item;
        const dynamicStyle = getClassStyle(item);

        return (
            <ThemedView style={[styles.classItem, dynamicStyle, isFinished && styles.finishedClass]}>
                <ThemedText style={[styles.className, (isCancelled || isFinished) && styles.disabledText]}>
                    {item.nombre || 'Turno'} - {item.tipoClase?.nombre || ''}
                </ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Horario: {item.horaInicio}hs - {item.horaFin}hs</ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>A cargo de : {item.profesor?.nombre || 'A confirmar'} {item.profesor?.apellido || ''}</ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Cupos: {(item.usuariosInscritos || []).length}/{item.capacidad}</ThemedText>

                <View style={styles.buttonContainer}>
                    {isCancelled ? (
                        <Text style={styles.badgeCancelled}>CANCELADO</Text>
                    ) : isFinished ? (
                        <Text style={styles.badgeFinished}>TERMINADO</Text>
                    ) : isEnrolled ? (
                        <ActionButton
                            title="Anular Inscripción"
                            onPress={() => handleUnenroll(item._id)}
                            iconName="calendar-times"
                            color="#e74c3c"
                        />
                    ) : isFull ? (
                        isWaiting ? (
                            <ActionButton
                                title="En lista de espera"
                                onPress={() => handleUnsubscribe(item._id)}
                                iconName="check-circle"
                                color="#f0ad4e" 
                            />
                        ) : (
                            <ActionButton
                                title="Notificarme Disponibilidad"
                                onPress={() => handleSubscribe(item._id)}
                                iconName="bell"
                                color="#1a5276" 
                            />
                        )
                    ) : (
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

    const getClassStyle = (clase) => {
        if (clase.estado === 'cancelada') {
            return styles.cancelledClass;
        }
        const fillRatio = clase.capacidad > 0 ? (clase.usuariosInscritos || []).length / clase.capacidad : 0;
        if (fillRatio === 1) return styles.fullClass;
        if (fillRatio >= 0.8) return styles.almostFullClass;
        if (fillRatio < 0.4) return styles.emptyClass;
        if (fillRatio < 0.7) return styles.almostEmptyClass;
        return {}; 
    };
    
    // --- RENDERIZADO DE ESCENAS PARA TABVIEW ---
    const CalendarScene = () => (
           <ThemedView style={{ flex: 1 }}>
        <Calendar 
            onDayPress={handleDayPress} 
            markedDates={markedDates} 
            markingType={'custom'} 
            theme={calendarTheme} 
        />
        </ThemedView>
    );

    const ListScene = () => (
        <ThemedView style={{ flex: 1 }}>
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

            {visibleClasses.length === 0 && !isLoading ? (
                 <ThemedText style={styles.emptyText}>No hay turnos para los filtros seleccionados.</ThemedText>
            ) : (
                selectedDate ? (
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
                ) : (
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
        </ThemedView>
    );

    const renderScene = SceneMap({
      calendar: CalendarScene,
      list: ListScene,
    });

    if (isLoading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
                <ThemedText style={styles.loadingText}>Cargando clases...</ThemedText>
            </ThemedView>
        );
    }
    
    // El render principal ahora usa TabView
    return (
        <View style={{ flex: 1 }}>
            <TabView
                navigationState={{ index, routes }}
                renderScene={renderScene}
                onIndexChange={handleIndexChange} // Usamos el nuevo handler
                initialLayout={{ width: layout.width }}
                renderTabBar={props => (
                    <TabBar
                        {...props}
                        style={{ backgroundColor: gymColor, paddingTop: Platform.OS === 'android' ? 10 : 0 }}
                        indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }}
                        labelStyle={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}
                    />
                )}
            />
            {adminPhoneNumber && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => handleWhatsAppPress(adminPhoneNumber)}
                >
                    <FontAwesome5 name="whatsapp" size={30} color="#fff" />
                </TouchableOpacity>
            )}
            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={gymColor} 
            />
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => {

    return StyleSheet.create({
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 15,
            borderRadius: 8,
        },
        actionButtonText: {
            color: '#fff',
            fontWeight: 'bold',
            marginLeft: 10,
            fontSize: 14,
        },
        container: { flex: 1, },
        pickerContainer: {
            marginHorizontal: 15,
            marginVertical: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: Colors[colorScheme].border,
            backgroundColor: Colors[colorScheme].background,
            justifyContent: 'center',
        },
        listHeader: { textAlign: 'center', fontSize: 20, fontWeight: 'bold', padding: 15, color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].background },
        sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: Colors[colorScheme].background, opacity: 0.9, color: Colors[colorScheme].text },
        classItem: {
            padding: 20,
            marginHorizontal: 16,
            marginVertical: 8,
            borderRadius: 8,
            borderWidth: 0,
            elevation:2,
            backgroundColor: Colors[colorScheme].background
        },
        className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
        classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
        buttonContainer: { marginTop: 12, alignSelf: 'flex-start', elevation: 3, },
        emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
        cancelledClass: { backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5', borderColor: colorScheme === 'dark' ? '#555' : '#e0e0e0', borderLeftWidth: 0, borderWidth: 1 },
        finishedClass: { opacity: 0.6 },
        disabledText: { color: Colors[colorScheme].icon },
        badgeCancelled: { color: Colors.light.error, fontStyle: 'italic', fontWeight: 'bold' },
        badgeFinished: { color: Colors[colorScheme].icon, fontStyle: 'italic', fontWeight: 'bold' },
        requestedBadge: {
            backgroundColor: '#f0ad4e',
            color: 'white',
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 8,
            fontWeight: 'bold',
            fontSize: 12
        },
        availableBadge: {
            backgroundColor: '#5cb85c',
            color: 'white',
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 8,
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
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
        },
        loadingText: {
            marginTop: 10,
            fontSize: 16,
            color: Colors[colorScheme].text
        },
        errorText: {
            color: Colors.light.error,
            fontSize: 16,
            textAlign: 'center'
        },
        retryButton: {
            marginTop: 20,
            backgroundColor: gymColor,
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 8
        },
        retryButtonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold'
        }
    });
};
export default CalendarScreen