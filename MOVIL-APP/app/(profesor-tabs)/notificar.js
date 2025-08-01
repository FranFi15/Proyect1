import React, { useState, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ActivityIndicator,
    TouchableOpacity,
    useColorScheme,
    Button,
    TextInput,
    Switch,
    FlatList
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import FilterModal from '@/components/FilterModal';
import { FontAwesome5 } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

// La función de estilos se define primero
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    formContainer: { paddingHorizontal: 20, paddingTop: 10 },
    listContainer: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: { marginBottom: 15, fontSize: 21, paddingHorizontal: 20, paddingTop: 20 },
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
        fontSize: 21,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 10,
        color: Colors[colorScheme].text,
    },
    buttonWrapper: { 
        borderRadius: 8, 
        overflow: 'hidden', 
        marginHorizontal: 20,
        marginBottom: 20, 
    },
    listItem: {
        padding: 15,
        marginHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 8,
        marginBottom: 5,
    },
    listItemSelected: { 
        backgroundColor: gymColor + '30',
        borderColor: gymColor,
        borderWidth: 1,
    },
    listItemText: { color: Colors[colorScheme].text, fontSize: 16, fontWeight: '500' },
    listItemSubtext: { color: Colors[colorScheme].text, fontSize: 12, opacity: 0.7 },
    emptyListText: { padding: 15, textAlign: 'center', color: Colors[colorScheme].icon },
    filterButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 50,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 15,
        backgroundColor: Colors[colorScheme].cardBackground
    },
    filterButtonText: { fontSize: 16, color: Colors[colorScheme].text },
});

const NotificationTeacherScreen = () => {
    const { gymColor, user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // Estados del componente
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isImportant, setIsImportant] = useState(false);
    const [targetType, setTargetType] = useState('class');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [myClasses, setMyClasses] = useState([]);
    const [myStudents, setMyStudents] = useState([]);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [activeModal, setActiveModal] = useState(null);
    
    // Lógica para obtener los datos
    const fetchTeacherData = useCallback(async () => {
    if (!user || !user._id) return;
    setLoading(true);
    try {
        const classesRes = await apiClient.get('/classes/profesor/me')
        const teacherClasses = classesRes.data || [];
        setMyClasses(teacherClasses);

        const studentMap = new Map();
        teacherClasses.forEach(cls => {
            (cls.usuariosInscritos || []).forEach(student => {
                if (student && student._id && !studentMap.has(student._id)) {
                    studentMap.set(student._id, student);
                }
            });
        });
        const uniqueStudents = Array.from(studentMap.values());
        setMyStudents(uniqueStudents);

    } catch (error) {
        setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar tus clases y alumnos.', buttons: [{ text: 'OK' }] });
    } finally {
        setLoading(false);
    }
}, [user]);

    useFocusEffect(useCallback(() => { fetchTeacherData(); }, [fetchTeacherData]));
    
    // Lógica de filtrado
    const filteredStudents = useMemo(() => {
        if (!userSearchTerm) return myStudents;
        return myStudents.filter(student => `${student.nombre} ${student.apellido}`.toLowerCase().includes(userSearchTerm.toLowerCase()));
    }, [myStudents, userSearchTerm]);

    const filteredClasses = useMemo(() => {
        if (!classSearchTerm) return myClasses;
        return myClasses.filter(cls => (cls.nombre || 'Turno').toLowerCase().includes(classSearchTerm.toLowerCase()));
    }, [myClasses, classSearchTerm]);
    
    // Lógica para enviar la notificación
    const handleSendNotification = () => {
        if (!title || !message) {
            setAlertInfo({ visible: true, title: 'Campos incompletos', message: 'Por favor, ingresa un título y un mensaje.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }
        let payload = { title, message, isImportant, targetType };
        let confirmationMessage = '';
        switch (targetType) {
            case 'user':
                if (!selectedUserId) { 
                    setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un alumno.', buttons: [{ text: 'OK' }] }); return; 
                }
                payload.targetId = selectedUserId;
                const student = myStudents.find(u => u._id === selectedUserId);
                confirmationMessage = `¿Enviar a ${student?.nombre} ${student?.apellido}?`;
                break;
            case 'class':
                if (!selectedClassId) { 
                    setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona una clase.', buttons: [{ text: 'OK' }] }); return;
                }
                payload.targetId = selectedClassId;
                const cls = myClasses.find(c => c._id === selectedClassId);
                confirmationMessage = `¿Enviar a todos los inscritos en "${cls?.nombre || 'Turno'} - ${cls?.tipoClase?.nombre}"?`;
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
                        setAlertInfo({ visible: true, title: 'Éxito', message: 'Notificación enviada correctamente.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
                        setTitle(''); setMessage(''); setIsImportant(false);
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo enviar la notificación.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
                    } finally {
                        setSending(false);
                    }
                }}
            ]
        });
    };
    
    // Lógica para el modal de filtros
    const getModalConfig = useMemo(() => {
        const targetTypeOptions = [{ _id: 'class', nombre: 'Clase Específica' }, { _id: 'user', nombre: 'Alumno Específico' }];
        if (activeModal === 'targetType') {
            return { title: 'Seleccionar Destinatario', options: targetTypeOptions, onSelect: setTargetType, selectedValue: targetType };
        }
        return null;
    }, [activeModal, targetType]);

    const getDisplayName = (id) => {
        if (id === 'class') return 'Clase Específica';
        if (id === 'user') return 'Cliente Específico';
        return 'Seleccionar';
    };

    // Renderizado del item de la lista
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
                    <Text style={styles.listItemSubtext}>{new Date(item.fecha).toLocaleDateString()} - {item.horaInicio}</Text>
                </TouchableOpacity>
            );
        }
        return null;
    };

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }
    
    const listData = targetType === 'user' ? filteredStudents : filteredClasses;

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.pageTitle}>Enviar Notificación a Alumnos</ThemedText>

            {/* 1. Contenedor del Formulario (fuera de la lista) */}
            <View style={styles.formContainer}>
                <TextInput style={styles.input} placeholder="Título" value={title} onChangeText={setTitle} placeholderTextColor={Colors[colorScheme].text} />
                <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline numberOfLines={4} placeholder="Mensaje" value={message} onChangeText={setMessage} placeholderTextColor={Colors[colorScheme].text} />
                <View style={styles.switchContainer}>
                    <ThemedText>¡Marcar como Importante!</ThemedText>
                    <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={setIsImportant} value={isImportant} />
                </View>
                <ThemedText style={styles.sectionTitle}>Destinatarios</ThemedText>
                <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('targetType')}>
                    <ThemedText style={styles.filterButtonText}>{getDisplayName(targetType)}</ThemedText>
                    <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                {targetType === 'user' && <TextInput style={styles.input} placeholder="Buscar alumno..." value={userSearchTerm} onChangeText={setUserSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />}
                {targetType === 'class' && <TextInput style={styles.input} placeholder="Buscar clase..." value={classSearchTerm} onChangeText={setClassSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />}
            </View>

            {/* 2. FlatList separada que solo maneja la lista */}
            <FlatList
                style={styles.listContainer}
                data={listData}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                ListEmptyComponent={
                    <Text style={styles.emptyListText}>
                        {targetType === 'user' ? 'No se encontraron alumnos' : 'No tienes clases asignadas'}
                    </Text>
                }
            />

            {/* 3. Botón de envío al final */}
            <View style={styles.buttonWrapper}>
                <Button title={sending ? "Enviando..." : "Enviar Notificación"} onPress={handleSendNotification} disabled={sending} color={gymColor} />
            </View>

            {/* Modales y Alertas */}
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

export default NotificationTeacherScreen;