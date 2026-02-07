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
import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns';
import BillingModalContent from '@/components/admin/BillingModalContent';
import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';
import UpgradePlanModal from '../../components/admin/UpgradePlanModal';
import QrScannerModal from '../../components/profesor/QrScannerModal'
import WebDatePicker from '@/components/WebDatePicker';

// --- COMPONENTE: Tarjeta de Estadística ---
const StatCard = ({ label, value, icon, color, action, actionLabel, isValueHidden, onToggleHidden, styles, style,  }) => {
    // Protección contra crash si styles no llega
    const safeStyles = styles || {}; 
     const { gymColor } = useAuth();

    return (
        <View style={[safeStyles.statCard, style, ]}>
            <View style={safeStyles.statHeader}>
                <Text style={safeStyles.statLabel}>{label}</Text>
                {onToggleHidden && (
                    <TouchableOpacity onPress={onToggleHidden} style={{ padding: 4 }}>
                        <Ionicons 
                            name={isValueHidden ? "eye-off" : "eye"} 
                            size={20} 
                            color={safeStyles.statLabel?.color || '#666'} 
                        />
                    </TouchableOpacity>
                )}
            </View>
            
            <View style={safeStyles.statContent}>
                <View style={[safeStyles.iconCircle, { backgroundColor: color + '20' }]}> 
                    {icon}
                </View>
                <Text style={[safeStyles.statValue, { color: color }]}>
                    {isValueHidden ? '••••••' : value}
                </Text>
            </View>

            {action && (
                <TouchableOpacity style={[safeStyles.statAction, { backgroundColor: color + '15' }]} onPress={action}>
                    <Text style={[safeStyles.statActionText, { color: color }]}>{actionLabel}</Text>
                    <Ionicons name="chevron-forward" size={12} color={color} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const formatDateUTC = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const ManageClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [subscriptionInfo, setSubscriptionInfo] = useState({ clientCount: 0, clientLimit: 100 });
    
    // NUEVO ESTADO: Deuda Total desde el Backend
    const [debtStats, setDebtStats] = useState({ totalDebt: 0, debtorCount: 0 });

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    
    const dynamicStyles = getStyles(colorScheme, gymColor); 

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
     
    const [datePickerConfig, setDatePickerConfig] = useState({
        visible: false, field: null, currentValue: new Date(), onConfirm: () => {}, onChange: () => {}
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
    
    // --- ESTADO VISIBILIDAD DEUDA ---
    const [isDebtVisible, setIsDebtVisible] = useState(false); 

    const handleToggleDebtVisibility = () => {
        setIsDebtVisible(!isDebtVisible);
    };

    const fetchAllData = useCallback(async () => {
        try {
            // AHORA HACEMOS 4 PETICIONES, INCLUYENDO LA DE DEUDA
            const [usersResponse, classTypesResponse, subInfoResponse, debtResponse] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/tipos-clase'),
                apiClient.get('/users/subscription-info'),
                apiClient.get('/users/financial-stats') 
            ]);

            setUsers(usersResponse.data.filter(u => u && (u.roles.includes('cliente') || u.roles.includes('profesor'))));
            setClassTypes(classTypesResponse.data.tiposClase || []);
            setSubscriptionInfo(subInfoResponse.data);
            setDebtStats(debtResponse.data); 

        } catch (error) {
            console.error(error); // Log para ver si falla la nueva ruta
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    const onRefresh = useCallback(async () => { setIsRefreshing(true); await fetchAllData(); setIsRefreshing(false); }, [fetchAllData]);

    useFocusEffect(useCallback(() => { setLoading(true); fetchAllData(); setIsDebtVisible(false); }, [fetchAllData]));

    useEffect(() => {
        if (selectedClient) {
            const updatedClient = users.find(u => u._id === selectedClient._id);
            if (updatedClient && JSON.stringify(updatedClient) !== JSON.stringify(selectedClient)) setSelectedClient(updatedClient);
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

    // ... Handlers (iguales) ...
    const handleUpgradePlan = async () => { setIsSubmitting(true); try { const response = await apiClient.put('/users/upgrade-plan'); setAlertInfo({ visible: true, title: '¡Plan Ampliado!', message: `Tu límite de clientes ha sido aumentado a ${response.data.newLimit}.`, buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] }); setActiveModal(null); await fetchAllData(); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo ampliar el plan.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] }); } finally { setIsSubmitting(false); } };
    const handleAddClientSubmit = async () => { setLoading(true); try { if (!newClientData.nombre || !newClientData.email || !newClientData.contraseña) throw new Error('Por favor, ingresa todos los campos obligatorios.'); await apiClient.post('/auth/register', newClientData); setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio registrado correctamente.'}); setActiveModal(null); await fetchAllData(); } catch (error) { let errorMessage = 'Ocurrió un error inesperado.'; if (error.response?.data?.message) errorMessage = error.response.data.message; else if (error.message) errorMessage = error.message; if (error.response?.status === 403) setActiveModal('upgrade'); else setAlertInfo({ visible: true, title: 'Error de Registro', message: errorMessage }); } finally { setLoading(false); } };
    const handleOpenBillingModal = (client) => { setSelectedClient(client); setBillingModalVisible(true); };
    const handleOpenCreditsModal = (client) => { setSelectedClient(client); setPlanData({ tipoClaseId: '', creditsToAdd: '0', isSubscription: false, autoRenewAmount: '8' }); setMassEnrollFilters({ tipoClaseId: '', diasDeSemana: [], fechaInicio: '', fechaFin: '' }); setAvailableSlots([]); setSelectedSlot(null); setCreditsModalVisible(true); };
    const handleOpenEditModal = (client) => { const clientRoles = Array.isArray(client.roles) && client.roles.length > 0 ? client.roles : ['cliente']; setEditingClientData({ ...client, roles: clientRoles, ordenMedicaRequerida: client.ordenMedicaRequerida || false, ordenMedicaEntregada: client.ordenMedicaEntregada || false }); if (client.fechaNacimiento && isValid(parseISO(client.fechaNacimiento))) { const date = parseISO(client.fechaNacimiento); setEditingClientDay(format(date, 'dd')); setEditingClientMonth(format(date, 'MM')); setEditingClientYear(format(date, 'yyyy')); } else { setEditingClientDay(''); setEditingClientMonth(''); setEditingClientYear(''); } setShowEditFormModal(true); };
    const handleOpenAddModal = () => { setNewClientData({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', numeroTelefono: '', obraSocial: '', roles: ['cliente'], ordenMedicaRequerida: false, ordenMedicaEntregada: false, puedeGestionarEjercicios: false }); setNewClientDay(''); setNewClientMonth(''); setNewClientYear(''); setShowAddFormModal(true); };
    const handleDeleteClient = (client) => { setAlertInfo({ visible: true, title: "Eliminar Socio", message: `¿Estás seguro de que quieres eliminar a ${client.nombre} ${client.apellido}?`, buttons: [ { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) }, { text: "Eliminar", style: "destructive", onPress: async () => { setAlertInfo({ visible: false }); try { await apiClient.delete(`/users/${client._id}`); setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio eliminado correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); fetchAllData(); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar al socio.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } } } ] }); };
    const handlePlanSubmit = async () => { if (!selectedClient || !planData.tipoClaseId) { setAlertInfo({ visible: true, title: 'Error', message: 'Por favor, selecciona un tipo de Turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); return; } const payload = { tipoClaseId: planData.tipoClaseId, creditsToAdd: Number(planData.creditsToAdd) || 0, isSubscription: planData.isSubscription, autoRenewAmount: Number(planData.autoRenewAmount) || 0, }; try { await apiClient.put(`/users/${selectedClient._id}/plan`, payload); setAlertInfo({ visible: true, title: 'Éxito', message: 'El plan del socio ha sido actualizado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); fetchAllData(); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } };
    const findAvailableSlots = async () => { const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters; if (!tipoClaseId || diasDeSemana.length === 0 || !fechaInicio ) { setAlertInfo({ visible: true, title: 'Error', message: 'Completa todos los filtros para buscar horarios.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); return; } setIsLoadingSlots(true); try { const params = { tipoClaseId, diasDeSemana: diasDeSemana.join(','), fechaInicio }; if (fechaFin) { params.fechaFin = fechaFin; } const response = await apiClient.get('/classes/available-slots', {params}); setAvailableSlots(response.data); if (response.data.length === 0) { setAlertInfo({ visible: true, title: 'Sin resultados', message: 'No se encontraron horarios disponibles para esa combinación.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron buscar los horarios.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } finally { setIsLoadingSlots(false); } };
    const handleMassEnrollSubmit = async () => { if (!selectedClient || !selectedSlot) { setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un horario para inscribir.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); return; } const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters; const { horaInicio, horaFin } = selectedSlot; const payload = { tipoClaseId, diasDeSemana, fechaInicio, horaInicio, horaFin }; if (fechaFin) { payload.fechaFin = fechaFin; } setAlertInfo({ visible: true, title: "Confirmar Inscripción Masiva", message: `¿Inscribir a ${selectedClient.nombre} en este plan?`, buttons: [ { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) }, { text: "Inscribir", style: "primary", onPress: async () => { setAlertInfo({ visible: false }); try { await apiClient.post(`/users/${selectedClient._id}/subscribe-to-plan`, payload); setAlertInfo({ visible: true, title: 'Éxito', message: 'El socio ha sido inscrito en el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); fetchAllData(); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo procesar la inscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } } } ] }); };
    const handleDaySelection = (day) => { const currentDays = massEnrollFilters.diasDeSemana; const newDays = currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day]; setMassEnrollFilters(prev => ({ ...prev, diasDeSemana: newDays })); };
    const handleNewClientChange = (name, value) => setNewClientData(prev => ({ ...prev, [name]: value }));
    const handleEditingClientChange = (name, value) => setEditingClientData(prev => ({ ...prev, [name]: value }));
    const handleUpdateClientSubmit = async () => { if (!editingClientData) return; const updatePayload = { nombre: editingClientData.nombre, apellido: editingClientData.apellido, email: editingClientData.email, dni: editingClientData.dni, sexo: editingClientData.sexo, fechaNacimiento: editingClientData.fechaNacimiento, numeroTelefono: editingClientData.numeroTelefono, telefonoEmergencia: editingClientData.telefonoEmergencia, obraSocial: editingClientData.obraSocial, roles: editingClientData.roles, direccion: editingClientData.direccion, ordenMedicaRequerida: editingClientData.ordenMedicaRequerida, ordenMedicaEntregada: editingClientData.ordenMedicaEntregada, puedeGestionarEjercicios: editingClientData.puedeGestionarEjercicios, }; try { await apiClient.put(`/users/${editingClientData._id}`, updatePayload); setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio actualizado correctamente.' }); setShowEditFormModal(false); fetchAllData(); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar al socio.' }); } };
    const handleToggleMedicalOrder = (user) => { const newStatus = !user.ordenMedicaEntregada; const actionText = newStatus ? "marcar como ENTREGADA" : "marcar como PENDIENTE"; setAlertInfo({ visible: true, title: `Confirmar Orden Médica`, message: `¿Estás seguro de que quieres ${actionText} la orden médica de ${user.nombre} ${user.apellido}?`, buttons: [ { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) }, { text: "Confirmar", style: "primary", onPress: async () => { setAlertInfo({ visible: false }); try { await apiClient.put(`/users/${user._id}`, { ordenMedicaEntregada: newStatus }); setUsers(currentUsers => currentUsers.map(u => u._id === user._id ? { ...u, ordenMedicaEntregada: newStatus } : u)); setAlertInfo({ visible: true, title: 'Éxito', message: 'El estado de la orden médica ha sido actualizado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el estado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } } } ] }); };
    const getModalConfig = useMemo(() => { const classTypeOptions = [{ _id: '', nombre: 'Selecciona un tipo' }, ...classTypes]; const roleOptions = [{ _id: 'cliente', nombre: 'Cliente' }, { _id: 'profesor', nombre: 'Profesional' }, { _id: 'admin', nombre: 'Admin' }]; switch (activeModal) { case 'addRole': return { title: 'Seleccionar Rol', options: roleOptions, onSelect: (id) => handleNewClientChange('roles', [id]), selectedValue: newClientData.roles[0] }; case 'editRole': return { title: 'Seleccionar Rol', options: roleOptions, onSelect: (id) => handleEditingClientChange('roles', [id]), selectedValue: editingClientData?.roles[0] }; case 'creditsClassType': return { title: 'Seleccionar Tipo de Turno', options: classTypeOptions, onSelect: (id) => setPlanData(prev => ({ ...prev, tipoClaseId: id })), selectedValue: planData.tipoClaseId }; case 'massEnrollClassType': return { title: 'Seleccionar Tipo de Turno', options: classTypeOptions, onSelect: (id) => setMassEnrollFilters(prev => ({ ...prev, tipoClaseId: id, diasDeSemana: [] })), selectedValue: massEnrollFilters.tipoClaseId }; default: return null; } }, [activeModal, classTypes, newClientData.roles, editingClientData?.roles, planData.tipoClaseId, massEnrollFilters.tipoClaseId]);
    const getDisplayName = (id, type) => { if (!id) return 'Seleccionar'; if (type === 'classType') return classTypes.find(t => t._id === id)?.nombre || 'Seleccionar'; if (type === 'role') return id.charAt(0).toUpperCase() + id.slice(1); return 'Seleccionar'; };
    const filteredData = useMemo(() => { if (!searchTerm) return users; return users.filter(user => `${user.nombre} ${user.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase()) ); }, [users, searchTerm]);
    const getTypeName = (typeId) => { const classType = classTypes.find(t => t._id === typeId); return classType?.nombre || 'Desconocido'; };
    const showDatePickerFor = (field, initialDateString, onChangeCallback) => { const initialDate = initialDateString ? parseISO(initialDateString) : new Date(); const handleDateChange = (event, selectedDate) => { const currentDate = selectedDate || initialDate; if (Platform.OS === 'android') { setDatePickerConfig(prev => ({ ...prev, visible: false })); if (event.type !== 'dismissed') { onChangeCallback(format(currentDate, 'yyyy-MM-dd')); } } else { setDatePickerConfig(prev => ({ ...prev, currentValue: currentDate })); } }; const handleConfirmIos = (dateToConfirm) => { onChangeCallback(format(dateToConfirm, 'yyyy-MM-dd')); setDatePickerConfig(prev => ({ ...prev, visible: false })); }; setDatePickerConfig({ visible: true, field: field, currentValue: initialDate, onChange: handleDateChange, onConfirm: handleConfirmIos }); };
    const renderDateField = (label, value, onChange) => { const displayValue = value ? format(parseISO(value), 'dd/MM/yyyy') : `Seleccionar ${label}`; if (Platform.OS === 'web') { return ( <View style={dynamicStyles.dateFieldContainer}> <ThemedText style={dynamicStyles.inputLabel}>{label}</ThemedText> <WebDatePicker selected={value ? parseISO(value) : null} onChange={(date) => onChange(format(date, 'yyyy-MM-dd'))} dateFormat="dd/MM/yyyy" popperPlacement="top-start" customInput={ <TouchableOpacity style={dynamicStyles.dateInputTouchable}> <Text style={dynamicStyles.dateInputText}>{displayValue}</Text> </TouchableOpacity> } /> </View> ); } return ( <View style={dynamicStyles.dateFieldContainer}> <ThemedText style={dynamicStyles.inputLabel}>{label}</ThemedText> <TouchableOpacity onPress={() => showDatePickerFor(label, value, onChange)} style={dynamicStyles.dateInputTouchable}> <Text style={dynamicStyles.dateInputText}>{displayValue}</Text> </TouchableOpacity> </View> ); };
    const handlePaseLibreDateChange = (field, dateString) => { setPaseLibreData(prev => ({ ...prev, [field]: dateString })); };
    const handleSavePaseLibre = async () => { if (!selectedClient || !paseLibreData.desde || !paseLibreData.hasta) { return setAlertInfo({ visible: true, title: 'Error', message: 'Debes seleccionar ambas fechas.' }); } try { await apiClient.put(`/users/${selectedClient._id}/pase-libre`, { paseLibreDesde: paseLibreData.desde, paseLibreHasta: paseLibreData.hasta, }); fetchAllData(); setAlertInfo({ visible: true, title: 'Éxito', message: 'Pase Libre actualizado.' }); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo guardar el Pase Libre.' }); } };
    const handleMassEnrollDateChange = (field, dateString) => { setMassEnrollFilters(prev => ({ ...prev, [field]: dateString })); };
    const handleGeneralScan = async ({ data }) => { setScannerVisible(false); try { const response = await apiClient.post('/check-in/scan', { userId: data }); let messageDetail = 'No hay turnos pendientes para hoy.'; if (response.data.classes && response.data.classes.length > 0) { messageDetail = response.data.classes.map(c => `${c.nombre} ${c.horario}`).join('\n'); } else if (response.data.message.includes('finalizaron')) { messageDetail = 'Todos sus turnos de hoy ya finalizaron.'; } setAlertInfo({ visible: true, title: response.data.message, message: messageDetail, }); } catch (error) { setAlertInfo({ visible: true, title: 'Error de Check-in', message: error.response?.data?.message || 'No se pudo verificar al cliente.', }); } };
    const handleToggleUserStatus = async (user, newStatus) => { try { await apiClient.put(`/users/${user._id}/status`, { isActive: newStatus }); setUsers(currentUsers => currentUsers.map(u => u._id === user._id ? { ...u, isActive: newStatus } : u)); setEditingClientData(prev => ({ ...prev, isActive: newStatus })); setAlertInfo({ visible: true, title: 'Éxito', message: 'El estado del cliente ha sido actualizado.' }); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo actualizar el estado.' }); setEditingClientData(prev => ({ ...prev, isActive: !newStatus })); } };
    const handleQuickRemovePaseLibre = (client) => { setAlertInfo({ visible: true, title: "Quitar Pase Libre", message: `¿Estás seguro de que quieres quitar el Pase Libre a ${client.nombre} ${client.apellido}?`, buttons: [ { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) }, { text: "Quitar", style: "destructive", onPress: async () => { setAlertInfo({ visible: false }); try { await apiClient.delete(`/users/${client._id}/pase-libre`); setAlertInfo({ visible: true, title: 'Éxito', message: 'Pase Libre eliminado correctamente.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] }); fetchAllData(); } catch (error) { setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar el Pase Libre.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] }); } } } ] }); };

    const renderUserCard = ({ item }) => {
        const hasCredits = Object.values(item.creditosPorTipo || {}).some(amount => amount > 0);
        const today = startOfDay(new Date()); 
        const paseLibreDate = item.paseLibreHasta ? parseISO(item.paseLibreHasta) : null;
        const isPaseLibreActive = paseLibreDate && isValid(paseLibreDate) && !isBefore(paseLibreDate, today);
        const isPaseLibreExpired = paseLibreDate && isValid(paseLibreDate) && isBefore(paseLibreDate, today);
        
        // --- CALCULO DEUDA INDIVIDUAL ---
        const balance = item.balance || 0;
        const isDebtor = balance < 0; 

        return (
            <View style={[dynamicStyles.card, !item.isActive && dynamicStyles.inactiveCard]}>
                <View style={dynamicStyles.cardTopRow}>
                    <View style={dynamicStyles.userInfo}>
                        <Text style={dynamicStyles.cardTitle}>{item.nombre} {item.apellido}</Text>
                        <Text style={dynamicStyles.cardSubtitle}>{item.email}</Text>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap:'wrap', marginTop: 5}}>
                            <View style={[dynamicStyles.roleBadge, item.roles.includes('admin') ? dynamicStyles.adminBadge : (item.roles.includes('profesor') ? dynamicStyles.profesorBadge : dynamicStyles.clienteBadge)]}>
                                <Text style={dynamicStyles.roleText}>{item.roles.join(', ')}</Text>
                            </View>

                            {item.roles.includes('cliente') && (
                                <View style={[dynamicStyles.balanceBadge, isDebtor ? dynamicStyles.debtBadge : dynamicStyles.paidBadge]}>
                                    <Ionicons name={isDebtor ? "alert-circle" : "checkmark-circle"} size={12} color={isDebtor ? "#c0392b" : "#27ae60"} style={{marginRight: 4}} />
                                    <Text style={[dynamicStyles.balanceText, {color: isDebtor ? "#c0392b" : "#27ae60"}]}>
                                        {/* AQUI SE MUESTRA LO QUE DEBE EL INDIVIDUO */}
                                        {isDebtor ? `Debe: $${Math.abs(balance).toFixed(2)}` : 'Al día'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={dynamicStyles.actionsContainer}>
                        {item.roles.includes('cliente') && (
                        <TouchableOpacity style={dynamicStyles.actionButton} onPress={() => handleOpenBillingModal(item)}>
                            <Ionicons name="logo-usd" size={22} color='#28a745' />
                        </TouchableOpacity>
                         )}
                        {item.roles.includes('cliente') && (
                        <TouchableOpacity style={dynamicStyles.actionButton} onPress={() => handleOpenCreditsModal(item)}>
                            <Ionicons name="card" size={22} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                         )}
                         {(isPaseLibreActive || isPaseLibreExpired) && (
                            <TouchableOpacity 
                                style={dynamicStyles.actionButton} 
                                onPress={() => handleQuickRemovePaseLibre(item)}
                            >
                                <Ionicons name="star" size={22} color="#e74c3c" />
                            </TouchableOpacity>
                        )}
                        {item?.ordenMedicaRequerida && (
                            <TouchableOpacity style={dynamicStyles.actionButton} onPress={() => handleToggleMedicalOrder(item)}>
                                <Ionicons name={item.ordenMedicaEntregada ? "document-text" : "document-text"} size={22} color={item.ordenMedicaEntregada ? '#28a745' : '#dc3545'} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={dynamicStyles.actionButton} onPress={() => handleOpenEditModal(item)}>
                            <FontAwesome name="user" size={22} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={dynamicStyles.actionButton} onPress={() => handleDeleteClient(item)}>
                            <Octicons name="trash" size={22} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </View>
                </View>
                {hasCredits && (
                    <View style={dynamicStyles.creditsContainer}>
                        {Object.entries(item.creditosPorTipo || {}).map(([typeId, amount]) => {
                            if (amount > 0) {
                                return (
                                    <View key={typeId} style={dynamicStyles.creditChip}>
                                        <Text style={dynamicStyles.creditText}>{getTypeName(typeId)}: {amount}</Text>
                                    </View>
                                );
                            }
                            return null;
                        })}
                    </View>
                )}
                {isPaseLibreActive && (
                    <View style={dynamicStyles.paseLibreContainer}>
                        <Ionicons name="star" size={14} color="#fff" />
                        <Text style={dynamicStyles.paseLibreText}>
                           Pase Libre hasta - {formatDateUTC(item.paseLibreHasta)}
                        </Text>
                    </View>
                )}
                {isPaseLibreExpired && (
                    <View style={[dynamicStyles.paseLibreContainer, { backgroundColor: '#e74c3c' }]}> 
                        <Ionicons name="alert-circle" size={14} color="#fff" />
                        <Text style={dynamicStyles.paseLibreText}>
                            Pase Libre Vencido - {formatDateUTC(item.paseLibreHasta)}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return <ThemedView style={dynamicStyles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={dynamicStyles.container} >
            <View style={dynamicStyles.headerContainer}>
                <ThemedText style={dynamicStyles.headerTitle}>Gestión de Usuarios</ThemedText>
            </View>

            {/* --- DASHBOARD STATISTICS --- */}
            <View style={dynamicStyles.statsContainer}>
                <StatCard 
                    label="Clientes Activos"
                    value={`${subscriptionInfo.clientCount} / ${subscriptionInfo.clientLimit}`}
                    icon={<Ionicons name="people" size={18} color={gymColor} />}
                    color={Colors[colorScheme].text}
                    action={() => setActiveModal('upgrade')}
                    actionLabel="Ampliar"
                    styles={dynamicStyles} 
                    style={{ flex: 1 }}
                />
                
                <StatCard 
                    label="Deuda Total"
                    value={`$${debtStats.totalDebt} `}
                    icon={<FontAwesome5 name="money-bill-wave" size={16} color="#e74c3c" />}
                    color={Colors[colorScheme].text}
                    isValueHidden={!isDebtVisible}
                    onToggleHidden={handleToggleDebtVisibility}
                    styles={dynamicStyles} 
                    style={{ flex: 1.3 }}
                />
            </View>
            
            <View style={dynamicStyles.searchInputContainer}>
                <TextInput
                    style={dynamicStyles.searchInput}
                    placeholder="Buscar usuario..."
                    placeholderTextColor={Colors[colorScheme].icon}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                <FontAwesome5 name="search" size={16} color={Colors[colorScheme].icon} style={dynamicStyles.searchIcon} />
            </View>
            
            <FlatList
                data={filteredData}
                renderItem={renderUserCard}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={<ThemedText style={dynamicStyles.emptyText}>No se encontraron usuarios.</ThemedText>}
                refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={gymColor} 
                        />
                    }
            />
            
            {/* ... FABS ... */}
            <TouchableOpacity style={dynamicStyles.fabScanner} onPress={() => setScannerVisible(true)}>
                <Ionicons name="qr-code" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.fab} onPress={handleOpenAddModal}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            <UpgradePlanModal
                visible={activeModal === 'upgrade'}
                onClose={() => setActiveModal(null)}
                onConfirm={handleUpgradePlan}
                currentCount={subscriptionInfo.clientCount}
                currentLimit={subscriptionInfo.clientLimit}
                gymColor={gymColor}
            />

            {/* ... Modales de Add/Edit/Billing/Credits se mantienen igual ... */}
            {showAddFormModal && (
                 <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={dynamicStyles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
                <Pressable style={dynamicStyles.modalOverlay} onPress={() => setShowAddFormModal(false)}>
                    <Pressable style={dynamicStyles.modalView}>
                        <TouchableOpacity onPress={() => setShowAddFormModal(false)} style={dynamicStyles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView>
                            <ThemedText style={dynamicStyles.modalTitle}>Registrar Nuevo Socio</ThemedText>
                            <ThemedText style={dynamicStyles.inputLabel}>Nombre</ThemedText>
                            <TextInput style={dynamicStyles.input} value={newClientData.nombre} onChangeText={(text) => handleNewClientChange('nombre', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>Apellido</ThemedText>
                            <TextInput style={dynamicStyles.input} value={newClientData.apellido} onChangeText={(text) => handleNewClientChange('apellido', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>Email</ThemedText>
                            <TextInput style={dynamicStyles.input} keyboardType="email-address" autoCapitalize="none" value={newClientData.email} onChangeText={(text) => handleNewClientChange('email', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>Contraseña</ThemedText>
                            <TextInput style={dynamicStyles.input} secureTextEntry value={newClientData.contraseña} onChangeText={(text) => handleNewClientChange('contraseña', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>DNI</ThemedText>
                            <TextInput style={dynamicStyles.input} keyboardType="numeric" value={newClientData.dni} onChangeText={(text) => handleNewClientChange('dni', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>Fecha de Nacimiento</ThemedText>
                            <View style={dynamicStyles.dateInputContainer}>
                                <TextInput style={dynamicStyles.dateInput} placeholder="DD" value={newClientDay} onChangeText={setNewClientDay} keyboardType="number-pad" maxLength={2} />
                                <TextInput style={dynamicStyles.dateInput} placeholder="MM" value={newClientMonth} onChangeText={setNewClientMonth} keyboardType="number-pad" maxLength={2} />
                                <TextInput style={dynamicStyles.dateInput} placeholder="AAAA" value={newClientYear} onChangeText={setNewClientYear} keyboardType="number-pad" maxLength={4} />
                            </View>
                            <ThemedText style={dynamicStyles.inputLabel}>Teléfono de Emergencia</ThemedText>
                            <TextInput style={dynamicStyles.input} keyboardType="phone-pad" value={newClientData.telefonoEmergencia} onChangeText={(text) => handleNewClientChange('telefonoEmergencia', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>Teléfono</ThemedText>
                            <TextInput style={dynamicStyles.input} keyboardType="phone-pad" value={newClientData.numeroTelefono} onChangeText={(text) => handleNewClientChange('numeroTelefono', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>Obra Social</ThemedText>
                            <TextInput style={dynamicStyles.input} value={newClientData.obraSocial} onChangeText={(text) => handleNewClientChange('obraSocial', text)} />
                            <ThemedText style={dynamicStyles.inputLabel}>Rol</ThemedText>
                            <TouchableOpacity style={dynamicStyles.filterButton} onPress={() => setActiveModal('addRole')}>
                                <ThemedText style={dynamicStyles.filterButtonText}>{getDisplayName(newClientData.roles[0], 'role')}</ThemedText>
                                <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                            <View style={dynamicStyles.switchRow}>
                                <ThemedText style={dynamicStyles.inputLabel}>¿Requiere Orden Médica?</ThemedText>
                                <Switch value={newClientData.ordenMedicaRequerida} onValueChange={(value) => handleNewClientChange('ordenMedicaRequerida', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                            </View>
                            {newClientData.ordenMedicaRequerida && (
                                <View style={dynamicStyles.switchRow}>
                                    <ThemedText style={dynamicStyles.inputLabel}>¿Orden Médica Entregada?</ThemedText>
                                    <Switch value={newClientData.ordenMedicaEntregada} onValueChange={(value) => handleNewClientChange('ordenMedicaEntregada', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                </View>
                            )}
                            <View style={dynamicStyles.modalActions}><View style={dynamicStyles.buttonWrapper}><Button title="Registrar" onPress={handleAddClientSubmit} color={gymColor} /></View></View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
             </KeyboardAvoidingView>
            )}

            {showEditFormModal && (
                 <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={dynamicStyles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
                <Pressable style={dynamicStyles.modalOverlay} onPress={() => setShowEditFormModal(false)}>
                    {editingClientData && (
                        <Pressable style={dynamicStyles.modalView}>
                            <TouchableOpacity onPress={() => setShowEditFormModal(false)} style={dynamicStyles.closeButton}>
                                <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                            </TouchableOpacity>
                            <ScrollView>
                                <ThemedText style={dynamicStyles.modalTitle}>Editar Socio</ThemedText>
                                <ThemedText style={dynamicStyles.inputLabel}>Nombre</ThemedText>
                                <TextInput style={dynamicStyles.input} value={editingClientData.nombre} onChangeText={(text) => handleEditingClientChange('nombre', text)} />
                                <ThemedText style={dynamicStyles.inputLabel}>Apellido</ThemedText>
                                <TextInput style={dynamicStyles.input} value={editingClientData.apellido} onChangeText={(text) => handleEditingClientChange('apellido', text)} />
                                <ThemedText style={dynamicStyles.inputLabel}>DNI</ThemedText>
                                <TextInput style={dynamicStyles.input} keyboardType="numeric" value={editingClientData.dni} onChangeText={(text) => handleEditingClientChange('dni', text)} />
                                <ThemedText style={dynamicStyles.inputLabel}>Fecha de Nacimiento</ThemedText>
                                <View style={dynamicStyles.dateInputContainer}>
                                    <TextInput style={dynamicStyles.dateInput} placeholder="DD" value={editingClientDay} onChangeText={setEditingClientDay} keyboardType="number-pad" maxLength={2} />
                                    <TextInput style={dynamicStyles.dateInput} placeholder="MM" value={editingClientMonth} onChangeText={setEditingClientMonth} keyboardType="number-pad" maxLength={2} />
                                    <TextInput style={dynamicStyles.dateInput} placeholder="AAAA" value={editingClientYear} onChangeText={setEditingClientYear} keyboardType="number-pad" maxLength={4} />
                                </View>
                                <ThemedText style={dynamicStyles.inputLabel}>Teléfono de Emergencia</ThemedText>
                                <TextInput style={dynamicStyles.input} keyboardType="phone-pad" value={editingClientData.telefonoEmergencia} onChangeText={(text) => handleEditingClientChange('telefonoEmergencia', text)} />
                                <ThemedText style={dynamicStyles.inputLabel}>Teléfono</ThemedText>
                                <TextInput style={dynamicStyles.input} keyboardType="phone-pad" value={editingClientData.numeroTelefono} onChangeText={(text) => handleEditingClientChange('numeroTelefono', text)} />
                                <ThemedText style={dynamicStyles.inputLabel}>Obra Social</ThemedText>
                                <TextInput style={dynamicStyles.input} value={editingClientData.obraSocial} onChangeText={(text) => handleEditingClientChange('obraSocial', text)} />
                                <ThemedText style={dynamicStyles.inputLabel}>Rol</ThemedText>
                                <TouchableOpacity style={dynamicStyles.filterButton} onPress={() => setActiveModal('editRole')}>
                                    <ThemedText style={dynamicStyles.filterButtonText}>{getDisplayName(editingClientData.roles[0], 'role')}</ThemedText>
                                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                                {editingClientData.roles.includes('cliente') && (
                                <View style={dynamicStyles.switchRow}>
                                    <ThemedText style={dynamicStyles.inputLabel}>¿Requiere Orden Médica?</ThemedText>
                                    <Switch value={editingClientData.ordenMedicaRequerida} onValueChange={(value) => handleEditingClientChange('ordenMedicaRequerida', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                </View>
                                 )}
                                {editingClientData.ordenMedicaRequerida && (
                                    <View style={dynamicStyles.switchRow}>
                                            <ThemedText style={dynamicStyles.inputLabel}>¿Orden Médica Entregada?</ThemedText>
                                            <Switch value={editingClientData.ordenMedicaEntregada} onValueChange={(value) => handleEditingClientChange('ordenMedicaEntregada', value)} trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} />
                                    </View>
                                )}
                               <View style={dynamicStyles.switchRow}>
                            <ThemedText style={dynamicStyles.inputLabel}>Cuenta Activa</ThemedText>
                            <Switch
                                value={editingClientData.isActive}
                                onValueChange={(value) => handleToggleUserStatus(editingClientData, value)}
                                trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"}
                            />
                        </View>
                                <View style={dynamicStyles.modalActions}><View style={dynamicStyles.buttonWrapper}><Button title="Guardar Cambios" onPress={handleUpdateClientSubmit} color={gymColor} /></View></View>
                            
                            </ScrollView>
                        </Pressable>
                    )}
                </Pressable>
                </KeyboardAvoidingView>
            )}

            {billingModalVisible && (
                 <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={dynamicStyles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
                <Pressable style={dynamicStyles.modalOverlay} onPress={() => setBillingModalVisible(false)}>
                    <Pressable style={dynamicStyles.modalView}>
                        {selectedClient && <BillingModalContent client={selectedClient} onClose={() => setBillingModalVisible(false)} onRefresh={fetchAllData} />}
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            )}
        
            {creditsModalVisible && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={dynamicStyles.modalOverlayWrapper}
                    keyboardVerticalOffset={70} 
                >
                <Pressable style={dynamicStyles.modalOverlay} onPress={() => setCreditsModalVisible(false)}>
                    <Pressable style={dynamicStyles.modalView}>
                        <TouchableOpacity onPress={() => setCreditsModalVisible(false)} style={dynamicStyles.closeButton}>
                            <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                        <ScrollView>
                            <ThemedText style={dynamicStyles.modalTitle}>Gestionar Plan de {selectedClient?.nombre}</ThemedText>
                            {selectedClient && Object.values(selectedClient.creditosPorTipo || {}).some(amount => amount > 0) && (
                    <View style={[dynamicStyles.creditsContainer, { marginBottom: 20, justifyContent: 'center' }]}>
                        {Object.entries(selectedClient.creditosPorTipo || {}).map(([typeId, amount]) => {
                            if (amount > 0) {
                                return (
                                    <View key={typeId} style={dynamicStyles.creditChip}>
                                        <Text style={dynamicStyles.creditText}>{getTypeName(typeId)}: {amount}</Text>
                                    </View>
                                );
                            }
                            return null;
                        })}
                    </View>
                )}
                            <View style={dynamicStyles.section}>
                                <ThemedText style={dynamicStyles.sectionTitle}>Carga de Créditos </ThemedText>
                                <ThemedText style={dynamicStyles.inputLabel}>Tipo de Clase</ThemedText>
                                <TouchableOpacity style={dynamicStyles.filterButton} onPress={() => setActiveModal('creditsClassType')}>
                                    <ThemedText style={dynamicStyles.filterButtonText}>{getDisplayName(planData.tipoClaseId, 'classType')}</ThemedText>
                                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                                <ThemedText style={dynamicStyles.inputLabel}>Créditos a Modificar (+/-)</ThemedText>
                                <TextInput style={dynamicStyles.input}  value={planData.creditsToAdd} onChangeText={text => setPlanData(prev => ({ ...prev, creditsToAdd: text }))} />
                                
                                <View style={dynamicStyles.buttonWrapper}><Button title="Aplicar Créditos" onPress={handlePlanSubmit} color={gymColor || '#1a5276'} /></View>
                            </View>
                            <View style={dynamicStyles.section}>
                                <ThemedText style={dynamicStyles.sectionTitle}>Asignar Pase Libre</ThemedText>
                                <View style={dynamicStyles.row}>
                                    <View style={{flex: 1, marginRight: 5}}>
                                        {renderDateField('Desde', paseLibreData.desde, (val) => handlePaseLibreDateChange('desde', val))}
                                    </View>
                                    <View style={{flex: 1, marginLeft: 5}}>
                                        {renderDateField('Hasta', paseLibreData.hasta, (val) => handlePaseLibreDateChange('hasta', val))}
                                    </View>
                                </View>
                                <View style={dynamicStyles.buttonWrapper}>
                                    <Button title="Guardar Pase Libre" onPress={handleSavePaseLibre} color={gymColor} />
                                </View>
                            </View>
                            <View style={dynamicStyles.section}>
                                <ThemedText style={dynamicStyles.sectionTitle}>Inscripción a Horario Fijo</ThemedText>
                                <ThemedText style={dynamicStyles.inputLabel}>Paso 1: Buscar horarios disponibles</ThemedText>
                                <ThemedText style={dynamicStyles.inputLabel}>Tipo de Clase</ThemedText>
                                <TouchableOpacity style={dynamicStyles.filterButton} onPress={() => setActiveModal('massEnrollClassType')}>
                                    <ThemedText style={dynamicStyles.filterButtonText}>{getDisplayName(massEnrollFilters.tipoClaseId, 'classType')}</ThemedText>
                                    <Ionicons name="chevron-down" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                                <ThemedText style={dynamicStyles.inputLabel}>Días de la Semana</ThemedText>
                                <View style={dynamicStyles.weekDayContainer}>
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                                        <TouchableOpacity key={day} onPress={() => handleDaySelection(day)} style={[dynamicStyles.dayChip, massEnrollFilters.diasDeSemana.includes(day) && dynamicStyles.dayChipSelected]}>
                                            <Text style={massEnrollFilters.diasDeSemana.includes(day) ? dynamicStyles.dayChipTextSelected : dynamicStyles.dayChipText}>{day.substring(0, 3)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                               <View style={dynamicStyles.row}>
                                    <View style={{flex: 1, marginRight: 5}}>
                                         {renderDateField('Desde', massEnrollFilters.fechaInicio, (val) => handleMassEnrollDateChange('fechaInicio', val))}
                                    </View>
                                    <View style={{flex: 1, marginLeft: 5}}>
                                         {renderDateField('Hasta', massEnrollFilters.fechaFin, (val) => handleMassEnrollDateChange('fechaFin', val))}
                                    </View>
                                </View>
                                
                                <View style={dynamicStyles.buttonWrapper}>
                                    <Button 
                                        title={isLoadingSlots ? "Buscando..." : "Buscar Horarios"} 
                                        onPress={findAvailableSlots} 
                                        disabled={isLoadingSlots} 
                                        color={gymColor || '#1a5276'} 
                                    />
                                </View>
                                
                                {availableSlots.map((slot, index) => {
                                    let teacherText = 'Sin profesor asignado';
                                    let teacherIdForKey = 'sin-profe';

                                    if (slot.profesores && slot.profesores.length > 0) {
                                        teacherText = slot.profesores
                                            .map(p => p ? `${p.nombre} ${p.apellido || ''}`.trim() : '')
                                            .join(', ');
                                        teacherIdForKey = slot.profesores.map(p => p._id).join('_');
                                    } 
                                    else if (slot.profesor && slot.profesor.nombre) {
                                        teacherText = `${slot.profesor.nombre} ${slot.profesor.apellido || ''}`.trim();
                                        teacherIdForKey = slot.profesor._id;
                                    }

                                    const dataId = `${slot.nombre}-${slot.tipoClase?._id}-${slot.horaInicio}-${teacherIdForKey}`;
                                    let isSelected = false;
                                    if (selectedSlot) {
                                        let selTeacherId = 'sin-profe';
                                        if (selectedSlot.profesores?.length > 0) {
                                            selTeacherId = selectedSlot.profesores.map(p => p._id).join('_');
                                        } else if (selectedSlot.profesor?._id) {
                                            selTeacherId = selectedSlot.profesor._id;
                                        }
                                        const selDataId = `${selectedSlot.nombre}-${selectedSlot.tipoClase?._id}-${selectedSlot.horaInicio}-${selTeacherId}`;
                                        isSelected = dataId === selDataId;
                                    }

                                    return (
                                        <TouchableOpacity 
                                            key={`slot_${index}_${dataId}`} 
                                            style={[dynamicStyles.slotItem, isSelected && dynamicStyles.slotItemSelected]} 
                                            onPress={() => setSelectedSlot(slot)}
                                        >
                                            <Text style={isSelected ? dynamicStyles.slotTextSelected : dynamicStyles.slotText}>
                                                {slot.nombre || 'Turno'} - {teacherText} - {slot.horaInicio}hs - {slot.horaFin}hs
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                                {availableSlots.length > 0 && (
                                    <View style={dynamicStyles.buttonWrapper}>
                                            <Button title="Inscribir a Plan" onPress={handleMassEnrollSubmit} color={gymColor || '#1a5276'} />
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
                </KeyboardAvoidingView>
            )}

           {datePickerConfig.visible && Platform.OS === 'ios' && (
                <Modal transparent={true} animationType="fade" visible={datePickerConfig.visible}>
                    <Pressable style={dynamicStyles.iosPickerOverlay} onPress={() => setDatePickerConfig(prev => ({...prev, visible: false}))}>
                        <Pressable style={dynamicStyles.iosPickerContainer}>
                            <View style={dynamicStyles.iosPickerHeader}>
                                <TouchableOpacity onPress={() => setDatePickerConfig(prev => ({...prev, visible: false}))}>
                                    <Text style={{color: Colors[colorScheme].text}}>Cancelar</Text>
                                </TouchableOpacity>
                                <Text style={{fontWeight: 'bold', color: Colors[colorScheme].text}}>Seleccionar Fecha</Text>
                                <TouchableOpacity onPress={() => datePickerConfig.onConfirm(datePickerConfig.currentValue)}>
                                    <Text style={{color: gymColor, fontWeight: 'bold'}}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={datePickerConfig.currentValue}
                                mode="date"
                                display="inline" 
                                onChange={datePickerConfig.onChange}
                                themeVariant={colorScheme}
                                style={{backgroundColor: Colors[colorScheme].background}}
                            />
                        </Pressable>
                    </Pressable>
                </Modal>
            )}

            {/* --- PICKER DE FECHA PARA ANDROID --- */}
            {datePickerConfig.visible && Platform.OS === 'android' && (
                <DateTimePicker
                    value={datePickerConfig.currentValue}
                    mode="date"
                    display="default"
                    onChange={datePickerConfig.onChange}
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
    
    modalOverlayWrapper: {
        ...StyleSheet.absoluteFillObject, 
        zIndex: 1000, 
        
    },
    container: { flex: 1 },
    headerContainer: {
        backgroundColor: gymColor,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    statsContainer: {
        flexDirection: 'row', 
        paddingHorizontal: 15, 
        paddingTop: 15, 
        justifyContent: 'space-between', 
        gap: 12
    },

    // --- NUEVO STAT CARD (Dashboard Style) ---
    statCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 12,
        padding: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 2 },
        justifyContent: 'space-between',
        borderWidth: 1, borderColor: Colors[colorScheme].border
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    statLabel: {
        fontSize: 11,
        color: Colors[colorScheme].icon,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    statContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    iconCircle: {
        width: 32, height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center'
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5
    },
    statAction: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start'
    },
    statActionText: {
        fontSize: 10,
        fontWeight: 'bold',
        marginRight: 4
    },
    // ----------------------------------------

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
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, padding: 15, marginVertical: 6, marginHorizontal: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, borderWidth: 1, borderColor: Colors[colorScheme].border },
    inactiveCard: {
        opacity: 0.6,
        backgroundColor: Colors[colorScheme].background,
    },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, },
    userInfo: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 2 },
    actionsContainer: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { marginLeft: 12, },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: gymColor || '#1a5276', borderRadius: 30, elevation: 8,shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41,  },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
    roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
    roleText: { fontSize: 10, fontWeight: 'bold', textTransform: 'capitalize', color: '#000' },
    clienteBadge: { backgroundColor: '#e0f3ffff' },
    profesorBadge: { backgroundColor: '#d1e7dd' },
    adminBadge: { backgroundColor: '#eff7d3ff' },
    balanceBadge: { 
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, 
        flexDirection: 'row', alignItems: 'center', 
    },
    debtBadge: { backgroundColor: '#fdf2f2', borderColor: '#e74c3c', borderWidth: 1 },
    paidBadge: { backgroundColor: '#f0fdf4', borderColor: '#27ae60', borderWidth: 1 },
    balanceText: { fontSize: 10, fontWeight: 'bold' },
    creditsContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 8, },
    creditChip: { backgroundColor: gymColor + '15', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginRight: 5, marginBottom: 4, },
    creditText: { color: Colors[colorScheme].text, fontSize: 10, fontWeight: '600', },
    modalOverlay: {  position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', width: '100%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10, },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text, paddingTop: 10 },
    inputLabel: { fontSize: 14, marginBottom: 6, color: Colors[colorScheme].text, opacity: 0.8 },
    input: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, color: Colors[colorScheme].text, fontSize: 14, backgroundColor: Colors[colorScheme].background },
    modalActions: { marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
    dateInputContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    dateInput: { borderWidth: 1, borderColor: Colors[colorScheme].border, padding: 12, borderRadius: 8, fontSize: 16, color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].background, textAlign: 'center', flex: 1, marginHorizontal: 4, },
    section: { marginBottom: 15, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15, color: Colors[colorScheme].text },
    planItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, },
    planText: { fontSize: 14, color: Colors[colorScheme].text, flex: 1 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 5 },
    weekDayContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 },
    dayChip: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: Colors[colorScheme].border, margin: 4, },
    dayChipSelected: { backgroundColor: gymColor || '#1a5276', borderColor: gymColor },
    dayChipText: { fontSize: 12, color: Colors[colorScheme].text },
    dayChipTextSelected: { color: '#FFFFFF', fontWeight: 'bold' },
    slotItem: { padding: 12, marginVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors[colorScheme].border },
    slotItemSelected: { borderColor: gymColor, backgroundColor: gymColor + '10' },
    slotText: { textAlign: 'center', fontSize: 14, color: Colors[colorScheme].text },
    slotTextSelected: { textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: gymColor },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 10, },
    buttonWrapper: { borderRadius: 8, overflow: 'hidden', marginTop: 10, },
    filterButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, backgroundColor: Colors[colorScheme].background, },
    filterButtonText: { fontSize: 14, color: Colors[colorScheme].text, },
    counterContainer: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, borderWidth: 1, borderColor: Colors[colorScheme].border, height: 60},
    counterLabel: { fontSize: 12, color: Colors[colorScheme].text },
    counterText: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text },
    overLimitText: { color: '#e74c3c' },
    upgradeButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: gymColor,
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 5,
    },
    upgradeButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 12 },
    fabScanner: { 
        position: 'absolute', width: 60, height: 60, alignItems: 'center',
        justifyContent: 'center', right: 90, bottom: 20, 
        backgroundColor:'#7f8c8d', 
        borderRadius: 30, elevation: 8,
    },
    paseLibreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#00ce9bff', 
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    paseLibreText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    dateFieldContainer: {
        marginBottom: 15,
    },
    dateInputTouchable: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 50,
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 15,
    },
    dateInputText: {
        fontSize: 16,
        color: Colors[colorScheme].text,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    iosPickerOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    iosPickerContainer: {
        backgroundColor: Colors[colorScheme].background, 
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        paddingBottom: 20, 
        paddingHorizontal: 10,
    },
    iosPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
        marginBottom: 10,
    },
});

export default ManageClientsScreen;