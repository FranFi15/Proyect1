// app/(tabs)/calendar.js
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, FlatList, SectionList, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],
  monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
  today: "Hoy"
};
LocaleConfig.defaultLocale = 'es';

const capitalize = (str) => {
  if (typeof str !== 'string' || str.length === 0) return '';
  const formattedStr = str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return formattedStr.replace(' De ', ' de '); // Para que 'de' quede en minúscula
};

const calendarTheme = {
    calendarBackground: '#f7f7f7',
    textSectionTitleColor: '#9e9e9e', // Un gris más suave para los días de la semana (L, M, etc)
    selectedDayBackgroundColor: '#6f5c94',
    selectedDayTextColor: '#ffffff',
    
    // Hacemos el color de "hoy" un azul más vibrante
    todayTextColor: '#007AFF',
    
    // Hacemos los números de los días un poco más pequeños para que "respiren"
    dayTextColor: '#2d4150',
    textDayFontWeight: '400', // Un grosor normal se ve más limpio
    textDayFontSize: 16,

    // Días deshabilitados (de otros meses)
    textDisabledColor: '#d9e1e8',
    
    // Puntos y Flechas
    dotColor: '#6f5c94',
    selectedDotColor: '#ffffff',
    arrowColor: '#6f5c94',
    disabledArrowColor: '#e0e0e0',

    // Título del Mes
    monthTextColor: '#333333',
    textMonthFontWeight: 'bold',
    textMonthfontWeight: 600,
    textMonthFontSize: 25, // Un tamaño más balanceado para el título del mes

    // Nombres de los días de la semana (L, M, M, J, V, S, D)
    textDayHeaderFontWeight: '500',
    textDayHeaderFontSize: 14,
};

const CalendarScreen = () => {
    // --- ESTADOS ---
    const [activeView, setActiveView] = useState('calendar'); // 'calendar' o 'list'
    const [allClasses, setAllClasses] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null); // null para indicar que no hay selección
    const [markedDates, setMarkedDates] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { user, login, refreshUser } = useAuth();

    
    // Estados para el filtro
    const [classTypes, setClassTypes] = useState([]);
    const [selectedClassType, setSelectedClassType] = useState('all');

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [classesResponse, typesResponse, userResponse] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/tipos-clase'),
                apiClient.get('/users/me') // Obtenemos al usuario para saber sus clases
            ]);

            const fetchedClasses = classesResponse.data;
            const userEnrolledClassIds = new Set(userResponse.data.clasesInscritas || []);

            setAllClasses(fetchedClasses);
            setClassTypes(typesResponse.data.tiposClase || []);

            const markers = {};
            fetchedClasses.forEach(cls => {
                if (cls.estado !== 'cancelada') {
                    const dateString = cls.fecha.substring(0, 10);
                    // Si la fecha no ha sido marcada aún, la inicializamos
                    if (!markers[dateString]) {
                        markers[dateString] = {
                            customStyles: {
                                container: {
                                    backgroundColor: '#e9ecef',
                                    borderRadius: 10,
                                }
                            }
                        };
                    }
                    
                    // Si el usuario está inscrito en esta clase, añadimos el punto morado
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
        
        // 1. Lógica para determinar si la clase ya terminó
        const now = new Date();
        const classDateTime = parseISO(`${item.fecha.substring(0, 10)}T${item.horaFin}:00`); // Usamos horaFin para la comparación
        const isFinished = classDateTime < now && !isCancelled;

        const dynamicStyle = getClassStyle(item);

        return (
            // 2. Aplicamos el estilo de clase terminada si corresponde
            <View style={[styles.classItem, dynamicStyle, isFinished && styles.finishedClass]}>
                <Text style={[styles.className, (isCancelled || isFinished) && styles.disabledText]}>
                    {item.nombre} - {item.tipoClase?.nombre || ''}
                </Text>
                <Text style={(isCancelled || isFinished) && styles.disabledText}>Horario: {item.horaInicio} - {item.horaFin}</Text>
                <Text style={(isCancelled || isFinished) && styles.disabledText}>Profesor: {item.profesor?.nombre || 'A confirmar'}</Text>
                <Text style={(isCancelled || isFinished) && styles.disabledText}>Cupos: {item.usuariosInscritos.length}/{item.capacidad}</Text>
                
                <View style={styles.buttonContainer}>
                    {/* 3. Lógica de renderizado condicional para el badge/botón */}
                    {isCancelled ? (
                        <View style={styles.badgeCancelled}><Text style={styles.badgeText}>CANCELADA</Text></View>
                    ) : isFinished ? (
                        <View style={styles.badgeFinished}><Text style={styles.badgeText}>TERMINADA</Text></View>
                    ) : isEnrolled ? (
                        <Button title="Anular Inscripción" color="#e74c3c" onPress={() => handleUnenroll(item._id)} />
                    ) : (
                        <Button title="Inscribirme" color="#2ecc71" onPress={() => handleEnroll(item._id)} disabled={item.usuariosInscritos.length >= item.capacidad} />
                    )}
                </View>
            </View>
        );
    };

    // --- RENDERIZADO PRINCIPAL DEL COMPONENTE ---
    return (
        <View style={styles.container}>
            {/* --- SELECTOR DE VISTA (ESTILO ACTUALIZADO) --- */}
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => { setActiveView('calendar'); setSelectedDate(null); }} style={[styles.tab, activeView === 'calendar' && styles.activeTab]}>
                    <Text style={styles.tabText}>Calendario</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveView('list')} style={[styles.tab, activeView === 'list' && styles.activeTab]}>
                    <Text style={styles.tabText}>Clases</Text>
                </TouchableOpacity>
            </View>

            {activeView === 'calendar' && (
                <Calendar onDayPress={handleDayPress} markedDates={markedDates} markingType={'custom'} theme={calendarTheme}  />
            )}

            {activeView === 'list' && (
                <>
                    {/* El título cambia según si hay una fecha seleccionada o no */}
                    <Text style={styles.listHeader}>{formattedDateTitle}</Text>
                    
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={selectedClassType} onValueChange={itemValue => setSelectedClassType(itemValue)}>
                            <Picker.Item label="Todas las Clases" value="all" />
                            {classTypes.map(type => (
                                <Picker.Item key={type._id} label={type.nombre} value={type._id} />
                            ))}
                        </Picker>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#6f5c94" style={{flex: 1}} />
                    ) : (
                        // Si no hay fecha seleccionada, usa SectionList. Si la hay, usa FlatList.
                        !selectedDate ? (
                            <SectionList
                                sections={sectionedClasses}
                                keyExtractor={(item, index) => item._id + index}
                                renderItem={renderClassItem}
                                renderSectionHeader={({ section: { title } }) => (
                                    <Text style={styles.sectionHeader}>{title}</Text>
                                )}
                                ListEmptyComponent={<Text style={styles.emptyText}>No hay próximas clases que coincidan.</Text>}
                            />
                        ) : (
                            <FlatList
                                data={visibleClasses}
                                keyExtractor={item => item._id}
                                renderItem={renderClassItem}
                                ListEmptyComponent={<Text style={styles.emptyText}>No hay clases para este día.</Text>}
                            />
                        )
                    )}
                </>
            )}
        </View>
    );
};

