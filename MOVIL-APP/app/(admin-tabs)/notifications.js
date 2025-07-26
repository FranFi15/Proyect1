import React, { useState, useCallback, useMemo } from 'react';
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
    TextInput,
    Switch
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Picker } from '@react-native-picker/picker';
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado

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

    const [allUsers, setAllUsers] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [classSearchTerm, setClassSearchTerm] = useState('');

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Estado para manejar la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

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
            setAlertInfo({
                visible: true,
                title: 'Campos incompletos',
                message: 'Por favor, ingresa un título y un mensaje.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            return;
        }

        let payload = { title, message, isImportant, targetType };
        let confirmationMessage = '';

        switch (targetType) {
            case 'user':
                if (!selectedUserId) { 
                    setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un usuario.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); 
                    return; 
                }
                payload.targetId = selectedUserId;
                const user = allUsers.find(u => u._id === selectedUserId);
                confirmationMessage = `¿Enviar a ${user?.nombre} ${user?.apellido}?`;
                break;
            case 'role':
                if (!selectedRoleId) { 
                    setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un rol.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); 
                    return; 
                }
                payload.targetRole = selectedRoleId;
                confirmationMessage = `¿Enviar a todos los usuarios con el rol "${selectedRoleId}"?`;
                break;
            case 'class':
                if (!selectedClassId) { 
                    setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona una clase.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); 
                    return; 
                }
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

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <ThemedText type="title" style={styles.pageTitle}>Enviar Notificación</ThemedText>
            
            <TextInput style={styles.input} placeholder="Título" value={title} onChangeText={setTitle} placeholderTextColor={Colors[colorScheme].text} />
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline numberOfLines={4} placeholder="Mensaje" value={message} onChangeText={setMessage} placeholderTextColor={Colors[colorScheme].text} />
            
            <View style={styles.switchContainer}>
                <ThemedText>Marcar como Importante (modal)</ThemedText>
                <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={setIsImportant} value={isImportant} />
            </View>

            <ThemedText style={styles.sectionTitle}>Destinatarios</ThemedText>
            <View style={styles.pickerContainer}>
                <Picker selectedValue={targetType} onValueChange={(itemValue) => setTargetType(itemValue)}>
                    <Picker.Item label="Todos los Usuarios" value="all" />
                    <Picker.Item label="Usuario Específico" value="user" />
                    <Picker.Item label="Rol Específico" value="role" />
                    <Picker.Item label="Clase Específica" value="class" />
                </Picker>
            </View>

            {targetType === 'user' && (
                <View>
                    <TextInput style={styles.input} placeholder="Buscar usuario..." value={userSearchTerm} onChangeText={setUserSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />
                    <ScrollView style={styles.listContainer} nestedScrollEnabled={true}>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map(item => (
                                <TouchableOpacity key={item._id} style={[styles.listItem, selectedUserId === item._id && styles.listItemSelected]} onPress={() => setSelectedUserId(item._id)}>
                                    <Text style={styles.listItemText}>{item.nombre} {item.apellido}</Text>
                                    <Text style={styles.listItemSubtext}>{item.email}</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyListText}>No se encontraron usuarios</Text>
                        )}
                    </ScrollView>
                </View>
            )}

            {targetType === 'role' && (
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={selectedRoleId} onValueChange={(itemValue) => setSelectedRoleId(itemValue)}>
                        <Picker.Item label="Selecciona un rol" value="" />
                        <Picker.Item label="Clientes" value="cliente" />
                        <Picker.Item label="Profesores" value="profesor" />
                        <Picker.Item label="Admins" value="admin" />
                    </Picker>
                </View>
            )}

            {targetType === 'class' && (
                 <View>
                    <TextInput style={styles.input} placeholder="Buscar clase..." value={classSearchTerm} onChangeText={setClassSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />
                    <ScrollView style={styles.listContainer} nestedScrollEnabled={true}>
                        {filteredClasses.length > 0 ? (
                            filteredClasses.map(item => (
                                <TouchableOpacity key={item._id} style={[styles.listItem, selectedClassId === item._id && styles.listItemSelected]} onPress={() => setSelectedClassId(item._id)}>
                                    <Text style={styles.listItemText}>{item.nombre || 'Turno'} - {item.tipoClase?.nombre}</Text>
                                    <Text style={styles.listItemSubtext}>{item.profesor?.nombre} {item.profesor?.apellido}</Text>
                                    <Text style={styles.listItemSubtext}>{new Date(item.fecha).toLocaleDateString()} - {item.horaInicio}</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyListText}>No se encontraron clases</Text>
                        )}
                    </ScrollView>
                </View>
            )}
            
            <View style={styles.buttonWrapper}>
                <Button title={sending ? "Enviando..." : "Enviar Notificación"} onPress={handleSendNotification} disabled={sending} color={gymColor} />
            </View>
            
            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={gymColor} 
            />
        </ScrollView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 , backgroundColor: Colors[colorScheme].cardBackground,},
    content: { padding: 20 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: {
        marginBottom: 20,
        fontSize: 24,
    },
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 10,
        color: Colors[colorScheme].text,
    },
    pickerContainer: {
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 20,
        color: Colors[colorScheme].text,
    },
    listContainer: {
        maxHeight: 250, // Altura máxima para que la lista sea scrollable
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        borderRadius: 8,
        marginBottom: 20,
    },
    listItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
    },
    listItemSelected: {
        backgroundColor: gymColor + '30', // 30 for opacity
    },
    listItemText: {
        color: Colors[colorScheme].text,
        fontSize: 16,
        fontWeight: '500',
    },
    listItemSubtext: {
        color: Colors[colorScheme].text,
        fontSize: 12,
        opacity: 0.7,
    },
    emptyListText: {
        padding: 15,
        textAlign: 'center',
        color: Colors[colorScheme].icon,
    },
    buttonWrapper: {
        borderRadius: 8,
        overflow: 'hidden', // Necesario para que el borderRadius se aplique al Button en Android
        marginTop: 10,
    }
});

export default NotificationAdminScreen;
