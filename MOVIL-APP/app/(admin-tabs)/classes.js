import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    useColorScheme,
    Button,
    Modal,
    TextInput,
    Platform,
    RefreshControl
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome6, Octicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO, isBefore, startOfDay, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomAlert from '@/components/CustomAlert';

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
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // --- Estados para Filtros ---
    const [selectedClassTypeFilter, setSelectedClassTypeFilter] = useState('all');
    const [selectedProfessorFilter, setSelectedProfessorFilter] = useState('all');
    const [selectedRecurrentClassTypeFilter, setSelectedRecurrentClassTypeFilter] = useState('all');

    // --- Estado para Notificaciones de Extensión ---
    const [notifiedGroups, setNotifiedGroups] = useState(new Set());


    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });
    
    // --- Estados para Modales ---
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [showRosterModal, setShowRosterModal] = useState(false);
    const [viewingClassRoster, setViewingClassRoster] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [classToCancel, setClassToCancel] = useState(null);
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [bulkUpdates, setBulkUpdates] = useState({ profesor: '', horaInicio: '', horaFin: '', diasDeSemana: [] });
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendingGroup, setExtendingGroup] = useState(null);
    const [extendUntilDate, setExtendUntilDate] = useState('');
    const [dayToManage, setDayToManage] = useState(new Date());
    const [showDayPicker, setShowDayPicker] = useState(false);


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
    
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateFieldToEdit, setDateFieldToEdit] = useState(null);
    
    const daysOfWeekOptions = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const fetchAllData = useCallback(async () => {
        try {
            const [classesRes, teachersRes, typesRes] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/users?role=profesor'),
                apiClient.get('/tipos-clase')
            ]);
            setClasses(classesRes?.data || []);
            setTeachers(teachersRes?.data || []);
            setClassTypes(typesRes?.data?.tiposClase || []);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos de gestión de turnos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            const loadInitialData = async () => {
                setLoading(true);
                await fetchAllData();
                setLoading(false);
            };
            loadInitialData();
        }, [fetchAllData])
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchAllData();
        setIsRefreshing(false);
    }, [fetchAllData]);

    const handleFormChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTimeInputChange = (text, name, setStateFunction) => {
        const cleanedText = text.replace(/[^0-9]/g, '');
        let formattedText = cleanedText;
        if (cleanedText.length > 2) {
            formattedText = `${cleanedText.slice(0, 2)}:${cleanedText.slice(2, 4)}`;
        }
        setStateFunction(prev => ({ ...prev, [name]: formattedText }));
    };

    const handleDaySelection = (day) => {
        const currentDays = formData.diaDeSemana;
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        handleFormChange('diaDeSemana', newDays);
    };
    
    const handleBulkDaySelection = (day) => {
        const currentDays = bulkUpdates.diasDeSemana;
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        setBulkUpdates(p => ({ ...p, diasDeSemana: newDays }));
    };

    const handleFormSubmit = async () => {
        setAlertInfo({
            visible: true,
            title: 'Confirmar Guardado',
            message: '¿Estás seguro de que quieres guardar los cambios en este turno?',
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo({ visible: false }) },
                { text: 'Guardar', style: 'primary', onPress: async () => {
                    setAlertInfo({ visible: false });
                    const payload = { ...formData };
                    if (!payload.profesor) delete payload.profesor;
                    
                    try {
                        if (editingClass) {
                            await apiClient.put(`/classes/${editingClass._id}`, payload);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'Turno actualizado correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        } else {
                            await apiClient.post('/classes', payload);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'Turno/s creado/s correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                        setShowAddModal(false);
                        setEditingClass(null);
                        fetchAllData();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo guardar el turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
            ]
        });
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
            fechaInicio: '',
            fechaFin: '',
        });
        setShowAddModal(true);
    };

   const handleViewRoster = async (classId) => {
        try {
            const response = await apiClient.get(`/classes/${classId}`);
            const classData = response.data;

            if (classData && classData.usuariosInscritos) {
                classData.usuariosInscritos = classData.usuariosInscritos.filter(user => user !== null);
            }

            setViewingClassRoster(classData);
            setShowRosterModal(true);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo obtener la lista de inscriptos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
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
            setAlertInfo({ visible: true, title: 'Éxito', message: 'El turno ha sido cancelado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            setShowCancelModal(false);
            setClassToCancel(null);
            fetchAllData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo cancelar el turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const handleReactivateClass = (classItem) => {
        setAlertInfo({
            visible: true,
            title: "Reactivar Clase",
            message: `¿Estás seguro de que quieres reactivar el turno "${classItem.nombre}"?`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Sí, Reactivar", style: 'primary', onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        await apiClient.put(`/classes/${classItem._id}/reactivate`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'El turno ha sido reactivado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        fetchAllData();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo reactivar el turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
            ]
        });
    };

    const showDatePickerForField = (field) => {
        setDateFieldToEdit(field);
        setShowDatePicker(true);
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || new Date();
        setShowDatePicker(Platform.OS === 'ios');
        const formattedDate = format(currentDate, 'yyyy-MM-dd');

        if (dateFieldToEdit === 'extendUntilDate') {
            setExtendUntilDate(formattedDate);
        } else if (dateFieldToEdit) {
            handleFormChange(dateFieldToEdit, formattedDate);
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
        return classes
            .filter(cls => format(parseISO(cls.fecha), 'yyyy-MM-dd') === selectedDate)
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }, [classes, selectedDate]);

    const filteredClassesForSelectedDate = useMemo(() => {
        return classesForSelectedDate
            .filter(cls => selectedClassTypeFilter === 'all' || cls.tipoClase?._id === selectedClassTypeFilter)
            .filter(cls => selectedProfessorFilter === 'all' || cls.profesor?._id === selectedProfessorFilter);
    }, [classesForSelectedDate, selectedClassTypeFilter, selectedProfessorFilter]);

    const correctlyGroupedClasses = useMemo(() => {
        const today = startOfDay(new Date());

        const futureClasses = classes.filter(cls => {
            const classDate = parseISO(cls.fecha);
            return !isBefore(classDate, today);
        });

        const recurrentClasses = futureClasses.filter(cls => cls.tipoInscripcion === 'fijo');

        const groups = recurrentClasses.reduce((acc, cls) => {
            const groupKey = `${cls.nombre}-${cls.tipoClase?._id}-${cls.horaInicio}-${cls.horaFin}`;

            if (!acc[groupKey]) {
                acc[groupKey] = {
                    nombre: cls.nombre,
                    tipoClase: cls.tipoClase,
                    horaInicio: cls.horaInicio,
                    horaFin: cls.horaFin,
                    profesor: cls.profesor,
                    diasDeSemana: new Set(),
                    cantidadDeInstancias: 0,
                    _id: groupKey, 
                    lastDate: cls.fecha,
                };
            }
            if (cls.diaDeSemana) {
                acc[groupKey].diasDeSemana.add(cls.diaDeSemana);
            }
            acc[groupKey].cantidadDeInstancias += 1;
            if (isBefore(new Date(acc[groupKey].lastDate), new Date(cls.fecha))) {
                acc[groupKey].lastDate = cls.fecha;
            }
            return acc;
        }, {});

        return Object.values(groups).map(group => ({
            ...group,
            diasDeSemana: Array.from(group.diasDeSemana).sort(),
        }));
    }, [classes]);

    useEffect(() => {
        if (loading) return;

        const expiringGroup = correctlyGroupedClasses.find(
            group => group.cantidadDeInstancias === 1 && !notifiedGroups.has(group._id)
        );

        if (expiringGroup) {
            handleExtendNotification(expiringGroup);
            setNotifiedGroups(prev => new Set(prev).add(expiringGroup._id));
        }
    }, [correctlyGroupedClasses, loading, notifiedGroups]);

    const handleExtendNotification = (group) => {
        const message = `Se están terminando las clases de "${group.nombre} - ${group.tipoClase.nombre}" de los días ${group.diasDeSemana.join(', ')}. ¿Quieres extenderlos un mes más?`;
        
        setAlertInfo({
            visible: true,
            title: "Extender Clases Recurrentes",
            message: message,
            buttons: [
                { text: "No, gracias", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Sí, extender", style: "primary", onPress: async () => {
                    setAlertInfo({ visible: false });
                    const newEndDate = addMonths(new Date(group.lastDate), 1);
                    const formattedEndDate = format(newEndDate, 'yyyy-MM-dd');
                    await handleExtendSubmit(group, formattedEndDate);
                }}
            ]
        });
    };

    const filteredGroupedClasses = useMemo(() => {
        return correctlyGroupedClasses
            .filter(group => selectedRecurrentClassTypeFilter === 'all' || group.tipoClase?._id === selectedRecurrentClassTypeFilter)
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }, [correctlyGroupedClasses, selectedRecurrentClassTypeFilter]);
    
    const renderClassItem = ({ item }) => (
        <View style={[styles.card, item.estado === 'cancelada' && styles.cancelledCard]}>
            <ThemedText style={styles.cardTitle}>{item.nombre}</ThemedText>
            <ThemedText style={styles.cardSubtitle}>{item.tipoClase?.nombre}</ThemedText>
            <ThemedText style={styles.cardInfo}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
            <ThemedText style={styles.cardInfo}>A cargo de: {item.profesor ? `${item.profesor.nombre} ${item.profesor.apellido}` : 'No asignado'}</ThemedText>
            <ThemedText style={styles.cardInfo}>Cupos: {item.usuariosInscritos.length} / {item.capacidad}</ThemedText>
            
            <View style={styles.actionsContainer}>
                {item.estado === 'cancelada' ? (
                    <>
                        <Text style={styles.cancelledText}>CANCELADA</Text>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleReactivateClass(item)}>
                            <Ionicons name="checkmark-circle" size={24} color={Colors[colorScheme].text}  />
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleViewRoster(item._id)}>
                            <Ionicons name="people" size={24} color={Colors[colorScheme].text}  />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelClass(item)}>
                            <Ionicons name="close-circle" size={24} color={'#a72828ff'}  />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
                            <FontAwesome6 name="edit" size={23} color={Colors[colorScheme].text}  />
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );

    const handleOpenBulkEditModal = (group) => {
        setEditingGroup(group);
        setBulkUpdates({ 
            profesor: group.profesor?._id || '', 
            horaInicio: group.horaInicio, 
            horaFin: group.horaFin, 
            diasDeSemana: [...group.diasDeSemana] 
        });
        setShowBulkEditModal(true);
    };

    const handleBulkUpdate = async () => {
        if (!editingGroup) return;
        const updates = Object.fromEntries(Object.entries(bulkUpdates).filter(([key, value]) => {
            if (typeof value === 'string') return value.trim() !== '';
            if (Array.isArray(value)) return value.length > 0;
            return value != null;
        }));

        if (Object.keys(updates).length === 0) {
            return setAlertInfo({ visible: true, title: 'Sin cambios', message: 'No has modificado ningún campo.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }

        const filters = {
            nombre: editingGroup.nombre,
            tipoClase: editingGroup.tipoClase._id,
            horaInicio: editingGroup.horaInicio,
            fechaDesde: new Date().toISOString().split('T')[0],
        };

        try {
            await apiClient.put('/classes/bulk-update', { filters, updates });
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Grupo de turnos actualizado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            setShowBulkEditModal(false);
            fetchAllData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el grupo.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const handleOpenExtendModal = (group) => {
        setExtendingGroup(group);
        setExtendUntilDate('');
        setShowExtendModal(true);
    };

    const handleExtendSubmit = async (groupToExtend = extendingGroup, newEndDate = extendUntilDate) => {
        if (!groupToExtend || !newEndDate) {
            return setAlertInfo({ visible: true, title: 'Error', message: 'Datos incompletos para extender el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
        const filters = {
            nombre: groupToExtend.nombre,
            tipoClase: groupToExtend.tipoClase._id,
            horaInicio: groupToExtend.horaInicio,
            diasDeSemana: groupToExtend.diasDeSemana,
        };
        const extension = { fechaFin: newEndDate };

        try {
            await apiClient.post('/classes/bulk-extend', { filters, extension });
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Turnos extendidos correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            setShowExtendModal(false);
            fetchAllData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'Error al extender turnos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const handleBulkDelete = (group) => {
        setAlertInfo({
            visible: true,
            title: "Eliminar Grupo de Turnos",
            message: `¿Estás seguro de que quieres eliminar TODAS las ${group.cantidadDeInstancias} instancias futuras de "${group.nombre}"?`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Eliminar", style: "destructive", onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        const filters = {
                            nombre: group.nombre,
                            tipoClase: group.tipoClase._id,
                            horaInicio: group.horaInicio,
                        };
                        await apiClient.post('/classes/bulk-delete', { filters });
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Grupo de turnos eliminado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        fetchAllData();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar el grupo.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
            ]
        });
    };

    const handleCancelDay = (refund) => {
        const date = format(dayToManage, 'yyyy-MM-dd');
        setAlertInfo({
            visible: true,
            title: "Confirmar Acción",
            message: `¿Seguro que quieres cancelar todos los turnos del ${format(dayToManage, 'dd/MM/yyyy')} ${refund ? 'con' : 'sin'} reembolso?`,
            buttons: [
                { text: "Volver", style: 'cancel', onPress: () => setAlertInfo({ visible: false }) },
                { text: "Confirmar", style: 'destructive', onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        await apiClient.post('/classes/cancel-day', { date, refundCredits: refund });
                        setAlertInfo({ visible: true, title: 'Éxito', message: `Todos los turnos del día han sido cancelados.`, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        fetchAllData();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || "No se pudo completar la operación.", buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
            ]
        });
    };
    
    const handleReactivateDay = () => {
        const date = format(dayToManage, 'yyyy-MM-dd');
        setAlertInfo({
            visible: true,
            title: "Confirmar Acción",
            message: `¿Seguro que quieres reactivar todos los turnos del ${format(dayToManage, 'dd/MM/yyyy')}?`,
            buttons: [
                { text: "Volver", style: 'cancel', onPress: () => setAlertInfo({ visible: false }) },
                { text: "Confirmar", style: 'primary', onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        await apiClient.post('/classes/reactivate-day', { date });
                        setAlertInfo({ visible: true, title: 'Éxito', message: `Todos los turnos del día han sido reactivados.`, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        fetchAllData();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || "No se pudo completar la operación.", buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
            ]
        });
    };

    const renderGroupedClassItem = ({ item }) => (
        <View style={[styles.card, item.cantidadDeInstancias === 1 && styles.expiringCard]}>
            <ThemedText style={styles.cardTitle}>{item.nombre}</ThemedText>
            <ThemedText style={styles.cardSubtitle}>{item.tipoClase?.nombre || 'N/A'}</ThemedText>
            <ThemedText style={styles.cardInfo}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
            <ThemedText style={styles.cardInfo}>Días: {item.diasDeSemana.sort().join(', ')}</ThemedText>
            <ThemedText style={styles.cardInfo}>A cargo de: {item.profesor ? `${item.profesor.nombre} ${item.profesor.apellido}` : 'No asignado'}</ThemedText>
            <ThemedText style={styles.cardInfo}>Turnos restantes: {item.cantidadDeInstancias}</ThemedText>
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenBulkEditModal(item)}>
                    <FontAwesome6 name="edit" size={23} color={Colors[colorScheme].text}  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenExtendModal(item)}>
                    <Ionicons name="add-circle" size={24} color={Colors[colorScheme].text}  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleBulkDelete(item)}>
                    <Octicons name="trash" size={24} color={Colors[colorScheme].text}  />
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
                            <>
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
                            </>
                        }
                        data={filteredClassesForSelectedDate}
                        renderItem={renderClassItem}
                        keyExtractor={(item) => item._id}
                        ListEmptyComponent={<ThemedText style={styles.placeholderText}>No hay turnos para este día.</ThemedText>}
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />
                        }
                    />
                );
            case 'bulk':
                return (
                    <FlatList
                        ListHeaderComponent={
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={selectedRecurrentClassTypeFilter}
                                    onValueChange={(itemValue) => setSelectedRecurrentClassTypeFilter(itemValue)}
                                >
                                    <Picker.Item label="Todos los Tipos" value="all" />
                                    {classTypes.map(type => <Picker.Item key={type._id} label={type.nombre} value={type._id} />)}
                                </Picker>
                            </View>
                        }
                        data={filteredGroupedClasses}
                        renderItem={renderGroupedClassItem}
                        keyExtractor={(item) => item._id}
                        ListEmptyComponent={<ThemedText style={styles.placeholderText}>No hay turnos fijos para gestionar.</ThemedText>}
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />
                        }
                    />
                );
            case 'day-management':
                return (
                    <View style={styles.dayManagementContainer}>
                        <ThemedText style={styles.sectionTitle}>Gestión por Día Completo</ThemedText>
                        <ThemedText style={styles.inputLabel}>Selecciona una fecha:</ThemedText>
                        <TouchableOpacity onPress={() => setShowDayPicker(true)}>
                            <View style={styles.dateInputTouchable}>
                                <Text style={styles.dateInputText}>{format(dayToManage, 'dd/MM/yyyy')}</Text>
                            </View>
                        </TouchableOpacity>
                        {showDayPicker && (
                            <DateTimePicker
                                value={dayToManage}
                                mode="date"
                                display="default"
                                onChange={(event, date) => {
                                    setShowDayPicker(Platform.OS === 'ios');
                                    if (date) setDayToManage(date);
                                }}
                            />
                        )}
                        <View style={styles.dayActions}>
                            <View style={styles.buttonWrapper}>
                                <Button title="Cancelar Turnos del Día" onPress={() => handleCancelDay(true)} color='#500000ff' />
                            </View>
                            <View style={styles.buttonWrapper}>
                                <Button title="Reactivar Turnos del Día" onPress={handleReactivateDay} color='#1a5276' />
                            </View>
                        </View>
                    </View>
                );
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
                    <Text style={[styles.tabText, activeTab === 'bulk' && styles.activeTabText]}>Recurrentes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('day-management')} style={[styles.tab, activeTab === 'day-management' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'day-management' && styles.activeTabText]}>Cancelar  Día</Text>
                </TouchableOpacity>
            </View>
            
            {renderContent()}

            <TouchableOpacity style={styles.fab} onPress={() => { setEditingClass(null); setShowAddModal(true); }}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* --- MODAL PARA AÑADIR/EDITAR CLASE (ACTUALIZADO) --- */}
            <Modal visible={showAddModal} transparent={true} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
                <View style={styles.modalContainer}>
                    <ThemedView style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color="#ccc" />
                        </TouchableOpacity>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                             <ThemedText style={styles.modalTitle}>{editingClass ? 'Editar Turno' : 'Crear Nuevo Turno'}</ThemedText>
                            
                             <ThemedText style={styles.inputLabel}>Nombre del Turno</ThemedText>
                             <TextInput style={styles.input} value={formData.nombre} onChangeText={text => handleFormChange('nombre', text)} />
                            
                             <ThemedText style={styles.inputLabel}>Tipo de Turno</ThemedText>
                             <View style={styles.pickerContainer}>
                                 <Picker selectedValue={formData.tipoClase} onValueChange={itemValue => handleFormChange('tipoClase', itemValue)}>
                                     <Picker.Item label="-- Seleccionar --" value="" />
                                     {classTypes.map(type => <Picker.Item key={type._id} label={type.nombre} value={type._id} />)}
                                 </Picker>
                             </View>
                            
                            <ThemedText style={styles.inputLabel}>A cargo de</ThemedText>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={formData.profesor} onValueChange={itemValue => handleFormChange('profesor', itemValue)}>
                                    <Picker.Item label="-- Seleccionar --" value="" />
                                    {teachers.map(t => <Picker.Item key={t._id} label={`${t.nombre} ${t.apellido}`} value={t._id} />)}
                                </Picker>
                            </View>

                            <ThemedText style={styles.inputLabel}>Capacidad</ThemedText>
                            <TextInput style={styles.input} keyboardType="numeric" value={formData.capacidad} onChangeText={text => handleFormChange('capacidad', text)} />

                            <ThemedText style={styles.inputLabel}>Tipo de Inscripción</ThemedText>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={formData.tipoInscripcion} onValueChange={itemValue => handleFormChange('tipoInscripcion', itemValue)} enabled={!editingClass}>
                                    <Picker.Item label="Fecha Única" value="libre" />
                                    <Picker.Item label="Recurrente" value="fijo" />
                                </Picker>
                            </View>
                            
                            {formData.tipoInscripcion === 'libre' ? (
                                <>
                                    <ThemedText style={styles.inputLabel}>Fecha</ThemedText>
                                    <TouchableOpacity onPress={() => showDatePickerForField('fecha')}>
                                        <View style={styles.dateInputTouchable}>
                                            <Text style={styles.dateInputText}>{formData.fecha || 'Seleccionar fecha...'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <ThemedText style={styles.inputLabel}>Hora de Inicio</ThemedText>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="HH:MM" 
                                        value={formData.horaInicio} 
                                        onChangeText={text => handleTimeInputChange(text, 'horaInicio', setFormData)}
                                        keyboardType="numeric"
                                        maxLength={5}
                                    />
                                    <ThemedText style={styles.inputLabel}>Hora de Fin</ThemedText>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="HH:MM" 
                                        value={formData.horaFin} 
                                        onChangeText={text => handleTimeInputChange(text, 'horaFin', setFormData)}
                                        keyboardType="numeric"
                                        maxLength={5}
                                    />
                                </>
                            ) : (
                                <>
                                    <ThemedText style={styles.inputLabel}>Horario Fijo</ThemedText>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="HH:MM" 
                                        value={formData.horaInicio} 
                                        onChangeText={text => handleTimeInputChange(text, 'horaInicio', setFormData)}
                                        keyboardType="numeric"
                                        maxLength={5}
                                    />
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="HH:MM" 
                                        value={formData.horaFin} 
                                        onChangeText={text => handleTimeInputChange(text, 'horaFin', setFormData)}
                                        keyboardType="numeric"
                                        maxLength={5}
                                    />
                                    
                                    <ThemedText style={styles.inputLabel}>Generar desde</ThemedText>
                                    <TouchableOpacity onPress={() => showDatePickerForField('fechaInicio')}>
                                        <View style={styles.dateInputTouchable}>
                                            <Text style={styles.dateInputText}>{formData.fechaInicio || 'Seleccionar fecha...'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    
                                    <ThemedText style={styles.inputLabel}>Generar hasta</ThemedText>
                                    <TouchableOpacity onPress={() => showDatePickerForField('fechaFin')}>
                                        <View style={styles.dateInputTouchable}>
                                            <Text style={styles.dateInputText}>{formData.fechaFin || 'Seleccionar fecha...'}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <ThemedText style={styles.inputLabel}>Días de la Semana</ThemedText>
                                    <View style={styles.weekDayContainer}>
                                        {daysOfWeekOptions.map(day => (
                                            <TouchableOpacity key={day} onPress={() => handleDaySelection(day)} style={[styles.dayChip, formData.diaDeSemana.includes(day) && styles.dayChipSelected]}>
                                                <Text style={formData.diaDeSemana.includes(day) ? styles.dayChipTextSelected : styles.dayChipText}>{day.substring(0,3)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            
                            <View style={styles.modalActions}>
                                <View style={styles.buttonWrapper}>
                                    <Button title={editingClass ? 'Actualizar' : 'Guardar'} onPress={handleFormSubmit} color='#1a5276' />
                                </View>
                            </View>
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>

            {/* --- MODAL PARA LISTA DE INSCRIPTOS  --- */}
            <Modal visible={showRosterModal} transparent={true} animationType="slide" onRequestClose={() => setShowRosterModal(false)}>
                <View style={styles.modalContainer}>
                        <ThemedView style={styles.modalView}>
                            <TouchableOpacity onPress={() => setShowRosterModal(false)} style={styles.closeButton}>
                                <Ionicons name="close-circle" size={30} color="#ccc" />
                            </TouchableOpacity>
                            <ThemedText style={styles.modalTitle}>Inscriptos en {viewingClassRoster?.nombre}</ThemedText>
                            <FlatList
                                data={viewingClassRoster?.usuariosInscritos || []}
                                keyExtractor={item => item._id || Math.random().toString()}
                                renderItem={({item}) => {
                                     if (!item) {
                                        return null;
                                    }
                                    return (
                                    <View style={styles.rosterItem}>
                                        <Text style={styles.rosterText}>{item.nombre} {item.apellido}</Text>
                                        <Text style={styles.rosterSubtext}>DNI: {item.dni}</Text>
                                        <Text style={styles.rosterSubtext}>Teléfono: {item.numeroTelefono}</Text>
                                        <Text style={styles.rosterSubtext}>Teléfono de Emergencia: {item.telefonoEmergencia}</Text>
                                        <Text style={styles.rosterSubtext}>Obra Social: {item.obraSocial}</Text>
                                    </View>
                                    )
                                }}
                                ListEmptyComponent={<Text style={styles.placeholderText}>No hay nadie inscripto.</Text>}
                                style={{width: '100%'}}
                            />
                        </ThemedView>
                </View>
            </Modal>

            {/* --- MODAL DE CONFIRMACIÓN PARA CANCELAR --- */}
            <Modal visible={showCancelModal} transparent={true} animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalView, styles.confirmationModal]}>
                        <TouchableOpacity onPress={() => setShowCancelModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color="#ccc" />
                        </TouchableOpacity>
                        <ThemedText style={styles.modalTitle}>Confirmar Cancelación</ThemedText>
                        <ThemedText>¿Deseas devolver los créditos a los usuarios inscritos?</ThemedText>
                        <View style={styles.modalActions}>
                            <View style={styles.buttonWrapper}>
                                <Button title="Sí, con reembolso" onPress={() => confirmCancelClass(true)} color='#1a5276' />
                            </View>
                            <View style={styles.buttonWrapper}>
                                <Button title="No, sin reembolso" onPress={() => confirmCancelClass(false)} color='#500000ff' />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- MODAL PARA EDITAR GRUPO  --- */}
            <Modal visible={showBulkEditModal} transparent={true} animationType="slide" onRequestClose={() => setShowBulkEditModal(false)}>
                 <View style={styles.modalContainer}>
                    <ThemedView style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowBulkEditModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color="#ccc" />
                        </TouchableOpacity>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <ThemedText style={styles.modalTitle}>Editar Grupo: {editingGroup?.nombre}</ThemedText>
                            
                            <TextInput 
                                style={styles.input} 
                                value={bulkUpdates.horaInicio} 
                                onChangeText={text => handleTimeInputChange(text, 'horaInicio', setBulkUpdates)}
                                keyboardType="numeric"
                                maxLength={5}
                            />
                            
                            <ThemedText style={styles.inputLabel}>Nuevo Horario de Fin: </ThemedText>
                            <TextInput 
                                style={styles.input} 
                                value={bulkUpdates.horaFin} 
                                onChangeText={text => handleTimeInputChange(text, 'horaFin', setBulkUpdates)}
                                keyboardType="numeric"
                                maxLength={5}
                            />
                            <ThemedText style={styles.inputLabel}>Capacidad: </ThemedText>
                            <TextInput style={styles.input} value={bulkUpdates.capacidad} onChangeText={text => setBulkUpdates(p => ({...p, capacidad: text}))} />
                            <ThemedText style={styles.inputLabel}>A cargo de:</ThemedText>
                            <View style={styles.pickerContainer}>
                                <Picker selectedValue={bulkUpdates.profesor} onValueChange={itemValue => setBulkUpdates(p => ({...p, profesor: itemValue}))}>
                                    <Picker.Item label="-- No cambiar --" value="" />
                                    {teachers.map(t => <Picker.Item key={t._id} label={`${t.nombre} ${t.apellido}`} value={t._id} />)}
                                </Picker>
                            </View>

                            <ThemedText style={styles.inputLabel}>Nuevos Días de la Semana:</ThemedText>
                            <View style={styles.weekDayContainer}>
                                {daysOfWeekOptions.map(day => (
                                    <TouchableOpacity key={day} onPress={() => handleBulkDaySelection(day)} style={[styles.dayChip, bulkUpdates.diasDeSemana.includes(day) && styles.dayChipSelected]}>
                                        <Text style={bulkUpdates.diasDeSemana.includes(day) ? styles.dayChipTextSelected : styles.dayChipText}>{day.substring(0,3)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                             <View style={styles.modalActions}>
                                <View style={styles.buttonWrapper}>
                                    <Button title="Guardar Cambios" onPress={handleBulkUpdate} color='#1a5276' />
                                </View>
                            </View>
                        </ScrollView>
                    </ThemedView>
                 </View>
            </Modal>

            {/* --- MODAL PARA EXTENDER CLASES  --- */}
            <Modal visible={showExtendModal} transparent={true} animationType="slide" onRequestClose={() => setShowExtendModal(false)}>
                 <View style={styles.modalContainer}>
                        <ThemedView style={styles.modalView}>
                            <TouchableOpacity onPress={() => setShowExtendModal(false)} style={styles.closeButton}>
                                <Ionicons name="close-circle" size={30} color="#ccc" />
                            </TouchableOpacity>
                            <ScrollView contentContainerStyle={styles.modalContent}>
                                <ThemedText style={styles.modalTitle}>Extender Turnos de {extendingGroup?.nombre}</ThemedText>
                                <ThemedText style={styles.inputLabel}>Extender hasta:</ThemedText>
                                <TouchableOpacity onPress={() => showDatePickerForField('extendUntilDate')}>
                                    <View style={styles.dateInputTouchable}>
                                        <Text style={styles.dateInputText}>{extendUntilDate || 'Seleccionar fecha...'}</Text>
                                    </View>
                                </TouchableOpacity>
                                <View style={styles.modalActions}>
                                    <View style={styles.buttonWrapper}>
                                        <Button title="Confirmar Extensión" onPress={() => handleExtendSubmit()} color='#1a5276' />
                                    </View>
                                </View>
                            </ScrollView>
                        </ThemedView>
                 </View>
            </Modal>

            {showDatePicker && (
                <DateTimePicker
                    value={
                        (dateFieldToEdit && formData[dateFieldToEdit] && new Date(formData[dateFieldToEdit])) ||
                        (extendUntilDate && new Date(extendUntilDate)) ||
                        new Date()
                    }
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}
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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
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
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 8,
        padding: 15,
        marginVertical: 8,
        marginHorizontal: 15,
        elevation: 3,
    },
    expiringCard: {
        borderColor: '#f0ad4e',
        borderWidth: 2,
    },
    cancelledCard: {
        backgroundColor: '#f0f0f0',
        opacity: 0.7,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: Colors[colorScheme].border,
        paddingTop: 10,
    },
    cancelledText: {
        color: Colors.light.error,
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 'auto',
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
    actionButton: {
        padding: 8,
        marginLeft: 15,
    },
    fab: {
        position: 'absolute',
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        left: 20,
        bottom: 20,
        backgroundColor: '#1a5276',
        borderRadius: 30,
        elevation: 8,
    },
    modalContainer: { 
        flex: 1, 
        justifyContent: 'flex-end', 
        alignItems: 'center', 
        backgroundColor: 'rgba(0,0,0,0.5)' 
    },
    modalView: { 
        height: '90%', 
        width: '100%', 
        backgroundColor: Colors[colorScheme].background, 
        borderTopLeftRadius: 12, 
        borderTopRightRadius: 12, 
        padding: 20, 
        elevation: 5 
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
    },
    modalContent: {
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 25,
        textAlign: 'center',
        paddingTop: 10,
        color: Colors[colorScheme].text,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
        gap: 15
    },
    confirmationModal: {
        width: '100%',
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 12,
        padding: 25,
        alignItems: "center",
        elevation: 5,
    },
    inputLabel: {
        fontSize: 16,
        marginBottom: 8,
        color: Colors[colorScheme].text,
        opacity: 0.9,
        fontWeight: '500',
    },
    input: {
        height: 50,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    pickerContainer: {
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        margin: 15,
        justifyContent: 'center',
        backgroundColor: Colors[colorScheme].cardBackground,
    },
    dateInputTouchable: {
        height: 50,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        justifyContent: 'center',
    },
    dateInputText: {
        fontSize: 16,
        color: Colors[colorScheme].text,
    },
    weekDayContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 15,
    },
    dayChip: {
        paddingVertical: 6,
        paddingHorizontal: 5,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: gymColor || '#1a5276',
        margin: 4,
        color :Colors[colorScheme].text
    },
    dayChipSelected: {
        backgroundColor: gymColor || '#1a5276',
    },
    dayChipText: {
        fontWeight: '600',
        color :Colors[colorScheme].text
    },
    dayChipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
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
    },
    dayManagementContainer: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    dayActions: {
        marginTop: 20,
        width: '100%',
        gap: 15,
    },
    buttonWrapper: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 10,
    },
    filtersContainer: {
        marginHorizontal: 15,
        marginTop: 10,
        flexDirection: 'row',
        gap: 10,
    }
});

export default ManageClassesScreen;
