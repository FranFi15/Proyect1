import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Alert, ActivityIndicator, SectionList, View, Text, Modal, FlatList, TouchableOpacity, useColorScheme , RefreshControl} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, parseISO, differenceInYears, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';

const capitalize = (str) => {
    if (!str) return '';
    const dateStr = str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return dateStr.replace(' De ', ' de ');
};

const calculateAge = (birthDateString) => {
    if (!birthDateString) return 'N/A';
    try {
        return differenceInYears(new Date(), parseISO(birthDateString));
    } catch (error) {
        return 'N/A';
    }
};

const ProfessorMyClassesScreen = () => {
    // --- STATE MANAGEMENT ---
    const [myClasses, setMyClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
     const [isRefreshing, setIsRefreshing] = useState(false); 
    
    // State for the main student list modal
    const [isListModalVisible, setListModalVisible] = useState(false);
    const [selectedClassStudents, setSelectedClassStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedClassName, setSelectedClassName] = useState('');

    // State for the student detail modal
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);

    const styles = getStyles(colorScheme, gymColor);

    // --- DATA FETCHING ---
   const fetchMyClasses = useCallback(async () => {
        try {
            const response = await apiClient.get('/classes/profesor/me');
            const sorted = response.data.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            setMyClasses(sorted);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar tus turnos asignados.');
        }
    }, []);

    // --- 4. Modificar useFocusEffect para manejar la carga inicial ---
    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                setLoading(true);
                await fetchMyClasses();
                setLoading(false);
            };
            loadData();
        }, [fetchMyClasses])
    );

    // --- 5. Crear la función onRefresh ---
    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchMyClasses();
        setIsRefreshing(false);
    }, [fetchMyClasses]);

    // Opens the list of students for a specific class.
    const handleViewStudents = async (classId, className) => {
        setSelectedClassName(className);
        setListModalVisible(true);
        setLoadingStudents(true);
        try {
            const response = await apiClient.get(`/classes/${classId}/students`);
            setSelectedClassStudents(response.data);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los alumnos del turno.');
            setListModalVisible(false);
        } finally {
            setLoadingStudents(false);
        }
    };

    // Opens the detail view for a single selected student.
    const handleViewStudentDetails = (student) => {
        setSelectedStudent(student);
        setDetailModalVisible(true);
    };

    // --- DATA STRUCTURING ---