// --- ESTILOS ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor:'#f7f7f7' },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 10,
        paddingTop: 20,
        backgroundColor:'#150224',

    },
    tab: { paddingBottom: 10, paddingHorizontal: 10 , },
    activeTab: { borderBottomWidth: 3, borderBottomColor: '#9282b3' },
    tabText: { fontSize: 16, fontWeight: '600', color:'#ffffff' },
    pickerContainer: { marginHorizontal: 15, marginVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ced4da', },
    listHeader: { textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#343a40', padding: 15 },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#495057', paddingVertical: 10, paddingHorizontal: 15, },
    
    // --- ESTILO DE TARJETA PARA CADA CLASE ---
    classItem: {
        backgroundColor: '#ffffff',
        padding: 20,
        marginHorizontal: 8,
        marginVertical: 8,
        borderRadius: 1,
        borderWidth: 1,
        borderColor: '#e9ecef',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
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
    emptyText: {
        textAlign: 'center', marginTop: 30, fontSize: 16, color: '#888'
    },
    cancelledClass: { backgroundColor: '#f5f5f5' },
    cancelledText: { textDecorationLine: 'line-through', color: '#b0bec5' },
    badge: {
        backgroundColor: '#cfd8dc', paddingVertical: 5, paddingHorizontal: 10,  alignSelf: 'flex-start',
    },
    badgeText: {
        color: '#546e7a', fontWeight: 'bold',
    },
    emptyClass: { borderWidth:0, borderLeftWidth:15, borderColor: '#4CAF50',backgroundColor: '#e8f5e9' },
    almostEmptyClass: {borderWidth:0, borderLeftWidth:15, borderColor: '#FFC107', backgroundColor: '#fffde7' },
    almostFullClass: {borderWidth:0, borderLeftWidth:15, borderColor: '#ff7707', backgroundColor: '#fff3e0' },
    fullClass: {borderWidth:0, borderLeftWidth:15, borderColor: '#F44336', backgroundColor: '#ffebee' },
});

export default CalendarScreen;