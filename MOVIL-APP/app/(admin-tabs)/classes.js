import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    useColorScheme,
    Pressable,
    TextInput,
    Platform, 
    RefreshControl,
    useWindowDimensions,
    KeyboardAvoidingView,
    Modal,
    Keyboard,
} from 'react-native';
import { useCachedFocusEffect } from '@/hooks/useCachedFocusEffect';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome6, Octicons, FontAwesome5 } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO, isBefore, startOfDay, addMonths, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';
import SheetDatePicker from '@/components/SheetDatePicker';
import ClassCard from '@/components/ClassCard';
import { TabView, TabBar } from 'react-native-tab-view';

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
        { key: 'day-management', title: 'Gestión Día' },
    ]);


    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [classes, setClasses] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  
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
    const [allUsers, setAllUsers] = useState([]);
    const [viewingClassRoster, setViewingClassRoster] = useState(null);
    const [rosterSearchTerm, setRosterSearchTerm] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [classToCancel, setClassToCancel] = useState(null);
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [bulkUpdates, setBulkUpdates] = useState({ profesores: [], horaInicio: '', horaFin: '', diasDeSemana: [] });
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendingGroup, setExtendingGroup] = useState(null);
    const [extendUntilDate, setExtendUntilDate] = useState('');
    const [dayToManage, setDayToManage] = useState(new Date());

    const [activeModal, setActiveModal] = useState(null);
    const [datePickerConfig, setDatePickerConfig] = useState({
        visible: false,
        field: null,
        currentValue: new Date(),
    });
    const datePickerCallbackRef = useRef(null);

    const [formData, setFormData] = useState({
        tipoClase: '',
        nombre: '',
        fecha: '',
        horaInicio: '',
        horaFin: '',
        capacidad: '10',
        profesores: [],
        tipoInscripcion: 'libre',
        diaDeSemana: [],
        fechaInicio: '',
        fechaFin: '',
        sucursal: '',
    });


    const daysOfWeekOptions = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const [searchTerm, setSearchTerm] = useState('');

    const fetchAllData = useCallback(async ({ bustCache = false } = {}) => {
        try {
            const cacheBuster = bustCache ? `?t=${new Date().getTime()}` : '';
            const [classesRes, teachersRes, usersRes, typesRes, sucursalesRes] = await Promise.all([
                apiClient.get(`/classes/admin${cacheBuster}`),
                apiClient.get('/users?role=profesor'),
                apiClient.get('/users'),
                apiClient.get('/tipos-clase?forCreation=true'),
                apiClient.get('/sucursales').catch(() => ({ data: [] }))
            ]);
            setClasses(classesRes?.data || []);
            setTeachers(teachersRes?.data || []);
            setAllUsers(usersRes?.data || []);
            setSucursales(sucursalesRes?.data || []);
            const filteredTypes = (typesRes.data.tiposClase || []).filter(type => !type.esUniversal);
            setClassTypes(filteredTypes);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos de gestión de turnos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    }, []);

    const { refresh } = useCachedFocusEffect(
        async ({ isInitial }) => {
            if (isInitial) setLoading(true);
            try {
                await fetchAllData();
            } finally {
                if (isInitial) setLoading(false);
            }
        },
        { ttlMs: 45_000 }
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchAllData({ bustCache: true });
        setIsRefreshing(false);
    }, [fetchAllData]);

    const handleFormChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- NUEVO: Manejador para selección múltiple de profesores ---
    const handleProfessorSelection = (teacherId) => {
        const currentTeachers = formData.profesores || [];
        const newTeachers = currentTeachers.includes(teacherId)
            ? currentTeachers.filter(id => id !== teacherId)
            : [...currentTeachers, teacherId];
        handleFormChange('profesores', newTeachers);
    };

    // --- NUEVO: Manejador para selección múltiple en edición masiva ---
    const handleBulkProfessorSelection = (teacherId) => {
        const currentTeachers = bulkUpdates.profesores || [];
        const newTeachers = currentTeachers.includes(teacherId)
            ? currentTeachers.filter(id => id !== teacherId)
            : [...currentTeachers, teacherId];
        setBulkUpdates(p => ({ ...p, profesores: newTeachers }));
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

        let profesoresIds = [];
        if (classItem.profesores && classItem.profesores.length > 0) {
            profesoresIds = classItem.profesores.map(p => p._id);
        } else if (classItem.profesor) {
            profesoresIds = [classItem.profesor._id];
        }

        setFormData({
            tipoClase: classItem.tipoClase?._id || '',
            nombre: classItem.nombre,
            fecha: dateString,
            horaInicio: classItem.horaInicio,
            horaFin: classItem.horaFin,
            capacidad: classItem.capacidad.toString(),
            profesores: profesoresIds,
            tipoInscripcion: classItem.tipoInscripcion,
            diaDeSemana: classItem.diaDeSemana || [],
            fechaInicio: '',
            fechaFin: '',
            sucursal: classItem.sucursal?._id || classItem.sucursal || (sucursales.length > 0 ? sucursales[0]._id : ''),
        });
        setShowAddModal(true);
    };

    const handleDeleteClass = (classItem) => {
        setAlertInfo({
            visible: true,
            title: "Eliminar Turno ",
            message: `¿Eliminar el turno de "${classItem.nombre}"? Se reembolsará créditos automáticamente y notificará a los usuarios.`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Eliminar",
                    style: "destructive", // Estilo rojo para peligro
                    onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.delete(`/classes/${classItem._id}`);
                            
                            setAlertInfo({ 
                                visible: true, 
                                title: 'Éxito', 
                                message: 'El turno ha sido eliminado correctamente.', 
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] 
                            });
                            
                            // Recargar los datos para que desaparezca de la lista
                            fetchAllData(); 
                        } catch (error) {
                            setAlertInfo({ 
                                visible: true, 
                                title: 'Error', 
                                message: error.response?.data?.message || 'No se pudo eliminar el turno.', 
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] 
                            });
                        }
                    }
                }
            ]
        });
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
            setRosterSearchTerm('');
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo obtener la lista de inscriptos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const usersNotInClass = useMemo(() => {
        if (!viewingClassRoster || !rosterSearchTerm) {
            return []; 
        }
        const lowercasedSearch = rosterSearchTerm.toLowerCase();
        return allUsers.filter(u => 
            u.roles.includes('cliente') &&
            !viewingClassRoster.usuariosInscritos.some(inscribed => inscribed._id === u._id) &&
            (`${u.nombre} ${u.apellido}`.toLowerCase().includes(lowercasedSearch) || u.dni.includes(rosterSearchTerm))
        );
    }, [allUsers, viewingClassRoster, rosterSearchTerm]);

    const handleAddUser = async (classId, userToAdd) => {
        try {
            await apiClient.post(`/classes/${classId}/add-user`, { userId: userToAdd._id });
            
            setViewingClassRoster(prevRoster => ({
                ...prevRoster,
                usuariosInscritos: [...prevRoster.usuariosInscritos, userToAdd]
            }));
            
            setRosterSearchTerm('');

            fetchAllData();

        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo añadir al usuario.' });
        }
    };
    
    const handleRemoveUser = async (classId, userToRemove) => {
        try {
            await apiClient.post(`/classes/${classId}/remove-user`, { userId: userToRemove._id });

            setViewingClassRoster(prevRoster => ({
                ...prevRoster,
                usuariosInscritos: prevRoster.usuariosInscritos.filter(user => user._id !== userToRemove._id)
            }));

            fetchAllData();

        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar al usuario.' });
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
  
    const closeDatePicker = useCallback(() => {
        setDatePickerConfig((prev) => ({ ...prev, visible: false }));
        datePickerCallbackRef.current = null;
    }, []);

    const showDatePickerFor = useCallback((field, initialDate, onConfirmCallback) => {
        Keyboard.dismiss();
        const seed = initialDate instanceof Date && isValid(initialDate) ? initialDate : new Date();
        datePickerCallbackRef.current = onConfirmCallback;
        setDatePickerConfig({
            visible: true,
            field,
            currentValue: seed,
        });
    }, []);

    const confirmSheetDate = useCallback((date) => {
        const cb = datePickerCallbackRef.current;
        closeDatePicker();
        if (date instanceof Date && isValid(date)) {
            cb?.(date);
        }
    }, [closeDatePicker]);

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


    const getModalConfig = useMemo(() => {
        const classTypeOptions = [{ _id: 'all', nombre: 'Todos los Tipos' }, ...classTypes];
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
            case 'formSucursal':
                return {
                    title: 'Seleccionar Sucursal',
                    options: sucursales.map(s => ({ _id: s._id, nombre: s.nombre })),
                    onSelect: (id) => handleFormChange('sucursal', id),
                    selectedValue: formData.sucursal,
                };
            case 'bulkSucursal':
                return {
                    title: 'Seleccionar Sucursal para Grupo',
                    options: sucursales.map(s => ({ _id: s._id, nombre: s.nombre })),
                    onSelect: (id) => setBulkUpdates(p => ({ ...p, sucursal: id })),
                    selectedValue: bulkUpdates.sucursal,
                };
            case 'formInscriptionType':
                return {
                    title: 'Seleccionar Tipo de Inscripción',
                    options: inscriptionTypeOptions,
                    onSelect: (id) => handleFormChange('tipoInscripcion', id),
                    selectedValue: formData.tipoInscripcion,
                };
            default:
                return null;
        }
    }, [activeModal, classTypes, teachers, formData.tipoClase, formData.profesor, formData.tipoInscripcion, formData.sucursal, selectedRecurrentClassTypeFilter, bulkUpdates.profesor, bulkUpdates.sucursal, sucursales]);



    const getDisplayName = (id, type) => {
        if (type === 'classType') return classTypes.find(t => t._id === id)?.nombre || '-- Seleccionar --';
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


    const filteredClasses = useMemo(() => {
        if (!searchTerm) {
            return classesForSelectedDate; 
        }

        const lowercasedTerm = searchTerm.toLowerCase();
        return classesForSelectedDate.filter(cls => {
            const className = cls.nombre?.toLowerCase() || '';
            const typeName = cls.tipoClase?.nombre?.toLowerCase() || '';
            
            // Lógica para buscar en el array de profesores
            const professorsNames = cls.profesores 
                ? cls.profesores.map(p => `${p.nombre} ${p.apellido}`.toLowerCase()).join(' ') 
                : '';
            const oldProfessorName = cls.profesor ? `${cls.profesor.nombre} ${cls.profesor.apellido}`.toLowerCase() : '';

            return className.includes(lowercasedTerm) ||
                   typeName.includes(lowercasedTerm) ||
                   professorsNames.includes(lowercasedTerm) ||
                   oldProfessorName.includes(lowercasedTerm);
        });
    }, [classesForSelectedDate, searchTerm]);

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
                    capacidad: cls.capacidad,
                    profesor: cls.profesor,
                    profesores: cls.profesores,
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

    const renderCardAction = (label, icon, color, onPress, iconSet = 'ionicons') => (
        <TouchableOpacity
            key={label}
            style={[styles.cardActionChip, { backgroundColor: color + '18', borderColor: color + '33' }]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            {iconSet === 'fa6' ? (
                <FontAwesome6 name={icon} size={14} color={color} />
            ) : iconSet === 'octicons' ? (
                <Octicons name={icon} size={15} color={color} />
            ) : (
                <Ionicons name={icon} size={16} color={color} />
            )}
            <Text style={[styles.cardActionChipText, { color }]} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
    );

    const renderClassItem = ({ item }) => {
        const isCancelled = item.estado === 'cancelada';
        const accent = gymColor || '#1a5276';

        const footer = isCancelled ? (
            <View style={styles.cardActionsRow}>
                {renderCardAction('Reactivar', 'refresh-circle', '#2ecc71', () => handleReactivateClass(item))}
                {renderCardAction('Eliminar', 'trash', Colors[colorScheme].text, () => handleDeleteClass(item), 'octicons')}
            </View>
        ) : (
            <View style={styles.cardActionsRow}>
                {renderCardAction('Inscriptos', 'people', accent, () => handleViewRoster(item._id))}
                {renderCardAction('Editar', 'edit', accent, () => handleEdit(item), 'fa6')}
                {renderCardAction('Cancelar', 'close-circle', '#e74c3c', () => handleCancelClass(item))}
                {renderCardAction('Eliminar', 'trash', Colors[colorScheme].text, () => handleDeleteClass(item), 'octicons')}
            </View>
        );

        return (
            <ClassCard
                item={item}
                gymColor={gymColor}
                muted={isCancelled}
                badges={isCancelled ? (
                    <View style={styles.statusPillMuted}>
                        <Text style={[styles.statusPillMutedText, { color: Colors.light.error }]}>CANCELADA</Text>
                    </View>
                ) : null}
                footer={footer}
            />
        );
    };

    const handleOpenBulkEditModal = (group) => {
        setEditingGroup(group);
        let profesoresIds = [];
        if (group.profesores && group.profesores.length > 0) {
            profesoresIds = group.profesores.map(p => p._id);
        } else if (group.profesor) {
            profesoresIds = [group.profesor._id];
        }
        setBulkUpdates({
            profesores: profesoresIds,
            horaInicio: group.horaInicio,
            horaFin: group.horaFin,
            capacidad: group.capacidad ? group.capacidad.toString() : '',
            diasDeSemana: [...(group.diasDeSemana || [])],
            sucursal: group.sucursal?._id || group.sucursal || (sucursales.length > 0 ? sucursales[0]._id : '')
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

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const fechaDesdeLocal = `${year}-${month}-${day}`;


        const filters = {
            nombre: editingGroup.nombre,
            tipoClase: editingGroup.tipoClase._id,
            horaInicio: editingGroup.horaInicio,
            fechaDesde: fechaDesdeLocal,
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

    const handleCancelDay = () => {
        const dateLabel = format(dayToManage, 'dd/MM/yyyy');
        setAlertInfo({
            visible: true,
            title: 'Cancelar turnos del día',
            message: `¿Querés cancelar todos los turnos del ${dateLabel}? Elegí si se reembolsan los créditos.`,
            buttons: [
                { text: 'Volver', style: 'cancel', onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: 'Sin reembolso',
                    style: 'destructive',
                    onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.post('/classes/cancel-day', {
                                date: format(dayToManage, 'yyyy-MM-dd'),
                                refundCredits: false,
                            });
                            setAlertInfo({
                                visible: true,
                                title: 'Éxito',
                                message: 'Todos los turnos del día han sido cancelados.',
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
                            });
                            fetchAllData();
                        } catch (error) {
                            setAlertInfo({
                                visible: true,
                                title: 'Error',
                                message: error.response?.data?.message || 'No se pudo completar la operación.',
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
                            });
                        }
                    },
                },
                {
                    text: 'Con reembolso',
                    style: 'primary',
                    onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.post('/classes/cancel-day', {
                                date: format(dayToManage, 'yyyy-MM-dd'),
                                refundCredits: true,
                            });
                            setAlertInfo({
                                visible: true,
                                title: 'Éxito',
                                message: 'Todos los turnos del día han sido cancelados.',
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
                            });
                            fetchAllData();
                        } catch (error) {
                            setAlertInfo({
                                visible: true,
                                title: 'Error',
                                message: error.response?.data?.message || 'No se pudo completar la operación.',
                                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
                            });
                        }
                    },
                },
            ],
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

    const renderGroupedClassItem = ({ item }) => {
        const isExpiring = item.cantidadDeInstancias === 1;
        const accent = gymColor || '#1a5276';
        return (
            <ClassCard
                item={item}
                gymColor={gymColor}
                showCapacity={false}
                badges={isExpiring ? (
                    <View style={styles.statusPillWarn}>
                        <Text style={styles.statusPillWarnText}>ÚLTIMO</Text>
                    </View>
                ) : null}
                extraMeta={
                    <>
                        <View style={styles.metaRowInline}>
                            <Ionicons name="calendar-outline" size={14} color={Colors[colorScheme].text} style={{ opacity: 0.55, marginRight: 6 }} />
                            <Text style={styles.metaRowInlineText}>Días: {(item.diasDeSemana || []).slice().sort().join(', ')}</Text>
                        </View>
                        <View style={styles.metaRowInline}>
                            <Ionicons name="layers-outline" size={14} color={Colors[colorScheme].text} style={{ opacity: 0.55, marginRight: 6 }} />
                            <Text style={styles.metaRowInlineText}>Turnos restantes: {item.cantidadDeInstancias}</Text>
                        </View>
                    </>
                }
                footer={
                    <View style={styles.cardActionsRow}>
                        {renderCardAction('Editar', 'edit', accent, () => handleOpenBulkEditModal(item), 'fa6')}
                        {renderCardAction('Extender', 'add-circle', accent, () => handleOpenExtendModal(item))}
                        {renderCardAction('Eliminar', 'trash', '#e74c3c', () => handleBulkDelete(item), 'octicons')}
                    </View>
                }
            />
        );
    };


    const renderScene = ({ route }) => {
        switch (route.key) {
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
                            <View style={styles.searchInputContainer}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Buscar por nombre, tipo o profesor..."
                                        placeholderTextColor={Colors[colorScheme].icon}
                                        value={searchTerm}
                                        onChangeText={setSearchTerm}
                                    />
                                    <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
                                </View>
                                </>
                        }
                        data={filteredClasses}
                        renderItem={renderClassItem}
                        keyExtractor={(item) => item._id}
                        ListEmptyComponent={
                            <ThemedText style={styles.placeholderText}>
                                {searchTerm 
                                    ? 'No se encontraron turnos para tu búsqueda.'
                                    : 'No hay turnos para este día.'
                                }
                            </ThemedText>
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
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.dayMgmtContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.dayMgmtHero}>
                            <View style={[styles.dayMgmtIconWrap, { backgroundColor: (gymColor || '#1a5276') + '18' }]}>
                                <Ionicons name="calendar" size={28} color={gymColor || '#1a5276'} />
                            </View>
                            <Text style={styles.dayMgmtTitle}>Gestión por día</Text>
                            <Text style={styles.dayMgmtSubtitle}>
                                Cancelá o reactivá todos los turnos de una fecha en un solo paso.
                            </Text>
                        </View>

                        <View style={styles.dayMgmtCard}>
                            <Text style={styles.dayMgmtCardLabel}>Fecha a gestionar</Text>
                            {renderDateField(
                                'Día a gestionar',
                                'dayToManage',
                                format(dayToManage, 'yyyy-MM-dd'),
                                (date) => setDayToManage(date)
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.dayMgmtActionBtn, { backgroundColor: '#e74c3c' }]}
                            onPress={handleCancelDay}
                            activeOpacity={0.88}
                        >
                            <Ionicons name="close-circle" size={22} color="#fff" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.dayMgmtActionTitle}>Cancelar turnos del día</Text>
                                <Text style={styles.dayMgmtActionSub}>Con opción de reembolso de créditos</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dayMgmtActionBtn, { backgroundColor: '#2ecc71' }]}
                            onPress={handleReactivateDay}
                            activeOpacity={0.88}
                        >
                            <Ionicons name="refresh-circle" size={22} color="#fff" />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.dayMgmtActionTitle}>Reactivar turnos del día</Text>
                                <Text style={styles.dayMgmtActionSub}>Vuelve a habilitar los turnos cancelados</Text>
                            </View>
                        </TouchableOpacity>
                    </ScrollView>
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
                    <TabBar {...props} style={{ backgroundColor: gymColor, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, marginBottom: 8 }}
                        indicatorStyle={{ backgroundColor: '#ffffff', height: 3, }}
                        labelStyle={styles.tabLabel}
                        tabStyle={styles.tabStyle}
                    />
                )}
            />

            <TouchableOpacity style={styles.fab} onPress={() => {
                setEditingClass(null);
                setFormData({
                    tipoClase: classTypes.length > 0 ? classTypes[0]._id : '',
                    nombre: '',
                    fecha: format(new Date(), 'yyyy-MM-dd'),
                    horaInicio: '09:00',
                    horaFin: '10:00',
                    capacidad: '10',
                    profesores: teachers.length > 0 ? [teachers[0]._id] : [],
                    tipoInscripcion: 'libre',
                    diaDeSemana: [],
                    fechaInicio: format(new Date(), 'yyyy-MM-dd'),
                    fechaFin: '',
                    sucursal: sucursales.length > 0 ? sucursales[0]._id : '',
                });
                setShowAddModal(true);
            }}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
            {showAddModal && (
                <Modal
                    visible={showAddModal && !datePickerConfig.visible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowAddModal(false)}
                    statusBarTranslucent
                    presentationStyle="overFullScreen"
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <KeyboardAwareSheet
                        onDismiss={() => setShowAddModal(false)}
                        backgroundColor={Colors[colorScheme].background}
                        borderRadius={24}
                        style={[styles.addClassModalView, { maxHeight: '92%' }]}
                    >
                            {/* Header Banner */}
                            <View style={[styles.addClassHeader, { backgroundColor: gymColor || '#007bff' }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.addClassHeaderTitle}>{editingClass ? 'Editar Turno' : 'Crear Nuevo Turno'}</Text>
                                    <Text style={styles.addClassHeaderSub}>{editingClass ? 'Modifica los parámetros y profesores' : 'Programa un turno individual o recurrente'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.addClassCloseBtn}>
                                    <Ionicons name="close" size={22} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.addClassScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                {/* Sección 1: Información Principal */}
                                <View style={styles.formCard}>
                                    <View style={styles.formSectionHeader}>
                                        <Ionicons name="information-circle" size={20} color={gymColor || '#007bff'} />
                                        <ThemedText style={styles.formSectionTitle}>1. Información General</ThemedText>
                                    </View>

                                    <ThemedText style={styles.inputLabel}>Nombre del Turno</ThemedText>
                                    <TextInput style={styles.input} value={formData.nombre} onChangeText={text => handleFormChange('nombre', text)} placeholder="Ej: Crossfit Matutino" placeholderTextColor={Colors[colorScheme].icon} />

                                    <ThemedText style={styles.inputLabel}>Tipo de Turno</ThemedText>
                                    <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('formClassType')}>
                                        <ThemedText style={styles.filterButtonText}>{getDisplayName(formData.tipoClase, 'classType')}</ThemedText>
                                        <FontAwesome6 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                    </TouchableOpacity>

                                    {sucursales && sucursales.length > 0 && (
                                        <>
                                            <ThemedText style={styles.inputLabel}>Sucursal del Turno</ThemedText>
                                            <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('formSucursal')}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Ionicons name="location-outline" size={14} color={Colors[colorScheme].text} style={{ marginRight: 6 }} />
                                                    <ThemedText style={styles.filterButtonText}>
                                                        {sucursales.find(s => s._id === formData.sucursal)?.nombre || 'Todas / Sucursal 1'}
                                                    </ThemedText>
                                                </View>
                                                <FontAwesome6 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    <ThemedText style={styles.inputLabel}>Profesores a Cargo</ThemedText>
                                    <View style={styles.weekDayContainer}> 
                                        {teachers.map(teacher => (
                                            <TouchableOpacity 
                                                key={teacher._id} 
                                                onPress={() => handleProfessorSelection(teacher._id)} 
                                                style={[
                                                    styles.dayChip, 
                                                    formData.profesores && formData.profesores.includes(teacher._id) && styles.dayChipSelected
                                                ]}
                                            >
                                                <Text style={
                                                    formData.profesores && formData.profesores.includes(teacher._id) 
                                                    ? styles.dayChipTextSelected 
                                                    : styles.dayChipText
                                                }>
                                                    {teacher.nombre} {teacher.apellido}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <ThemedText style={styles.inputLabel}>Capacidad Máxima (Cupos)</ThemedText>
                                    <TextInput style={styles.input} keyboardType="numeric" value={formData.capacidad} onChangeText={text => handleFormChange('capacidad', text)} placeholder="Ej: 20" placeholderTextColor={Colors[colorScheme].icon} />
                                </View>

                                {/* Sección 2: Programación */}
                                <View style={styles.formCard}>
                                    <View style={styles.formSectionHeader}>
                                        <Ionicons name="time" size={20} color={gymColor || '#007bff'} />
                                        <ThemedText style={styles.formSectionTitle}>2. Programación y Horarios</ThemedText>
                                    </View>

                                    <ThemedText style={styles.inputLabel}>Tipo de Programación</ThemedText>
                                    <TouchableOpacity style={[styles.filterButton, !!editingClass && { opacity: 0.6 }]} onPress={() => !editingClass && setActiveModal('formInscriptionType')} disabled={!!editingClass}>
                                        <ThemedText style={[styles.filterButtonText, !!editingClass && styles.disabledText]}>{getDisplayName(formData.tipoInscripcion, 'inscription')}</ThemedText>
                                        <FontAwesome6 name="chevron-down" size={12} color={!!editingClass ? Colors[colorScheme].icon : Colors[colorScheme].text} />
                                    </TouchableOpacity>

                                    {formData.tipoInscripcion === 'libre' ? (
                                        <>
                                            <ThemedText style={styles.inputLabel}>Fecha de la Clase</ThemedText>
                                            {renderDateField('Fecha', 'fecha', formData.fecha, (date) => handleFormChange('fecha', format(date, 'yyyy-MM-dd')))}
                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={styles.inputLabel}>Hora Inicio</ThemedText>
                                                    <TextInput style={styles.input} placeholder="HH:MM" placeholderTextColor={Colors[colorScheme].icon} value={formData.horaInicio} onChangeText={text => handleTimeInputChange(text, 'horaInicio', setFormData)} keyboardType="numeric" maxLength={5} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={styles.inputLabel}>Hora Fin</ThemedText>
                                                    <TextInput style={styles.input} placeholder="HH:MM" placeholderTextColor={Colors[colorScheme].icon} value={formData.horaFin} onChangeText={text => handleTimeInputChange(text, 'horaFin', setFormData)} keyboardType="numeric" maxLength={5} />
                                                </View>
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={styles.inputLabel}>Generar desde</ThemedText>
                                                    {renderDateField('Fecha Inicio', 'fechaInicio', formData.fechaInicio, (date) => handleFormChange('fechaInicio', format(date, 'yyyy-MM-dd')))}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={styles.inputLabel}>Generar hasta</ThemedText>
                                                    {renderDateField('Fecha Fin', 'fechaFin', formData.fechaFin, (date) => handleFormChange('fechaFin', format(date, 'yyyy-MM-dd')))}
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={styles.inputLabel}>Hora Inicio</ThemedText>
                                                    <TextInput style={styles.input} placeholder="HH:MM" placeholderTextColor={Colors[colorScheme].icon} value={formData.horaInicio} onChangeText={text => handleTimeInputChange(text, 'horaInicio', setFormData)} keyboardType="numeric" maxLength={5} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={styles.inputLabel}>Hora Fin</ThemedText>
                                                    <TextInput style={styles.input} placeholder="HH:MM" placeholderTextColor={Colors[colorScheme].icon} value={formData.horaFin} onChangeText={text => handleTimeInputChange(text, 'horaFin', setFormData)} keyboardType="numeric" maxLength={5} />
                                                </View>
                                            </View>
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
                                </View>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={[styles.submitActionBtn, { backgroundColor: gymColor || '#1a5276' }]} onPress={handleFormSubmit} activeOpacity={0.85}>
                                        <Ionicons name={editingClass ? "checkmark-circle-outline" : "add-circle-outline"} size={22} color="#fff" />
                                        <Text style={styles.submitActionBtnText}>{editingClass ? 'Actualizar Turno' : 'Crear Turno'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                    </KeyboardAwareSheet>
                    {['formClassType', 'formSucursal', 'formInscriptionType'].includes(activeModal) && getModalConfig && (
                        <FilterModal
                            embedded
                            visible
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
                    <CustomAlert
                        inline
                        visible={alertInfo.visible}
                        title={alertInfo.title}
                        message={alertInfo.message}
                        buttons={alertInfo.buttons}
                        onClose={() => setAlertInfo((prev) => ({ ...prev, visible: false }))}
                        gymColor={gymColor}
                    />
                    </View>
                </Modal>
            )}

           {showRosterModal && viewingClassRoster && (
                <Modal
                    visible={showRosterModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowRosterModal(false)}
                    statusBarTranslucent
                    presentationStyle="overFullScreen"
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <KeyboardAwareSheet
                            onDismiss={() => setShowRosterModal(false)}
                            backgroundColor={Colors[colorScheme].background}
                            style={{ maxHeight: '90%' }}
                        >
                            <View style={[styles.addClassHeader, { backgroundColor: gymColor || '#1a5276' }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.addClassHeaderTitle}>Gestionar Inscriptos</Text>
                                    <Text style={styles.addClassHeaderSub}>
                                        {viewingClassRoster.nombre} · {viewingClassRoster.horaInicio}–{viewingClassRoster.horaFin}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowRosterModal(false)} style={styles.addClassCloseBtn}>
                                    <Ionicons name="close" size={22} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                contentContainerStyle={styles.addClassScrollContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={styles.rosterSection}>
                                    <View style={styles.rosterSectionHeader}>
                                        <Text style={styles.rosterSectionTitle}>Inscriptos</Text>
                                        <View style={[styles.rosterCountPill, { backgroundColor: (gymColor || '#1a5276') + '18' }]}>
                                            <Text style={[styles.rosterCountText, { color: gymColor || '#1a5276' }]}>
                                                {(viewingClassRoster.usuariosInscritos || []).length}/{viewingClassRoster.capacidad}
                                            </Text>
                                        </View>
                                    </View>

                                    {(viewingClassRoster.usuariosInscritos || []).length === 0 ? (
                                        <Text style={styles.rosterEmpty}>Nadie inscrito en este turno.</Text>
                                    ) : (
                                        (viewingClassRoster.usuariosInscritos || []).map((user) => (
                                            <View key={user._id} style={styles.rosterRow}>
                                                <View style={[styles.rosterAvatar, { backgroundColor: (gymColor || '#1a5276') + '22' }]}>
                                                    <Text style={[styles.rosterAvatarText, { color: gymColor || '#1a5276' }]}>
                                                        {(user.nombre?.[0] || '').toUpperCase()}{(user.apellido?.[0] || '').toUpperCase()}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.rosterName}>{user.nombre} {user.apellido}</Text>
                                                    <Text style={styles.rosterDni}>DNI {user.dni || '—'}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={styles.rosterIconBtn}
                                                    onPress={() => handleRemoveUser(viewingClassRoster._id, user)}
                                                >
                                                    <Ionicons name="remove-circle" size={26} color="#e74c3c" />
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}
                                </View>

                                <View style={styles.rosterSection}>
                                    <Text style={styles.rosterSectionTitle}>Añadir socio</Text>
                                    <View style={styles.rosterSearchWrap}>
                                        <Ionicons name="search" size={16} color={Colors[colorScheme].icon} style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={styles.rosterSearchInput}
                                            placeholder="Buscar por nombre o DNI..."
                                            placeholderTextColor={Colors[colorScheme].icon}
                                            value={rosterSearchTerm}
                                            onChangeText={setRosterSearchTerm}
                                        />
                                    </View>
                                    {rosterSearchTerm.length > 0 && usersNotInClass.length === 0 && (
                                        <Text style={styles.rosterEmpty}>Sin resultados.</Text>
                                    )}
                                    {usersNotInClass.map((user) => (
                                        <View key={user._id} style={styles.rosterRow}>
                                            <View style={[styles.rosterAvatar, { backgroundColor: '#2ecc7122' }]}>
                                                <Text style={[styles.rosterAvatarText, { color: '#2ecc71' }]}>
                                                    {(user.nombre?.[0] || '').toUpperCase()}{(user.apellido?.[0] || '').toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.rosterName}>{user.nombre} {user.apellido}</Text>
                                                <Text style={styles.rosterDni}>DNI {user.dni || '—'}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.rosterIconBtn}
                                                onPress={() => handleAddUser(viewingClassRoster._id, user)}
                                            >
                                                <Ionicons name="add-circle" size={26} color="#2ecc71" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </KeyboardAwareSheet>
                    </View>
                </Modal>
            )}

            {showCancelModal && classToCancel && (
                <Modal
                    visible={showCancelModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowCancelModal(false)}
                    statusBarTranslucent
                    presentationStyle="overFullScreen"
                >
                    <Pressable style={styles.cancelOverlay} onPress={() => setShowCancelModal(false)}>
                        <Pressable style={styles.cancelCard} onPress={(e) => e.stopPropagation?.()}>
                            <View style={styles.cancelIconWrap}>
                                <Ionicons name="warning" size={28} color="#e74c3c" />
                            </View>
                            <Text style={styles.cancelTitle}>Confirmar cancelación</Text>
                            <Text style={styles.cancelMessage}>
                                ¿Querés cancelar “{classToCancel.nombre}” ({classToCancel.horaInicio}hs)? Elegí si se reembolsan los créditos a los inscriptos.
                            </Text>
                            <TouchableOpacity
                                style={[styles.cancelChoiceBtn, { backgroundColor: '#2ecc71' }]}
                                onPress={() => confirmCancelClass(true)}
                                activeOpacity={0.88}
                            >
                                <Ionicons name="cash-outline" size={18} color="#fff" />
                                <Text style={styles.cancelChoiceText}>Sí, reembolsar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.cancelChoiceBtn, { backgroundColor: '#e74c3c' }]}
                                onPress={() => confirmCancelClass(false)}
                                activeOpacity={0.88}
                            >
                                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                                <Text style={styles.cancelChoiceText}>No reembolsar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cancelDismissBtn}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <Text style={styles.cancelDismissText}>Volver</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}
            
            {showBulkEditModal && (
                <Modal
                    visible={showBulkEditModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowBulkEditModal(false)}
                    statusBarTranslucent
                    presentationStyle="overFullScreen"
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <KeyboardAwareSheet
                            onDismiss={() => setShowBulkEditModal(false)}
                            backgroundColor={Colors[colorScheme].background}
                            style={{ maxHeight: '92%' }}
                        >
                            <View style={[styles.addClassHeader, { backgroundColor: gymColor || '#1a5276' }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.addClassHeaderTitle}>Editar Grupo Recurrente</Text>
                                    <Text style={styles.addClassHeaderSub}>{editingGroup?.nombre}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowBulkEditModal(false)} style={styles.addClassCloseBtn}>
                                    <Ionicons name="close" size={22} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView
                                contentContainerStyle={styles.addClassScrollContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                <ThemedText style={styles.inputLabel}>Nuevo Horario de Inicio:</ThemedText>
                                <TextInput style={styles.input} value={bulkUpdates.horaInicio} onChangeText={text => handleTimeInputChange(text, 'horaInicio', setBulkUpdates)} keyboardType="numeric" maxLength={5} />
                                <ThemedText style={styles.inputLabel}>Nuevo Horario de Fin:</ThemedText>
                                <TextInput style={styles.input} value={bulkUpdates.horaFin} onChangeText={text => handleTimeInputChange(text, 'horaFin', setBulkUpdates)} keyboardType="numeric" maxLength={5} />
                                <ThemedText style={styles.inputLabel}>Capacidad:</ThemedText>
                                <TextInput style={styles.input} keyboardType="numeric" value={bulkUpdates.capacidad} onChangeText={text => setBulkUpdates(p => ({...p, capacidad: text}))} />
                                {sucursales && sucursales.length > 0 && (
                                    <>
                                        <ThemedText style={styles.inputLabel}>Sucursal del Grupo:</ThemedText>
                                        <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('bulkSucursal')}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="location-outline" size={14} color={Colors[colorScheme].text} style={{ marginRight: 6 }} />
                                                <ThemedText style={styles.filterButtonText}>
                                                    {sucursales.find(s => s._id === bulkUpdates.sucursal)?.nombre || 'Seleccionar Sucursal'}
                                                </ThemedText>
                                            </View>
                                            <FontAwesome6 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                        </TouchableOpacity>
                                    </>
                                )}
                                <ThemedText style={styles.inputLabel}>A cargo de (Seleccionar para cambiar)</ThemedText>
                                <View style={styles.weekDayContainer}>
                                    {teachers.map(teacher => (
                                        <TouchableOpacity
                                            key={teacher._id}
                                            onPress={() => handleBulkProfessorSelection(teacher._id)}
                                            style={[
                                                styles.dayChip,
                                                bulkUpdates.profesores && bulkUpdates.profesores.includes(teacher._id) && styles.dayChipSelected
                                            ]}
                                        >
                                            <Text style={
                                                bulkUpdates.profesores && bulkUpdates.profesores.includes(teacher._id)
                                                    ? styles.dayChipTextSelected
                                                    : styles.dayChipText
                                            }>
                                                {teacher.nombre} {teacher.apellido}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <ThemedText style={styles.inputLabel}>Nuevos Días de la Semana:</ThemedText>
                                <View style={styles.weekDayContainer}>
                                    {daysOfWeekOptions.map(day => (
                                        <TouchableOpacity key={day} onPress={() => handleBulkDaySelection(day)} style={[styles.dayChip, bulkUpdates.diasDeSemana.includes(day) && styles.dayChipSelected]}>
                                            <Text style={bulkUpdates.diasDeSemana.includes(day) ? styles.dayChipTextSelected : styles.dayChipText}>{day.substring(0,3)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <View style={[styles.modalActions, { marginTop: 20 }]}>
                                    <TouchableOpacity style={[styles.submitActionBtn, { backgroundColor: gymColor || '#1a5276' }]} onPress={handleBulkUpdate}>
                                        <FontAwesome6 name="save" size={18} color="#fff" />
                                        <Text style={styles.submitActionBtnText}>Guardar Cambios</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </KeyboardAwareSheet>
                    </View>
                </Modal>
            )}

            {showExtendModal && (
                <Modal
                    visible={showExtendModal && !datePickerConfig.visible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowExtendModal(false)}
                    statusBarTranslucent
                    presentationStyle="overFullScreen"
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <KeyboardAwareSheet
                            onDismiss={() => setShowExtendModal(false)}
                            backgroundColor={Colors[colorScheme].background}
                            style={{ maxHeight: '70%' }}
                        >
                            <View style={[styles.addClassHeader, { backgroundColor: gymColor || '#1a5276' }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.addClassHeaderTitle}>Extender Turnos Recurrentes</Text>
                                    <Text style={styles.addClassHeaderSub}>{extendingGroup?.nombre}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowExtendModal(false)} style={styles.addClassCloseBtn}>
                                    <Ionicons name="close" size={22} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView
                                contentContainerStyle={styles.addClassScrollContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                <ThemedText style={styles.inputLabel}>Extender hasta:</ThemedText>
                                {renderDateField(
                                    'Fecha de extensión',
                                    'extendUntilDate',
                                    extendUntilDate,
                                    (date) => setExtendUntilDate(format(date, 'yyyy-MM-dd'))
                                )}
                                <View style={[styles.modalActions, { marginTop: 20 }]}>
                                    <TouchableOpacity style={[styles.submitActionBtn, { backgroundColor: gymColor || '#1a5276' }]} onPress={() => handleExtendSubmit()}>
                                        <Ionicons name="calendar-outline" size={20} color="#fff" />
                                        <Text style={styles.submitActionBtnText}>Confirmar Extensión</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </KeyboardAwareSheet>
                    </View>
                </Modal>
            )}


            {getModalConfig && !['formClassType', 'formSucursal', 'formInscriptionType'].includes(activeModal) && (
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

            <SheetDatePicker
                visible={datePickerConfig.visible}
                value={datePickerConfig.currentValue}
                title="Seleccionar Fecha"
                gymColor={gymColor}
                onClose={closeDatePicker}
                onConfirm={confirmSheetDate}
            />

            {!showAddModal && (
                <CustomAlert
                    visible={alertInfo.visible}
                    title={alertInfo.title}
                    message={alertInfo.message}
                    buttons={alertInfo.buttons}
                    onClose={() => setAlertInfo((prev) => ({ ...prev, visible: false }))}
                    gymColor={gymColor}
                />
            )}
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    placeholderText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7, paddingHorizontal: 20, color: Colors[colorScheme].text },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 14, padding: 18, marginVertical: 8, marginHorizontal: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, borderWidth: 1, borderColor: Colors[colorScheme].border },
    expiringCard: { borderColor: '#f0ad4e', borderWidth: 2 },
    cancelledCard: { backgroundColor: Colors[colorScheme].cardBackground, opacity: 0.7, borderWidth: 1, borderColor: Colors[colorScheme].border},
    actionsContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 10 },
    cancelledText: { color: Colors[colorScheme].text, fontSize: 16, fontWeight: 'bold', marginRight: 'auto' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 16, color: Colors[colorScheme].text, marginBottom: 10 },
    cardInfo: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.8, marginBottom: 4 },
    actionButton: { padding: 8, marginLeft: 15 },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', left: 20, bottom: 20, backgroundColor: gymColor ||'#1a5276', borderRadius: 30, elevation: 12, zIndex: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,},
    modalOverlayWrapper: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
    modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', width: '100%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, elevation: 5 },
    addClassModalView: { maxHeight: '92%', width: '100%', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 8, overflow: 'hidden' },
    addClassHeader: { paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    addClassHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    addClassHeaderSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    addClassCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    addClassScrollContent: { padding: 18, paddingBottom: 40 },
    formCard: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors[colorScheme].border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
    formSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border, paddingBottom: 10 },
    formSectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text },
    submitActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 24, borderRadius: 14, width: '100%', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    submitActionBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    modalContent: { paddingBottom: 40 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 25, textAlign: 'center', paddingTop: 10, color: Colors[colorScheme].text },
    modalSubtitle: { fontSize: 16, marginBottom: 15, textAlign: 'center', color: Colors[colorScheme].text },
    modalActions: { width: '100%', flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 15 },
    confirmationModal: { height: 'auto', width: '90%', borderRadius: 5, padding: 25, alignItems: "center", elevation: 5, justifyContent: 'center' },
    inputLabel: { fontSize: 14, marginBottom: 6, color: Colors[colorScheme].text, opacity: 0.9, fontWeight: '600', marginTop: 12 },
    input: { height: 48, backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, color: Colors[colorScheme].text, fontSize: 15, marginTop: 4 },
    dateInputTouchable: { height: 48, backgroundColor: Colors[colorScheme].background, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, marginTop: 4, marginBottom: 10, justifyContent: 'center' },
    dateInputText: { fontSize: 15, color: Colors[colorScheme].text },
    weekDayContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, marginBottom: 10 },
    dayChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors[colorScheme].border, margin: 4, backgroundColor: Colors[colorScheme].background },
    dayChipSelected: { backgroundColor: gymColor || '#1a5276', borderColor: gymColor || '#1a5276' },
    dayChipText: { color :Colors[colorScheme].text, fontSize: 13 },
    dayChipTextSelected: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
    cardActionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    cardActionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        minWidth: '46%',
        flexGrow: 1,
    },
    cardActionChipText: {
        fontSize: 12,
        fontWeight: '800',
        flexShrink: 1,
    },
    rosterSection: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        padding: 14,
        marginBottom: 14,
    },
    rosterSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    rosterSectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors[colorScheme].text,
        marginBottom: 10,
    },
    rosterCountPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    rosterCountText: {
        fontSize: 12,
        fontWeight: '800',
    },
    rosterEmpty: {
        textAlign: 'center',
        color: Colors[colorScheme].icon,
        fontSize: 13,
        paddingVertical: 12,
    },
    rosterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors[colorScheme].border,
    },
    rosterAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rosterAvatarText: {
        fontWeight: '800',
        fontSize: 13,
    },
    rosterName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors[colorScheme].text,
    },
    rosterDni: {
        fontSize: 12,
        color: Colors[colorScheme].icon,
        marginTop: 2,
    },
    rosterIconBtn: {
        padding: 4,
    },
    rosterSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].background,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    rosterSearchInput: {
        flex: 1,
        color: Colors[colorScheme].text,
        fontSize: 15,
        paddingVertical: 0,
    },
    cancelOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    cancelCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 20,
        padding: 22,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        alignItems: 'center',
    },
    cancelIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#e74c3c22',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    cancelTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors[colorScheme].text,
        textAlign: 'center',
        marginBottom: 8,
    },
    cancelMessage: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors[colorScheme].text,
        opacity: 0.75,
        textAlign: 'center',
        marginBottom: 18,
    },
    cancelChoiceBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 10,
    },
    cancelChoiceText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },
    cancelDismissBtn: {
        paddingVertical: 10,
        marginTop: 2,
    },
    cancelDismissText: {
        color: Colors[colorScheme].icon,
        fontWeight: '700',
        fontSize: 14,
    },
    dayMgmtContent: {
        padding: 20,
        paddingBottom: 100,
    },
    dayMgmtHero: {
        alignItems: 'center',
        marginBottom: 20,
        paddingTop: 8,
    },
    dayMgmtIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    dayMgmtTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: Colors[colorScheme].text,
        marginBottom: 6,
    },
    dayMgmtSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        color: Colors[colorScheme].text,
        opacity: 0.7,
        paddingHorizontal: 12,
    },
    dayMgmtCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        padding: 16,
        marginBottom: 16,
    },
    dayMgmtCardLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors[colorScheme].text,
        opacity: 0.8,
        marginBottom: 4,
    },
    dayMgmtActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 14,
        marginBottom: 12,
    },
    dayMgmtActionTitle: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 15,
    },
    dayMgmtActionSub: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginTop: 2,
    },
    rosterItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    rosterText: { fontSize: 16, color: Colors[colorScheme].text, marginBottom: 3 },
    rosterSubtext: { fontSize: 12, color: Colors[colorScheme].icon,  marginBottom: 5 },
    dayManagementContainer: { flex: 1, alignItems: 'center', padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 20, marginTop: 10, color: Colors[colorScheme].text },
    dayActions: { marginTop: 20, width: '100%', gap: 15 },
    buttonWrapper: { borderRadius: 10, overflow: 'hidden', marginTop: 10 },
    filterButton:{ 
        marginTop: 4,
        marginBottom: 10,
        alignSelf: 'center',
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        height: 48, 
        borderColor: Colors[colorScheme].border, 
        borderWidth: 1, 
        borderRadius: 10, 
        paddingHorizontal: 14,  
        backgroundColor: Colors[colorScheme].background, 
        width: '100%',
    },
    filterButtonText: { fontSize: 16, color: Colors[colorScheme].text },
    disabledText: { color: Colors[colorScheme].icon },
     iosPickerOverlay: {
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    iosPickerContainer: {
        backgroundColor: Colors[colorScheme].background,
        borderTopRightRadius: 5,
        borderTopLeftRadius: 5,
        padding: 20,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
        marginTop: 15,
        marginBottom: 10,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    searchInput: {
        flex: 1,
        height: 50,
        paddingHorizontal: 15,
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    searchIcon: {
        marginRight: 15,
    },
    tabLabel: { fontSize: 12, fontWeight: 'bold', textTransform: 'none' }, 
    statusPillMuted: { backgroundColor: Colors[colorScheme].background, borderWidth: 1, borderColor: Colors[colorScheme].border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    statusPillMutedText: { color: Colors[colorScheme].icon, fontWeight: '800', fontSize: 10 },
    statusPillWarn: { backgroundColor: '#fff3cd', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    statusPillWarnText: { color: '#856404', fontWeight: '800', fontSize: 10 },
    metaRowInline: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    metaRowInlineText: { flexShrink: 1, fontSize: 13, color: Colors[colorScheme].text, opacity: 0.72, fontWeight: '500' },
    classItem: {
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 5,
        elevation: 2,
        backgroundColor: Colors[colorScheme].background,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,
         borderWidth: 1, borderColor: Colors[colorScheme].border
    },
    className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
    classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
    cancelledClass: { backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5', borderColor: colorScheme === 'dark' ? '#555' : '#e0e0e0', borderLeftWidth: 0, borderWidth: 1 },
    finishedClass: { opacity: 0.6 },
    
    badgeCancelled: { color: Colors.light.error, fontStyle: 'italic', fontWeight: 'bold' },
    
    emptyClass: { borderLeftWidth: 15, borderColor: '#006400', backgroundColor: colorScheme === 'dark' ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9' },
    almostEmptyClass: { borderLeftWidth: 15, borderColor: '#FFC107', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 193, 7, 0.2)' : '#fffde7' },
    almostFullClass: { borderLeftWidth: 15, borderColor: '#ff7707', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 119, 7, 0.2)' : '#fff3e0' },
    fullClass: { borderLeftWidth: 15, borderColor: '#F44336', backgroundColor: colorScheme === 'dark' ? 'rgba(244, 67, 54, 0.2)' : '#ffebee' },
    
    buttonContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 10 },
    adminActionsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' , gap: 10, alignSelf: 'flex-end' },
    iconButton: { flexDirection: 'row', marginLeft: 5 },
    cardMenuBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors[colorScheme].cardBackground, borderWidth: 1, borderColor: Colors[colorScheme].border, justifyContent: 'center', alignItems: 'center' },
    cardDropdownContainer: { marginTop: 14, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 12 },
    dropdownOptionsList: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 12, borderWidth: 1, borderColor: Colors[colorScheme].border, overflow: 'hidden' },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    dropdownItemText: { fontSize: 15, fontWeight: '500', color: Colors[colorScheme].text },                                                                                 
});

export default ManageClassesScreen;