const sectionedClasses = useMemo(() => {
    
    const today = startOfDay(new Date());

    
    const futureClasses = myClasses.filter(clase => {
        const classDate = parseISO(clase.fecha);
        // La condición !isBefore(classDate, today) es verdadera si la clase es
        // de hoy o de una fecha futura.
        return !isBefore(classDate, today);
    });

    
    const grouped = futureClasses.reduce((acc, clase) => {
        const dateKey = capitalize(format(parseISO(clase.fecha), "EEEE, d 'de' MMMM", { locale: es }));
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(clase);
        return acc;
    }, {});

    return Object.keys(grouped).map(title => ({ title, data: grouped[title] }));
}, [myClasses]); 

    // --- RENDER FUNCTIONS ---

    // Renders a single class item in the main screen list.
    const renderClassItem = ({ item }) => (
        <ThemedView style={styles.classItem}>
            <ThemedText style={styles.className}>{item.nombre || 'Turno'} - {item.tipoClase?.nombre || 'General'}</ThemedText>
            <ThemedText style={styles.classInfoText}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
            <ThemedText style={styles.classInfoText}>Inscritos: {item.usuariosInscritos.length}/{item.capacidad}</ThemedText>
            <TouchableOpacity style={styles.viewStudentsButton} onPress={() => handleViewStudents(item._id, item.nombre)}>
                <FontAwesome5 name="users" size={16} color="#fff" />
                <Text style={styles.viewStudentsButtonText}>Ver Clientes</Text>
            </TouchableOpacity>
        </ThemedView>
    );

    // Renders a student's name in the first modal list.
     const renderStudentListItem = ({ item }) => (
        <TouchableOpacity onPress={() => handleViewStudentDetails(item)}>
            <View style={styles.studentListItem}>
                <Text style={styles.studentName}>{item.nombre} {item.apellido}</Text>
                 <View style={styles.studentListActions}>
                    {item.ordenMedicaRequerida && (
                        <Ionicons
                            name={item.ordenMedicaEntregada ? "document-text" : "document-text"}
                            size={22} 
                            color={item.ordenMedicaEntregada ? '#28a745' : '#dc3545'}
                        />
                    )}
                    <FontAwesome5 name="info-circle" size={22} color={Colors[colorScheme].icon} />
                </View>
            </View>
        </TouchableOpacity>
    );

    // Renders the full details of a student in the second modal.
    const renderStudentDetail = () => {
        if (!selectedStudent) return null;

        return (
            <View style={styles.studentDetailContainer}>
                 <Text style={styles.detailTitle}>{selectedStudent.nombre} {selectedStudent.apellido}</Text>
                 <Text style={styles.studentInfo}><Text style={styles.infoLabel}>DNI:</Text> {selectedStudent.dni || 'No provisto'}</Text>
                 <Text style={styles.studentInfo}><Text style={styles.infoLabel}>Edad:</Text> {calculateAge(selectedStudent.fechaNacimiento)} años</Text>
                 <Text style={styles.studentInfo}><Text style={styles.infoLabel}>Email:</Text> {selectedStudent.email || 'No provisto'}</Text>
                 <Text style={styles.studentInfo}><Text style={styles.infoLabel}>Teléfono:</Text> {selectedStudent.numeroTelefono || 'No provisto'}</Text>
                 <Text style={styles.studentInfo}><Text style={styles.infoLabel}>Tel. Emergencia:</Text> {selectedStudent.telefonoEmergencia || 'No provisto'}</Text>
                 <Text style={styles.studentInfo}><Text style={styles.infoLabel}>Obra Social:</Text> {selectedStudent.obraSocial || 'No provisto'}</Text>
            </View>
        );
    };

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={styles.container}>
            <SectionList
                sections={sectionedClasses}
                keyExtractor={(item) => item._id}
                renderItem={renderClassItem}
                renderSectionHeader={({ section: { title } }) => (
                    <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
                )}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No tienes turnos asignados en el futuro.</ThemedText>}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />
                }
            />
            
            {/* Modal 1: List of Students */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isListModalVisible}
                onRequestClose={() => setListModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalView}>
                        <ThemedText style={styles.modalTitle}>Clientes</ThemedText>
                        {loadingStudents ? (
                            <ActivityIndicator size="large" color={gymColor} />
                        ) : (
                            <FlatList
                                data={selectedClassStudents}
                                renderItem={renderStudentListItem}
                                keyExtractor={(item) => item._id}
                                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay clientes inscritos.</ThemedText>}
                                style={{width: '100%'}}
                                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />
                }
                            />
                        )}
                        <TouchableOpacity
                            style={[styles.buttonClose, {backgroundColor: '#1a5276'}]}
                            onPress={() => setListModalVisible(false)}
                        >
                            <Text style={styles.textStyle}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal 2: Student Details */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isDetailModalVisible}
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalView}>
                        <ThemedText style={styles.modalTitle}>Detalles del Cliente</ThemedText>
                        {renderStudentDetail()}
                        <TouchableOpacity
                            style={[styles.buttonClose, {backgroundColor: '#1a5276'}]}
                            onPress={() => setDetailModalVisible(false)}
                        >
                            <Text style={styles.textStyle}>Volver</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background, },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors[colorScheme].background, color: Colors[colorScheme].text, borderBottomWidth: 0, borderBottomColor: Colors[colorScheme].border },
    classItem: { backgroundColor: Colors[colorScheme].cardBackground, padding: 18, marginHorizontal: 16, marginVertical: 8, borderRadius: 2, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 1.41 },
    className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
    classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
    viewStudentsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor:'#1a5276', paddingVertical: 10, borderRadius: 2, marginTop: 12 },
    viewStudentsButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalView: { margin: 20, backgroundColor: Colors[colorScheme].background, borderRadius: 2, padding: 25, alignItems: 'center', elevation: 5, width: '90%', maxHeight: '80%' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: Colors[colorScheme].text },
    buttonClose: { borderRadius: 2, paddingVertical: 12, paddingHorizontal: 20, elevation: 2, marginTop: 15, width: '100%' },
    textStyle: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
    // Styles for the first modal (student list)
    studentListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 0,
        borderBottomColor: Colors[colorScheme].border,
        width: '100%'
    },
    studentName: {
        fontSize: 18,
        color: Colors[colorScheme].text,
    },
    studentListActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15, // Espacio entre los íconos
    },
    studentDetailContainer: {
        width: '100%',
        marginBottom: 20,
    },
    detailTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: gymColor,
        textAlign: 'center',
        marginBottom: 15,
    },
    studentInfo: {
        fontSize: 16,
        color: Colors[colorScheme].text,
        opacity: 0.9,
        marginTop: 8,
    },
    infoLabel: {
        fontWeight: 'bold',
    }
});

export default ProfessorMyClassesScreen;
