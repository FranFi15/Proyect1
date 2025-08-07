import React, { useState, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ActivityIndicator,
    TouchableOpacity,
    FlatList,
    useColorScheme,
    Button,
    TextInput,
    Switch,
    Platform,
    KeyboardAvoidingView,
    Modal,
    ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import FilterModal from '@/components/FilterModal';
import CustomAlert from '@/components/CustomAlert';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';

// --- Estilos ---
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: { marginBottom: 15, fontSize: 21, paddingHorizontal: 20, paddingTop: 20 },
    formContainer: { paddingHorizontal: 20, paddingTop: 10 },
    label: { fontSize: 14, color: Colors[colorScheme].icon, marginBottom: 8 },
    input: {
        backgroundColor: Colors[colorScheme].cardBackground,
        color: Colors[colorScheme].text,
        padding: 15,
        borderRadius: 8,
        fontSize: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    filterButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors[colorScheme].cardBackground,
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    filterButtonText: { color: Colors[colorScheme].text, fontSize: 16 },
    placeholderText: { color: Colors[colorScheme].icon },
    actionsContainer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    buttonWrapper: { borderRadius: 8, overflow: 'hidden' },
    modalContainer: {
        flex: 1,
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    listItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
    },
    listItemText: { color: Colors[colorScheme].text, fontSize: 16, fontWeight: '500' },
    listItemSubtext: { color: Colors[colorScheme].text, fontSize: 12, opacity: 0.7 },
    emptyListText: { padding: 20, textAlign: 'center', color: Colors[colorScheme].icon },
});


