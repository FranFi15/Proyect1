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
    Platform,
    Modal,
    KeyboardAvoidingView,
    RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome, Octicons, FontAwesome5, FontAwesome6 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, parseISO, isValid, isAfter } from 'date-fns';
import BillingModalContent from '@/components/admin/BillingModalContent';
import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';
import UpgradePlanModal from '../../components/admin/UpgradePlanModal';
import QrScannerModal from '../../components/profesor/QrScannerModal'

const ClientCounter = ({ count, limit, onUpgradePress, gymColor, colorScheme }) => {
    const styles = getStyles(colorScheme, gymColor);
    const isOverLimit = count >= limit;
    return (
        <View style={styles.counterContainer}>
            <View>
                <ThemedText style={styles.counterLabel}>Clientes</ThemedText>
                <ThemedText style={[styles.counterText, isOverLimit && styles.overLimitText]}>
                    {count} / {limit}
                </ThemedText>
            </View>
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
                <FontAwesome6 name="arrow-trend-up" size={14} color="#fff" />
                <Text style={styles.upgradeButtonText}>Ampliar Limite</Text>
            </TouchableOpacity>
        </View>
    );
};


const ManageClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [subscriptionInfo, setSubscriptionInfo] = useState({ clientCount: 0, clientLimit: 100 });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
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
    
    
    // 💡 PASO 2: Centraliza el estado del DatePicker en un objeto.
    const [datePickerConfig, setDatePickerConfig] = useState({
        visible: false,
        field: null, // 'fechaInicio' o 'fechaFin'
        currentValue: new Date(),
    });

    const [newClientData, setNewClientData] = useState({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', numeroTelefono: '', obraSocial: '', roles: ['cliente'], ordenMedicaRequerida: false, ordenMedicaEntregada: false });
    const [newClientDay, setNewClientDay] = useState('');
    const [newClientMonth, setNewClientMonth] = useState('');
    const [newClientYear, setNewClientYear] = useState('');


    const [editingClientData, setEditingClientData] = useState(null);
    const [editingClientDay, setEditingClientDay] = useState('');
    const [editingClientMonth, setEditingClientMonth] = useState('');
    const [editingClientYear, setEditingClientYear] = useState('');

    const [activeModal, setActiveModal] = useState(null);

    const [isScannerVisible, setScannerVisible] = useState(false);

    const [paseLibreData, setPaseLibreData] = useState({ desde: null, hasta: null });
    
    const [isPaseLibrePickerVisible, setIsPaseLibrePickerVisible] = useState(false);
    const [paseLibreFieldToEdit, setPaseLibreFieldToEdit] = useState(null); 



    const fetchAllData = useCallback(async () => {
        try {
            const [usersResponse, classTypesResponse, subInfoResponse] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/tipos-clase'),
                apiClient.get('/users/subscription-info') // Ruta corregida
            ]);

            setUsers(usersResponse.data.filter(u => u && (u.roles.includes('cliente') || u.roles.includes('profesor'))));
            setClassTypes(classTypesResponse.data.tiposClase || []);
            setSubscriptionInfo(subInfoResponse.data);

        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    const onRefresh = useCallback(async () => {
            setIsRefreshing(true);
            await fetchAllData();
            setIsRefreshing(false);
        }, [fetchAllData]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchAllData();
        }, [fetchAllData])
    );

    useEffect(() => {
        if (selectedClient) {
            const updatedClient = users.find(u => u._id === selectedClient._id);
            if (updatedClient && JSON.stringify(updatedClient) !== JSON.stringify(selectedClient)) {
                setSelectedClient(updatedClient);
            }
        }
    }, [users]);

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

    const handleTogglePermission = async (user) => {
        const newPermissionStatus = !user.puedeGestionarEjercicios;
        const actionText = newPermissionStatus ? "otorgar" : "revocar";
        const userName = `${user.nombre} ${user.apellido}`;

        setAlertInfo({
            visible: true,
            title: "Confirmar Permiso",
            message: `¿Estás seguro de que quieres ${actionText} el permiso para gestionar ejercicios a ${userName}?`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Confirmar", style: "primary", onPress: async () => {
                    try {
                        // Usamos la misma ruta de actualización, pero solo enviamos el campo que cambia
                        await apiClient.put(`/users/${user._id}`, {
                            puedeGestionarEjercicios: newPermissionStatus
                        });

                        // Actualizamos el estado local para ver el cambio al instante
                        setUsers(currentUsers =>
                            currentUsers.map(u =>
                                u._id === user._id
                                    ? { ...u, puedeGestionarEjercicios: newPermissionStatus }
                                    : u
                            )
                        );
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Permiso actualizado.' });
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo actualizar el permiso.' });
                    }
                }}
            ]
        });
    };

    const handleUpgradePlan = async () => {
        setIsSubmitting(true);
        try {
            const response = await apiClient.put('/users/upgrade-plan'); 
            setAlertInfo({ 
                visible: true, 
                title: '¡Plan Ampliado!', 
                message: `Tu límite de clientes ha sido aumentado a ${response.data.newLimit}.`, 
                buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] 
            });
            setActiveModal(null);
            await fetchAllData();
        } catch (error) {
            setAlertInfo({ 
                visible: true, 
                title: 'Error', 
                message: error.response?.data?.message || 'No se pudo ampliar el plan.', 
                buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddClientSubmit = async () => {
        setLoading(true);
        try {
            // Validación de campos (puedes hacerla más robusta si quieres)
            if (!newClientData.nombre || !newClientData.email || !newClientData.contraseña) {
                throw new Error('Por favor, ingresa todos los campos obligatorios.');
            }

            await apiClient.post('/auth/register', newClientData);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio registrado correctamente.'});
            setActiveModal(null);
            await fetchAllData();
        } catch (error) {
        // --- ¡AQUÍ ESTÁ LA LÓGICA MEJORADA! ---
        let errorMessage = 'Ocurrió un error inesperado. Inténtalo de nuevo.'; // Mensaje por defecto

        if (error.response && error.response.data && error.response.data.message) {
            // Caso 1: El backend envió un mensaje de error específico (ej: "email ya existe").
            errorMessage = error.response.data.message;
        } else if (error.message) {
            // Caso 2: No hubo respuesta del backend, es un error de red o de otro tipo.
            errorMessage = error.message;
        }

        // Caso especial para el límite de clientes
        if (error.response && error.response.status === 403) {
            setActiveModal('upgrade');
        } else {
            // Mostramos el mensaje de error correcto y amigable en el modal
            setAlertInfo({ 
                visible: true, 
                title: 'Error de Registro', 
                message: errorMessage 
            });
        }
    } finally {
        setLoading(false);
    }
};

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
        setNewClientData({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', numeroTelefono: '', obraSocial: '', roles: ['cliente'], ordenMedicaRequerida: false, ordenMedicaEntregada: false, puedeGestionarEjercicios: false });
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
            setAlertInfo({ visible: true, title: 'Error', message: 'Por favor, selecciona un tipo de Turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
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
            message: "¿Seguro que quieres eliminar la suscripción automática para este Turno?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Quitar", style: "destructive", onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.delete(`/users/${selectedClient._id}/subscription/${tipoClaseId}`);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'Suscripción eliminada.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                            fetchAllData();
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
        if (!tipoClaseId || diasDeSemana.length === 0 || !fechaInicio ) {
            setAlertInfo({ visible: true, title: 'Error', message: 'Completa todos los filtros para buscar horarios.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }
        setIsLoadingSlots(true);
        try {
            const params = {
            tipoClaseId,
            diasDeSemana: diasDeSemana.join(','),
            fechaInicio,
        };
        if (fechaFin) {
            params.fechaFin = fechaFin;
        }
            const response = await apiClient.get('/classes/available-slots', {params});
            
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

        const payload = {
        tipoClaseId,
        diasDeSemana,
        fechaInicio,
        horaInicio,
        horaFin,
    };

    if (fechaFin) {
        payload.fechaFin = fechaFin;
    }

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
                            await apiClient.post(`/users/${selectedClient._id}/subscribe-to-plan`, payload);
                            setAlertInfo({ visible: true, title: 'Éxito', message: 'El socio ha sido inscrito en el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
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

    const handleNewClientChange = (name, value) => {
        setNewClientData(prev => ({ ...prev, [name]: value }));
    };


    const handleEditingClientChange = (name, value) => {
        setEditingClientData(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateClientSubmit = async () => {
        if (!editingClientData) return;
        
        // Creamos un payload solo con los datos que se pueden editar en este formulario
        const updatePayload = {
            nombre: editingClientData.nombre,
            apellido: editingClientData.apellido,
            email: editingClientData.email,
            dni: editingClientData.dni,
            sexo: editingClientData.sexo,
            fechaNacimiento: editingClientData.fechaNacimiento,
            numeroTelefono: editingClientData.numeroTelefono,
            telefonoEmergencia: editingClientData.telefonoEmergencia,
            obraSocial: editingClientData.obraSocial,
            roles: editingClientData.roles,
            direccion: editingClientData.direccion,
            ordenMedicaRequerida: editingClientData.ordenMedicaRequerida,
            ordenMedicaEntregada: editingClientData.ordenMedicaEntregada,
            puedeGestionarEjercicios: editingClientData.puedeGestionarEjercicios,
        };

        try {
            await apiClient.put(`/users/${editingClientData._id}`, updatePayload);
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio actualizado correctamente.' });
            setShowEditFormModal(false);
            fetchAllData();
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar al socio.' });
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

    const handleSavePaseLibre = async () => {
        if (!selectedClient || !paseLibreData.desde || !paseLibreData.hasta) {
            return setAlertInfo({ visible: true, title: 'Error', message: 'Debes seleccionar ambas fechas.' });
        }
        try {
            await apiClient.put(`/users/${selectedClient._id}/pase-libre`, {
                paseLibreDesde: format(paseLibreData.desde, 'yyyy-MM-dd'),
                paseLibreHasta: format(paseLibreData.hasta, 'yyyy-MM-dd'),
            });
             fetchAllData();
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Pase Libre actualizado.' });
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo guardar el Pase Libre.' });
        }
    };
    const showPaseLibreDatePicker = (field) => {
        setPaseLibreFieldToEdit(field);
        setIsPaseLibrePickerVisible(true);
    };

    const handlePaseLibreDateChange = (event, selectedDate) => {
        setIsPaseLibrePickerVisible(Platform.OS === 'ios');
        if (selectedDate) {
            setPaseLibreData(prev => ({
                ...prev,
                [paseLibreFieldToEdit]: selectedDate
            }));
        }
    };
    const handleRemovePaseLibre = (client) => {
        if (!client) return;
        setAlertInfo({
            visible: true,
            title: "Quitar Pase Libre",
            message: `¿Seguro que quieres eliminar el Pase Libre de ${client.nombre}?`,
            buttons: [
                { text: "Cancelar", style: "cancel" },
                { text: "Quitar", style: "destructive", onPress: async () => {
                    try {
                        await apiClient.delete(`/users/${client._id}/pase-libre`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Pase Libre eliminado.' });
                        fetchAllData(); // Refrescamos los datos
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo eliminar el Pase Libre.' });
                    }
                }}
            ]
        });
    };

    const renderPaseLibreDateField = (label, field) => {
        const dateValue = paseLibreData[field];
        const displayValue = dateValue ? format(dateValue, 'dd/MM/yyyy') : `Seleccionar ${label.toLowerCase()}`;

        if (Platform.OS === 'web') {
            return (
                <DatePicker
                    selected={dateValue}
                    onChange={(date) => setPaseLibreData(prev => ({ ...prev, [field]: date }))}
                    minDate={field === 'hasta' ? paseLibreData.desde : null}
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
            <TouchableOpacity onPress={() => showPaseLibreDatePicker(field)}>
                <View style={styles.dateInputTouchable}>
                    <Text style={styles.dateInputText}>{displayValue}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const getModalConfig = useMemo(() => {
        const classTypeOptions = [{ _id: '', nombre: 'Selecciona un tipo' }, ...classTypes];
        const roleOptions = [
            { _id: 'cliente', nombre: 'Cliente' },
            { _id: 'profesor', nombre: 'Profesional' },
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
                    title: 'Seleccionar Tipo de Turno',
                    options: classTypeOptions,
                    onSelect: (id) => setPlanData(prev => ({ ...prev, tipoClaseId: id })),
                    selectedValue: planData.tipoClaseId,
                };
            case 'massEnrollClassType':
                return {
                    title: 'Seleccionar Tipo de Turno',
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

    const showDatePickerFor = (field) => {
        let initialDate = new Date();
        let minDate;

        if (field === 'fechaFin' && massEnrollFilters.fechaInicio) {
            const startDate = parseISO(massEnrollFilters.fechaInicio);
            minDate = startDate;
            initialDate = (massEnrollFilters.fechaFin && isAfter(parseISO(massEnrollFilters.fechaFin), startDate))
                ? parseISO(massEnrollFilters.fechaFin)
                : startDate;
        } else if (massEnrollFilters[field]) {
            initialDate = parseISO(massEnrollFilters[field]);
        }

        setDatePickerConfig({
            visible: true,
            field: field,
            currentValue: initialDate,
            minimumDate: minDate,
        });
    };

    const handleDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setDatePickerConfig(prev => ({ ...prev, visible: false }));
        }
        if (event.type === 'dismissed') {
            if (Platform.OS === 'ios') setDatePickerConfig(prev => ({...prev, visible: false}));
            return;
        }

        const newDate = selectedDate || datePickerConfig.currentValue;

        if (Platform.OS === 'ios') {
            setDatePickerConfig(prev => ({ ...prev, currentValue: newDate }));
            return;
        }
        
        const formattedDate = format(newDate, 'yyyy-MM-dd');
        setMassEnrollFilters(prev => ({ ...prev, [datePickerConfig.field]: formattedDate }));
    };
    
    const confirmIosDate = () => {
        const { field, currentValue } = datePickerConfig;
        const formattedDate = format(currentValue, 'yyyy-MM-dd');
        setMassEnrollFilters(prev => ({ ...prev, [field]: formattedDate }));
        setDatePickerConfig({ visible: false, field: null, currentValue: new Date(), minimumDate: undefined });
    };


    const renderDateField = (field) => {
        const value = massEnrollFilters[field];

        if (Platform.OS === 'web') {
            const startDate = massEnrollFilters.fechaInicio ? parseISO(massEnrollFilters.fechaInicio) : null;
            
            return (
                <DatePicker
                    selected={value ? parseISO(value) : null}
                    onChange={(date) => {
                        if (date) {
                            setMassEnrollFilters(prev => ({ ...prev, [field]: format(date, 'yyyy-MM-dd') }));
                        }
                    }}
                    minDate={field === 'fechaFin' ? startDate : null}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="YYYY-MM-DD"
                    customInput={
                        <View style={styles.dateInputTouchable}>
                            <Text style={styles.dateInputText}>{value || 'Seleccionar fecha'}</Text>
                        </View>
                    }
                />
            );
        }

        return (
            <Pressable onPress={() => showDatePickerFor(field)}>
                <View style={styles.dateInputTouchable}>
                    <Text style={styles.dateInputText}>{value || 'Seleccionar fecha'}</Text>
                </View>
            </Pressable>
        );
    };

   const handleGeneralScan = async ({ data }) => {
        setScannerVisible(false);
        try {
            const response = await apiClient.post('/check-in/scan', { userId: data });
            
            let messageDetail = 'No hay turnos pendientes para hoy.';
            if (response.data.classes && response.data.classes.length > 0) {
                // Mapeamos la lista de clases a un string legible
                messageDetail = response.data.classes
                    .map(c => `${c.nombre} ${c.horario}`)
                    .join('\n');
            } else if (response.data.message.includes('finalizaron')) {
                messageDetail = 'Todos sus turnos de hoy ya finalizaron.';
            }

            setAlertInfo({
                visible: true,
                title: response.data.message,
                message: messageDetail,
            });

        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error de Check-in',
                message: error.response?.data?.message || 'No se pudo verificar al cliente.',
            });
        }
    };
    const handleToggleUserStatus = async (user, newStatus) => {
        try {
            // Llama a la ruta específica para cambiar el estado
            await apiClient.put(`/users/${user._id}/status`, { isActive: newStatus });

            // Actualiza el estado local para que el cambio se vea al instante
            setUsers(currentUsers =>
                currentUsers.map(u =>
                    u._id === user._id ? { ...u, isActive: newStatus } : u
                )
            );
            setEditingClientData(prev => ({ ...prev, isActive: newStatus }));

            setAlertInfo({ visible: true, title: 'Éxito', message: 'El estado del cliente ha sido actualizado.' });
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el estado.' });
            // Revertimos el cambio visual si la API falla
            setEditingClientData(prev => ({ ...prev, isActive: !newStatus }));
        }
    };


    const renderUserCard = ({ item }) => {
        const hasCredits = Object.values(item.creditosPorTipo || {}).some(amount => amount > 0);
        const hasPaseLibre = item.paseLibreHasta && isValid(parseISO(item.paseLibreHasta));

        return (
            <View style={[styles.card, !item.isActive && styles.inactiveCard]}>
                <View style={styles.cardTopRow}>
                    <View style={styles.userInfo}>
                        <Text style={styles.cardTitle}>{item.nombre} {item.apellido}</Text>
                        <Text style={styles.cardSubtitle}>{item.email}</Text>
                        <Text style={[styles.roleBadge, item.roles.includes('admin') ? styles.adminBadge : (item.roles.includes('profesor') ? styles.profesorBadge : styles.clienteBadge)]}>
                            {item.roles.join(', ')}
                        </Text>
                    </View>
                    <View style={styles.actionsContainer}>
                        {item.roles.includes('cliente') && (
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenBillingModal(item)}>
                            <Ionicons name="logo-usd" size={24} color='#28a745' />
                        </TouchableOpacity>
                         )}
                        {item.roles.includes('cliente') && (
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenCreditsModal(item)}>
                            <Ionicons name="card" size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                         )}
                          {item.roles.includes('profesor') && (
                        <TouchableOpacity style={styles.actionButton} onPress={() =>handleTogglePermission(item)}>
                            <Ionicons name="accessibility" size={24} color={item.puedeGestionarEjercicios ? '#28a745' : '#dc3545'} />
                        </TouchableOpacity>
                         )}
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
                {hasPaseLibre && (
                    <View style={styles.paseLibreContainer}>
                        <Ionicons name="star" size={14} color={styles.paseLibreText.color} />
                        <Text style={styles.paseLibreText}>
                            Pase Libre hasta: {format(parseISO(item.paseLibreHasta), 'dd/MM/yyyy')}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={styles.container} >
            <ClientCounter 
                count={subscriptionInfo.clientCount}
                limit={subscriptionInfo.clientLimit}
                onUpgradePress={() => setActiveModal('upgrade')}
                gymColor={gymColor}
                colorScheme={colorScheme}
            />
            
            <View style={styles.searchInputContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar usuario por nombre..."
                    placeholderTextColor={Colors[colorScheme].icon}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={styles.searchIcon} />
            </View>
            
            <FlatList
                data={filteredData}
                renderItem={renderUserCard}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No se encontraron usuarios.</ThemedText>}
                refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={gymColor} 
                        />
                    }
            />
            <TouchableOpacity style={styles.fabScanner} onPress={() => setScannerVisible(true)}>
                <Ionicons name="qr-code" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fab} onPress={handleOpenAddModal}>
                <Ionicons name="person-add" size={30} color="#fff" />
            </TouchableOpacity>

            <UpgradePlanModal
                visible={activeModal === 'upgrade'}
                onClose={() => setActiveModal(null)}
                onConfirm={handleUpgradePlan}
                currentCount={subscriptionInfo.clientCount}
                currentLimit={subscriptionInfo.clientLimit}
                gymColor={gymColor}
            />

            {showAddFormModal && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
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
             </KeyboardAvoidingView>
            )}

            {showEditFormModal && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
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
                                {editingClientData.roles.includes('cliente') && (
                                <View style={styles.switchRow}>
                                    <ThemedText style={styles.inputLabel}>¿Requiere Orden Médica?</ThemedText>
                                    <Switch value={editingClientData.ordenMedicaRequerida} onValueChange={(value) => handleEditingClientChange('ordenMedicaRequerida', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                </View>
                                  )}
                                {editingClientData.ordenMedicaRequerida && (
                                    <View style={styles.switchRow}>
                                        <ThemedText style={styles.inputLabel}>¿Orden Médica Entregada?</ThemedText>
                                        <Switch value={editingClientData.ordenMedicaEntregada} onValueChange={(value) => handleEditingClientChange('ordenMedicaEntregada', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                    </View>
                                )}
                                {editingClientData.roles.includes('profesor') && (
                            <View style={styles.switchRow}>
                                <ThemedText style={styles.inputLabel}>Permitir gestionar ejercicios</ThemedText>
                                <Switch
                                    value={editingClientData.puedeGestionarEjercicios}
                                    onValueChange={(value) => handleEditingClientChange('puedeGestionarEjercicios', value)}
                                    trackColor={{ false: "#767577", true: gymColor }}
                                    thumbColor={"#f4f3f4"}
                                />
                            </View>
                        )}
                               <View style={styles.switchRow}>
                            <ThemedText style={styles.inputLabel}>Cuenta Activa</ThemedText>
                            <Switch
                                value={editingClientData.isActive}
                                onValueChange={(value) => handleToggleUserStatus(editingClientData, value)}
                                trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"}
                            />
                        </View>
                                <View style={styles.modalActions}><View style={styles.buttonWrapper}><Button title="Guardar Cambios" onPress={handleUpdateClientSubmit} color={gymColor} /></View></View>
                            
                            </ScrollView>
                        </Pressable>
                    )}
                </Pressable>
                </KeyboardAvoidingView>
            )}

            {billingModalVisible && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
                <Pressable style={styles.modalOverlay} onPress={() => setBillingModalVisible(false)}>
                    <Pressable style={styles.modalView}>
                        {selectedClient && <BillingModalContent client={selectedClient} onClose={() => setBillingModalVisible(false)} onRefresh={fetchAllData} />}
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            )}

            {/* Este es el modal principal que se modifica */}
            {creditsModalVisible && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
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
                                        <Text style={styles.planText}>Suscripción: {getTypeName(sub.tipoClase.nombre)} ({sub.autoRenewAmount} créditos/mes)</Text>
                                        <TouchableOpacity onPress={() => handleRemoveSubscription(sub.tipoClase)}><Octicons name="trash" size={22} color={Colors[colorScheme].text} /></TouchableOpacity>
                                    </View>
                                ))}
                                {selectedClient?.planesFijos?.length > 0 && selectedClient.planesFijos.map(plan => (
                                    <View key={plan._id} style={styles.planItem}>
                                        <Text style={styles.planText}>Plan Fijo: {getTypeName(plan.tipoClase.nombre)} ({plan.diasDeSemana.join(', ')})</Text>
                                        <TouchableOpacity onPress={() => handleRemoveFixedPlan(plan._id)}><Octicons name="trash" size={22} color={Colors[colorScheme].text} /></TouchableOpacity>
                                    </View>
                                ))}
                              {selectedClient?.paseLibreHasta && isValid(parseISO(selectedClient.paseLibreHasta)) && (
        <View style={styles.planItem}>
            <Text style={styles.planText}>
                Pase Libre (hasta {format(parseISO(selectedClient.paseLibreHasta), 'dd/MM/yyyy')})
            </Text>
            <TouchableOpacity onPress={() => handleRemovePaseLibre(selectedClient)}>
                <Octicons name="trash" size={22} color={Colors[colorScheme].text} />
            </TouchableOpacity>
        </View>
    )}
                              {(!selectedClient?.monthlySubscriptions || selectedClient.monthlySubscriptions.length === 0) &&
     (!selectedClient?.planesFijos || selectedClient.planesFijos.length === 0) &&
     (!selectedClient?.paseLibreHasta || !isValid(parseISO(selectedClient.paseLibreHasta))) &&
        <Text style={styles.planText}>Este socio no tiene planes activos.</Text>
    }
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
                            <ThemedText style={styles.sectionTitle}>Asignar Pase Libre</ThemedText>
                            <ThemedText style={styles.inputLabel}>Válido Desde:</ThemedText>
                            {renderPaseLibreDateField('Desde', 'desde')}

                            <ThemedText style={styles.inputLabel}>Válido Hasta:</ThemedText>
                            {renderPaseLibreDateField('Hasta', 'hasta')}
                            
                            <View style={styles.buttonWrapper}>
                                <Button title="Guardar Pase Libre" onPress={handleSavePaseLibre} color={gymColor} />
                            </View>
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
                                {renderDateField('fechaInicio')}
                                
                                <ThemedText style={styles.inputLabel}>Hasta (Opcional)</ThemedText>
                                {renderDateField('fechaFin')}
                                
                                <View style={styles.buttonWrapper}>
                                    <Button 
                                        title={isLoadingSlots ? "Buscando..." : "Buscar Horarios"} 
                                        onPress={findAvailableSlots} 
                                        disabled={isLoadingSlots} 
                                        color={gymColor || '#1a5276'} 
                                    />
                                </View>
                                
                                {availableSlots.map((slot) => {
    // Creamos un ID único usando todos los datos
    const slotId = `${slot.nombre}-${slot.tipoClase?._id}-${slot.horaInicio}-${slot.profesor?._id}`;
    const isSelected = selectedSlot && `${selectedSlot.nombre}-${selectedSlot.tipoClase?._id}-${selectedSlot.horaInicio}-${selectedSlot.profesor?._id}` === slotId;

    return (
        <TouchableOpacity 
            key={slotId} 
            style={[styles.slotItem, isSelected && styles.slotItemSelected]} 
            onPress={() => setSelectedSlot(slot)}
        >
            <Text style={isSelected ? styles.slotTextSelected : styles.slotText}>
                {/* Mostramos el nombre de la clase, el profesor y el horario */}
                {slot.nombre || 'Turno'} - { (slot.profesor?.nombre || '') + ' ' + (slot.profesor?.apellido || '') } - {slot.horaInicio}hs - {slot.horaFin}hs
            </Text>
        </TouchableOpacity>
    );
})}
                                {availableSlots.length > 0 && (
                                    <View style={styles.buttonWrapper}>
                                        <Button title="Inscribir a Plan" onPress={handleMassEnrollSubmit} color={gymColor || '#1a5276'} />
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            )}

            {datePickerConfig.visible && Platform.OS !== 'web' && (
                <>
                    {Platform.OS === 'android' && (
                        <DateTimePicker
                            value={datePickerConfig.currentValue}
                            mode="date"
                            display="default"
                            minimumDate={datePickerConfig.minimumDate}
                            onChange={handleDateChange}
                        />
                    )}
                    {Platform.OS === 'ios' && (
                        <Modal transparent={true} animationType="slide" visible={datePickerConfig.visible}>
                            <Pressable style={styles.iosPickerOverlay} onPress={() => setDatePickerConfig(p => ({...p, visible: false}))}>
                                <Pressable style={styles.iosPickerContainer} onPress={() => {}}>
                                    <DateTimePicker value={datePickerConfig.currentValue} mode="date" display="inline" minimumDate={datePickerConfig.minimumDate} onChange={handleDateChange} themeVariant={colorScheme} />
                                    <Button title="Confirmar" onPress={confirmIosDate} color={gymColor} />
                                </Pressable>
                            </Pressable>
                        </Modal>
                    )}
                </>
            )}
            {isPaseLibrePickerVisible && Platform.OS !== 'web' && (
                <DateTimePicker
                    value={paseLibreData[paseLibreFieldToEdit] || new Date()}
                    mode="date"
                    display="default"
                    onChange={handlePaseLibreDateChange}
                />
            )}

            {getModalConfig && ( <FilterModal visible={!!activeModal} onClose={() => setActiveModal(null)} onSelect={(id) => { getModalConfig.onSelect(id); setActiveModal(null); }} title={getModalConfig.title} options={getModalConfig.options} selectedValue={getModalConfig.selectedValue} theme={{ colors: Colors[colorScheme], gymColor }} /> )}
            <QrScannerModal 
                visible={isScannerVisible}
                onClose={() => setScannerVisible(false)}
                onBarcodeScanned={handleGeneralScan}
            />    
            <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={alertInfo.buttons} onClose={() => setAlertInfo({ ...alertInfo, visible: false })} gymColor={gymColor} />

        </ThemedView>
    );
}

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    dateInputTouchable: {
        height: 45,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 15,
        marginBottom: 15,
        justifyContent: 'center',
    },
    dateInputText: {
        fontSize: 14,
        color: Colors[colorScheme].text,
    },
    iosPickerOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    iosPickerContainer: {
        backgroundColor: Colors[colorScheme].background,
        borderTopRightRadius: 5,
        borderTopLeftRadius: 5,
        padding: 20,
        height: '50%',
        justifyContent: 'space-evenly',
        alignItems: 'center',
    },
    modalOverlayWrapper: {
        ...StyleSheet.absoluteFillObject, 
        zIndex: 1000, 
    },
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: 15,
        height: 50,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 15,
        backgroundColor: Colors[colorScheme].cardBackground,
        color: Colors[colorScheme].text,
        fontSize: 16
    }, 
    searchInput: {
        height: 50,
        color: Colors[colorScheme].text,
        fontSize: 16
    },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, padding: 15, marginVertical: 8, marginHorizontal: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, },
    inactiveCard: {
        opacity: 0.5,
        backgroundColor: Colors[colorScheme].cardBackground + '80',
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, },
    userInfo: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 9, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
    actionsContainer: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { marginLeft: 10, },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: gymColor || '#1a5276', borderRadius: 30, elevation: 8,shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,  },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
    roleBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, fontSize: 12, fontWeight: 'bold', overflow: 'hidden', textTransform: 'capitalize', alignSelf: 'flex-start', },
    clienteBadge: { backgroundColor: '#e0f3ffff', color: '#0561daff' },
    profesorBadge: { backgroundColor: '#d1e7dd', color: '#0f5132' },
    adminBadge: { backgroundColor: '#eff7d3ff', color: '#b6df00ff' },
    creditsContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 10, },
    creditChip: { backgroundColor: gymColor + '20', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 6, },
    creditText: { color: Colors[colorScheme].text, fontSize: 12, fontWeight: '600', },
    modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', width: '100%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 5, borderTopRightRadius: 5, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10, },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text, paddingTop: 10 },
    inputLabel: { fontSize: 14, marginBottom: 8, color: Colors[colorScheme].text, opacity: 0.8 },
    input: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, marginBottom: 15, color: Colors[colorScheme].text, fontSize: 14 },
    modalActions: { marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
    dateInputContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    dateInput: { borderWidth: 1, borderColor: Colors[colorScheme].border, padding: 12, borderRadius: 5, fontSize: 16, color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].background, textAlign: 'center', flex: 1, marginHorizontal: 4, },
    section: { marginBottom: 15, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15, color: Colors[colorScheme].text },
    planItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, },
    planText: { fontSize: 14, color: Colors[colorScheme].text, flex: 1 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 5 },
    weekDayContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 },
    dayChip: { paddingVertical: 4, paddingHorizontal: 4, borderRadius: 5, borderWidth: 1.5, borderColor: Colors[colorScheme].border, margin: 4, },
    dayChipSelected: { backgroundColor: gymColor || '#1a5276' },
    dayChipText: { fontSize: 14, color: Colors[colorScheme].text },
    dayChipTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
    slotItem: { padding: 12, marginVertical: 5, borderRadius: 5, borderWidth: 1, borderColor: Colors[colorScheme].border },
    slotItemSelected: { borderColor: gymColor, backgroundColor: gymColor + '20' },
    slotText: { textAlign: 'center', fontSize: 14, color: Colors[colorScheme].text },
    slotTextSelected: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: gymColor },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 10, },
    buttonWrapper: { borderRadius: 5, overflow: 'hidden', marginTop: 10, },
    filterButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 5, paddingHorizontal: 10, marginBottom: 15, backgroundColor: Colors[colorScheme].background, },
    filterButtonText: { fontSize: 14, color: Colors[colorScheme].text, },
    counterContainer: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15,paddingBottom:0, marginBottom:0},
    counterLabel: { fontSize: 14, color: Colors[colorScheme].text },
    counterText: { fontSize: 20, fontWeight: 'bold', color: Colors[colorScheme].icon },
    overLimitText: { color: '#e74c3c' },
    upgradeButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: gymColor,
        paddingVertical: 10, paddingHorizontal: 15, borderRadius: 5,
    },
    upgradeButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
    fabScanner: { 
        position: 'absolute', width: 60, height: 60, alignItems: 'center',
        justifyContent: 'center', right: 20, bottom: 90, 
        backgroundColor: gymColor || '#3498db', 
        borderRadius: 30, elevation: 8,
    },
    paseLibreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00ce9bff', // Un color dorado/amarillo para destacarlo
        borderRadius: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginTop: 10,
        alignSelf: 'flex-start', // Para que no ocupe todo el ancho
    },
    paseLibreText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 6,
    },

});

export default ManageClientsScreen;