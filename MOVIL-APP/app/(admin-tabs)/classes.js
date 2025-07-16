import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    FlatList,
    useColorScheme,
    Button,
    Modal,
    TextInput
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Picker } from '@react-native-picker/picker';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['Dom.','Lun.','Mar.','Mié.','Jue.','Vie.','Sáb.'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

const ManageClassesScreen = () => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [activeTab, setActiveTab] = useState('calendar');
    const [loading, setLoading] = useState(true);

    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [groupedClasses, setGroupedClasses] = useState([]);
    
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // --- Estados para Modales ---
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [showRosterModal, setShowRosterModal] = useState(false);
    const [viewingClassRoster, setViewingClassRoster] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [classToCancel, setClassToCancel] = useState(null);

    const [formData, setFormData] = useState({
        tipoClase: '', 
        nombre: '',
        fecha: '',
        horaInicio: '', 
        horaFin: '', 
        capacidad: '10',
        profesor: '', 
        tipoInscripcion: 'libre',
        diaDeSemana: [], 
        fechaInicio: '', 
        fechaFin: '', 
    });
    
    const daysOfWeekOptions = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [classesRes, groupedRes, teachersRes, typesRes] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/classes/grouped'),
                apiClient.get('/users?role=profesor'),
                apiClient.get('/tipos-clase')
            ]);
            setClasses(classesRes.data || []);
            setGroupedClasses(groupedRes.data || []);
            setTeachers(teachersRes.data || []);
            setClassTypes(typesRes.data.tiposClase || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los datos de gestión de clases.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(fetchAllData);

    const handleFormSubmit = async () => {
        if (editingClass) {
            // Lógica de Actualización
            try {
                await apiClient.put(`/classes/${editingClass._id}`, formData);
                Alert.alert('Éxito', 'Clase actualizada correctamente.');
            } catch (error) {
                Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar la clase.');
            }
        } else {
            // Lógica de Creación
            try {
                await apiClient.post('/classes', formData);
                Alert.alert('Éxito', 'Clase creada correctamente.');
            } catch (error) {
                Alert.alert('Error', error.response?.data?.message || 'No se pudo crear la clase.');
            }
        }
        setShowAddModal(false);
        setEditingClass(null);
        fetchAllData();
    };

    const handleEdit = (classItem) => {
        setEditingClass(classItem);
        setFormData({
            tipoClase: classItem.tipoClase?._id || '',
            nombre: classItem.nombre,
            fecha: classItem.fecha ? format(parseISO(classItem.fecha), 'yyyy-MM-dd') : '',
            horaInicio: classItem.horaInicio,
            horaFin: classItem.horaFin,
            capacidad: classItem.capacidad.toString(),
            profesor: classItem.profesor?._id || '',
            tipoInscripcion: classItem.tipoInscripcion,
            diaDeSemana: classItem.diaDeSemana || [],
            // No se pre-llenan las fechas de recurrencia para edición simple
            fechaInicio: '',
            fechaFin: '',
        });
        setShowAddModal(true);
    };

    const handleViewRoster = async (classId) => {
        try {
            const response = await apiClient.get(`/classes/${classId}`);
            setViewingClassRoster(response.data);
            setShowRosterModal(true);
        } catch (error) {
            Alert.alert('Error', 'No se pudo obtener la lista de inscriptos.');
        }
    };

    const handleCancelClass = (classItem) => {
        setClassToCancel(classItem);
        setShowCancelModal(true);
    };

    const confirmCancelClass = async (refundCredits) => {
        if (!classToCancel) return;
        try {
            await apiClient.put(`/classes/${classToCancel._id}/cancel`, { refundCredits });
            Alert.alert('Éxito', 'La clase ha sido cancelada.');
            setShowCancelModal(false);
            setClassToCancel(null);
            fetchAllData();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo cancelar la clase.');
        }
    };

    const markedDates = useMemo(() => {
        const markers = {};
        classes.forEach(cls => {
            const dateString = format(parseISO(cls.fecha), 'yyyy-MM-dd');
            if (!markers[dateString]) {
                markers[dateString] = { marked: true, dotColor: gymColor };
            }
        });
        if (selectedDate) {
            markers[selectedDate] = { ...markers[selectedDate], selected: true, selectedColor: gymColor };
        }
        return markers;
    }, [classes, selectedDate, gymColor]);

    const classesForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        return classes.filter(cls => format(parseISO(cls.fecha), 'yyyy-MM-dd') === selectedDate);
    }, [classes, selectedDate]);
    
    const renderClassItem = ({ item }) => (
        <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>{item.nombre}</ThemedText>
            <ThemedText style={styles.cardSubtitle}>{item.tipoClase?.nombre}</ThemedText>
            <ThemedText style={styles.cardInfo}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
            <ThemedText style={styles.cardInfo}>Profesor: {item.profesor ? `${item.profesor.nombre} ${item.profesor.apellido}` : 'No asignado'}</ThemedText>
            <ThemedText style={styles.cardInfo}>Cupos: {item.usuariosInscritos.length} / {item.capacidad}</ThemedText>
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleViewRoster(item._id)}>
                    <Ionicons name="people" size={20} color={gymColor} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelClass(item)}>
                    <Ionicons name="close-circle" size={22} color={Colors.light.error} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
                    <Ionicons name="pencil" size={20} color={gymColor} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderContent = () => {
        if (loading) {
            return <ActivityIndicator size="large" color={gymColor} style={{ marginTop: 50 }} />;
        }

        switch (activeTab) {
            case 'calendar':
                return (
                    <FlatList
                        ListHeaderComponent={
                            <Calendar
                                onDayPress={(day) => setSelectedDate(day.dateString)}
                                markedDates={markedDates}
                                theme={{
                                    calendarBackground: Colors[colorScheme].background,
                                    textSectionTitleColor: Colors[colorScheme].text,
                                    selectedDayBackgroundColor: gymColor,
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: gymColor,
                                    dayTextColor: Colors[colorScheme].text,
                                    textDisabledColor: Colors[colorScheme].icon,
                                    arrowColor: gymColor,
                                }}
                            />
                        }
                        data={classesForSelectedDate}
                        renderItem={renderClassItem}
                        keyExtractor={(item) => item._id}
                        ListEmptyComponent={<ThemedText style={styles.placeholderText}>No hay clases para este día.</ThemedText>}
                    />
                );
            case 'bulk':
                 return <ThemedText style={styles.placeholderText}>Gestión de Clases Fijas en desarrollo.</ThemedText>;
            case 'day-management':
                return <ThemedText style={styles.placeholderText}>Gestión por día en desarrollo.</ThemedText>;
            default:
                return null;
        }
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('calendar')} style={[styles.tab, activeTab === 'calendar' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'calendar' && styles.activeTabText]}>Calendario</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('bulk')} style={[styles.tab, activeTab === 'bulk' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'bulk' && styles.activeTabText]}>Clases Fijas</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('day-management')} style={[styles.tab, activeTab === 'day-management' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'day-management' && styles.activeTabText]}>Por Día</Text>
                </TouchableOpacity>
            </View>
            {renderContent()}
            <TouchableOpacity style={styles.fab} onPress={() => { setEditingClass(null); setShowAddModal(true); }}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* Modal para Añadir/Editar Clase */}
            <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
                <ThemedView style={styles.modalContainer}>
                    <ScrollView contentContainerStyle={styles.modalContent}>
                         <ThemedText style={styles.modalTitle}>{editingClass ? 'Editar Clase' : 'Crear Nueva Clase'}</ThemedText>
                        
                        <ThemedText style={styles.inputLabel}>Nombre de la Clase</ThemedText>
                        <TextInput style={styles.input} value={formData.nombre} onChangeText={text => setFormData(p => ({...p, nombre: text}))} />
                        
                        <ThemedText style={styles.inputLabel}>Tipo de Clase</ThemedText>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.tipoClase} onValueChange={itemValue => setFormData(p => ({...p, tipoClase: itemValue}))}>
                                <Picker.Item label="-- Seleccionar --" value="" />
                                {classTypes.map(type => <Picker.Item key={type._id} label={type.nombre} value={type._id} />)}
                            </Picker>
                        </View>
                        
                        <ThemedText style={styles.inputLabel}>Profesor (Opcional)</ThemedText>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.profesor} onValueChange={itemValue => setFormData(p => ({...p, profesor: itemValue}))}>
                                <Picker.Item label="-- Seleccionar --" value="" />
                                {teachers.map(t => <Picker.Item key={t._id} label={`${t.nombre} ${t.apellido}`} value={t._id} />)}
                            </Picker>
                        </View>

                        <ThemedText style={styles.inputLabel}>Capacidad</ThemedText>
                        <TextInput style={styles.input} keyboardType="numeric" value={formData.capacidad} onChangeText={text => setFormData(p => ({...p, capacidad: text}))} />

                        <ThemedText style={styles.inputLabel}>Hora de Inicio</ThemedText>
                        <TextInput style={styles.input} placeholder="HH:MM" value={formData.horaInicio} onChangeText={text => setFormData(p => ({...p, horaInicio: text}))} />
                        
                        <ThemedText style={styles.inputLabel}>Hora de Fin</ThemedText>
                        <TextInput style={styles.input} placeholder="HH:MM" value={formData.horaFin} onChangeText={text => setFormData(p => ({...p, horaFin: text}))} />

                        <ThemedText style={styles.inputLabel}>Fecha (si es clase única)</ThemedText>
                        <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={formData.fecha} onChangeText={text => setFormData(p => ({...p, fecha: text}))} />

                        <View style={styles.modalActions}>
                            <Button title="Cancelar" onPress={() => setShowAddModal(false)} color="#888" />
                            <Button title="Guardar" onPress={handleFormSubmit} color={gymColor} />
                        </View>
                    </ScrollView>
                </ThemedView>
            </Modal>

            {/* Modal para Ver Inscriptos */}
            <Modal visible={showRosterModal} animationType="slide" onRequestClose={() => setShowRosterModal(false)}>
                <ThemedView style={styles.modalContainer}>
                     <ThemedText style={styles.modalTitle}>Inscriptos en {viewingClassRoster?.nombre}</ThemedText>
                     <FlatList
                        data={viewingClassRoster?.usuariosInscritos || []}
                        keyExtractor={item => item._id}
                        renderItem={({item}) => (
                            <View style={styles.rosterItem}>
                                <Text style={styles.rosterText}>{item.nombre} {item.apellido}</Text>
                                <Text style={styles.rosterSubtext}>DNI: {item.dni}</Text>
                            </View>
                        )}
                        ListEmptyComponent={<Text style={styles.placeholderText}>No hay nadie inscripto.</Text>}
                     />
                     <Button title="Cerrar" onPress={() => setShowRosterModal(false)} color={gymColor} />
                </ThemedView>
            </Modal>

             {/* Modal para Cancelar Clase */}
            <Modal visible={showCancelModal} transparent={true} animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
                <View style={styles.centeredView}>
                    <View style={styles.confirmationModal}>
                        <ThemedText style={styles.modalTitle}>Confirmar Cancelación</ThemedText>
                        <ThemedText>¿Deseas devolver los créditos a los usuarios inscritos?</ThemedText>
                        <View style={styles.modalActions}>
                            <Button title="Sí, con reembolso" onPress={() => confirmCancelClass(true)} color={gymColor}/>
                            <Button title="No, sin reembolso" onPress={() => confirmCancelClass(false)} color={Colors.light.error}/>
                        </View>
                         <Button title="Volver" onPress={() => setShowCancelModal(false)} color="#888" />
                    </View>
                </View>
            </Modal>

        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: Colors[colorScheme].cardBackground,
        elevation: 4,
    },
    tab: {
        paddingVertical: 15,
        paddingHorizontal: 10,
        alignItems: 'center',
        flex: 1,
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: gymColor,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors[colorScheme].icon,
    },
    activeTabText: {
        color: gymColor,
    },
    placeholderText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        opacity: 0.7,
    },
    listHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        padding: 15,
        textAlign: 'center',
        backgroundColor: Colors[colorScheme].background,
    },
    card: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 10,
        padding: 15,
        marginVertical: 8,
        marginHorizontal: 15,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
    },
    cardSubtitle: {
        fontSize: 16,
        color: gymColor,
        marginBottom: 10,
    },
    cardInfo: {
        fontSize: 14,
        color: Colors[colorScheme].text,
        opacity: 0.8,
        marginBottom: 4,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: Colors[colorScheme].border,
        paddingTop: 10,
    },
    actionButton: {
        marginLeft: 20,
        padding: 5,
    },
    fab: {
        position: 'absolute',
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        right: 30,
        bottom: 30,
        backgroundColor: gymColor || Colors.light.tint,
        borderRadius: 30,
        elevation: 8,
    },
    modalContainer: {
        flex: 1,
        paddingTop: 40,
    },
    modalContent: {
        padding: 20,
        paddingBottom: 50,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center'
    },
    inputLabel: {
        fontSize: 16,
        marginBottom: 8,
        color: Colors[colorScheme].text,
        opacity: 0.8,
    },
    input: {
        height: 50,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        color: Colors[colorScheme].text,
    },
    pickerContainer: {
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 30,
    },
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    confirmationModal: {
        margin: 20,
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 20,
        padding: 35,
        alignItems: "center",
        elevation: 5
    },
    rosterItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
    },
    rosterText: {
        fontSize: 16,
        color: Colors[colorScheme].text,
    },
    rosterSubtext: {
        fontSize: 12,
        color: Colors[colorScheme].icon,
    }
});

export default ManageClassesScreen;
