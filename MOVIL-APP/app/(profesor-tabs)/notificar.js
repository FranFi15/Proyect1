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
    FlatList,
    // --- IMPORTACIONES CLAVE ---
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import FilterModal from '@/components/FilterModal';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

const NotificationTeacherScreen = () => {
    const { gymColor, user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // Estados del formulario
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isImportant, setIsImportant] = useState(false);
    
    // Estados de selección
    const [targetType, setTargetType] = useState('class'); // Inicia por defecto en 'class'
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');

    // Estados de búsqueda (para el modal)
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [classSearchTerm, setClassSearchTerm] = useState('');

    // Estados de datos y carga
    const [myClasses, setMyClasses] = useState([]);
    const [myStudents, setMyStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Estados de modales
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [activeModal, setActiveModal] = useState(null); // Para el FilterModal
    const [searchModalVisible, setSearchModalVisible] = useState(false); // Para el nuevo modal de búsqueda

    // --- MANEJADORES DE MODAL ---
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
        setActiveModal(null);
    };

    const fetchTeacherData = useCallback(async () => {
        if (!user || !user._id) return;
        setLoading(true);
        try {
            const classesRes = await apiClient.get('/classes/profesor/me');
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
            setMyStudents(Array.from(studentMap.values()));
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar tus datos.', buttons: [{ text: 'OK' }] });
        } finally {
            setLoading(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchTeacherData(); }, [fetchTeacherData]));
    
    const filteredStudents = useMemo(() => {
        if (!userSearchTerm) return myStudents;
        return myStudents.filter(student => `${student.nombre} ${student.apellido}`.toLowerCase().includes(userSearchTerm.toLowerCase()));
    }, [myStudents, userSearchTerm]);

    const filteredClasses = useMemo(() => {
        if (!classSearchTerm) return myClasses;
        return myClasses.filter(cls => (cls.nombre || 'Turno').toLowerCase().includes(classSearchTerm.toLowerCase()));
    }, [myClasses, classSearchTerm]);
    
    const handleSendNotification = () => {
        // ... (Tu lógica de envío no necesita cambios)
    };
    
    const getModalConfig = useMemo(() => {
        const targetTypeOptions = [{ _id: 'class', nombre: 'Turno Específico' }, { _id: 'user', nombre: 'Cliente Específico' }];
        if (activeModal === 'targetType') {
            return { title: 'Seleccionar Destinatario', options: targetTypeOptions, onSelect: handleTargetTypeSelect, selectedValue: targetType };
        }
        return null;
    }, [activeModal, targetType]);

    const getDisplayName = (id) => {
        if (id === 'class') return 'Turno Específico';
        if (id === 'user') return 'Cliente Específico';
        return 'Seleccionar';
    };

    const getSelectedItemDisplay = () => {
        if (targetType === 'user' && selectedUserId) {
            const student = myStudents.find(u => u._id === selectedUserId);
            return student ? `${student.nombre} ${student.apellido}` : '';
        }
        if (targetType === 'class' && selectedClassId) {
            const cls = myClasses.find(c => c._id === selectedClassId);
            return cls ? `${cls.nombre || 'Turno'} - ${cls.tipoClase?.nombre}` : '';
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
                    <ThemedText type="title" style={styles.pageTitle}>Notificar</ThemedText>

                    <View style={styles.formContainer}>
                        <TextInput style={styles.input} placeholder="Título" value={title} onChangeText={setTitle} placeholderTextColor={Colors[colorScheme].icon} />
                        <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} multiline placeholder="Mensaje" value={message} onChangeText={setMessage} placeholderTextColor={Colors[colorScheme].icon} />
                        
                        <ThemedText style={styles.label}>Destinatarios</ThemedText>
                        <TouchableOpacity style={styles.filterButton} onPress={() => setActiveModal('targetType')}>
                            <ThemedText style={styles.filterButtonText}>{getDisplayName(targetType)}</ThemedText>
                            <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                        </TouchableOpacity>

                        {targetType === 'user' && (
                            <>
                                <ThemedText style={styles.label}>Alumno Específico</ThemedText>
                                <TouchableOpacity style={styles.filterButton} onPress={openSearchModal}>
                                    <ThemedText style={[styles.filterButtonText, !selectedUserId && styles.placeholderText]}>
                                        {selectedUserId ? getSelectedItemDisplay() : 'Seleccionar un Cliente...'}
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
                                        {selectedClassId ? getSelectedItemDisplay() : 'Seleccionar un Turno...'}
                                    </ThemedText>
                                    <FontAwesome5 name="search" size={16} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    <View style={{ flex: 1 }} />

                    <View style={styles.actionsContainer}>
                        <View style={styles.switchContainer}>
                            <ThemedText>Marcar como Importante (modal)</ThemedText>
                            <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={setIsImportant} value={isImportant} />
                        </View>
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
                                {targetType === 'user' ? 'Buscar Alumno' : 'Buscar Turno'}
                            </ThemedText>
                            <TouchableOpacity onPress={closeSearchModal}>
                                <Ionicons name="close" size={28} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder={targetType === 'user' ? "Buscar por nombre..." : "Buscar por nombre de Turno..."}
                            value={targetType === 'user' ? userSearchTerm : classSearchTerm}
                            onChangeText={targetType === 'user' ? setUserSearchTerm : setClassSearchTerm}
                            placeholderTextColor={Colors[colorScheme].icon}
                        />

                        <FlatList
                            data={targetType === 'user' ? filteredStudents : filteredClasses}
                            renderItem={targetType === 'user' ? renderUserItem : renderClassItem}
                            keyExtractor={(item) => item._id}
                            ListEmptyComponent={<Text style={styles.emptyListText}>No se encontraron resultados</Text>}
                        />
                    </KeyboardAvoidingView>
                </ThemedView>
            </Modal>
            
            {getModalConfig && (
                <FilterModal
                    visible={!!activeModal}
                    onClose={() => setActiveModal(null)}
                    onSelect={getModalConfig.onSelect}
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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageTitle: { backgroundColor: gymColor,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
       alignSelf: 'center',
       width: '100%',
       textAlign: 'center',
       fontWeight: 'bold',
       color: '#fff',
       fontSize: 18,  },
    formContainer: { paddingHorizontal: 20, paddingTop: 10 , marginTop: 20},
    label: { fontSize: 14, color: Colors[colorScheme].icon, marginBottom: 8 },
    input: {
        backgroundColor: Colors[colorScheme].cardBackground,
        color: Colors[colorScheme].text,
        padding: 15,
        borderRadius: 5,
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
        borderRadius: 5,
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
    buttonWrapper: { borderRadius: 5, overflow: 'hidden' },
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

export default NotificationTeacherScreen;