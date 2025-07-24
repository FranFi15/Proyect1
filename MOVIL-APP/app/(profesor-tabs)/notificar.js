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
    ScrollView // Se vuelve a usar ScrollView como contenedor principal
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Picker } from '@react-native-picker/picker';
import CustomAlert from '@/components/CustomAlert';

// Nuevo componente para la pantalla de notificaciones del profesor
const NotificationTeacherScreen = () => {
    const { gymColor, user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

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

    const fetchTeacherData = useCallback(async () => {
        if (!user || !user._id) return;
        setLoading(true);
        try {
            const classesRes = await apiClient.get(`/classes?profesorId=${user._id}`);
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
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudieron cargar tus clases y alumnos.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchTeacherData(); }, [fetchTeacherData]));

    const filteredStudents = useMemo(() => {
        if (!userSearchTerm) return myStudents;
        return myStudents.filter(student =>
            `${student.nombre} ${student.apellido}`.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            student.email.toLowerCase().includes(userSearchTerm.toLowerCase())
        );
    }, [myStudents, userSearchTerm]);

    const filteredClasses = useMemo(() => {
        if (!classSearchTerm) return myClasses;
        return myClasses.filter(cls =>
            (cls.nombre || 'Turno').toLowerCase().includes(classSearchTerm.toLowerCase()) ||
            (cls.tipoClase?.nombre || '').toLowerCase().includes(classSearchTerm.toLowerCase())
        );
    }, [myClasses, classSearchTerm]);

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
                    setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona un alumno.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] }); 
                    return; 
                }
                payload.targetId = selectedUserId;
                const student = myStudents.find(u => u._id === selectedUserId);
                confirmationMessage = `¿Enviar a ${student?.nombre} ${student?.apellido}?`;
                break;
            case 'class':
                if (!selectedClassId) { 
                    setAlertInfo({ visible: true, title: 'Error', message: 'Selecciona una clase.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] }); 
                    return; 
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
                        setTitle('');
                        setMessage('');
                        setIsImportant(false);
                    } catch (error) {
                        setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo enviar la notificación.', buttons: [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }] });
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
        // Se vuelve a usar un ScrollView principal para toda la pantalla
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <ThemedText type="title" style={styles.pageTitle}>Enviar Notificación a Alumnos</ThemedText>
            
            <TextInput style={styles.input} placeholder="Título" value={title} onChangeText={setTitle} placeholderTextColor={Colors[colorScheme].text} />
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline numberOfLines={4} placeholder="Mensaje" value={message} onChangeText={setMessage} placeholderTextColor={Colors[colorScheme].text} />
            
            <View style={styles.switchContainer}>
                <ThemedText>Marcar como Importante (modal)</ThemedText>
                <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={setIsImportant} value={isImportant} />
            </View>

            <ThemedText style={styles.sectionTitle}>Destinatarios</ThemedText>
            <View style={styles.pickerContainer}>
                <Picker selectedValue={targetType} onValueChange={(itemValue) => setTargetType(itemValue)}>
                    <Picker.Item label="Clase Específica" value="class" />
                    <Picker.Item label="Alumno Específico" value="user" />
                </Picker>
            </View>

            {targetType === 'user' && (
                <View>
                    <TextInput style={styles.input} placeholder="Buscar alumno..." value={userSearchTerm} onChangeText={setUserSearchTerm} placeholderTextColor={Colors[colorScheme].icon} />
                    <ScrollView style={styles.listContainer} nestedScrollEnabled={true}>
                        {filteredStudents.length > 0 ? (
                            filteredStudents.map(item => (
                                <TouchableOpacity key={item._id} style={[styles.listItem, selectedUserId === item._id && styles.listItemSelected]} onPress={() => setSelectedUserId(item._id)}>
                                    <Text style={styles.listItemText}>{item.nombre} {item.apellido}</Text>
                                    <Text style={styles.listItemSubtext}>{item.email}</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyListText}>No se encontraron alumnos</Text>
                        )}
                    </ScrollView>
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
                                    <Text style={styles.listItemSubtext}>{new Date(item.fecha).toLocaleDateString()} - {item.horaInicio}</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyListText}>No tienes clases asignadas</Text>
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
    container: { 
        flex: 1, 
        backgroundColor: Colors[colorScheme].cardBackground,
    },
    contentContainer: {
        padding: 20,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: {
        marginBottom: 25,
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
        maxHeight: 250, // Altura máxima para que la lista interna sea scrollable
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
        overflow: 'hidden',
        marginTop: 10,
    }
});

export default NotificationTeacherScreen;
