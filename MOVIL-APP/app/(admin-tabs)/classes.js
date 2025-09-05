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
    Pressable,
    TextInput,
    Platform, 
    RefreshControl,
    useWindowDimensions,
    KeyboardAvoidingView,
    Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome6, Octicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO, isBefore, startOfDay, addMonths, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Picker nativo
import DateTimePicker from '@react-native-community/datetimepicker';

// 💡 PASO 1: Importar el picker para la web y sus estilos
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';
import { TabView, TabBar } from 'react-native-tab-view';

// ... (configuración de LocaleConfig se mantiene igual)
LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
    today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';


const ManageClassesScreen = () => {
    // ... (todos tus estados y hooks se mantienen igual)
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);
    const layout = useWindowDimensions();

    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'calendar', title: 'Calendario' },
        { key: 'bulk', title: 'Recurrentes' },
        { key: 'day-management', title: 'Gestión por Día' },
    ]);


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

    const [activeModal, setActiveModal] = useState(null);
    const [datePickerConfig, setDatePickerConfig] = useState({
        visible: false,
        field: null, // 'fecha', 'fechaInicio', 'fechaFin', 'extendUntilDate', or 'dayToManage'
        currentValue: new Date(),
        onConfirm: () => {}
    });

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

    // ... (fetchAllData, useFocusEffect, onRefresh, etc. se mantienen igual)
    const fetchAllData = useCallback(async () => {
        try {
            const cacheBuster = `?t=${new Date().getTime()}`;
            const [classesRes, teachersRes, typesRes] = await Promise.all([
                apiClient.get(`/classes${cacheBuster}`),
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
                {
                    text: 'Guardar', style: 'primary', onPress: async () => {
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
                    }
                }
            ]
        });
    };

    const handleEdit = (classItem) => {
        setEditingClass(classItem);
        const dateString = classItem.fecha.substring(0, 10);
        setFormData({
            tipoClase: classItem.tipoClase?._id || '',
            nombre: classItem.nombre,
            fecha: dateString,
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
                {
                    text: "Sí, Reactivar", style: 'primary', onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.put(`/classes/${classItem._id}/reactivate`);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'El turno ha sido reactivado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchAllData();
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo reactivar el turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    };
  
    const showDatePickerFor = (field, initialDate, onConfirmCallback) => {
        setDatePickerConfig({
            visible: true,
            field: field,
            currentValue: initialDate || new Date(),
            onConfirm: onConfirmCallback,
        });
    };
    
    const handleDateChange = (event, selectedDate) => {
        const newDate = selectedDate || datePickerConfig.currentValue;

        if (Platform.OS === 'android') {
            setDatePickerConfig({ visible: false }); // Close picker immediately on Android
            if (event.type !== 'dismissed') {
                datePickerConfig.onConfirm(newDate); // Confirm date on Android
            }
        } else { // iOS
            setDatePickerConfig(prev => ({ ...prev, currentValue: newDate }));
        }
    };
    
    const confirmIosDate = () => {
        datePickerConfig.onConfirm(datePickerConfig.currentValue);
        setDatePickerConfig({ visible: false }); // Close modal
    };

    const renderDateField = (label, field, value, onConfirmCallback) => {
        const displayValue = value ? format(parseISO(value), 'dd/MM/yyyy') : `Seleccionar ${label.toLowerCase()}`;
        const initialDate = value ? parseISO(value) : new Date();

        if (Platform.OS === 'web') {
            return (
                <DatePicker
                    selected={value ? parseISO(value) : null}
                    onChange={onConfirmCallback}
                    dateFormat="dd/MM/yyyy"
                    customInput={
                        <View style={styles.dateInputTouchable}>
                            <Text style={styles.dateInputText}>{displayValue}</Text>
                        </View>
                    }
                />
            );
        }

        return (
            <TouchableOpacity onPress={() => showDatePickerFor(field, initialDate, onConfirmCallback)}>
                <View style={styles.dateInputTouchable}>
                    <Text style={styles.dateInputText}>{displayValue}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    // 💡 PASO 2: Modificar los manejadores de fecha para que sean compatibles con web y nativo
    const showDatePickerForField = (field) => {
        setDateFieldToEdit(field);
        setShowDatePicker(true);
    };

    const onDateChange = (eventOrDate, selectedDate) => {
        const currentDate = Platform.OS === 'web' ? eventOrDate : selectedDate;
        setShowDatePicker(Platform.OS === 'ios'); // En web, este estado no controla el picker
        
        if (Platform.OS === 'web') {
            setShowDatePicker(false); // Cierra el "modal" virtual en la web
        }

        if (currentDate) {
            const formattedDate = format(currentDate, 'yyyy-MM-dd');
            if (dateFieldToEdit === 'extendUntilDate') {
                setExtendUntilDate(formattedDate);
            } else if (dateFieldToEdit) {
                handleFormChange(dateFieldToEdit, formattedDate);
            }
        }
    };

    const onDayToManageChange = (eventOrDate, selectedDate) => {
        const currentDate = Platform.OS === 'web' ? eventOrDate : selectedDate;
        setShowDayPicker(Platform.OS === 'ios');

        if(Platform.OS === 'web') {
            setShowDayPicker(false);
        }

        if (currentDate) {
            setDayToManage(currentDate);
        }
    };

    // ... (getModalConfig y el resto de la lógica de negocio se mantienen igual)
    const getModalConfig = useMemo(() => {
        const classTypeOptions = [{ _id: 'all', nombre: 'Todos los Tipos' }, ...classTypes];
        const teacherOptions = [{ _id: '', nombre: '-- Seleccionar --' }, ...teachers.map(t => ({ _id: t._id, nombre: `${t.nombre} ${t.apellido}` }))];
        const inscriptionTypeOptions = [
            { _id: 'libre', nombre: 'Fecha Única' },
            { _id: 'fijo', nombre: 'Recurrente' },
        ];

        switch (activeModal) {
            case 'recurrentFilter':
                return {
                    title: 'Filtrar por Tipo',
                    options: classTypeOptions,
                    onSelect: setSelectedRecurrentClassTypeFilter,
                    selectedValue: selectedRecurrentClassTypeFilter
                };
            case 'formClassType':
                return {
                    title: 'Seleccionar Tipo de Turno',
                    options: classTypes.map(t => ({ _id: t._id, nombre: t.nombre })),
                    onSelect: (id) => handleFormChange('tipoClase', id),
                    selectedValue: formData.tipoClase,
                };
            case 'formTeacher':
                return {
                    title: 'Seleccionar Encargado',
                    options: teacherOptions,
                    onSelect: (id) => handleFormChange('profesor', id),
                    selectedValue: formData.profesor,
                };
            case 'formInscriptionType':
                return {
                    title: 'Seleccionar Tipo de Inscripción',
                    options: inscriptionTypeOptions,
                    onSelect: (id) => handleFormChange('tipoInscripcion', id),
                    selectedValue: formData.tipoInscripcion,
                };
            case 'bulkEditTeacher':
                return {
                    title: 'Seleccionar Encargado',
                    options: [{ _id: '', nombre: '-- No cambiar --' }, ...teacherOptions.slice(1)], // Reusa teacherOptions pero cambia el default
                    onSelect: (id) => setBulkUpdates(p => ({ ...p, profesor: id })),
                    selectedValue: bulkUpdates.profesor,
                };
            default:
                return null;
        }
    }, [activeModal, classTypes, teachers, formData.tipoClase, formData.profesor, formData.tipoInscripcion, selectedRecurrentClassTypeFilter, bulkUpdates.profesor]);



    const getDisplayName = (id, type) => {
        if (type === 'classType') return classTypes.find(t => t._id === id)?.nombre || '-- Seleccionar --';
        if (type === 'teacher') {
            const teacher = teachers.find(t => t._id === id);
            return teacher ? `${teacher.nombre} ${teacher.apellido}` : '-- Seleccionar --';
        }
        if (type === 'inscription') return id === 'fijo' ? 'Recurrente' : 'Fecha Única';
        return 'Seleccionar';
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
            if (Array.isArray(cls.diaDeSemana) && cls.diaDeSemana.length > 0) {
                acc[groupKey].diasDeSemana.add(cls.diaDeSemana[0]);
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
        const message = `Se están terminando los turnos de "${group.nombre} - ${group.tipoClase.nombre}" de los días ${group.diasDeSemana.join(', ')}. ¿Quieres extenderlos un mes más?`;

        setAlertInfo({
            visible: true,
            title: "Extender Turnos",
            message: message,
            buttons: [
                { text: "No, gracias", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Sí, extender", style: "primary", onPress: async () => {
                        setAlertInfo({ visible: false });
                        const newEndDate = addMonths(new Date(group.lastDate), 1);
                        const formattedEndDate = format(newEndDate, 'yyyy-MM-dd');
                        await handleExtendSubmit(group, formattedEndDate);
                    }
                }
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
                            <Ionicons name="checkmark-circle" size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleViewRoster(item._id)}>
                            <Ionicons name="people" size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelClass(item)}>
                            <Ionicons name="close-circle" size={24} color={'#a72828ff'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
                            <FontAwesome6 name="edit" size={23} color={Colors[colorScheme].text} />
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
                {
                    text: "Eliminar", style: "destructive", onPress: async () => {
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
                    }
                }
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
                {
                    text: "Confirmar", style: 'destructive', onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.post('/classes/cancel-day', { date, refundCredits: refund });
                            setAlertInfo({ visible: true, title: 'Éxito', message: `Todos los turnos del día han sido cancelados.`, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchAllData();
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || "No se pudo completar la operación.", buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
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
                {
                    text: "Confirmar", style: 'primary', onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.post('/classes/reactivate-day', { date });
                            setAlertInfo({ visible: true, title: 'Éxito', message: `Todos los turnos del día han sido reactivados.`, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchAllData();
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || "No se pudo completar la operación.", buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
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
                    <FontAwesome6 name="edit" size={23} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenExtendModal(item)}>
                    <Ionicons name="add-circle" size={24} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleBulkDelete(item)}>
                    <Octicons name="trash" size={24} color={Colors[colorScheme].text} />
                </TouchableOpacity>
            </View>
        </View>
    );

    // 💡 PASO 3: Crear un componente de renderizado de fecha reutilizable para la web.
    // Esto simplifica el JSX principal.
    const renderWebDatePicker = (value, onChange, placeholder) => {
        const dateValue = value && isValid(parseISO(value)) ? parseISO(value) : null;
        return (
            <DatePicker
                selected={dateValue}
                onChange={onChange}
                dateFormat="yyyy-MM-dd"
                placeholderText={placeholder}
                customInput={<View style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{value || placeholder}</Text></View>}
            />
        );
    };

    const renderScene = ({ route }) => {
        switch (route.key) {
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
                        data={filteredClassesForSelectedDate}
                        renderItem={renderClassItem}
                        keyExtractor={(item) => item._id}
                        ListEmptyComponent={
                            <ThemedText style={styles.placeholderText}>No hay turnos para este día.</ThemedText>
                        }
                        refreshControl={
                            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />
                        }
                    />
                );
            case 'bulk':
                const recurrentFilterText = classTypes.find(t => t._id === selectedRecurrentClassTypeFilter)?.nombre || 'Todos los Tipos';
                return (
                    <FlatList
                        ListHeaderComponent={
                            <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('recurrentFilter')}>
                                <ThemedText style={styles.filterButtonText}>{recurrentFilterText}</ThemedText>
                                <FontAwesome6 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
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
                        
                        {/* 💡 PASO 4: Usar lógica condicional para el selector de fecha */}
                        {Platform.OS === 'web' ? (
                            <DatePicker
                                selected={dayToManage}
                                onChange={onDayToManageChange}
                                dateFormat="dd/MM/yyyy"
                                customInput={
                                    <TouchableOpacity>
                                        <View style={styles.dateInputTouchable}>
                                            <Text style={styles.dateInputText}>{format(dayToManage, 'dd/MM/yyyy')}</Text>
                                        </View>
                                    </TouchableOpacity>
                                }
                            />
                        ) : (
                            <TouchableOpacity onPress={() => setShowDayPicker(true)}>
                                <View style={styles.dateInputTouchable}>
                                    <Text style={styles.dateInputText}>{format(dayToManage, 'dd/MM/yyyy')}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        
                        {Platform.OS !== 'web' && showDayPicker && (
                            <DateTimePicker
                                value={dayToManage}
                                mode="date"
                                display="default"
                                onChange={onDayToManageChange}
                            />
                        )}

                        <View style={styles.dayActions}>
                            <View style={styles.buttonWrapper}>
                                <Button title="Cancelar Turnos del Día" onPress={() => handleCancelDay(true)} color='#500000ff' />
                            </View>
                            <View style={styles.buttonWrapper}>
                                <Button title="Reactivar Turnos del Día" onPress={handleReactivateDay} color='#005013ff' />
                            </View>
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return <ActivityIndicator size="large" color={gymColor} style={{ flex: 1, backgroundColor: Colors[colorScheme].background }} />;
    }

    return (
        <ThemedView style={styles.container}>
            <TabView
                navigationState={{ index, routes }}
                renderScene={renderScene} // renderScene y toda su lógica interna se mantiene
                onIndexChange={setIndex}
                initialLayout={{ width: layout.width }}
                renderTabBar={props => (
                    <TabBar {...props} style={{ backgroundColor: gymColor }}
                        indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }}
                        labelStyle={styles.tabLabel}
                        tabStyle={styles.tabStyle}
                    />
                )}
            />

            <TouchableOpacity style={styles.fab} onPress={() => { setEditingClass(null); setShowAddModal(true); }}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
            {datePickerConfig.visible && Platform.OS === 'ios' && (
                <Modal transparent={true} animationType="slide" visible={datePickerConfig.visible}>
                    <Pressable style={styles.iosPickerOverlay} onPress={() => setDatePickerConfig(p => ({...p, visible: false}))}>
                        <Pressable style={styles.iosPickerContainer}>
                            <DateTimePicker 
                                value={datePickerConfig.currentValue} 
                                mode="date" 
                                display="inline" 
                                onChange={handleDateChange} 
                                themeVariant={colorScheme}
                            />
                            <Button title="Confirmar" onPress={confirmIosDate} color={gymColor} />
                        </Pressable>
                    </Pressable>
                </Modal>
            )}

            {/* --- DATE PICKER FOR ANDROID (INVISIBLE) --- */}
            {datePickerConfig.visible && Platform.OS === 'android' && (
                <DateTimePicker
                    value={datePickerConfig.currentValue}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                />
            )}    
            {showAddModal && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper} keyboardVerticalOffset={70}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
                    <Pressable style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <ThemedText style={styles.modalTitle}>{editingClass ? 'Editar Turno' : 'Crear Nuevo Turno'}</ThemedText>
                            <ThemedText style={styles.inputLabel}>Nombre del Turno</ThemedText>
                            <TextInput style={styles.input} value={formData.nombre} onChangeText={text => handleFormChange('nombre', text)} placeholderTextColor={Colors[colorScheme].icon} />
                            <ThemedText style={styles.inputLabel}>Tipo de Turno</ThemedText>
                            <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('formClassType')}>
                                <ThemedText style={styles.filterButtonText}>{getDisplayName(formData.tipoClase, 'classType')}</ThemedText>
                                <FontAwesome6 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                            <ThemedText style={styles.inputLabel}>A cargo de</ThemedText>
                            <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('formTeacher')}>
                                <ThemedText style={styles.filterButtonText}>{getDisplayName(formData.profesor, 'teacher')}</ThemedText>
                                <FontAwesome6 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                            <ThemedText style={styles.inputLabel}>Capacidad</ThemedText>
                            <TextInput style={styles.input} keyboardType="numeric" value={formData.capacidad} onChangeText={text => handleFormChange('capacidad', text)} />
                            <ThemedText style={styles.inputLabel}>Tipo de Inscripción</ThemedText>
                            <TouchableOpacity style={styles.filterButton} onPress={() => !editingClass && setActiveModal('formInscriptionType')} disabled={!!editingClass}>
                                <ThemedText style={[styles.filterButtonText, !!editingClass && styles.disabledText]}>{getDisplayName(formData.tipoInscripcion, 'inscription')}</ThemedText>
                                <FontAwesome6 name="chevron-down" size={12} color={!!editingClass ? Colors[colorScheme].icon : Colors[colorScheme].text} />
                            </TouchableOpacity>
                            {formData.tipoInscripcion === 'libre' ? (
                                <>
                                    <ThemedText style={styles.inputLabel}>Fecha</ThemedText>
                                {renderDateField('Fecha', 'fecha', formData.fecha, (date) => handleFormChange('fecha', format(date, 'yyyy-MM-dd')))}
                                    <ThemedText style={styles.inputLabel}>Hora de Inicio</ThemedText>
                                    <TextInput style={styles.input} placeholder="HH:MM" value={formData.horaInicio} onChangeText={text => handleTimeInputChange(text, 'horaInicio', setFormData)} keyboardType="numeric" maxLength={5} />
                                    <ThemedText style={styles.inputLabel}>Hora de Fin</ThemedText>
                                    <TextInput style={styles.input} placeholder="HH:MM" value={formData.horaFin} onChangeText={text => handleTimeInputChange(text, 'horaFin', setFormData)} keyboardType="numeric" maxLength={5} />
                                </>
                            ) : (
                                <>
                                    <ThemedText style={styles.inputLabel}>Generar desde</ThemedText>
                                {renderDateField('Fecha Inicio', 'fechaInicio', formData.fechaInicio, (date) => handleFormChange('fechaInicio', format(date, 'yyyy-MM-dd')))}
                                <ThemedText style={styles.inputLabel}>Generar hasta</ThemedText>
                                {renderDateField('Fecha Fin', 'fechaFin', formData.fechaFin, (date) => handleFormChange('fechaFin', format(date, 'yyyy-MM-dd')))}
                                    <ThemedText style={styles.inputLabel}>Hora Inicio</ThemedText>
                                    <TextInput style={styles.input} placeholder="HH:MM" value={formData.horaInicio} onChangeText={text => handleTimeInputChange(text, 'horaInicio', setFormData)} keyboardType="numeric" maxLength={5} />
                                        <ThemedText style={styles.inputLabel}>Hora Fin</ThemedText>
                                    <TextInput style={styles.input} placeholder="HH:MM" value={formData.horaFin} onChangeText={text => handleTimeInputChange(text, 'horaFin', setFormData)} keyboardType="numeric" maxLength={5} />
                                    <ThemedText style={styles.inputLabel}>Días de la Semana</ThemedText>
                                    <View style={styles.weekDayContainer}>
                                        {daysOfWeekOptions.map(day => (
                                            <TouchableOpacity key={day} onPress={() => handleDaySelection(day)} style={[styles.dayChip, formData.diaDeSemana.includes(day) && styles.dayChipSelected]}>
                                                <Text style={formData.diaDeSemana.includes(day) ? styles.dayChipTextSelected : styles.dayChipText}>{day.substring(0, 3)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                            <View style={styles.modalActions}><View style={styles.buttonWrapper}><Button title={editingClass ? 'Actualizar' : 'Guardar'} onPress={handleFormSubmit} color={gymColor || '#1a5276'} /></View></View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            )}

            {showRosterModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowRosterModal(false)}>
                    <Pressable style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowRosterModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ThemedText style={styles.modalTitle}>Inscriptos en {viewingClassRoster?.nombre}</ThemedText>
                        <FlatList
                            data={viewingClassRoster?.usuariosInscritos || []}
                            keyExtractor={item => item._id || Math.random().toString()}
                            renderItem={({item}) => item ? (
                            <View style={styles.rosterItem}>

                            <Text style={styles.rosterText}>{item.nombre} {item.apellido}</Text>

                             <Text style={styles.rosterSubtext}>DNI: {item.dni}</Text>

                             <Text style={styles.rosterSubtext}>Teléfono: {item.numeroTelefono}</Text>

                             <Text style={styles.rosterSubtext}>Teléfono de Emergencia: {item.telefonoEmergencia}</Text>

                             <Text style={styles.rosterSubtext}>Obra Social: {item.obraSocial}</Text>
                            </View>) : null}
                            ListEmptyComponent={<Text style={styles.placeholderText}>No hay nadie inscripto.</Text>}
                            style={{width: '100%'}}
                        />
                    </Pressable>
                </Pressable>
            )}

            {showCancelModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowCancelModal(false)}>
                    <Pressable style={[styles.modalView, styles.confirmationModal]}>
                        <TouchableOpacity onPress={() => setShowCancelModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ThemedText style={styles.modalTitle}>Confirmar Cancelación</ThemedText>
                        <ThemedText>¿Deseas devolver los créditos a los usuarios inscritos?</ThemedText>
                        <View style={styles.modalActions}>
                            <View style={styles.buttonWrapper}><Button title="Sí, con reembolso" onPress={() => confirmCancelClass(true)} color={'#005013ff'} /></View>
                            <View style={styles.buttonWrapper}><Button title="No, sin reembolso" onPress={() => confirmCancelClass(false)} color={'#500000ff'} /></View>
                        </View>
                    </Pressable>
                </Pressable>
            )}
            
            {showBulkEditModal && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper} keyboardVerticalOffset={70}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowBulkEditModal(false)}>
                    <Pressable style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowBulkEditModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <ThemedText style={styles.modalTitle}>Editar Grupo: {editingGroup?.nombre}</ThemedText>
                            <ThemedText style={styles.inputLabel}>Nuevo Horario de Inicio:</ThemedText>
                            <TextInput style={styles.input} value={bulkUpdates.horaInicio} onChangeText={text => handleTimeInputChange(text, 'horaInicio', setBulkUpdates)} keyboardType="numeric" maxLength={5} />
                            <ThemedText style={styles.inputLabel}>Nuevo Horario de Fin:</ThemedText>
                            <TextInput style={styles.input} value={bulkUpdates.horaFin} onChangeText={text => handleTimeInputChange(text, 'horaFin', setBulkUpdates)} keyboardType="numeric" maxLength={5} />
                            <ThemedText style={styles.inputLabel}>Capacidad:</ThemedText>
                            <TextInput style={styles.input} keyboardType="numeric" value={bulkUpdates.capacidad} onChangeText={text => setBulkUpdates(p => ({...p, capacidad: text}))} />
                            <ThemedText style={styles.inputLabel}>A cargo de:</ThemedText>
                            <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('bulkEditTeacher')}>
                                <ThemedText style={styles.filterButtonText}>{bulkUpdates.profesor ? getDisplayName(bulkUpdates.profesor, 'teacher') : '-- No cambiar --'}</ThemedText>
                                <FontAwesome6 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                            <ThemedText style={styles.inputLabel}>Nuevos Días de la Semana:</ThemedText>
                            <View style={styles.weekDayContainer}>
                                {daysOfWeekOptions.map(day => (
                                    <TouchableOpacity key={day} onPress={() => handleBulkDaySelection(day)} style={[styles.dayChip, bulkUpdates.diasDeSemana.includes(day) && styles.dayChipSelected]}>
                                        <Text style={bulkUpdates.diasDeSemana.includes(day) ? styles.dayChipTextSelected : styles.dayChipText}>{day.substring(0,3)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.modalActions}><View style={styles.buttonWrapper}><Button title="Guardar Cambios" onPress={handleBulkUpdate} color={gymColor || '#1a5276'} /></View></View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            )}

            {showExtendModal && (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper} keyboardVerticalOffset={70}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowExtendModal(false)}>
                    <Pressable style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowExtendModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <ThemedText style={styles.modalTitle}>Extender Turnos de {extendingGroup?.nombre}</ThemedText>
                            <ThemedText style={styles.inputLabel}>Extender hasta:</ThemedText>
                            {Platform.OS === 'web' ? (
                                <DatePicker
                                    selected={extendUntilDate && isValid(parseISO(extendUntilDate)) ? parseISO(extendUntilDate) : null}
                                    onChange={(date) => setExtendUntilDate(format(date, 'yyyy-MM-dd'))}
                                    dateFormat="yyyy-MM-dd"
                                    customInput={<View style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{extendUntilDate || 'Seleccionar fecha...'}</Text></View>}
                                />
                            ) : (
                                <TouchableOpacity onPress={() => showDatePickerForField('extendUntilDate')}>
                                    <View style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{extendUntilDate || 'Seleccionar fecha...'}</Text></View>
                                </TouchableOpacity>
                            )}
                            <View style={styles.modalActions}><View style={styles.buttonWrapper}><Button title="Confirmar Extensión" onPress={() => handleExtendSubmit()} color={gymColor || '#1a5276'} /></View></View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            )}

            {Platform.OS !== 'web' && showDatePicker && (
                <DateTimePicker
                    value={
                        (dateFieldToEdit && formData[dateFieldToEdit] && parseISO(formData[dateFieldToEdit])) ||
                        (extendUntilDate && parseISO(extendUntilDate)) ||
                        new Date()
                    }
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    themeVariant={colorScheme}
                />
            )}

            {getModalConfig && (
                <FilterModal
                    visible={!!activeModal}
                    onClose={() => setActiveModal(null)}
                    onSelect={(id) => {
                        getModalConfig.onSelect(id);
                        setActiveModal(null);
                    }}
                    title={getModalConfig.title}
                    options={getModalConfig.options}
                    selectedValue={getModalConfig.selectedValue}
                    theme={{ colors: Colors[colorScheme], gymColor }}
                />
            )}

            {showDatePicker && (
                <DateTimePicker
                  value={
                        (dateFieldToEdit && formData[dateFieldToEdit] && new Date(formData[dateFieldToEdit].replace(/-/g, '/'))) ||
                        (extendUntilDate && new Date(extendUntilDate.replace(/-/g, '/'))) ||
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
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    placeholderText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7, paddingHorizontal: 20, color: Colors[colorScheme].text },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, padding: 15, marginVertical: 8, marginHorizontal: 15, elevation: 3 },
    expiringCard: { borderColor: '#f0ad4e', borderWidth: 2 },
    cancelledCard: { backgroundColor: Colors[colorScheme].cardBackground, opacity: 0.7 },
    actionsContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 10 },
    cancelledText: { color: Colors[colorScheme].text, fontSize: 16, fontWeight: 'bold', marginRight: 'auto' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 16, color: gymColor, marginBottom: 10 },
    cardInfo: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.8, marginBottom: 4 },
    actionButton: { padding: 8, marginLeft: 15 },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', left: 20, bottom: 20, backgroundColor: gymColor ||'#1a5276', borderRadius: 30, elevation: 8 },
    modalOverlayWrapper: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
    modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', width: '100%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    modalContent: { paddingBottom: 40 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 25, textAlign: 'center', paddingTop: 10, color: Colors[colorScheme].text },
    modalActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 30, gap: 15 },
    confirmationModal: { height: 'auto', width: '90%', borderRadius: 12, padding: 25, alignItems: "center", elevation: 5, justifyContent: 'center' },
    inputLabel: { fontSize: 16, marginBottom: 8, color: Colors[colorScheme].text, opacity: 0.9, fontWeight: '500', marginTop: 15 },
    input: { height: 50, backgroundColor: Colors[colorScheme].cardBackground, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, color: Colors[colorScheme].text, fontSize: 16, marginTop:10 },
    dateInputTouchable: { height: 50, backgroundColor: Colors[colorScheme].cardBackground, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 20, justifyContent: 'center' },
    dateInputText: { fontSize: 16, color: Colors[colorScheme].text },
    weekDayContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 },
    dayChip: { paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, borderWidth: 1.5, borderColor: Colors[colorScheme].border, margin: 4 },
    dayChipSelected: { backgroundColor: gymColor || '#1a5276' },
    dayChipText: { color :Colors[colorScheme].text, fontSize: 14 },
    dayChipTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
    rosterItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    rosterText: { fontSize: 16, color: Colors[colorScheme].text },
    rosterSubtext: { fontSize: 12, color: Colors[colorScheme].icon },
    dayManagementContainer: { flex: 1, alignItems: 'center', padding: 20 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
    dayActions: { marginTop: 20, width: '100%', gap: 15 },
    buttonWrapper: { borderRadius: 8, overflow: 'hidden', marginTop: 10 },
    filterButton:{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        height: 50, 
        borderColor: Colors[colorScheme].border, 
        borderWidth: 1, 
        borderRadius: 8, 
        paddingHorizontal: 15,  
        backgroundColor: Colors[colorScheme].cardBackground, 
        color: Colors[colorScheme].text, 
        fontSize: 16 
    },
    filterButtonText: { fontSize: 16, color: Colors[colorScheme].text },
    disabledText: { color: Colors[colorScheme].icon },
     iosPickerOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    iosPickerContainer: {
        backgroundColor: Colors[colorScheme].background,
        borderTopRightRadius: 20,
        borderTopLeftRadius: 20,
        padding: 20,
    },
});

export default ManageClassesScreen;
