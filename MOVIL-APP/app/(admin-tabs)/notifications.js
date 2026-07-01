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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBox: {
        backgroundColor: gymColor || '#007bff',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginBottom: 15,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4 },
    formContainer: { paddingHorizontal: 16, paddingBottom: 30 },
    cardSection: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text, marginLeft: 8 },
    label: { fontSize: 13, color: Colors[colorScheme].icon, marginBottom: 6, fontWeight: '600' },
    input: {
        backgroundColor: colorScheme === 'dark' ? '#2c2c2c' : '#f8f9fa',
        color: Colors[colorScheme].text,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        fontSize: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border
    },
    selectorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colorScheme === 'dark' ? '#2c2c2c' : '#f8f9fa',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        marginBottom: 12
    },
    selectorText: { fontSize: 15, fontWeight: '600', color: Colors[colorScheme].text, flex: 1 },
    placeholderText: { color: Colors[colorScheme].icon, fontWeight: '400' },
    switchCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4
    },
    switchInfo: { flex: 1, marginRight: 15 },
    switchTitle: { fontSize: 15, fontWeight: 'bold', color: Colors[colorScheme].text },
    switchSub: { fontSize: 12, color: Colors[colorScheme].icon, marginTop: 3 },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: gymColor || '#007bff',
        paddingVertical: 16,
        borderRadius: 12,
        elevation: 3,
        shadowColor: gymColor || '#007bff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5
    },
    sendButtonDisabled: { opacity: 0.6 },
    sendButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    modalContainer: { flex: 1, padding: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    listItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
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

    const handleSendNotification = () => {
        if (!title || !message) {
            setAlertInfo({ visible: true, title: 'Campos incompletos', message: 'Por favor, ingresa un título y un mensaje.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
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
                if (!selectedClassId) { setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un Turno.', buttons: [{ text: 'OK' }] }); return; }
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
                {
                    text: 'Enviar', style: 'primary', onPress: async () => {
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
                    }
                }
            ]
        });
    };

    const getModalConfig = useMemo(() => {
        const targetTypeOptions = [{ _id: 'all', nombre: 'Todos los Usuarios' }, { _id: 'user', nombre: 'Usuario Específico' }, { _id: 'role', nombre: 'Rol Específico' }, { _id: 'class', nombre: 'Turno Específico' }];
        const roleOptions = [{ _id: '', nombre: 'Selecciona un rol' }, { _id: 'cliente', nombre: 'Clientes' }, { _id: 'profesor', nombre: 'Profesionales' }, { _id: 'admin', nombre: 'Admins' }];
        switch (activeModal) {
            case 'targetType': return { title: 'Seleccionar Destinatario', options: targetTypeOptions, onSelect: handleTargetTypeSelect, selectedValue: targetType };
            case 'role': return { title: 'Seleccionar Rol', options: roleOptions, onSelect: setSelectedRoleId, selectedValue: selectedRoleId };
            default: return null;
        }
    }, [activeModal, targetType, selectedRoleId]);

    const getDisplayName = (id, type) => {
        if (type === 'targetType') {
            const options = [{ _id: 'all', nombre: 'Todos los Usuarios' }, { _id: 'user', nombre: 'Usuario Específico' }, { _id: 'role', nombre: 'Rol Específico' }, { _id: 'class', nombre: 'Turno Específico' }];
            return options.find(o => o._id === id)?.nombre || 'Seleccionar';
        }
        if (type === 'role') {
            const options = [{ _id: 'cliente', nombre: 'Clientes' }, { _id: 'profesor', nombre: 'Profesionales' }, { _id: 'admin', nombre: 'Admins' }];
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
                {/* --- CAMBIO AQUÍ: Añadido keyboardShouldPersistTaps y keyboardDismissMode --- */}
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    {/* Header Banner */}
                    <View style={styles.headerBox}>
                        <Text style={styles.headerTitle}>Enviar Notificación</Text>
                    </View>

                    <View style={styles.formContainer}>
                        {/* SECCIÓN 1: DESTINATARIO */}
                        <View style={styles.cardSection}>
                            <View style={styles.sectionTitleRow}>
                                <Ionicons name="people" size={20} color={gymColor || '#007bff'} />
                                <Text style={styles.sectionTitle}>1. Seleccionar Destinatario</Text>
                            </View>

                            <ThemedText style={styles.label}>Grupo o Destinatario</ThemedText>
                            <TouchableOpacity style={styles.selectorBox} onPress={() => setActiveModal('targetType')}>
                                <Text style={styles.selectorText}>{getDisplayName(targetType, 'targetType')}</Text>
                                <FontAwesome5 name="chevron-down" size={14} color={Colors[colorScheme].icon} />
                            </TouchableOpacity>

                            {targetType === 'role' && (
                                <>
                                    <ThemedText style={styles.label}>Rol Específico</ThemedText>
                                    <TouchableOpacity style={styles.selectorBox} onPress={() => setActiveModal('role')}>
                                        <Text style={styles.selectorText}>{getDisplayName(selectedRoleId, 'role')}</Text>
                                        <FontAwesome5 name="chevron-down" size={14} color={Colors[colorScheme].icon} />
                                    </TouchableOpacity>
                                </>
                            )}

                            {targetType === 'user' && (
                                <>
                                    <ThemedText style={styles.label}>Usuario Específico</ThemedText>
                                    <TouchableOpacity style={styles.selectorBox} onPress={openSearchModal}>
                                        <Text style={[styles.selectorText, !selectedUserId && styles.placeholderText]}>
                                            {selectedUserId ? getSelectedItemDisplay() : 'Buscar usuario...'}
                                        </Text>
                                        <Ionicons name="search" size={18} color={Colors[colorScheme].icon} />
                                    </TouchableOpacity>
                                </>
                            )}

                            {targetType === 'class' && (
                                <>
                                    <ThemedText style={styles.label}>Turno / Clase Específica</ThemedText>
                                    <TouchableOpacity style={styles.selectorBox} onPress={openSearchModal}>
                                        <Text style={[styles.selectorText, !selectedClassId && styles.placeholderText]}>
                                            {selectedClassId ? getSelectedItemDisplay() : 'Buscar turno...'}
                                        </Text>
                                        <Ionicons name="search" size={18} color={Colors[colorScheme].icon} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                        {/* SECCIÓN 2: CONTENIDO */}
                        <View style={styles.cardSection}>
                            <View style={styles.sectionTitleRow}>
                                <Ionicons name="chatbubble-ellipses" size={20} color={gymColor || '#007bff'} />
                                <Text style={styles.sectionTitle}>2. Contenido del Mensaje</Text>
                            </View>

                            <ThemedText style={styles.label}>Título del Aviso</ThemedText>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: ¡Apertura en feriado!"
                                value={title}
                                onChangeText={setTitle}
                                placeholderTextColor={Colors[colorScheme].icon}
                            />

                            <ThemedText style={styles.label}>Cuerpo del Mensaje</ThemedText>
                            <TextInput
                                style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Escribe aquí toda la información que desees comunicar..."
                                value={message}
                                onChangeText={setMessage}
                                placeholderTextColor={Colors[colorScheme].icon}
                            />
                        </View>

                        {/* SECCIÓN 3: PRIORIDAD */}
                        <View style={styles.cardSection}>
                            <View style={styles.switchCardRow}>
                                <View style={styles.switchInfo}>
                                    <Text style={styles.switchTitle}>⚠️ Aviso Emergente Importante</Text>
                                    <Text style={styles.switchSub}>Se mostrará como un modal emergente cuando el usuario abra la aplicación.</Text>
                                </View>
                                <Switch
                                    trackColor={{ false: "#767577", true: gymColor || '#007bff' }}
                                    thumbColor={"#f4f3f4"}
                                    onValueChange={setIsImportant}
                                    value={isImportant}
                                />
                            </View>
                        </View>

                        {/* BOTÓN ENVIAR */}
                        <TouchableOpacity
                            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                            onPress={handleSendNotification}
                            disabled={sending}
                            activeOpacity={0.85}
                        >
                            {sending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Ionicons name="send" size={20} color="#fff" />
                            )}
                            <Text style={styles.sendButtonText}>{sending ? "Enviando Notificación..." : "Enviar Notificación Ahora"}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal
                animationType="fade"
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

                        {/* --- CAMBIO AQUÍ: Añadido keyboardShouldPersistTaps y keyboardDismissMode --- */}
                        <FlatList
                            data={targetType === 'user' ? filteredUsers : filteredClasses}
                            renderItem={targetType === 'user' ? renderUserItem : renderClassItem}
                            keyExtractor={(item) => item._id}
                            ListEmptyComponent={<Text style={styles.emptyListText}>No se encontraron resultados</Text>}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
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
                options={activeModal === 'targetType' ? [{ _id: 'all', nombre: 'Todos los Usuarios' }, { _id: 'user', nombre: 'Usuario Específico' }, { _id: 'role', nombre: 'Rol Específico' }, { _id: 'class', nombre: 'Turno Específico' }] : [{ _id: '', nombre: 'Selecciona un rol' }, { _id: 'cliente', nombre: 'Clientes' }, { _id: 'profesor', nombre: 'Profesionales' }, { _id: 'admin', nombre: 'Admins' }]}
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