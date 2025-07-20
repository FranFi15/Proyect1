import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
    StyleSheet, 
    FlatList, 
    View, 
    TextInput, 
    ActivityIndicator, 
    Alert,
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
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import BillingModalContent from '../../components/admin/BillingModalContent'; 

const ManageClientsScreen = () => {
    const [users, setUsers] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // --- ESTADOS DE LOS MODALES ---
    const [selectedClient, setSelectedClient] = useState(null);
    const [creditsModalVisible, setCreditsModalVisible] = useState(false);
    const [billingModalVisible, setBillingModalVisible] = useState(false);
    const [showAddFormModal, setShowAddFormModal] = useState(false);
    const [showEditFormModal, setShowEditFormModal] = useState(false);

    // --- ESTADOS PARA FORMULARIOS Y LÓGICA INTERNA ---
    const [planData, setPlanData] = useState({ tipoClaseId: '', creditsToAdd: '0', isSubscription: false, autoRenewAmount: '8' });
    const [massEnrollFilters, setMassEnrollFilters] = useState({ tipoClaseId: '', diasDeSemana: [], fechaInicio: '', fechaFin: '' });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [showMassEnrollDatePicker, setShowMassEnrollDatePicker] = useState(false);
    const [datePickerField, setDatePickerField] = useState(null);
    const [newClientData, setNewClientData] = useState({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', numeroTelefono: '', obraSocial: '', roles: ['cliente'], });
    const [editingClientData, setEditingClientData] = useState(null);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersResponse, classTypesResponse] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/tipos-clase')
            ]);
            
            const filteredUsers = usersResponse.data.filter(u => u.roles.includes('cliente') || u.roles.includes('profesor'));
            setUsers(filteredUsers);
            setClassTypes(classTypesResponse.data.tiposClase || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los datos.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(fetchAllData);

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
        setEditingClientData({ ...client, roles: Array.isArray(client.roles) && client.roles.length > 0 ? client.roles : ['cliente'] });
        setShowEditFormModal(true);
    };
    
    const handleDeleteClient = (client) => {
        Alert.alert( "Eliminar Socio", `¿Estás seguro de que quieres eliminar a ${client.nombre} ${client.apellido}?`,
            [ { text: "Cancelar", style: "cancel" }, { text: "Eliminar", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/users/${client._id}`);
                    Alert.alert('Éxito', 'Socio eliminado correctamente.');
                    fetchAllData();
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'No se pudo eliminar al socio.');
                }
            }}]
        );
    };

    const handlePlanSubmit = async () => {
        if (!selectedClient || !planData.tipoClaseId) {
            Alert.alert('Error', 'Por favor, selecciona un tipo de clase.');
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
            Alert.alert('Éxito', 'El plan del socio ha sido actualizado.');
            setCreditsModalVisible(false);
            fetchAllData();
        } catch (error) {
             Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar el plan.');
        }
    };

    const handleRemoveSubscription = (tipoClaseId) => {
        if (!selectedClient || !tipoClaseId) return;
        Alert.alert("Quitar Suscripción", "¿Seguro que quieres eliminar la suscripción automática para esta clase?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Quitar", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/users/${selectedClient._id}/subscription/${tipoClaseId}`);
                    Alert.alert('Éxito', 'Suscripción eliminada.');
                    fetchAllData();
                    setCreditsModalVisible(false);
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'No se pudo eliminar la suscripción.');
                }
            }}
        ]);
    };

    const handleRemoveFixedPlan = (planId) => {
        if (!selectedClient) return;
        Alert.alert("Quitar Plan Fijo", "¿Seguro que quieres quitar este plan de horario fijo?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Quitar", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/users/${selectedClient._id}/fixed-plan/${planId}`);
                    Alert.alert('Éxito', 'Plan de horario fijo eliminado.');
                    fetchAllData();
                    setCreditsModalVisible(false);
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'No se pudo quitar el plan.');
                }
            }}
        ]);
    };

    const findAvailableSlots = async () => {
        const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters;
        if (!tipoClaseId || diasDeSemana.length === 0 || !fechaInicio || !fechaFin) {
            Alert.alert('Error', 'Completa todos los filtros para buscar horarios.');
            return;
        }
        setIsLoadingSlots(true);
        try {
            const response = await apiClient.get('/classes/available-slots', {
                params: { tipoClaseId, diasDeSemana: diasDeSemana.join(','), fechaInicio, fechaFin }
            });
            setAvailableSlots(response.data);
            if (response.data.length === 0) {
                Alert.alert('Sin resultados', 'No se encontraron horarios disponibles para esa combinación.');
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudieron buscar los horarios.');
        } finally {
            setIsLoadingSlots(false);
        }
    };
    
    const handleMassEnrollSubmit = async () => {
        if (!selectedClient || !selectedSlot) {
            Alert.alert('Error', 'Selecciona un horario para inscribir.');
            return;
        }
        const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters;
        const { horaInicio, horaFin } = selectedSlot;

        Alert.alert("Confirmar Inscripción Masiva", `¿Inscribir a ${selectedClient.nombre} en este plan?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Inscribir", onPress: async () => {
                try {
                    await apiClient.post(`/users/${selectedClient._id}/subscribe-to-plan`, {
                        tipoClaseId, diasDeSemana, fechaInicio, fechaFin, horaInicio, horaFin,
                    });
                    Alert.alert('Éxito', 'El socio ha sido inscrito en el plan.');
                    setCreditsModalVisible(false);
                    fetchAllData();
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'No se pudo procesar la inscripción.');
                }
            }}
        ]);
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
                Alert.alert('Error', `Por favor, completa el campo: ${key}`);
                return;
            }
        }
        try {
            await apiClient.post('/auth/register', newClientData);
            Alert.alert('Éxito', 'Socio registrado correctamente.');
            setShowAddFormModal(false);
            fetchAllData();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo registrar al socio.');
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
            Alert.alert('Éxito', 'Socio actualizado correctamente.');
            setShowEditFormModal(false);
            fetchAllData();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo actualizar al socio.');
        }
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

    const renderUserCard = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.userInfo}>
                <Text style={styles.cardTitle}>{item.nombre} {item.apellido}</Text>
                <Text style={styles.cardSubtitle}>{item.email}</Text>
                <Text style={[styles.roleBadge, item.roles.includes('admin') ? styles.adminBadge : (item.roles.includes('profesor') ? styles.profesorBadge : styles.clienteBadge)]}>
                    {item.roles.join(', ')}
                </Text>
            </View>
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenBillingModal(item)}>
                    <Ionicons name="logo-usd" size={20} color='#0d9800ff' />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenCreditsModal(item)}>
                    <Ionicons name="card" size={20} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenEditModal(item)}>
                    <Ionicons name="pencil" size={20} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteClient(item)}>
                    <Ionicons name="trash" size={20} color={Colors[colorScheme].text} />
                </TouchableOpacity>
            </View>
        </View>
    );

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
            <TouchableOpacity style={styles.fab} onPress={() => setShowAddFormModal(true)}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            <Modal animationType="slide" transparent={true} visible={showAddFormModal} onRequestClose={() => setShowAddFormModal(false)}>
                <View style={styles.modalContainer}>
                    <ThemedView style={styles.modalView}>
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
                            <ThemedText style={styles.inputLabel}>Fecha de Nacimiento (YYYY-MM-DD)</ThemedText>
                            <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={newClientData.fechaNacimiento} onChangeText={(text) => handleNewClientChange('fechaNacimiento', text)} />
                            <ThemedText style={styles.inputLabel}>Teléfono de Emergencia</ThemedText>
                            <TextInput style={styles.input} keyboardType="phone-pad" value={newClientData.telefonoEmergencia} onChangeText={(text) => handleNewClientChange('telefonoEmergencia', text)} />
                            <ThemedText style={styles.inputLabel}>Teléfono (Opcional)</ThemedText>
                            <TextInput style={styles.input} keyboardType="phone-pad" value={newClientData.numeroTelefono} onChangeText={(text) => handleNewClientChange('numeroTelefono', text)} />
                            <ThemedText style={styles.inputLabel}>Obra Social (Opcional)</ThemedText>
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

                            <View style={styles.modalActions}>
                                <Button title="Cancelar" onPress={() => setShowAddFormModal(false)} color="#888" />
                                <Button title="Registrar" onPress={handleAddClientSubmit} color={gymColor} />
                            </View>
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={showEditFormModal} onRequestClose={() => setShowEditFormModal(false)}>
                <View style={styles.modalContainer}>
                    {editingClientData && (
                        <ThemedView style={styles.modalView}>
                            <ScrollView>
                                <ThemedText style={styles.modalTitle}>Editar Socio</ThemedText>
                                <ThemedText style={styles.inputLabel}>Nombre</ThemedText>
                                <TextInput style={styles.input} value={editingClientData.nombre} onChangeText={(text) => handleEditingClientChange('nombre', text)} />
                                <ThemedText style={styles.inputLabel}>Apellido</ThemedText>
                                <TextInput style={styles.input} value={editingClientData.apellido} onChangeText={(text) => handleEditingClientChange('apellido', text)} />
                                {/* ... otros inputs para DNI, email, etc. ... */}

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

                                <View style={styles.modalActions}>
                                    <Button title="Cancelar" onPress={() => setShowEditFormModal(false)} color="#888" />
                                    <Button title="Guardar Cambios" onPress={handleUpdateClientSubmit} color={gymColor} />
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
                        <ScrollView>
                            <ThemedText style={styles.modalTitle}>Gestionar Plan de {selectedClient?.nombre}</ThemedText>
                            <View style={styles.section}>
                                <ThemedText style={styles.sectionTitle}>Planes Actuales</ThemedText>
                                {selectedClient?.monthlySubscriptions?.length > 0 && selectedClient.monthlySubscriptions.map(sub => (
                                    <View key={sub._id} style={styles.planItem}>
                                        <Text style={styles.planText}>Suscripción: {getTypeName(sub.tipoClase)} ({sub.autoRenewAmount} créditos/mes)</Text>
                                        <TouchableOpacity onPress={() => handleRemoveSubscription(sub.tipoClase)}>
                                            <Ionicons name="trash-bin-outline" size={22} color={Colors.light.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {selectedClient?.planesFijos?.length > 0 && selectedClient.planesFijos.map(plan => (
                                    <View key={plan._id} style={styles.planItem}>
                                        <Text style={styles.planText}>Plan Fijo: {getTypeName(plan.tipoClase)} ({plan.diasDeSemana.join(', ')})</Text>
                                        <TouchableOpacity onPress={() => handleRemoveFixedPlan(plan._id)}>
                                            <Ionicons name="trash-bin-outline" size={22} color={Colors.light.error} />
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
                                <Button title="Aplicar Créditos/Suscripción" onPress={handlePlanSubmit} color='#1a5276' />
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
                                <Button title={isLoadingSlots ? "Buscando..." : "Buscar Horarios"} onPress={findAvailableSlots} disabled={isLoadingSlots} color='#1a5276' />
                                {availableSlots.length > 0 && (
                                    <View style={{marginTop: 20}}>
                                        <ThemedText style={styles.inputLabel}>Paso 2: Seleccionar horario</ThemedText>
                                        {availableSlots.map((slot, index) => (
                                            <TouchableOpacity key={index} style={[styles.slotItem, selectedSlot?.horaInicio === slot.horaInicio && styles.slotItemSelected]} onPress={() => setSelectedSlot(slot)}>
                                                <Text style={selectedSlot?.horaInicio === slot.horaInicio ? styles.slotTextSelected : styles.slotText}>{slot.horaInicio} - {slot.horaFin}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <View style={{marginTop: 15}}>
                                            <Button title="Inscribir en Plan" onPress={handleMassEnrollSubmit} disabled={!selectedSlot} color={'#005013ff'} />
                                        </View>
                                    </View>
                                )}
                            </View>
                            <View style={styles.modalActions}>
                                <Button title="Cerrar" onPress={() => setCreditsModalVisible(false)} color="#888" />
                            </View>
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>
        </ThemedView>
    );
}

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    searchInput: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 2, paddingHorizontal: 15, margin: 15, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text, fontSize: 16 },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 2, padding: 15, marginVertical: 8, marginHorizontal: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
    userInfo: { flex: 1, marginRight: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    cardSubtitle: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 4 },
    actionsContainer: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { marginLeft: 5, padding: 6 },
    fab: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: '#1a5276', borderRadius: 30, elevation: 8 },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
    roleBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, fontSize: 12, fontWeight: 'bold', alignSelf: 'flex-start', overflow: 'hidden', textTransform: 'capitalize' },
    clienteBadge: { backgroundColor: '#e0f3ffff', color: '#0561daff' },
    profesorBadge: { backgroundColor: '#d1e7dd', color: '#0f5132' },
    adminBadge: { backgroundColor: '#eff7d3ff', color: '#b6df00ff' },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { width: '90%', maxHeight: '90%', backgroundColor: Colors[colorScheme].background, borderRadius: 12, padding: 20, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: Colors[colorScheme].text },
    inputLabel: { fontSize: 14, marginBottom: 8, color: Colors[colorScheme].text, opacity: 0.8 },
    input: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, color: Colors[colorScheme].text, fontSize: 14 },
    pickerContainer: { 
        borderColor: Colors[colorScheme].border, 
        borderWidth: 1, 
        borderRadius: 8, 
        marginBottom: 15,
        justifyContent: 'center'
    },
    modalActions: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-around' },
    balanceText: { fontSize: 14, fontWeight: '600', marginTop: 8 },
    debtText: { color: Colors.light.error },
    okText: { color: '#28a745' },
    // Estilos del modal de créditos
    section: { marginBottom: 15, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border, paddingTop: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 15, color: Colors[colorScheme].text },
    planItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, },
    planText: { fontSize: 14, color: Colors[colorScheme].text, flex: 1 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 5 },
    weekDayContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 },
    dayChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: gymColor, margin: 4 },
    dayChipSelected: { backgroundColor: gymColor },
    dayChipText: { color: gymColor, fontSize: 12 },
    dayChipTextSelected: { color: '#FFFFFF', fontSize: 12 },
    slotItem: { padding: 12, marginVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors[colorScheme].border },
    slotItemSelected: { borderColor: gymColor, backgroundColor: gymColor + '20' },
    slotText: { textAlign: 'center', fontSize: 14, color: Colors[colorScheme].text },
    slotTextSelected: { textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: gymColor },
    dateInputTouchable: { height: 45, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, justifyContent: 'center', },
    dateInputText: { fontSize: 14, color: Colors[colorScheme].text, }
});

export default ManageClientsScreen;
