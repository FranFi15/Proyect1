import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet,
    FlatList,
    View,
    TextInput,
    ActivityIndicator,
    TouchableOpacity,
    useColorScheme,
    Pressable,
    Text,
    ScrollView,
    Switch,
    Button,
    Platform // Asegúrate de que Platform está importado
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome, Octicons } from '@expo/vector-icons';

// Importa el picker nativo
import DateTimePicker from '@react-native-community/datetimepicker';

// 💡 PASO 1: Importa el picker para la web y sus estilos
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { format, parseISO, isValid } from 'date-fns';
import BillingModalContent from '@/components/admin/BillingModalContent';
import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';

const ManageClientsScreen = () => {
    // ... (todo tu estado y hooks existentes se mantienen igual) ...
    const [users, setUsers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: []
    });

    const [selectedClient, setSelectedClient] = useState(null);
    const [creditsModalVisible, setCreditsModalVisible] = useState(false);
    const [billingModalVisible, setBillingModalVisible] = useState(false);
    const [showAddFormModal, setShowAddFormModal] = useState(false);
    const [showEditFormModal, setShowEditFormModal] = useState(false);


    const [planData, setPlanData] = useState({ tipoClaseId: '', creditsToAdd: '0', isSubscription: false, autoRenewAmount: '8' });
    const [massEnrollFilters, setMassEnrollFilters] = useState({ tipoClaseId: '', diasDeSemana: [], fechaInicio: '', fechaFin: '' });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [showMassEnrollDatePicker, setShowMassEnrollDatePicker] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null);


    const [newClientData, setNewClientData] = useState({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', numeroTelefono: '', obraSocial: '', roles: ['cliente'], ordenMedicaRequerida: false, ordenMedicaEntregada: false });
    const [newClientDay, setNewClientDay] = useState('');
    const [newClientMonth, setNewClientMonth] = useState('');
    const [newClientYear, setNewClientYear] = useState('');


    const [editingClientData, setEditingClientData] = useState(null);
    const [editingClientDay, setEditingClientDay] = useState('');
    const [editingClientMonth, setEditingClientMonth] = useState('');
    const [editingClientYear, setEditingClientYear] = useState('');

    const [activeModal, setActiveModal] = useState(null);

    // ... (todas tus funciones fetchAllData, handle*, etc., se mantienen igual) ...
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersResponse, classTypesResponse] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/tipos-clase')
            ]);

            const validUsers = usersResponse.data.filter(user => user !== null);
            const filteredUsers = validUsers.filter(u => u.roles.includes('cliente') || u.roles.includes('profesor'));
            setUsers(filteredUsers);
            setClassTypes(classTypesResponse.data.tiposClase || []);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar los datos.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchAllData();
        }, [fetchAllData])
    );

    useEffect(() => {
        if (newClientDay.length === 2 && newClientMonth.length === 2 && newClientYear.length === 4) {
            const dateString = `${newClientYear}-${newClientMonth.padStart(2, '0')}-${newClientDay.padStart(2, '0')}`;
            setNewClientData(prev => ({ ...prev, fechaNacimiento: dateString }));
        }
    }, [newClientDay, newClientMonth, newClientYear]);

    useEffect(() => {
        if (editingClientDay.length === 2 && editingClientMonth.length === 2 && editingClientYear.length === 4) {
            const dateString = `${editingClientYear}-${editingClientMonth.padStart(2, '0')}-${editingClientDay.padStart(2, '0')}`;
            setEditingClientData(prev => ({ ...prev, fechaNacimiento: dateString }));
        }
    }, [editingClientDay, editingClientMonth, editingClientYear]);

    const handleOpenBillingModal = (client) => {
        setSelectedClient(client);
        setBillingModalVisible(true);
    };

    const handleOpenCreditsModal = (client) => {
        setSelectedClient(client);
        setPlanData({ tipoClaseId: '', creditsToAdd: '0', isSubscription: false, autoRenewAmount: '8' });
        setMassEnrollFilters({ tipoClaseId: '', diasDeSemana: [], fechaInicio: '', fechaFin: '' });
        setAvailableSlots([]);
        setSelectedSlot(null);
        setCreditsModalVisible(true);
    };

    const handleOpenEditModal = (client) => {
        const clientRoles = Array.isArray(client.roles) && client.roles.length > 0 ? client.roles : ['cliente'];
        setEditingClientData({
            ...client,
            roles: clientRoles,
            ordenMedicaRequerida: client.ordenMedicaRequerida || false,
            ordenMedicaEntregada: client.ordenMedicaEntregada || false
        });

        if (client.fechaNacimiento && isValid(parseISO(client.fechaNacimiento))) {
            const date = parseISO(client.fechaNacimiento);
            setEditingClientDay(format(date, 'dd'));
            setEditingClientMonth(format(date, 'MM'));
            setEditingClientYear(format(date, 'yyyy'));
        } else {
            setEditingClientDay('');
            setEditingClientMonth('');
            setEditingClientYear('');
        }
        setShowEditFormModal(true);
    };

    const handleOpenAddModal = () => {
        setNewClientData({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', numeroTelefono: '', obraSocial: '', roles: ['cliente'], ordenMedicaRequerida: false, ordenMedicaEntregada: false });
        setNewClientDay('');
        setNewClientMonth('');
        setNewClientYear('');
        setShowAddFormModal(true);
    };

    const handleDeleteClient = (client) => {
        setAlertInfo({
            visible: true,
            title: "Eliminar Socio",
            message: `¿Estás seguro de que quieres eliminar a ${client.nombre} ${client.apellido}?`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Eliminar", style: "destructive", onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.delete(`/users/${client._id}`);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio eliminado correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchAllData();
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar al socio.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    };

    const handlePlanSubmit = async () => {
        if (!selectedClient || !planData.tipoClaseId) {
            setAlertInfo({ visible: true, title: 'Error', message: 'Por favor, selecciona un tipo de clase.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }
        const payload = {
            tipoClaseId: planData.tipoClaseId,
            creditsToAdd: Number(planData.creditsToAdd) || 0,
            isSubscription: planData.isSubscription,
            autoRenewAmount: Number(planData.autoRenewAmount) || 0,
        };
        try {
            await apiClient.put(`/users/${selectedClient._id}/plan`, payload);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'El plan del socio ha sido actualizado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            setCreditsModalVisible(false);
            fetchAllData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const handleRemoveSubscription = (tipoClaseId) => {
        if (!selectedClient || !tipoClaseId) return;
        setAlertInfo({
            visible: true,
            title: "Quitar Suscripción",
            message: "¿Seguro que quieres eliminar la suscripción automática para esta clase?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Quitar", style: "destructive", onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.delete(`/users/${selectedClient._id}/subscription/${tipoClaseId}`);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'Suscripción eliminada.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchAllData();
                            setCreditsModalVisible(false);
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar la suscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    };

    const handleRemoveFixedPlan = (planId) => {
        if (!selectedClient) return;
        setAlertInfo({
            visible: true,
            title: "Quitar Plan Fijo",
            message: "¿Seguro que quieres quitar este plan de horario fijo?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Quitar", style: "destructive", onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.delete(`/users/${selectedClient._id}/fixed-plan/${planId}`);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'Plan de horario fijo eliminado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchAllData();
                            setCreditsModalVisible(false);
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo quitar el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    };

    const findAvailableSlots = async () => {
        const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters;
        if (!tipoClaseId || diasDeSemana.length === 0 || !fechaInicio || !fechaFin) {
            setAlertInfo({ visible: true, title: 'Error', message: 'Completa todos los filtros para buscar horarios.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }
        setIsLoadingSlots(true);
        try {
            const response = await apiClient.get('/classes/available-slots', {
                params: { tipoClaseId, diasDeSemana: diasDeSemana.join(','), fechaInicio, fechaFin }
            });
            setAvailableSlots(response.data);
            if (response.data.length === 0) {
                setAlertInfo({ visible: true, title: 'Sin resultados', message: 'No se encontraron horarios disponibles para esa combinación.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            }
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron buscar los horarios.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } finally {
            setIsLoadingSlots(false);
        }
    };

    const handleMassEnrollSubmit = async () => {
        if (!selectedClient || !selectedSlot) {
            setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un horario para inscribir.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }
        const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters;
        const { horaInicio, horaFin } = selectedSlot;

        setAlertInfo({
            visible: true,
            title: "Confirmar Inscripción Masiva",
            message: `¿Inscribir a ${selectedClient.nombre} en este plan?`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Inscribir", style: "primary", onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.post(`/users/${selectedClient._id}/subscribe-to-plan`, {
                                tipoClaseId, diasDeSemana, fechaInicio, fechaFin, horaInicio, horaFin,
                            });
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'El socio ha sido inscrito en el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            setCreditsModalVisible(false);
                            fetchAllData();
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo procesar la inscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    };

    const handleDaySelection = (day) => {
        const currentDays = massEnrollFilters.diasDeSemana;
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        setMassEnrollFilters(prev => ({ ...prev, diasDeSemana: newDays }));
    };

    const showDatePickerFor = (field) => {
        setDatePickerField(field);
        setShowMassEnrollDatePicker(true);
    };

    // 💡 PASO 2: Modifica tu manejador de fecha para que funcione en ambas plataformas
    const handleDateChangeForMassEnroll = (eventOrDate, selectedDate) => {
        // En web, 'eventOrDate' es directamente el objeto Date.
        // En nativo, el primer argumento es 'event' y el segundo 'selectedDate'.
        const currentDate = Platform.OS === 'web' ? eventOrDate : selectedDate;

        // Ocultamos el picker
        setShowMassEnrollDatePicker(Platform.OS === 'ios'); // En iOS se mantiene abierto, en Android y web se cierra

        if (currentDate) {
            const formattedDate = format(currentDate, 'yyyy-MM-dd');
            setMassEnrollFilters(prev => ({ ...prev, [datePickerField]: formattedDate }));
        }
    };


    const handleNewClientChange = (name, value) => {
        setNewClientData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddClientSubmit = async () => {
        for (const key in newClientData) {
            const optionalFields = ['numeroTelefono', 'obraSocial', 'roles'];
            if (newClientData[key] === '' && !optionalFields.includes(key)) {
                setAlertInfo({ visible: true, title: 'Error', message: `Por favor, completa el campo: ${key}`, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                return;
            }
        }
        try {
            await apiClient.post('/auth/register', newClientData);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio registrado correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            setShowAddFormModal(false);
            fetchAllData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo registrar al socio.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const handleEditingClientChange = (name, value) => {
        setEditingClientData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateClientSubmit = async () => {
        if (!editingClientData) return;
        try {
            const { contraseña, ...updatePayload } = editingClientData;
            await apiClient.put(`/users/${editingClientData._id}`, updatePayload);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio actualizado correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            setShowEditFormModal(false);
            fetchAllData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar al socio.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const handleToggleMedicalOrder = (user) => {
        const newStatus = !user.ordenMedicaEntregada;
        const actionText = newStatus ? "marcar como ENTREGADA" : "marcar como PENDIENTE";
        const userName = `${user.nombre} ${user.apellido}`;

        setAlertInfo({
            visible: true,
            title: `Confirmar Orden Médica`,
            message: `¿Estás seguro de que quieres ${actionText} la orden médica de ${userName}?`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Confirmar", style: "primary", onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.put(`/users/${user._id}`, {
                                ordenMedicaEntregada: newStatus
                            });
                            setUsers(currentUsers =>
                                currentUsers.map(u =>
                                    u._id === user._id
                                        ? { ...u, ordenMedicaEntregada: newStatus }
                                        : u
                                )
                            );
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'El estado de la orden médica ha sido actualizado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el estado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    };

    const getModalConfig = useMemo(() => {
        const classTypeOptions = [{ _id: '', nombre: 'Selecciona un tipo' }, ...classTypes];
        const roleOptions = [
            { _id: 'cliente', nombre: 'Cliente' },
            { _id: 'profesor', nombre: 'Profesor' },
            { _id: 'admin', nombre: 'Admin' },
        ];

        switch (activeModal) {
            case 'addRole':
                return {
                    title: 'Seleccionar Rol',
                    options: roleOptions,
                    onSelect: (id) => handleNewClientChange('roles', [id]),
                    selectedValue: newClientData.roles[0],
                };
            case 'editRole':
                return {
                    title: 'Seleccionar Rol',
                    options: roleOptions,
                    onSelect: (id) => handleEditingClientChange('roles', [id]),
                    selectedValue: editingClientData?.roles[0],
                };
            case 'creditsClassType':
                return {
                    title: 'Seleccionar Tipo de Clase',
                    options: classTypeOptions,
                    onSelect: (id) => setPlanData(prev => ({ ...prev, tipoClaseId: id })),
                    selectedValue: planData.tipoClaseId,
                };
            case 'massEnrollClassType':
                return {
                    title: 'Seleccionar Tipo de Clase',
                    options: classTypeOptions,
                    onSelect: (id) => setMassEnrollFilters(prev => ({ ...prev, tipoClaseId: id, diasDeSemana: [] })),
                    selectedValue: massEnrollFilters.tipoClaseId,
                };
            default:
                return null;
        }
    }, [activeModal, classTypes, newClientData.roles, editingClientData?.roles, planData.tipoClaseId, massEnrollFilters.tipoClaseId]);

    const getDisplayName = (id, type) => {
        if (!id) return 'Seleccionar';
        if (type === 'classType') return classTypes.find(t => t._id === id)?.nombre || 'Seleccionar';
        if (type === 'role') return id.charAt(0).toUpperCase() + id.slice(1);
        return 'Seleccionar';
    };

    const filteredData = useMemo(() => {
        if (!searchTerm) return users;
        return users.filter(user =>
            `${user.nombre} ${user.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const getTypeName = (typeId) => {
        const classType = classTypes.find(t => t._id === typeId);
        return classType?.nombre || 'Desconocido';
    };

    const renderUserCard = ({ item }) => {
        const hasCredits = Object.values(item.creditosPorTipo || {}).some(amount => amount > 0);

        return (
            <View style={styles.card}>
                <View style={styles.cardTopRow}>
                    <View style={styles.userInfo}>
                        <Text style={styles.cardTitle}>{item.nombre} {item.apellido}</Text>
                        <Text style={styles.cardSubtitle}>{item.email}</Text>
                        <Text style={[styles.roleBadge, item.roles.includes('admin') ? styles.adminBadge : (item.roles.includes('profesor') ? styles.profesorBadge : styles.clienteBadge)]}>
                            {item.roles.join(', ')}
                        </Text>
                    </View>
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenBillingModal(item)}>
                            <Ionicons name="logo-usd" size={24} color='#28a745' />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenCreditsModal(item)}>
                            <Ionicons name="card" size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                        {item?.ordenMedicaRequerida && (
                            <TouchableOpacity style={styles.actionButton} onPress={() => handleToggleMedicalOrder(item)}>
                                <Ionicons name={item.ordenMedicaEntregada ? "document-text" : "document-text"} size={24} color={item.ordenMedicaEntregada ? '#28a745' : '#dc3545'} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenEditModal(item)}>
                            <FontAwesome name="user" size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteClient(item)}>
                            <Octicons name="trash" size={23} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </View>
                </View>
                {hasCredits && (
                    <View style={styles.creditsContainer}>
                        {Object.entries(item.creditosPorTipo || {}).map(([typeId, amount]) => {
                            if (amount > 0) {
                                return (
                                    <View key={typeId} style={styles.creditChip}>
                                        <Text style={styles.creditText}>{getTypeName(typeId)}: {amount}</Text>
                                    </View>
                                );
                            }
                            return null;
                        })}
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    // 💡 PASO 3: Crea un componente reutilizable para el selector de fecha
    const renderDatePicker = (field, value) => {
        if (Platform.OS === 'web') {
            const dateValue = value ? new Date(value + 'T00:00:00') : null; // Ajuste para que la fecha no se corra
            return (
                <DatePicker
                    selected={dateValue}
                    onChange={(date) => handleDateChangeForMassEnroll(date, null)}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="YYYY-MM-DD"
                    customInput={<TouchableOpacity style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{value || 'YYYY-MM-DD'}</Text></TouchableOpacity>}
                />
            );
        }

        // Lógica nativa (iOS/Android)
        return (
            <>
                <TouchableOpacity onPress={() => showDatePickerFor(field)}>
                    <View style={styles.dateInputTouchable}>
                        <Text style={styles.dateInputText}>{value || 'YYYY-MM-DD'}</Text>
                    </View>
                </TouchableOpacity>
                {showMassEnrollDatePicker && datePickerField === field && (
                    <DateTimePicker
                        value={value ? new Date(value + 'T00:00:00') : new Date()}
                        mode="date"
                        display="default"
                        onChange={handleDateChangeForMassEnroll}
                    />
                )}
            </>
        );
    };


    return (
        <ThemedView style={styles.container}>
            <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre, apellido o email..."
                placeholderTextColor={Colors[colorScheme].icon}
                value={searchTerm}
                onChangeText={setSearchTerm}
            />
            <FlatList
                data={filteredData}
                renderItem={renderUserCard}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No se encontraron usuarios.</ThemedText>}
            />
            <TouchableOpacity style={styles.fab} onPress={handleOpenAddModal}>
                <Ionicons name="person-add" size={30} color="#fff" />
            </TouchableOpacity>

            {showAddFormModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowAddFormModal(false)}>
                    <Pressable style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowAddFormModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView>
                            <ThemedText style={styles.modalTitle}>Registrar Nuevo Socio</ThemedText>
                            <ThemedText style={styles.inputLabel}>Nombre</ThemedText>
                            <TextInput style={styles.input} value={newClientData.nombre} onChangeText={(text) => handleNewClientChange('nombre', text)} />
                            <ThemedText style={styles.inputLabel}>Apellido</ThemedText>
                            <TextInput style={styles.input} value={newClientData.apellido} onChangeText={(text) => handleNewClientChange('apellido', text)} />
                            <ThemedText style={styles.inputLabel}>Email</ThemedText>
                            <TextInput style={styles.input} keyboardType="email-address" autoCapitalize="none" value={newClientData.email} onChangeText={(text) => handleNewClientChange('email', text)} />
                            <ThemedText style={styles.inputLabel}>Contraseña</ThemedText>
                            <TextInput style={styles.input} secureTextEntry value={newClientData.contraseña} onChangeText={(text) => handleNewClientChange('contraseña', text)} />
                            <ThemedText style={styles.inputLabel}>DNI</ThemedText>
                            <TextInput style={styles.input} keyboardType="numeric" value={newClientData.dni} onChangeText={(text) => handleNewClientChange('dni', text)} />
                            <ThemedText style={styles.inputLabel}>Fecha de Nacimiento</ThemedText>
                            <View style={styles.dateInputContainer}>
                                <TextInput style={styles.dateInput} placeholder="DD" value={newClientDay} onChangeText={setNewClientDay} keyboardType="number-pad" maxLength={2} />
                                <TextInput style={styles.dateInput} placeholder="MM" value={newClientMonth} onChangeText={setNewClientMonth} keyboardType="number-pad" maxLength={2} />
                                <TextInput style={styles.dateInput} placeholder="AAAA" value={newClientYear} onChangeText={setNewClientYear} keyboardType="number-pad" maxLength={4} />
                            </View>
                            <ThemedText style={styles.inputLabel}>Teléfono de Emergencia</ThemedText>
                            <TextInput style={styles.input} keyboardType="phone-pad" value={newClientData.telefonoEmergencia} onChangeText={(text) => handleNewClientChange('telefonoEmergencia', text)} />
                            <ThemedText style={styles.inputLabel}>Teléfono</ThemedText>
                            <TextInput style={styles.input} keyboardType="phone-pad" value={newClientData.numeroTelefono} onChangeText={(text) => handleNewClientChange('numeroTelefono', text)} />
                            <ThemedText style={styles.inputLabel}>Obra Social</ThemedText>
                            <TextInput style={styles.input} value={newClientData.obraSocial} onChangeText={(text) => handleNewClientChange('obraSocial', text)} />
                            <ThemedText style={styles.inputLabel}>Rol</ThemedText>
                            <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('addRole')}>
                                <ThemedText style={styles.filterButtonText}>{getDisplayName(newClientData.roles[0], 'role')}</ThemedText>
                                <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                            <View style={styles.switchRow}>
                                <ThemedText style={styles.inputLabel}>¿Requiere Orden Médica?</ThemedText>
                                <Switch value={newClientData.ordenMedicaRequerida} onValueChange={(value) => handleNewClientChange('ordenMedicaRequerida', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                            </View>
                            {newClientData.ordenMedicaRequerida && (
                                <View style={styles.switchRow}>
                                    <ThemedText style={styles.inputLabel}>¿Orden Médica Entregada?</ThemedText>
                                    <Switch value={newClientData.ordenMedicaEntregada} onValueChange={(value) => handleNewClientChange('ordenMedicaEntregada', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                </View>
                            )}
                            <View style={styles.modalActions}><View style={styles.buttonWrapper}><Button title="Registrar" onPress={handleAddClientSubmit} color={gymColor} /></View></View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            )}

            {showEditFormModal && (
                <Pressable style={styles.modalOverlay} onPress={() => setShowEditFormModal(false)}>
                    {editingClientData && (
                        <Pressable style={styles.modalView}>
                            <TouchableOpacity onPress={() => setShowEditFormModal(false)} style={styles.closeButton}>
                                <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                            </TouchableOpacity>
                            <ScrollView>
                                <ThemedText style={styles.modalTitle}>Editar Socio</ThemedText>
                                <ThemedText style={styles.inputLabel}>Nombre</ThemedText>
                                <TextInput style={styles.input} value={editingClientData.nombre} onChangeText={(text) => handleEditingClientChange('nombre', text)} />
                                <ThemedText style={styles.inputLabel}>Apellido</ThemedText>
                                <TextInput style={styles.input} value={editingClientData.apellido} onChangeText={(text) => handleEditingClientChange('apellido', text)} />
                                <ThemedText style={styles.inputLabel}>DNI</ThemedText>
                                <TextInput style={styles.input} keyboardType="numeric" value={editingClientData.dni} onChangeText={(text) => handleEditingClientChange('dni', text)} />
                                <ThemedText style={styles.inputLabel}>Fecha de Nacimiento</ThemedText>
                                <View style={styles.dateInputContainer}>
                                    <TextInput style={styles.dateInput} placeholder="DD" value={editingClientDay} onChangeText={setEditingClientDay} keyboardType="number-pad" maxLength={2} />
                                    <TextInput style={styles.dateInput} placeholder="MM" value={editingClientMonth} onChangeText={setEditingClientMonth} keyboardType="number-pad" maxLength={2} />
                                    <TextInput style={styles.dateInput} placeholder="AAAA" value={editingClientYear} onChangeText={setEditingClientYear} keyboardType="number-pad" maxLength={4} />
                                </View>
                                <ThemedText style={styles.inputLabel}>Teléfono de Emergencia</ThemedText>
                                <TextInput style={styles.input} keyboardType="phone-pad" value={editingClientData.telefonoEmergencia} onChangeText={(text) => handleEditingClientChange('telefonoEmergencia', text)} />
                                <ThemedText style={styles.inputLabel}>Teléfono</ThemedText>
                                <TextInput style={styles.input} keyboardType="phone-pad" value={editingClientData.numeroTelefono} onChangeText={(text) => handleEditingClientChange('numeroTelefono', text)} />
                                <ThemedText style={styles.inputLabel}>Obra Social</ThemedText>
                                <TextInput style={styles.input} value={editingClientData.obraSocial} onChangeText={(text) => handleEditingClientChange('obraSocial', text)} />
                                <ThemedText style={styles.inputLabel}>Rol</ThemedText>
                                <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('editRole')}>
                                    <ThemedText style={styles.filterButtonText}>{getDisplayName(editingClientData.roles[0], 'role')}</ThemedText>
                                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                                <View style={styles.switchRow}>
                                    <ThemedText style={styles.inputLabel}>¿Requiere Orden Médica?</ThemedText>
                                    <Switch value={editingClientData.ordenMedicaRequerida} onValueChange={(value) => handleEditingClientChange('ordenMedicaRequerida', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                </View>
                                {editingClientData.ordenMedicaRequerida && (
                                    <View style={styles.switchRow}>
                                        <ThemedText style={styles.inputLabel}>¿Orden Médica Entregada?</ThemedText>
                                        <Switch value={editingClientData.ordenMedicaEntregada} onValueChange={(value) => handleEditingClientChange('ordenMedicaEntregada', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                    </View>
                                )}
                                <View style={styles.modalActions}><View style={styles.buttonWrapper}><Button title="Guardar Cambios" onPress={handleUpdateClientSubmit} color={gymColor} /></View></View>
                            </ScrollView>
                        </Pressable>
                    )}
                </Pressable>
            )}

            {billingModalVisible && (
                <Pressable style={styles.modalOverlay} onPress={() => setBillingModalVisible(false)}>
                    <Pressable style={styles.modalView}>
                        {selectedClient && <BillingModalContent client={selectedClient} onClose={() => setBillingModalVisible(false)} onRefresh={fetchAllData} />}
                    </Pressable>
                </Pressable>
            )}

            {creditsModalVisible && (
                <Pressable style={styles.modalOverlay} onPress={() => setCreditsModalVisible(false)}>
                    <Pressable style={styles.modalView}>
                        <TouchableOpacity onPress={() => setCreditsModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView>
                            <ThemedText style={styles.modalTitle}>Gestionar Plan de {selectedClient?.nombre}</ThemedText>
                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Planes Actuales</ThemedText>
                                {selectedClient?.monthlySubscriptions?.length > 0 && selectedClient.monthlySubscriptions.map(sub => (
                                    <View key={sub._id} style={styles.planItem}>
                                        <Text style={styles.planText}>Suscripción: {getTypeName(sub.tipoClase)} ({sub.autoRenewAmount} créditos/mes)</Text>
                                        <TouchableOpacity onPress={() => handleRemoveSubscription(sub.tipoClase)}><Octicons name="trash" size={22} color={Colors.light.error} /></TouchableOpacity>
                                    </View>
                                ))}
                                {selectedClient?.planesFijos?.length > 0 && selectedClient.planesFijos.map(plan => (
                                    <View key={plan._id} style={styles.planItem}>
                                        <Text style={styles.planText}>Plan Fijo: {getTypeName(plan.tipoClase)} ({plan.diasDeSemana.join(', ')})</Text>
                                        <TouchableOpacity onPress={() => handleRemoveFixedPlan(plan._id)}><Octicons name="trash" size={22} color={Colors.light.error} /></TouchableOpacity>
                                    </View>
                                ))}
                                {(selectedClient?.monthlySubscriptions?.length === 0 && selectedClient?.planesFijos?.length === 0) && (<Text style={styles.planText}>Este socio no tiene planes activos.</Text>)}
                            </View>
                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Carga de Créditos / Suscripción</ThemedText>
                                <ThemedText style={styles.inputLabel}>Tipo de Clase</ThemedText>
                                <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('creditsClassType')}>
                                    <ThemedText style={styles.filterButtonText}>{getDisplayName(planData.tipoClaseId, 'classType')}</ThemedText>
                                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                                <ThemedText style={styles.inputLabel}>Créditos a Modificar (+/-)</ThemedText>
                                <TextInput style={styles.input} keyboardType="numeric" value={planData.creditsToAdd} onChangeText={text => setPlanData(prev => ({ ...prev, creditsToAdd: text }))} />
                                <View style={styles.switchContainer}>
                                    <ThemedText>¿Renovación automática mensual?</ThemedText>
                                    <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={value => setPlanData(prev => ({ ...prev, isSubscription: value }))} value={planData.isSubscription} />
                                </View>
                                {planData.isSubscription && (
                                    <>
                                        <ThemedText style={styles.inputLabel}>Créditos a renovar por mes</ThemedText>
                                        <TextInput style={styles.input} keyboardType="numeric" value={planData.autoRenewAmount} onChangeText={text => setPlanData(prev => ({ ...prev, autoRenewAmount: text }))} />
                                    </>
                                )}
                                <View style={styles.buttonWrapper}><Button title="Aplicar Créditos/Suscripción" onPress={handlePlanSubmit} color={gymColor || '#1a5276'} /></View>
                            </View>
                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Inscripción a Horario Fijo</ThemedText>
                                <ThemedText style={styles.inputLabel}>Paso 1: Buscar horarios disponibles</ThemedText>
                                <ThemedText style={styles.inputLabel}>Tipo de Clase</ThemedText>
                                <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('massEnrollClassType')}>
                                    <ThemedText style={styles.filterButtonText}>{getDisplayName(massEnrollFilters.tipoClaseId, 'classType')}</ThemedText>
                                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                                <ThemedText style={styles.inputLabel}>Días de la Semana</ThemedText>
                                <View style={styles.weekDayContainer}>
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                                        <TouchableOpacity key={day} onPress={() => handleDaySelection(day)} style={[styles.dayChip, massEnrollFilters.diasDeSemana.includes(day) && styles.dayChipSelected]}>
                                            <Text style={massEnrollFilters.diasDeSemana.includes(day) ? styles.dayChipTextSelected : styles.dayChipText}>{day.substring(0, 3)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                 <ThemedText style={styles.inputLabel}>Desde</ThemedText>
                                {Platform.OS === 'web' ? (
                                    <DatePicker
                                        selected={massEnrollFilters.fechaInicio ? parseISO(massEnrollFilters.fechaInicio) : null}
                                        onChange={(date) => setMassEnrollFilters(prev => ({ ...prev, fechaInicio: format(date, 'yyyy-MM-dd') }))}
                                        dateFormat="yyyy-MM-dd"
                                        customInput={<View style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{massEnrollFilters.fechaInicio || 'YYYY-MM-DD'}</Text></View>}
                                    />
                                ) : (
                                    <TouchableOpacity onPress={() => showDatePickerFor('fechaInicio')}>
                                        <View style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{massEnrollFilters.fechaInicio || 'YYYY-MM-DD'}</Text></View>
                                    </TouchableOpacity>
                                )}

                                <ThemedText style={styles.inputLabel}>Hasta</ThemedText>
                                {Platform.OS === 'web' ? (
                                    <DatePicker
                                        selected={massEnrollFilters.fechaFin ? parseISO(massEnrollFilters.fechaFin) : null}
                                        onChange={(date) => setMassEnrollFilters(prev => ({ ...prev, fechaFin: format(date, 'yyyy-MM-dd') }))}
                                        dateFormat="yyyy-MM-dd"
                                        customInput={<View style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{massEnrollFilters.fechaFin || 'YYYY-MM-DD'}</Text></View>}
                                    />
                                ) : (
                                    <TouchableOpacity onPress={() => showDatePickerFor('fechaFin')}>
                                        <View style={styles.dateInputTouchable}><Text style={styles.dateInputText}>{massEnrollFilters.fechaFin || 'YYYY-MM-DD'}</Text></View>
                                    </TouchableOpacity>
                                )}

                                {Platform.OS !== 'web' && showMassEnrollDatePicker && (
                                    <DateTimePicker
                                        value={new Date()}
                                        mode="date"
                                        display="default"
                                        onChange={handleDateChangeForMassEnroll}
                                        themeVariant={colorScheme}
                                    />
                                )}
                                
                                <View style={styles.buttonWrapper}><Button title={isLoadingSlots ? "Buscando..." : "Buscar Horarios"} onPress={findAvailableSlots} disabled={isLoadingSlots} color={gymColor || '#1a5276'} /></View>
                                {availableSlots.length > 0 && (
                                    <View style={{ marginTop: 20 }}>
                                        <ThemedText style={styles.inputLabel}>Paso 2: Seleccionar horario</ThemedText>
                                        {availableSlots.map((slot, index) => (
                                            <TouchableOpacity key={index} style={[styles.slotItem, selectedSlot?.horaInicio === slot.horaInicio && styles.slotItemSelected]} onPress={() => setSelectedSlot(slot)}>
                                                <Text style={selectedSlot?.horaInicio === slot.horaInicio ? styles.slotTextSelected : styles.slotText}>{slot.horaInicio} - {slot.horaFin}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <View style={styles.buttonWrapper}><Button title="Inscribir en Plan" onPress={handleMassEnrollSubmit} disabled={!selectedSlot} color={'#005013ff'} /></View>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
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
}

// ... (tus estilos `getStyles` se mantienen igual) ...
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    searchInput: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, margin: 15, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text, fontSize: 16 },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, padding: 15, marginVertical: 8, marginHorizontal: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, },
    userInfo: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 9, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
    actionsContainer: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { marginLeft: 10, },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: gymColor || '#1a5276', borderRadius: 30, elevation: 8 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
    roleBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, fontSize: 12, fontWeight: 'bold', overflow: 'hidden', textTransform: 'capitalize', alignSelf: 'flex-start', },
    clienteBadge: { backgroundColor: '#e0f3ffff', color: '#0561daff' },
    profesorBadge: { backgroundColor: '#d1e7dd', color: '#0f5132' },
    adminBadge: { backgroundColor: '#eff7d3ff', color: '#b6df00ff' },
    creditsContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 10, },
    creditChip: { backgroundColor: gymColor + '20', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 6, },
    creditText: { color: Colors[colorScheme].text, fontSize: 12, fontWeight: '600', },
    modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', width: '100%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10, },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text, paddingTop: 10 },
    inputLabel: { fontSize: 14, marginBottom: 8, color: Colors[colorScheme].text, opacity: 0.8 },
    input: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, color: Colors[colorScheme].text, fontSize: 14 },
    modalActions: { marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
    dateInputContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    dateInput: { borderWidth: 1, borderColor: Colors[colorScheme].border, padding: 12, borderRadius: 8, fontSize: 16, color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].background, textAlign: 'center', flex: 1, marginHorizontal: 4, },
    section: { marginBottom: 15, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15, color: Colors[colorScheme].text },
    planItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, },
    planText: { fontSize: 14, color: Colors[colorScheme].text, flex: 1 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 5 },
    weekDayContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 },
    dayChip: { paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8, borderWidth: 1.5, borderColor: Colors[colorScheme].border, margin: 4, },
    dayChipSelected: { backgroundColor: gymColor || '#1a5276' },
    dayChipText: { fontSize: 14, color: Colors[colorScheme].text },
    dayChipTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
    slotItem: { padding: 12, marginVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors[colorScheme].border },
    slotItemSelected: { borderColor: gymColor, backgroundColor: gymColor + '20' },
    slotText: { textAlign: 'center', fontSize: 14, color: Colors[colorScheme].text },
    slotTextSelected: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: gymColor },
    dateInputTouchable: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, justifyContent: 'center', },
    dateInputText: { fontSize: 14, color: Colors[colorScheme].text, },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 10, },
    buttonWrapper: { borderRadius: 8, overflow: 'hidden', marginTop: 10, },
    filterButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, backgroundColor: Colors[colorScheme].background, },
    filterButtonText: { fontSize: 14, color: Colors[colorScheme].text, },
});

export default ManageClientsScreen;