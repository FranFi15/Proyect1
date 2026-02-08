import React, { useState, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    FlatList,
    View,
    ActivityIndicator,
    Pressable,
    useColorScheme,
    Text,
    Modal,
    RefreshControl,
    SectionList,
    TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { format, parseISO, differenceInYears, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import CustomAlert from '@/components/CustomAlert';
import QrScannerModal from '@/components/profesor/QrScannerModal'

// --- Funciones Helper ---
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
    // --- Estados del Componente ---
    const [myClasses, setMyClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Estados para Modales
    const [isListModalVisible, setListModalVisible] = useState(false);
    const [isScannerVisible, setScannerVisible] = useState(false);
    
    
    // Estados para Datos Seleccionados
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [selectedClassStudents, setSelectedClassStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);

    const [alertInfo, setAlertInfo] = useState({ visible: false });
    const styles = getStyles(colorScheme, gymColor);

    // --- Lógica de Datos ---
    const fetchMyClasses = useCallback(async () => {
        try {
            const response = await apiClient.get('/classes/profesor/me');
            const sorted = response.data.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            setMyClasses(sorted);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar tus turnos.' });
        }
    }, []);

    useFocusEffect(useCallback(() => {
        const loadData = async () => {
            setLoading(true);
            await fetchMyClasses();
            setLoading(false);
        };
        loadData();
    }, [fetchMyClasses]));

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchMyClasses();
        setIsRefreshing(false);
    }, [fetchMyClasses]);
    
    // --- Manejadores de Eventos ---
    const handleOpenClassModal = async (classId) => {
        setSelectedClassId(classId); 
        setListModalVisible(true);
        setLoadingStudents(true);
        try {
            const response = await apiClient.get(`/classes/${classId}/students`);
            setSelectedClassStudents(response.data);
        } catch (error) {
            setListModalVisible(false); 
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los alumnos.' });
        } finally {
            setLoadingStudents(false);
        }
    };
    
    const handleBarcodeScanned = async ({ data }) => {
        setScannerVisible(false);
        try {
            // 2. Usa el ID guardado para la llamada a la API
            const response = await apiClient.post(`/classes/${selectedClassId}/check-in`, { userId: data });
            setAlertInfo({
                visible: true,
                title: response.data.message,
                message: `Cliente: ${response.data.userName}`,
            });
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Acceso Denegado',
                message: error.response?.data?.message || 'Error al verificar la inscripción.',
            });
        }
    };

    const handleViewStudentDetails = (student) => {
        setSelectedStudent(student);
    };

    const handleBackToList = () => {
        setSelectedStudent(null);
    };

    const handleCloseModal = () => {
        setListModalVisible(false);
        setSelectedStudent(null);
        setSelectedClassId(null); // Limpia el ID al cerrar
    };
    
    // --- Lógica de Renderizado ---
    const sectionedClasses = useMemo(() => {
        const today = startOfDay(new Date());
        const futureClasses = myClasses.filter(clase => !isBefore(parseISO(clase.fecha), today));
        const grouped = futureClasses.reduce((acc, clase) => {
            const dateKey = capitalize(format(parseISO(clase.fecha), "EEEE, d 'de' MMMM", { locale: es }));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(clase);
            return acc;
        }, {});
        return Object.keys(grouped).map(title => ({ title, data: grouped[title] }));
    }, [myClasses]);

    const renderClassItem = ({ item }) => (
        <ThemedView style={styles.classItem}>
            <ThemedText style={styles.className}>{item.nombre || 'Turno'} - {item.tipoClase?.nombre || 'General'}</ThemedText>
            <ThemedText style={styles.classInfoText}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
            <ThemedText style={styles.classInfoText}>Inscritos: {item.usuariosInscritos.length}/{item.capacidad}</ThemedText>
            <Pressable style={styles.viewStudentsButton} onPress={() => handleOpenClassModal(item._id)}>
                <FontAwesome5 name="users" size={16} color="#fff" />
                <Text style={styles.viewStudentsButtonText}>Ver Clientes</Text>
            </Pressable>
        </ThemedView>
    );

    const renderStudentListItem = ({ item }) => (
        <Pressable onPress={() => handleViewStudentDetails(item)}>
            <View style={styles.studentListItem}>
                <Text style={styles.studentName}>{item.nombre} {item.apellido}</Text>
                <View style={styles.studentListActions}>
                    {item.ordenMedicaRequerida && (
                        <Ionicons
                            name="document-text"
                            size={22}
                            color={item.ordenMedicaEntregada ? '#28a745' : '#dc3545'}
                        />
                    )}
                    <FontAwesome5 name="info-circle" size={22} color={Colors[colorScheme].icon} />
                </View>
            </View>
        </Pressable>
    );

    // This component is now rendered INSIDE the single modal
    const StudentDetailView = () => {
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

                {/* This is the new Pressable to go back to the list */}
                <Pressable
                    style={({ pressed }) => [styles.button, styles.buttonBack, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={handleBackToList}
                >
                    <Text style={styles.textStyle}>Volver</Text>
                </Pressable>
            </View>
        );
    };

     if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                                <ThemedText style={styles.headerTitle}>Mis Turnos</ThemedText>
                            </View>
            <SectionList
                sections={sectionedClasses}
                keyExtractor={(item) => item._id}
                renderItem={renderClassItem}
                renderSectionHeader={({ section: { title } }) => <ThemedText style={styles.sectionHeader}>{title}</ThemedText>}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No tienes turnos asignados.</ThemedText>}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />}
            />

            <Modal
                animationType="fade"
                transparent={true}
                visible={isListModalVisible}
                onRequestClose={handleCloseModal}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalView}>
                        {selectedStudent ? (
                            <StudentDetailView /> 
                        ) : (
                            <>
                                <ThemedText style={styles.modalTitle}>Clientes Inscritos</ThemedText>

                                <TouchableOpacity style={styles.scanButton} onPress={() => {setListModalVisible(false); setScannerVisible(true);}}>
                                    <FontAwesome5 name="qrcode" size={18} color="#fff" />
                                    <Text style={styles.scanButtonText}>Escanear Ingreso (QR)</Text>
                                </TouchableOpacity>

                                {loadingStudents ? (
                                    <ActivityIndicator size="large" color={gymColor} />
                                ) : (
                                    <FlatList
                                        data={selectedClassStudents}
                                        renderItem={renderStudentListItem}
                                        keyExtractor={(item) => item._id}
                                        ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay clientes inscritos.</ThemedText>}
                                        style={{ width: '100%' }}
                                    />
                                )}
                            </>
                        )}
                        <Pressable style={({ pressed }) => [styles.button, styles.buttonClose, { opacity: pressed ? 0.7 : 1 }]} onPress={handleCloseModal}>
                            <Text style={styles.textStyle}>Cerrar</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
                <QrScannerModal 
                visible={isScannerVisible}
                onClose={() => {setScannerVisible(false); setListModalVisible(true)} }
                onBarcodeScanned={handleBarcodeScanned}
            />
           

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons || [{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }]}
                onClose={() => setAlertInfo({ visible: false })}
                gymColor={gymColor}
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background, },
    headerContainer: {
        backgroundColor: gymColor,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerTitle: {backgroundColor: gymColor,
        
        alignItems: 'center',
       alignSelf: 'center',
       width: '100%',
       textAlign: 'center',
       fontWeight: 'bold',
       color: '#fff',
       fontSize: 18,},
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' , },
    sectionHeader: { marginTop: 15,fontSize: 20, fontWeight: 'bold', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors[colorScheme].background, color: Colors[colorScheme].text, },
    classItem: { backgroundColor: Colors[colorScheme].cardBackground, padding: 18, marginHorizontal: 16, marginVertical: 8, borderRadius: 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 1.41,  borderWidth: 1, borderColor: Colors[colorScheme].border },
    className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
    classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
    viewStudentsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: gymColor || '#1a5276', paddingVertical: 10, borderRadius: 5, marginTop: 12 },
    viewStudentsButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    modalContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalView: {  backgroundColor: Colors[colorScheme].background, borderRadius: 5, padding: 25, justifyContent: 'flex-end' , alignItems: 'center', elevation: 5, width: '100%', height: '85%' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: Colors[colorScheme].text },
    button: {
        borderRadius: 5,
        paddingVertical: 12,
        paddingHorizontal: 20,
        elevation: 2,
        width: '100%',
        marginTop: 15,
    },
    buttonClose: {
        backgroundColor: '#c0392b', // Un color rojo para cerrar
    },
    buttonBack: {
        backgroundColor: '#2980b9', // Un color azul para volver
    },
    textStyle: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
    
    studentListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18,  width: '100%' },
    studentName: { fontSize: 18, color: Colors[colorScheme].text },
    studentListActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },

    studentDetailContainer: { width: '100%', alignItems: 'center' }, 
    detailTitle: { fontSize: 22, fontWeight: 'bold', color: Colors[colorScheme].text, textAlign: 'center', marginBottom: 15 },
    studentInfo: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.9, marginTop: 8, alignSelf: 'flex-start' }, 
    infoLabel: { fontWeight: 'bold' },
    scanButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: gymColor,
        paddingVertical: 12, borderRadius: 5, marginBottom: 15, width: '100%',
    },
    scanButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, fontSize: 16 }
});

export default ProfessorMyClassesScreen;