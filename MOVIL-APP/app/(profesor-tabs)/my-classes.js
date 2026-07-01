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
    ScrollView,
    Linking,
    Alert,
    Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
            <View style={styles.studentCard}>
                {item.fotoPerfil ? (
                    <Image source={{ uri: item.fotoPerfil }} style={styles.studentAvatar} />
                ) : (
                    <View style={[styles.studentAvatar, { backgroundColor: gymColor || '#007bff' }]}>
                        <Text style={styles.studentAvatarText}>
                            {(item.nombre?.[0] || '').toUpperCase()}{(item.apellido?.[0] || '').toUpperCase()}
                        </Text>
                    </View>
                )}
                <View style={styles.studentCardInfo}>
                    <Text style={styles.studentName}>{item.nombre} {item.apellido}</Text>
                    <Text style={styles.studentSub}>{item.email || 'Sin email'}</Text>
                </View>
                <View style={styles.studentListActions}>
                    {item.ordenMedicaRequerida && (
                        <Ionicons
                            name="document-text"
                            size={20}
                            color={item.ordenMedicaEntregada ? '#28a745' : '#dc3545'}
                        />
                    )}
                    <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme].icon} />
                </View>
            </View>
        </Pressable>
    );

    // This component is now rendered INSIDE the single modal
    const StudentDetailView = () => {
        if (!selectedStudent) return null;

        const infoRows = [
            { icon: 'id-card', label: 'DNI', value: selectedStudent.dni || 'No provisto' },
            { icon: 'calendar-alt', label: 'Edad', value: `${calculateAge(selectedStudent.fechaNacimiento)} años` },
            { icon: 'envelope', label: 'Email', value: selectedStudent.email || 'No provisto' },
            { icon: 'phone-alt', label: 'Teléfono', value: selectedStudent.numeroTelefono || 'No provisto', phone: !!selectedStudent.numeroTelefono },
            { icon: 'ambulance', label: 'Tel. Emergencia', value: selectedStudent.telefonoEmergencia || 'No provisto', phone: !!selectedStudent.telefonoEmergencia },
            { icon: 'hospital', label: 'Obra Social', value: selectedStudent.obraSocial || 'No provisto' },
        ];

        const handlePhoneTap = (number) => {
            Alert.alert(
                number,
                '¿Qué deseas hacer?',
                [
                    { text: 'Llamar', onPress: () => Linking.openURL(`tel:${number}`) },
                    { text: 'Copiar número', onPress: async () => {
                        await Clipboard.setStringAsync(number);
                        Alert.alert('Copiado', 'Número copiado al portapapeles.');
                    }},
                    { text: 'Cancelar', style: 'cancel' },
                ]
            );
        };

        return (
            <View style={styles.studentDetailContainer}>
                {/* Detail Header */}
                {selectedStudent.fotoPerfil ? (
                    <Image source={{ uri: selectedStudent.fotoPerfil }} style={styles.detailAvatarLarge} />
                ) : (
                    <View style={[styles.detailAvatarLarge, { backgroundColor: gymColor || '#007bff' }]}>
                        <Text style={styles.detailAvatarText}>
                            {(selectedStudent.nombre?.[0] || '').toUpperCase()}{(selectedStudent.apellido?.[0] || '').toUpperCase()}
                        </Text>
                    </View>
                )}
                <Text style={styles.detailTitle}>{selectedStudent.nombre} {selectedStudent.apellido}</Text>

                {/* Info Cards */}
                <ScrollView style={{ width: '100%', flex: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={styles.detailInfoCard}>
                        {infoRows.map((row, idx) => {
                            const RowWrapper = row.phone ? TouchableOpacity : View;
                            const wrapperProps = row.phone ? { onPress: () => handlePhoneTap(row.value), activeOpacity: 0.6 } : {};
                            return (
                                <RowWrapper key={idx} style={[styles.detailInfoRow, idx < infoRows.length - 1 && styles.detailInfoRowBorder]} {...wrapperProps}>
                                    <View style={styles.detailInfoIcon}>
                                        <FontAwesome5 name={row.icon} size={16} color={gymColor || '#007bff'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.detailInfoLabel}>{row.label}</Text>
                                        <Text style={[styles.detailInfoValue, row.phone && { color: gymColor || '#007bff', textDecorationLine: 'underline' }]}>{row.value}</Text>
                                    </View>
                                    {row.phone && <Ionicons name="call-outline" size={20} color={gymColor || '#007bff'} />}
                                </RowWrapper>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={handleBackToList} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={18} color="#fff" />
                    <Text style={styles.backButtonText}>Volver a la Lista</Text>
                </TouchableOpacity>
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
                animationType="slide"
                transparent={true}
                visible={isListModalVisible}
                onRequestClose={handleCloseModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        {selectedStudent ? (
                            <StudentDetailView /> 
                        ) : (
                            <>
                                {/* Modal Header */}
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalHeaderTitle}>Clientes Inscritos</Text>
                                    <Text style={styles.modalHeaderSubtitle}>{selectedClassStudents.length} alumno{selectedClassStudents.length !== 1 ? 's' : ''}</Text>
                                </View>

                                {/* QR Scan Button */}
                                <TouchableOpacity style={styles.scanButton} onPress={() => {setListModalVisible(false); setScannerVisible(true);}}>
                                    <FontAwesome5 name="qrcode" size={18} color="#fff" />
                                    <Text style={styles.scanButtonText}>Escanear Ingreso (QR)</Text>
                                </TouchableOpacity>

                                {loadingStudents ? (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                        <ActivityIndicator size="large" color={gymColor} />
                                    </View>
                                ) : (
                                    <FlatList
                                        data={selectedClassStudents}
                                        renderItem={renderStudentListItem}
                                        keyExtractor={(item) => item._id}
                                        ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay clientes inscritos.</ThemedText>}
                                        style={{ width: '100%', flex: 1 }}
                                        contentContainerStyle={{ paddingBottom: 10 }}
                                        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                                    />
                                )}
                            </>
                        )}
                        {/* Close Button */}
                        <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal} activeOpacity={0.8}>
                            <Text style={styles.closeButtonText}>Cerrar</Text>
                        </TouchableOpacity>
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
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4
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
    classItem: { backgroundColor: Colors[colorScheme].cardBackground, padding: 18, marginHorizontal: 16, marginVertical: 8, borderRadius: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3,  borderWidth: 1, borderColor: Colors[colorScheme].border },
    className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
    classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
    viewStudentsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: gymColor || '#1a5276', paddingVertical: 12, borderRadius: 10, marginTop: 12 },
    viewStudentsButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },

    // --- MODAL STYLES ---
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: {
        backgroundColor: Colors[colorScheme].background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 20,
        paddingHorizontal: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        height: '85%',
    },
    modalHeader: {
        backgroundColor: gymColor || '#007bff',
        marginHorizontal: -20,
        marginTop: 0,
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        alignItems: 'center',
        marginBottom: 16,
    },
    modalHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    modalHeaderSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

    // --- STUDENT CARD LIST ITEM ---
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors[colorScheme].cardBackground,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
    },
    studentAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    studentAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    studentCardInfo: { flex: 1 },
    studentName: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text },
    studentSub: { fontSize: 12, color: Colors[colorScheme].icon, marginTop: 2 },
    studentListActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

    // --- STUDENT DETAIL VIEW ---
    studentDetailContainer: { flex: 1, width: '100%', alignItems: 'center', paddingTop: 20 },
    detailAvatarLarge: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    detailAvatarText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
    detailTitle: { fontSize: 22, fontWeight: 'bold', color: Colors[colorScheme].text, textAlign: 'center', marginBottom: 20 },
    detailInfoCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        overflow: 'hidden',
    },
    detailInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    detailInfoRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
    },
    detailInfoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: (gymColor || '#007bff') + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    detailInfoLabel: { fontSize: 11, color: Colors[colorScheme].icon, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    detailInfoValue: { fontSize: 15, color: Colors[colorScheme].text, fontWeight: '500', marginTop: 2 },

    // --- BUTTONS ---
    scanButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: gymColor || '#007bff',
        paddingVertical: 14, borderRadius: 12, marginBottom: 16, width: '100%',
        elevation: 2, shadowColor: gymColor || '#007bff', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 4,
    },
    scanButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, fontSize: 15 },
    closeButton: {
        backgroundColor: colorScheme === 'dark' ? '#444' : '#e0e0e0',
        paddingVertical: 14,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginTop: 12,
    },
    closeButtonText: { color: Colors[colorScheme].text, fontWeight: 'bold', fontSize: 15 },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: gymColor || '#007bff',
        paddingVertical: 14,
        borderRadius: 12,
        width: '100%',
        marginTop: 12,
        elevation: 2,
    },
    backButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
});

export default ProfessorMyClassesScreen;