const NotificationAdminScreen = () => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isImportant, setIsImportant] = useState(false);
    const [targetType, setTargetType] = useState('all');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [allUsers, setAllUsers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [activeModal, setActiveModal] = useState(null);
    const [searchModalVisible, setSearchModalVisible] = useState(false);

    const openSearchModal = () => setSearchModalVisible(true);
    const closeSearchModal = () => {
        setSearchModalVisible(false);
        setUserSearchTerm('');
        setClassSearchTerm('');
    };

    const handleTargetTypeSelect = (newTargetType) => {
        setTargetType(newTargetType);
        setSelectedUserId('');
        setSelectedClassId('');
        setSelectedRoleId('');
        setActiveModal(null);
    };

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, classesRes] = await Promise.all([
                apiClient.get('/users?populate=creditos'),
                apiClient.get('/classes?populate=tipoClase,profesor')
            ]);
            setAllUsers(usersRes.data || []);
            setAllClasses(classesRes.data || []);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchInitialData(); }, [fetchInitialData]));

    const filteredUsers = useMemo(() => {
        if (!userSearchTerm) return allUsers;
        return allUsers.filter(user =>
            `${user.nombre} ${user.apellido}`.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
        );
    }, [allUsers, userSearchTerm]);

    const filteredClasses = useMemo(() => {
        if (!classSearchTerm) return allClasses;
        return allClasses.filter(cls =>
            cls.nombre.toLowerCase().includes(classSearchTerm.toLowerCase())
        );
    }, [allClasses, classSearchTerm]);
    
    // --- FUNCIÓN RESTAURADA ---
    const handleSendNotification = () => {
        if (!title || !message) {
            setAlertInfo({ visible: true, title: 'Campos incompletos', message: 'Por favor, ingresa un título y un mensaje.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]});
            return;
        }
        let payload = { title, message, isImportant, targetType };
        let confirmationMessage = '';
        switch (targetType) {
            case 'user':
                if (!selectedUserId) { setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un usuario.', buttons: [{ text: 'OK' }] }); return; }
                payload.targetId = selectedUserId;
                const user = allUsers.find(u => u._id === selectedUserId);
                confirmationMessage = `¿Enviar a ${user?.nombre} ${user?.apellido}?`;
                break;
            case 'role':
                if (!selectedRoleId) { setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un rol.', buttons: [{ text: 'OK' }] }); return; }
                payload.targetRole = selectedRoleId;
                confirmationMessage = `¿Enviar a todos los usuarios con el rol "${getDisplayName(selectedRoleId, 'role')}"?`;
                break;
            case 'class':
                if (!selectedClassId) { setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona una clase.', buttons: [{ text: 'OK' }] }); return; }
                payload.targetId = selectedClassId;
                const cls = allClasses.find(c => c._id === selectedClassId);
                confirmationMessage = `¿Enviar a todos los inscritos en "${cls?.nombre}"?`;
                break;
            case 'all':
                confirmationMessage = '¿Estás seguro de que quieres enviar esta notificación a TODOS los usuarios?';
                break;
            default: return;
        }
        setAlertInfo({
            visible: true,
            title: "Confirmar Envío",
            message: confirmationMessage,
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo({ visible: false }) },
                { text: 'Enviar', style: 'primary', onPress: async () => {
                    setAlertInfo({ visible: false });
                    setSending(true);
                    try {
                        await apiClient.post('/notifications', payload);
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Notificación enviada correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        setTitle('');
                        setMessage('');
                        setIsImportant(false);
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo enviar la notificación.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                    } finally {
                        setSending(false);
                    }
                }}
            ]
        });
    };
    
    const getModalConfig = useMemo(() => {
        const targetTypeOptions = [{_id: 'all', nombre: 'Todos los Usuarios'}, {_id: 'user', nombre: 'Usuario Específico'}, {_id: 'role', nombre: 'Rol Específico'}, {_id: 'class', nombre: 'Clase Específica'}];
        const roleOptions = [{_id: '', nombre: 'Selecciona un rol'}, {_id: 'cliente', nombre: 'Clientes'}, {_id: 'profesor', nombre: 'Profesionales'}, {_id: 'admin', nombre: 'Admins'}];
        switch (activeModal) {
            case 'targetType': return { title: 'Seleccionar Destinatario', options: targetTypeOptions, onSelect: handleTargetTypeSelect, selectedValue: targetType };
            case 'role': return { title: 'Seleccionar Rol', options: roleOptions, onSelect: setSelectedRoleId, selectedValue: selectedRoleId };
            default: return null;
        }
    }, [activeModal, targetType, selectedRoleId]);
    
    const getDisplayName = (id, type) => {
        if (type === 'targetType') {
            const options = [{_id: 'all', nombre: 'Todos los Usuarios'}, {_id: 'user', nombre: 'Usuario Específico'}, {_id: 'role', nombre: 'Rol Específico'}, {_id: 'class', nombre: 'Clase Específica'}];
            return options.find(o => o._id === id)?.nombre || 'Seleccionar';
        }
        if (type === 'role') {
            const options = [{_id: 'cliente', nombre: 'Clientes'}, {_id: 'profesor', nombre: 'Profesionales'}, {_id: 'admin', nombre: 'Admins'}];
            return options.find(o => o._id === id)?.nombre || 'Seleccionar un rol';
        }
        return 'Seleccionar';
    };

    const getSelectedItemDisplay = () => {
        if (targetType === 'user' && selectedUserId) {
            const user = allUsers.find(u => u._id === selectedUserId);
            return user ? `${user.nombre} ${user.apellido}` : '';
        }
        if (targetType === 'class' && selectedClassId) {
            const cls = allClasses.find(c => c._id === selectedClassId);
            return cls ? `${cls.nombre} - ${cls.tipoClase?.nombre}` : '';
        }
        return '';
    };

    const renderUserItem = ({ item }) => (
        <TouchableOpacity style={styles.listItem} onPress={() => {
            setSelectedUserId(item._id);
            closeSearchModal();
        }}>
            <Text style={styles.listItemText}>{item.nombre} {item.apellido}</Text>
            <Text style={styles.listItemSubtext}>{item.email}</Text>
        </TouchableOpacity>
    );

    const renderClassItem = ({ item }) => (
         <TouchableOpacity style={styles.listItem} onPress={() => {
            setSelectedClassId(item._id);
            closeSearchModal();
         }}>
            <Text style={styles.listItemText}>{item.nombre || 'Turno'} - {item.tipoClase?.nombre}</Text>
            <Text style={styles.listItemSubtext}>{item.profesor?.nombre} {item.profesor?.apellido}</Text>
            <Text style={styles.listItemSubtext}>{new Date(item.fecha).toLocaleDateString()} - {item.horaInicio}</Text>
        </TouchableOpacity>
    );
    
    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }
    
    return (
        <ThemedView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={80}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <ThemedText type="title" style={styles.pageTitle}>Enviar Notificación</ThemedText>
                    
                    <View style={styles.formContainer}>
                        <TextInput style={styles.input} placeholder="Título" value={title} onChangeText={setTitle} placeholderTextColor={Colors[colorScheme].icon} />
                        <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} multiline placeholder="Mensaje" value={message} onChangeText={setMessage} placeholderTextColor={Colors[colorScheme].icon} />
                        <View style={styles.switchContainer}>
                            <ThemedText>Marcar como Importante (modal)</ThemedText>
                            <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={setIsImportant} value={isImportant} />
                        </View>
                        <ThemedText style={styles.label}>Destinatario</ThemedText>
                        <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('targetType')}>
                            <ThemedText style={styles.filterButtonText}>{getDisplayName(targetType, 'targetType')}</ThemedText>
                            <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                        </TouchableOpacity>

                        {targetType === 'role' && (
                            <>
                                <ThemedText style={styles.label}>Rol Específico</ThemedText>
                                <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('role')}>
                                    <ThemedText style={styles.filterButtonText}>{getDisplayName(selectedRoleId, 'role')}</ThemedText>
                                    <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                            </>
                        )}

                        {targetType === 'user' && (
                            <>
                                <ThemedText style={styles.label}>Usuario Específico</ThemedText>
                                <TouchableOpacity style={styles.filterButton} onPress={openSearchModal}>
                                    <ThemedText style={[styles.filterButtonText, !selectedUserId && styles.placeholderText]}>
                                        {selectedUserId ? getSelectedItemDisplay() : 'Seleccionar un usuario...'}
                                    </ThemedText>
                                    <FontAwesome5 name="search" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                            </>
                        )}

                        {targetType === 'class' && (
                             <>
                                <ThemedText style={styles.label}>Clase Específica</ThemedText>
                                <TouchableOpacity style={styles.filterButton} onPress={openSearchModal}>
                                    <ThemedText style={[styles.filterButtonText, !selectedClassId && styles.placeholderText]}>
                                        {selectedClassId ? getSelectedItemDisplay() : 'Seleccionar una clase...'}
                                    </ThemedText>
                                    <FontAwesome5 name="search" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    <View style={{ flex: 1 }} />

                    <View style={styles.actionsContainer}>
                        <View style={styles.buttonWrapper}>
                            <Button title={sending ? "Enviando..." : "Enviar Notificación"} onPress={handleSendNotification} disabled={sending} color={gymColor} />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal
                animationType="slide"
                transparent={false}
                visible={searchModalVisible}
                onRequestClose={closeSearchModal}
            >
                <ThemedView style={styles.modalContainer}>
                    <KeyboardAvoidingView
                         style={{ flex: 1 }}
                         behavior={Platform.OS === "ios" ? "padding" : "height"}
                         keyboardVerticalOffset={20}
                    >
                        <View style={styles.modalHeader}>
                            <ThemedText style={styles.modalTitle}>
                                {targetType === 'user' ? 'Buscar Usuario' : 'Buscar Clase'}
                            </ThemedText>
                            <TouchableOpacity onPress={closeSearchModal}>
                                <Ionicons name="close" size={28} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder={targetType === 'user' ? "Buscar por nombre o email..." : "Buscar por nombre de clase..."}
                            value={targetType === 'user' ? userSearchTerm : classSearchTerm}
                            onChangeText={targetType === 'user' ? setUserSearchTerm : setClassSearchTerm}
                            placeholderTextColor={Colors[colorScheme].icon}
                        />

                        <FlatList
                            data={targetType === 'user' ? filteredUsers : filteredClasses}
                            renderItem={targetType === 'user' ? renderUserItem : renderClassItem}
                            keyExtractor={(item) => item._id}
                            ListEmptyComponent={<Text style={styles.emptyListText}>No se encontraron resultados</Text>}
                        />
                    </KeyboardAvoidingView>
                </ThemedView>
            </Modal>
            
            <FilterModal
                visible={!!activeModal}
                onClose={() => setActiveModal(null)}
                onSelect={(id) => {
                    if (activeModal === 'targetType') {
                        handleTargetTypeSelect(id);
                    } else {
                        if (activeModal === 'role') setSelectedRoleId(id);
                        setActiveModal(null);
                    }
                }}
                title={activeModal === 'targetType' ? 'Seleccionar Destinatario' : 'Seleccionar Rol'}
                options={activeModal === 'targetType' ? [{_id: 'all', nombre: 'Todos los Usuarios'}, {_id: 'user', nombre: 'Usuario Específico'}, {_id: 'role', nombre: 'Rol Específico'}, {_id: 'class', nombre: 'Clase Específica'}] : [{_id: '', nombre: 'Selecciona un rol'}, {_id: 'cliente', nombre: 'Clientes'}, {_id: 'profesor', nombre: 'Profesionales'}, {_id: 'admin', nombre: 'Admins'}]}
                selectedValue={activeModal === 'targetType' ? targetType : selectedRoleId}
                theme={{ colors: Colors[colorScheme], gymColor }}
            />
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

export default NotificationAdminScreen;