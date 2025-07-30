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
    Switch
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import FilterModal from '@/components/FilterModal';
import CustomAlert from '@/components/CustomAlert';
import { FontAwesome5 } from '@expo/vector-icons';

const NotificationAdminScreen = () => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // --- Estados del formulario ---
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isImportant, setIsImportant] = useState(false);
    const [targetType, setTargetType] = useState('all');
    
    // --- Estados de selección y búsqueda ---
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [classSearchTerm, setClassSearchTerm] = useState('');

    // --- Estados de datos y carga ---
    const [allUsers, setAllUsers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // --- Estado para Alerta y Modal ---
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [activeModal, setActiveModal] = useState(null);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, classesRes] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/classes')
            ]);
            setAllUsers(usersRes.data || []);
            setAllClasses(classesRes.data || []);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar los datos necesarios.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchInitialData();
        }, [fetchInitialData])
    );

    // --- Lógica de filtrado ---
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

    // --- Lógica de envío ---
    const handleSendNotification = () => {
        // (Tu lógica de handleSendNotification existente no necesita cambios)
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
                confirmationMessage = `¿Enviar a todos los usuarios con el rol "${selectedRoleId}"?`;
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
    
    // (Tu lógica de getModalConfig y getDisplayName existente no necesita cambios)
    const getModalConfig = useMemo(() => {
        const targetTypeOptions = [{_id: 'all', nombre: 'Todos los Usuarios'}, {_id: 'user', nombre: 'Usuario Específico'}, {_id: 'role', nombre: 'Rol Específico'}, {_id: 'class', nombre: 'Clase Específica'}];
        const roleOptions = [{_id: '', nombre: 'Selecciona un rol'}, {_id: 'cliente', nombre: 'Clientes'}, {_id: 'profesor', nombre: 'Profesores'}, {_id: 'admin', nombre: 'Admins'}];
        switch (activeModal) {
            case 'targetType': return { title: 'Seleccionar Destinatario', options: targetTypeOptions, onSelect: setTargetType, selectedValue: targetType };
            case 'role': return { title: 'Seleccionar Rol', options: roleOptions, onSelect: setSelectedRoleId, selectedValue: selectedRoleId };
            default: return null;
        }
    }, [activeModal, targetType, selectedRoleId]);
    
    const getDisplayName = (id, type) => {
        if (!id) return 'Seleccionar';
        if (type === 'targetType') {
            const options = [{_id: 'all', nombre: 'Todos los Usuarios'}, {_id: 'user', nombre: 'Usuario Específico'}, {_id: 'role', nombre: 'Rol Específico'}, {_id: 'class', nombre: 'Clase Específica'}];
            return options.find(o => o._id === id)?.nombre || 'Seleccionar';
        }
        if (type === 'role') {
            const options = [{_id: 'cliente', nombre: 'Clientes'}, {_id: 'profesor', nombre: 'Profesores'}, {_id: 'admin', nombre: 'Admins'}];
            return options.find(o => o._id === id)?.nombre || 'Seleccionar un rol';
        }
        return 'Seleccionar';
    };


    const renderListHeader = () => (
        <>
            <ThemedText type="title" style={styles.pageTitle}>Enviar Notificación</ThemedText>
            <TextInput style={styles.input} placeholder="Título" value={title} onChangeText={setTitle} placeholderTextColor={Colors[colorScheme].text} />
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline numberOfLines={4} placeholder="Mensaje" value={message} onChangeText={setMessage} placeholderTextColor={Colors[colorScheme].text} />
            
            <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('targetType')}>
                <ThemedText style={styles.filterButtonText}>{getDisplayName(targetType, 'targetType')}</ThemedText>
                <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
            </TouchableOpacity>

            {targetType === 'role' && (
                <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('role')}>
                    <ThemedText style={styles.filterButtonText}>{getDisplayName(selectedRoleId, 'role')}</ThemedText>
                    <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                </TouchableOpacity>
            )}

            {targetType === 'user' && <TextInput style={styles.input} placeholder="Buscar usuario..." value={userSearchTerm} onChangeText={setUserSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />}
            {targetType === 'class' && <TextInput style={styles.input} placeholder="Buscar clase..." value={classSearchTerm} onChangeText={setClassSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />}
        </>
    );

    const renderListFooter = () => (
        <>
            <View style={styles.switchContainer}>
                <ThemedText>Marcar como Importante (modal)</ThemedText>
                <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={setIsImportant} value={isImportant} />
            </View>
            <View style={styles.buttonWrapper}>
                <Button title={sending ? "Enviando..." : "Enviar Notificación"} onPress={handleSendNotification} disabled={sending} color={gymColor} />
            </View>
        </>
    );

    const renderItem = ({ item }) => {
        if (targetType === 'user') {
            return (
                <TouchableOpacity style={[styles.listItem, selectedUserId === item._id && styles.listItemSelected]} onPress={() => setSelectedUserId(item._id)}>
                    <Text style={styles.listItemText}>{item.nombre} {item.apellido}</Text>
                    <Text style={styles.listItemSubtext}>{item.email}</Text>
                </TouchableOpacity>
            );
        }
        if (targetType === 'class') {
            return (
                <TouchableOpacity style={[styles.listItem, selectedClassId === item._id && styles.listItemSelected]} onPress={() => setSelectedClassId(item._id)}>
                    <Text style={styles.listItemText}>{item.nombre || 'Turno'} - {item.tipoClase?.nombre}</Text>
                    <Text style={styles.listItemSubtext}>{item.profesor?.nombre} {item.profesor?.apellido}</Text>
                    <Text style={styles.listItemSubtext}>{new Date(item.fecha).toLocaleDateString()} - {item.horaInicio}</Text>
                </TouchableOpacity>
            );
        }
        return null;
    };
    
    // --- Renderizado principal ---
    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }
    
    const listData = targetType === 'user' ? filteredUsers : (targetType === 'class' ? filteredClasses : []);

    return (
        <ThemedView style={styles.container}>
            <FlatList
                data={listData}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={renderListHeader}
                ListFooterComponent={renderListFooter}
                ListEmptyComponent={
                    (targetType === 'user' || targetType === 'class') ?
                    <Text style={styles.emptyListText}>No se encontraron resultados</Text>
                    : null
                }
                contentContainerStyle={styles.content}
                // Añadimos un estilo al contenedor de la lista si hay datos
                style={listData.length > 0 ? styles.listContainerWithData : {}}
            />

            {/* Los modales y alertas se quedan fuera de la lista */}
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
};

// --- Estilos ---
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    content: { padding: 20, paddingBottom: 50 }, // Padding extra al final
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: { marginBottom: 20, fontSize: 20 },
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
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
    },
    
    listItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].cardBackground
    },
    listItemSelected: { backgroundColor: gymColor + '30' },
    listItemText: { color: Colors[colorScheme].text, fontSize: 16, fontWeight: '500' },
    listItemSubtext: { color: Colors[colorScheme].text, fontSize: 12, opacity: 0.7 },
    emptyListText: { padding: 15, textAlign: 'center', color: Colors[colorScheme].icon },
    buttonWrapper: { borderRadius: 8, overflow: 'hidden', marginTop: 10, paddingHorizontal: 4 },
    filterButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors[colorScheme].cardBackground,
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    filterButtonText: { color: Colors[colorScheme].text, fontSize: 16 },
});

export default NotificationAdminScreen;