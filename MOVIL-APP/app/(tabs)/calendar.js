// app/(tabs)/calendar.js
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, FlatList, SectionList, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
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

const CalendarScreen = () => {
    // --- ESTADOS ---
    const [activeView, setActiveView] = useState('calendar'); // 'calendar' o 'list'
    const [allClasses, setAllClasses] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null); // null para indicar que no hay selección
    const [markedDates, setMarkedDates] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { user, login } = useAuth();
    
    // Estados para el filtro
    const [classTypes, setClassTypes] = useState([]);
    const [selectedClassType, setSelectedClassType] = useState('all');

    // --- LÓGICA DE DATOS ---
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [classesResponse, typesResponse] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/tipos-clase')
            ]);
            const fetchedClasses = classesResponse.data;
            setAllClasses(fetchedClasses);
            setClassTypes(typesResponse.data.tiposClase || []);

            const markers = {};
            fetchedClasses.forEach(cls => {
                if (cls.estado !== 'cancelada') { // En tu modelo el estado es 'cancelada'
                    const dateString = cls.fecha.substring(0, 10);
                    markers[dateString] = { marked: true, dotColor: '#6f5c94' };
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
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Para comparar solo la fecha

        return allClasses
            // Si hay una fecha seleccionada, filtra por esa fecha. Si no, muestra todas las futuras.
            .filter(cls => selectedDate ? cls.fecha.substring(0, 10) === selectedDate : new Date(cls.fecha) >= today)
            .filter(cls => selectedClassType === 'all' || cls.tipoClase?._id === selectedClassType)
            .sort((a, b) => {
                // Ordenar primero por fecha, y luego por hora
                const dateComparison = new Date(a.fecha) - new Date(b.fecha);
                if (dateComparison !== 0) return dateComparison;
                return a.horaInicio.localeCompare(b.horaInicio);
            });
    }, [allClasses, selectedDate, selectedClassType]);

    // --- HANDLERS (Iguales que antes) ---
    const handleEnroll = async (classId) => {
    try {
        await apiClient.post(`/classes/${classId}/enroll`);
        Alert.alert('¡Éxito!', 'Te has inscrito en la clase.');
        // Refrescamos los datos para que la UI se actualice
        fetchData(); 
    } catch (error) {
        // Mostramos el mensaje de error que viene del backend
        Alert.alert('Error', error.response?.data?.message || 'No se pudo procesar la inscripción.');
    }
};
    const handleUnenroll = async (classId) => {
    Alert.alert(
        "Confirmar Anulación",
        "¿Estás seguro de que quieres anular tu inscripción?",
        [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Sí, Anular",
                onPress: async () => {
                    try {
                        const response = await apiClient.post(`/classes/${classId}/unenroll`);
                        // El backend nos dirá si el crédito fue reembolsado o no
                        Alert.alert('Anulación Procesada', response.data.message);
                        // Refrescamos los datos
                        fetchData();
                    } catch (error) {
                        Alert.alert('Error', error.response?.data?.message || 'No se pudo anular la inscripción.');
                    }
                },
                style: 'destructive'
            }
        ]
    );
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
        const dynamicStyle = getClassStyle(item);
        return (
            <View style={[styles.classItem, dynamicStyle]}>
                <Text style={[styles.className, isCancelled && styles.cancelledText]}>
                    {item.nombre} - {item.tipoClase?.nombre || ''}
                </Text>
                <Text style={isCancelled && styles.cancelledText}>Horario: {item.horaInicio} - {item.horaFin}</Text>
                {item.profesor ? (
                    <Text style={isCancelled && styles.cancelledText}>Profesor: {item.profesor.nombre} {item.profesor.apellido}</Text>
                ) : (
                    <Text style={isCancelled && styles.cancelledText}>Profesor: A confirmar</Text>
                )}
                <Text style={isCancelled && styles.cancelledText}>Cupos: {item.usuariosInscritos.length}/{item.capacidad}</Text>
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
                <Calendar onDayPress={handleDayPress} markedDates={markedDates} />
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
    container: { flex: 1, backgroundColor: '#f8f9fa' },
   tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 10,
        paddingTop: 20,
    },
    tab: {
        paddingBottom: 10,
        paddingHorizontal: 10
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#6f5c94'
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#495057'
    },
    pickerContainer: {
        marginHorizontal: 10, borderRadius: 8,
    },
    listHeader: {
        textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#343a40', paddingHorizontal: 15, paddingTop: 15, paddingBottom: 5,
    },
    sectionHeader: {
        fontSize: 20, fontWeight: 'bold', color: '#495057', paddingVertical: 10, paddingHorizontal: 15, marginTop: 10,
    },
    classItem: {
        padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee', marginHorizontal: 10, marginVertical: 5, borderRadius: 8,
    },
    className: {
        fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#333',
    },
    buttonContainer: {
        marginTop: 10,
    },
    emptyText: {
        textAlign: 'center', marginTop: 30, fontSize: 16, color: '#888'
    },
    cancelledClass: { backgroundColor: '#f5f5f5' },
    cancelledText: { textDecorationLine: 'line-through', color: '#b0bec5' },
    badge: {
        backgroundColor: '#cfd8dc', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 15, alignSelf: 'flex-start',
    },
    badgeText: {
        color: '#546e7a', fontWeight: 'bold',
    },
    emptyClass: { backgroundColor: '#e8f5e9' },
    almostEmptyClass: { backgroundColor: '#fffde7' },
    almostFullClass: { backgroundColor: '#fff3e0' },
    fullClass: { backgroundColor: '#ffebee' },
});

export default CalendarScreen;