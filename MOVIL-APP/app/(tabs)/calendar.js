// app/(tabs)/calendar.js
import React, { useState, useCallback, useMemo } from 'react';
import { 
    StyleSheet, 
    Alert, 
    ActivityIndicator, 
    TouchableOpacity, 
    Platform,
    useColorScheme, // Hook para detectar el tema
    SectionList,
    FlatList,
    Button,
    View, // Mantenemos View para algunos contenedores simples
    Text, // Mantenemos Text para botones y elementos sin tema
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
    selectedDayBackgroundColor: Colors.light.tint, // Usamos un color fijo para mejor visibilidad
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
    // --- ESTADOS (SIN CAMBIOS) ---
    const [activeView, setActiveView] = useState('calendar');
    const [allClasses, setAllClasses] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [markedDates, setMarkedDates] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { user, refreshUser } = useAuth();
    const [classTypes, setClassTypes] = useState([]);
    const [selectedClassType, setSelectedClassType] = useState('all');
    
    // --- DETECCIÓN DEL TEMA Y ESTILOS DINÁMICOS ---
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);
    const calendarTheme = getCalendarTheme(colorScheme);

    // --- LÓGICA DE DATOS ---
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [classesResponse, typesResponse, userResponse] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/tipos-clase'),
                apiClient.get('/users/me')
            ]);
    
            const fetchedClasses = classesResponse.data;
            const userEnrolledClassIds = new Set(userResponse.data.clasesInscritas || []);
    
            setAllClasses(fetchedClasses);
            setClassTypes(typesResponse.data.tiposClase || []);
    
            const markers = {};
            fetchedClasses.forEach(cls => {
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
                    if (userEnrolledClassIds.has(cls._id)) {
                        markers[dateString].marked = true;
                        markers[dateString].dotColor = '#6f5c94'; 
                    }
                }
            });
            setMarkedDates(markers);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los datos.');
        } finally {
            setIsLoading(false);
        }
    };
    
    useFocusEffect(useCallback(() => { fetchData(); }, []));

    // --- LÓGICA DE FILTRADO Y ORDENAMIENTO ---
    const visibleClasses = useMemo(() => {
    const now = new Date(); // Obtenemos la fecha y hora actual

    return allClasses
        .filter(cls => {
            // Si hay una fecha seleccionada, mostramos todas las de ese día (comportamiento actual)
            if (selectedDate) {
                return cls.fecha.substring(0, 10) === selectedDate;
            } 
            // Si NO hay fecha seleccionada (vista de "Próximas Clases"),
            // combinamos fecha y hora para una comparación precisa.
            else {
                // Creamos un objeto Date completo para la clase
                const classDateTime = parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`);
                // Solo incluimos la clase si su momento de inicio es en el futuro
                return classDateTime >= now;
            }
            
        })
        .filter(cls => selectedClassType === 'all' || cls.tipoClase?._id === selectedClassType)
        .sort((a, b) => {
            const dateComparison = new Date(a.fecha) - new Date(b.fecha);
            if (dateComparison !== 0) return dateComparison;
            return a.horaInicio.localeCompare(b.horaInicio);
        });
}, [allClasses, selectedDate, selectedClassType]);

    const handleEnroll = async (classId) => {
    try {
        await apiClient.post(`/classes/${classId}/enroll`);
        Alert.alert('¡Éxito!', 'Te has inscrito en la clase.');
        
        // 2. LLAMAMOS A LA FUNCIÓN PARA ACTUALIZAR LOS DATOS DEL USUARIO
        await refreshUser();
        
        // Mantenemos la llamada a fetchData para actualizar los cupos
        fetchData();
    } catch (error) {
        Alert.alert('Error', error.response?.data?.message || 'No se pudo procesar la inscripción.');
    }
};
    // Archivo: MOVIL-APP/app/(tabs)/calendar.js

// Función CORREGIDA
const handleUnenroll = (classId) => {
    
    // 1. Creamos una función con la lógica para anular la clase
    const performUnenroll = async () => {
        try {
            console.log('Confirmado por el usuario. Llamando a la API...');
            const response = await apiClient.post(`/classes/${classId}/unenroll`);
            
            // Usamos Alert aquí porque es solo para mostrar un mensaje, no para confirmar. Funciona bien.
            Alert.alert('Anulación Procesada', response.data.message);
            
            await refreshUser();
            fetchData();

        } catch (error) {
            console.error('La llamada a la API para anular falló:', error.response?.data || error);
            Alert.alert('Error', error.response?.data?.message || 'No se pudo anular la inscripción.');
        }
    };

    // 2. Usamos Platform para decidir qué diálogo de confirmación mostrar
    if (Platform.OS === 'web') {
        // SOLUCIÓN PARA WEB: Usamos window.confirm, que es nativo del navegador
        if (window.confirm("¿Estás seguro de que quieres anular tu inscripción?")) {
            performUnenroll(); // Si el usuario hace clic en "Aceptar", ejecutamos la lógica.
        }
    } else {
        // SOLUCIÓN PARA MÓVIL (iOS/Android): Mantenemos el Alert.alert, que aquí sí funciona bien
        Alert.alert(
            "Confirmar Anulación",
            "¿Estás seguro de que quieres anular tu inscripción?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sí, Anular",
                    onPress: performUnenroll, // Ejecutamos la misma lógica
                    style: 'destructive'
                }
            ]
        );
    }
};
    const getClassStyle = (clase) => {
    // Las clases canceladas tienen prioridad
    if (clase.estado === 'cancelada') {
        return styles.cancelledClass;
    }
    // Calculamos el ratio de ocupación
    const fillRatio = clase.capacidad > 0 ? clase.usuariosInscritos.length / clase.capacidad : 0;
    if (fillRatio === 1) {
        return styles.fullClass; // Rojo
    }
    if (fillRatio >= 0.8) {
        return styles.almostFullClass; // Naranja
    }
    if (fillRatio < 0.4) {
        return styles.emptyClass; // Verde
    }
    if (fillRatio < 0.7) {
        return styles.almostEmptyClass; // Amarillo
    }
    return {}; 
};

    
    const handleDayPress = (day) => {
        setSelectedDate(day.dateString); 
        setActiveView('list'); 
    };

    const formattedDateTitle = useMemo(() => {
        if (!selectedDate) {
            return 'Próximas Clases'; // Título por defecto para la lista completa
        }
        try {
            // parseISO convierte el string 'YYYY-MM-DD' a un objeto Date de JavaScript
            const date = parseISO(selectedDate);
            // format le da el estilo "10 de Julio", usando el locale en español
            return capitalize(format(date, "EEEE, d 'de' MMMM", { locale: es }));
        } catch (e) {
            return 'Clases'; // Fallback por si la fecha es inválida
        }
    }, [selectedDate]);

    const sectionedClasses = useMemo(() => {
        if (selectedDate) return []; // No necesitamos secciones si hay una fecha seleccionada

        const grouped = visibleClasses.reduce((acc, clase) => {
            const dateKey = clase.fecha.substring(0, 10);
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(clase);
            return acc;
        }, {});

         return Object.keys(grouped).map(dateKey => ({
            title: capitalize(format(parseISO(dateKey), "EEEE, d 'de' MMMM", { locale: es })),
            data: grouped[dateKey]
        }));
    }, [visibleClasses, selectedDate]);

    
     const renderClassItem = ({ item }) => {
        const isEnrolled = user?.clasesInscritas?.includes(item._id);
        const isCancelled = item.estado === 'cancelada';
        const now = new Date();
        const classDateTime = parseISO(`${item.fecha.substring(0, 10)}T${item.horaFin}:00`);
        const isFinished = classDateTime < now && !isCancelled;
        const dynamicStyle = getClassStyle(item);

        return (
            <ThemedView style={[styles.classItem, dynamicStyle, isFinished && styles.finishedClass]}>
                <ThemedText style={[styles.className, (isCancelled || isFinished) && styles.disabledText]}>
                    {item.nombre} - {item.tipoClase?.nombre || ''}
                </ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Profesor: {item.profesor?.nombre || 'A confirmar'}</ThemedText>
                <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Cupos: {item.usuariosInscritos.length}/{item.capacidad}</ThemedText>
                
                <View style={styles.buttonContainer}>
                    {isCancelled ? <Text style={styles.badgeCancelled}>CANCELADA</Text>
                    : isFinished ? <Text style={styles.badgeFinished}>TERMINADA</Text>
                    : isEnrolled ? <Button title="Anular" color="#e74c3c" onPress={() => handleUnenroll(item._id)} />
                    : <Button title="Inscribirme" color="#2ecc71" onPress={() => handleEnroll(item._id)} disabled={item.usuariosInscritos.length >= item.capacidad} />}
                </View>
            </ThemedView>
        );
    };

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
                <Calendar onDayPress={handleDayPress} markedDates={markedDates} markingType={'custom'} theme={calendarTheme} />
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

                    {isLoading ? <ActivityIndicator size="large" color={Colors[colorScheme].tint} style={{flex: 1}} />
                    : !selectedDate ? (
                        <SectionList
                            sections={sectionedClasses}
                            keyExtractor={(item, index) => item._id + index}
                            renderItem={renderClassItem}
                            renderSectionHeader={({ section: { title } }) => (
                                <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
                            )}
                            ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay próximas clases.</ThemedText>}
                        />
                    ) : (
                        <FlatList
                            data={visibleClasses}
                            keyExtractor={item => item._id}
                            renderItem={renderClassItem}
                            ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay clases para este día.</ThemedText>}
                        />
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
        justifyContent: 'center', // Centra el Picker verticalmente en Android
    },
    listHeader: { textAlign: 'center', fontSize: 22, fontWeight: 'bold', padding: 15 },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: Colors[colorScheme].background, opacity: 0.9, color: Colors[colorScheme].text },
    classItem: {
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors[colorScheme].icon,
    },
    className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
    classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4 },
    buttonContainer: { marginTop: 12, alignSelf: 'flex-start' },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, opacity: 0.7 },
    
    // Estilos de estado de clase que respetan el modo oscuro
    cancelledClass: { backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5', borderColor: colorScheme === 'dark' ? '#555' : '#e0e0e0', borderLeftWidth: 0, borderWidth: 1 },
    finishedClass: { opacity: 0.6 },
    disabledText: { color: Colors[colorScheme].icon },
    badgeCancelled: { color: Colors[colorScheme].icon, fontStyle: 'italic', fontWeight: 'bold' },
    badgeFinished: { color: Colors[colorScheme].icon, fontStyle: 'italic', fontWeight: 'bold' },

    // --- ESTILOS DE OCUPACIÓN ADAPTADOS PARA DARK MODE ---
    emptyClass: { borderLeftWidth: 15, borderColor: '#4CAF50', backgroundColor: colorScheme === 'dark' ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9' },
    almostEmptyClass: { borderLeftWidth: 15, borderColor: '#FFC107', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 193, 7, 0.2)' : '#fffde7' },
    almostFullClass: { borderLeftWidth: 15, borderColor: '#ff7707', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 119, 7, 0.2)' : '#fff3e0' },
    fullClass: { borderLeftWidth: 15, borderColor: '#F44336', backgroundColor: colorScheme === 'dark' ? 'rgba(244, 67, 54, 0.2)' : '#ffebee' },
});

export default CalendarScreen;
