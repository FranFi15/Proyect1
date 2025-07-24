import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
    StyleSheet, 
    FlatList, 
    View, 
    TextInput, 
    ActivityIndicator, 
    TouchableOpacity,
    useColorScheme,
    Modal,
    Text,
    ScrollView,
    Switch,
    Button,
    Platform
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome, Octicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, isValid } from 'date-fns';
import BillingModalContent from '@/components/admin/BillingModalContent'; 
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado

const ManageClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // Estado para manejar la alerta personalizada
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
                { text: "Eliminar", style: "destructive", onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        await apiClient.delete(`/users/${client._id}`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Socio eliminado correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        fetchAllData();
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar al socio.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
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
                { text: "Quitar", style: "destructive", onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        await apiClient.delete(`/users/${selectedClient._id}/subscription/${tipoClaseId}`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Suscripción eliminada.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        fetchAllData();
                        setCreditsModalVisible(false);
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo eliminar la suscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
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
                { text: "Quitar", style: "destructive", onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        await apiClient.delete(`/users/${selectedClient._id}/fixed-plan/${planId}`);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Plan de horario fijo eliminado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        fetchAllData();
                        setCreditsModalVisible(false);
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo quitar el plan.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    }
                }}
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
                { text: "Inscribir", style: "primary", onPress: async () => {
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
                }}
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

    const handleDateChangeForMassEnroll = (event, selectedDate) => {
        setShowMassEnrollDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');
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
                { text: "Confirmar", style: "primary", onPress: async () => {
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
                }}
            ]
        });
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
                            <Ionicons name={item.ordenMedicaEntregada ? "document-text" : "document-text"} size={24} color={item.ordenMedicaEntregada ? '#28a745' : '#dc3545'}/>
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

            <Modal animationType="slide" transparent={true} visible={showAddFormModal} onRequestClose={() => setShowAddFormModal(false)}>
                <View style={styles.modalContainer}>
                    <ThemedView style={styles.modalView}>
                        <TouchableOpacity onPress={() => setShowAddFormModal(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color="#ccc" />
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
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={newClientData.roles[0]}
                                    onValueChange={(itemValue) => handleNewClientChange('roles', [itemValue])}
                                >
                                    <Picker.Item label="Cliente" value="cliente" />
                                    <Picker.Item label="Profesor" value="profesor" />
                                    <Picker.Item label="Admin" value="admin" />
                                </Picker>
                            </View>
                            <View style={styles.switchRow}>
                                 <ThemedText style={styles.inputLabel}>¿Requiere Orden Médica?</ThemedText>
                                 <Switch
                                     value={newClientData.ordenMedicaRequerida}
                                     onValueChange={(value) => handleNewClientChange('ordenMedicaRequerida', value)}
                                     trackColor={{ false: "#767577", true: gymColor }}
                                     thumbColor={"#f4f3f4"}
                                 />
                             </View>
                             {newClientData.ordenMedicaRequerida && (
                                 <View style={styles.switchRow}>
                                     <ThemedText style={styles.inputLabel}>¿Orden Médica Entregada?</ThemedText>
                                     <Switch
                                         value={newClientData.ordenMedicaEntregada}
                                         onValueChange={(value) => handleNewClientChange('ordenMedicaEntregada', value)}
                                         trackColor={{ false: "#767577", true: gymColor }}
                                         thumbColor={"#f4f3f4"}
                                     />
                                 </View>
                             )}

                            <View style={styles.modalActions}>
                                <View style={styles.buttonWrapper}>
                                    <Button title="Registrar" onPress={handleAddClientSubmit} color={gymColor} />
                                </View>
                            </View>
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={showEditFormModal} onRequestClose={() => setShowEditFormModal(false)}>
                <View style={styles.modalContainer}>
                    {editingClientData && (
                        <ThemedView style={styles.modalView}>
                            <TouchableOpacity onPress={() => setShowEditFormModal(false)} style={styles.closeButton}>
                                <Ionicons name="close-circle" size={30} color="#ccc" />
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
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={editingClientData.roles[0]}
                                        onValueChange={(itemValue) => handleEditingClientChange('roles', [itemValue])}
                                    >
                                        <Picker.Item label="Cliente" value="cliente" />
                                        <Picker.Item label="Profesor" value="profesor" />
                                        <Picker.Item label="Admin" value="admin" />
                                    </Picker>
                                </View>
                                <View style={styles.switchRow}>
                                    <ThemedText style={styles.inputLabel}>¿Requiere Orden Médica?</ThemedText>
                                    <Switch
                                        value={editingClientData.ordenMedicaRequerida}
                                        onValueChange={(value) => handleEditingClientChange('ordenMedicaRequerida', value)}
                                        trackColor={{ false: "#767577", true: gymColor }}
                                        thumbColor={"#f4f3f4"}
                                    />
                                </View>
                                {editingClientData.ordenMedicaRequerida && (
                                    <View style={styles.switchRow}>
                                        <ThemedText style={styles.inputLabel}>¿Orden Médica Entregada?</ThemedText>
                                        <Switch
                                            value={editingClientData.ordenMedicaEntregada}
                                            onValueChange={(value) => handleEditingClientChange('ordenMedicaEntregada', value)}
                                            trackColor={{ false: "#767577", true: gymColor }}
                                            thumbColor={"#f4f3f4"}
                                        />
                                    </View>
                                )}

                                <View style={styles.modalActions}>
                                    <View style={styles.buttonWrapper}>
                                        <Button title="Guardar Cambios" onPress={handleUpdateClientSubmit} color={gymColor} />
                                    </View>
                                </View>
                            </ScrollView>
                        </ThemedView>
                    )}
                </View>
            </Modal>

            <Modal visible={billingModalVisible} onRequestClose={() => setBillingModalVisible(false)} transparent={true} animationType="slide">
                {selectedClient && <BillingModalContent client={selectedClient} onClose={() => setBillingModalVisible(false)} onRefresh={fetchAllData} />}
            </Modal>
            
            <Modal animationType="slide" transparent={true} visible={creditsModalVisible} onRequestClose={() => setCreditsModalVisible(false)}>
                 <View style={styles.modalContainer}>
                    <ThemedView style={styles.modalView}>
                        <TouchableOpacity onPress={() => setCreditsModalVisible(false)} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={30} color="#ccc" />
                        </TouchableOpacity>
                        <ScrollView>
                            <ThemedText style={styles.modalTitle}>Gestionar Plan de {selectedClient?.nombre}</ThemedText>
                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Planes Actuales</ThemedText>
                                {selectedClient?.monthlySubscriptions?.length > 0 && selectedClient.monthlySubscriptions.map(sub => (
                                    <View key={sub._id} style={styles.planItem}>
                                        <Text style={styles.planText}>Suscripción: {getTypeName(sub.tipoClase)} ({sub.autoRenewAmount} créditos/mes)</Text>
                                        <TouchableOpacity onPress={() => handleRemoveSubscription(sub.tipoClase)}>
                                            <Octicons name="trash" size={22} color={Colors.light.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {selectedClient?.planesFijos?.length > 0 && selectedClient.planesFijos.map(plan => (
                                    <View key={plan._id} style={styles.planItem}>
                                        <Text style={styles.planText}>Plan Fijo: {getTypeName(plan.tipoClase)} ({plan.diasDeSemana.join(', ')})</Text>
                                        <TouchableOpacity onPress={() => handleRemoveFixedPlan(plan._id)}>
                                            <Octicons name="trash" size={22} color={Colors.light.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {(selectedClient?.monthlySubscriptions?.length === 0 && selectedClient?.planesFijos?.length === 0) && (
                                    <Text style={styles.planText}>Este socio no tiene planes activos.</Text>
                                )}
                            </View>
                            
                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Carga de Créditos / Suscripción</ThemedText>
                                <ThemedText style={styles.inputLabel}>Tipo de Clase</ThemedText>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={planData.tipoClaseId} onValueChange={(itemValue) => setPlanData(prev => ({...prev, tipoClaseId: itemValue}))}>
                                        <Picker.Item label=" Selecciona un tipo " value="" />
                                        {classTypes.map(type => <Picker.Item key={type._id} label={type.nombre} value={type._id} />)}
                                    </Picker>
                                </View>
                                <ThemedText style={styles.inputLabel}>Créditos a Modificar (+/-)</ThemedText>
                                <TextInput style={styles.input} keyboardType="numeric" value={planData.creditsToAdd} onChangeText={text => setPlanData(prev => ({...prev, creditsToAdd: text}))}/>
                                <View style={styles.switchContainer}>
                                    <ThemedText>¿Renovación automática mensual?</ThemedText>
                                    <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={value => setPlanData(prev => ({...prev, isSubscription: value}))} value={planData.isSubscription}/>
                                </View>
                                {planData.isSubscription && (
                                    <>
                                        <ThemedText style={styles.inputLabel}>Créditos a renovar por mes</ThemedText>
                                        <TextInput style={styles.input} keyboardType="numeric" value={planData.autoRenewAmount} onChangeText={text => setPlanData(prev => ({...prev, autoRenewAmount: text}))}/>
                                    </>
                                )}
                                <View style={styles.buttonWrapper}>
                                    <Button title="Aplicar Créditos/Suscripción" onPress={handlePlanSubmit} color='#1a5276' />
                                </View>
                            </View>

                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Inscripción a Horario Fijo</ThemedText>
                                <ThemedText style={styles.inputLabel}>Paso 1: Buscar horarios disponibles</ThemedText>
                                <ThemedText style={styles.inputLabel}>Tipo de Clase</ThemedText>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={massEnrollFilters.tipoClaseId} onValueChange={(itemValue) => setMassEnrollFilters(prev => ({...prev, tipoClaseId: itemValue, diasDeSemana: []}))}>
                                        <Picker.Item label=" Selecciona un tipo " value="" />
                                        {classTypes.map(type => <Picker.Item key={type._id} label={type.nombre} value={type._id} />)}
                                    </Picker>
                                </View>
                                <ThemedText style={styles.inputLabel}>Días de la Semana</ThemedText>
                                <View style={styles.weekDayContainer}>
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                                        <TouchableOpacity key={day} onPress={() => handleDaySelection(day)} style={[styles.dayChip, massEnrollFilters.diasDeSemana.includes(day) && styles.dayChipSelected]}>
                                            <Text style={massEnrollFilters.diasDeSemana.includes(day) ? styles.dayChipTextSelected : styles.dayChipText}>{day.substring(0,3)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <ThemedText style={styles.inputLabel}>Desde</ThemedText>
                                <TouchableOpacity onPress={() => showDatePickerFor('fechaInicio')}>
                                    <View style={styles.dateInputTouchable}>
                                        <Text style={styles.dateInputText}>{massEnrollFilters.fechaInicio || 'YYYY-MM-DD'}</Text>
                                    </View>
                                </TouchableOpacity>
                                <ThemedText style={styles.inputLabel}>Hasta</ThemedText>
                                <TouchableOpacity onPress={() => showDatePickerFor('fechaFin')}>
                                    <View style={styles.dateInputTouchable}>
                                        <Text style={styles.dateInputText}>{massEnrollFilters.fechaFin || 'YYYY-MM-DD'}</Text>
                                    </View>
                                </TouchableOpacity>
                                {showMassEnrollDatePicker && (
                                    <DateTimePicker value={new Date()} mode="date" display="default" onChange={handleDateChangeForMassEnroll} />
                                )}
                                <View style={styles.buttonWrapper}>
                                    <Button title={isLoadingSlots ? "Buscando..." : "Buscar Horarios"} onPress={findAvailableSlots} disabled={isLoadingSlots} color='#1a5276' />
                                </View>
                                {availableSlots.length > 0 && (
                                    <View style={{marginTop: 20}}>
                                        <ThemedText style={styles.inputLabel}>Paso 2: Seleccionar horario</ThemedText>
                                        {availableSlots.map((slot, index) => (
                                            <TouchableOpacity key={index} style={[styles.slotItem, selectedSlot?.horaInicio === slot.horaInicio && styles.slotItemSelected]} onPress={() => setSelectedSlot(slot)}>
                                                <Text style={selectedSlot?.horaInicio === slot.horaInicio ? styles.slotTextSelected : styles.slotText}>{slot.horaInicio} - {slot.horaFin}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <View style={styles.buttonWrapper}>
                                            <Button title="Inscribir en Plan" onPress={handleMassEnrollSubmit} disabled={!selectedSlot} color={'#005013ff'} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>
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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    searchInput: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, margin: 15, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text, fontSize: 16 },
    card: { 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 8,
        padding: 15, 
        marginVertical: 8, 
        marginHorizontal: 15, 
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    userInfo: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
    actionsContainer: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { marginLeft: 10, },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: '#1a5276', borderRadius: 30, elevation: 8 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
    roleBadge: {
        marginTop: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 'bold',
        overflow: 'hidden',
        textTransform: 'capitalize',
        alignSelf: 'flex-start',
    },
    clienteBadge: { backgroundColor: '#e0f3ffff', color: '#0561daff' },
    profesorBadge: { backgroundColor: '#d1e7dd', color: '#0f5132' },
    adminBadge: { backgroundColor: '#eff7d3ff', color: '#b6df00ff' },
    creditsContainer: { 
        flexDirection: 'row', 
        flexWrap: 'wrap',
        paddingTop: 10,
        
    },
    creditChip: {
        backgroundColor: gymColor + '20',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginRight: 6,
        marginBottom: 6,
    },
    creditText: {
        color: gymColor,
        fontSize: 12,
        fontWeight: '600',
    },
    modalContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', width: '100%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, elevation: 5 },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text, paddingTop: 10 },
    inputLabel: { fontSize: 14, marginBottom: 8, color: Colors[colorScheme].text, opacity: 0.8 },
    input: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, color: Colors[colorScheme].text, fontSize: 14 },
    pickerContainer: { 
        borderColor: Colors[colorScheme].border, 
        borderWidth: 1, 
        borderRadius: 8, 
        marginBottom: 15,
        justifyContent: 'center'
    },
    modalActions: { marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
    balanceText: { fontSize: 14, fontWeight: '600', marginTop: 8 },
    debtText: { color: Colors.light.error },
    okText: { color: '#28a745' },
    dateInputContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        marginBottom: 15 
    },
    dateInput: {
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        color: Colors[colorScheme].text,
        backgroundColor: Colors[colorScheme].background,
        textAlign: 'center',
        flex: 1,
        marginHorizontal: 4,
    },
    section: { marginBottom: 15, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15, color: Colors[colorScheme].text },
    planItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, },
    planText: { fontSize: 14, color: Colors[colorScheme].text, flex: 1 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 5 },
    weekDayContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 },
    dayChip: { paddingVertical: 6, paddingHorizontal: 5, borderRadius: 8, borderWidth: 1, borderColor: '#1a5276', margin: 4 },
    dayChipSelected: { backgroundColor: '#1a5276'},
    dayChipText: { fontSize: 16 },
    dayChipTextSelected: { color: '#FFFFFF', fontSize: 16 },
    slotItem: { padding: 12, marginVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors[colorScheme].border },
    slotItemSelected: { borderColor: gymColor, backgroundColor: gymColor + '20' },
    slotText: { textAlign: 'center', fontSize: 14, color: Colors[colorScheme].text },
    slotTextSelected: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: gymColor },
    dateInputTouchable: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, justifyContent: 'center', },
    dateInputText: { fontSize: 14, color: Colors[colorScheme].text, },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingVertical: 10,
    },
    buttonWrapper: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 10,
    }
});

export default ManageClientsScreen;
