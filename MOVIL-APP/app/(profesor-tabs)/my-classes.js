import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Alert, ActivityIndicator, SectionList, View, Text, Modal, FlatList, TouchableOpacity, useColorScheme } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, parseISO, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

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
    const [myClasses, setMyClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedClassStudents, setSelectedClassStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedClassName, setSelectedClassName] = useState('');

    const styles = getStyles(colorScheme, gymColor);

    // --- CORRECCIÓN DE useFocusEffect ---
    // Se aplica el patrón recomendado para evitar la advertencia.
    useFocusEffect(
        useCallback(() => {
            const fetchMyClasses = async () => {
                setLoading(true);
                try {
                    const response = await apiClient.get('/classes/profesor/me');
                    const sorted = response.data.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                    setMyClasses(sorted);
                } catch (error) {
                    Alert.alert('Error', 'No se pudieron cargar tus clases asignadas.');
                } finally {
                    setLoading(false);
                }
            };

            fetchMyClasses();
        }, [])
    );

    const handleViewStudents = async (classId, className) => {
        setSelectedClassName(className);
        setModalVisible(true);
        setLoadingStudents(true);
        try {
            const response = await apiClient.get(`/classes/${classId}/students`);
            setSelectedClassStudents(response.data);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los alumnos de la clase.');
            setModalVisible(false);
        } finally {
            setLoadingStudents(false);
        }
    };

    const sectionedClasses = useMemo(() => {
        const grouped = myClasses.reduce((acc, clase) => {
            const dateKey = capitalize(format(parseISO(clase.fecha), "EEEE, d 'de' MMMM", { locale: es }));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(clase);
            return acc;
        }, {});
        return Object.keys(grouped).map(title => ({ title, data: grouped[title] }));
    }, [myClasses]);

    const renderClassItem = ({ item }) => (
        <ThemedView style={styles.classItem}>
            <ThemedText style={styles.className}>{item.nombre} - {item.tipoClase?.nombre || 'General'}</ThemedText>
            <ThemedText style={styles.classInfoText}>Horario: {item.horaInicio} - {item.horaFin}</ThemedText>
            <ThemedText style={styles.classInfoText}>Inscritos: {item.usuariosInscritos.length}/{item.capacidad}</ThemedText>
            <TouchableOpacity style={styles.viewStudentsButton} onPress={() => handleViewStudents(item._id, item.nombre)}>
                <FontAwesome5 name="users" size={16} color="#fff" />
                <Text style={styles.viewStudentsButtonText}>Ver Alumnos</Text>
            </TouchableOpacity>
        </ThemedView>
    );

    const renderStudentItem = ({ item }) => (
        <View style={styles.studentItem}>
            <Text style={styles.studentName}>{item.nombre} {item.apellido}</Text>
            <Text style={styles.studentInfo}>DNI: {item.dni || 'No provisto'}</Text>
            <Text style={styles.studentInfo}>Edad: {calculateAge(item.fechaNacimiento)} años</Text>
            <Text style={styles.studentInfo}>Email: {item.email || 'No provisto'}</Text>
            <Text style={styles.studentInfo}>Teléfono: {item.numeroTelefono || 'No provisto'}</Text>
            <Text style={styles.studentInfo}>Tel. Emergencia: {item.telefonoEmergencia || 'No provisto'}</Text>
            <Text style={styles.studentInfo}>Obra Social: {item.obraSocial || 'No provisto'}</Text>
        </View>
    );

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
                ListEmptyComponent={<ThemedText style={styles.emptyText}>No tienes clases asignadas en el futuro.</ThemedText>}
            />
            
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalView}>
                        <ThemedText style={styles.modalTitle}>Alumnos en "{selectedClassName}"</ThemedText>
                        {loadingStudents ? (
                            <ActivityIndicator size="large" color={gymColor} />
                        ) : (
                            <FlatList
                                data={selectedClassStudents}
                                renderItem={renderStudentItem}
                                keyExtractor={(item) => item._id}
                                ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay alumnos inscritos.</ThemedText>}
                                style={{width: '100%'}}
                            />
                        )}
                        <TouchableOpacity
                            style={[styles.buttonClose, {backgroundColor: gymColor}]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.textStyle}>Cerrar</Text>
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
    sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors[colorScheme].background, color: Colors[colorScheme].text, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    classItem: { backgroundColor: Colors[colorScheme].cardBackground, padding: 18, marginHorizontal: 16, marginVertical: 8, borderRadius: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 1.41 },
    className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
    classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
    viewStudentsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: gymColor || '#1a5276', paddingVertical: 10, borderRadius: 8, marginTop: 12 },
    viewStudentsButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalView: { margin: 20, backgroundColor: Colors[colorScheme].background, borderRadius: 15, padding: 25, alignItems: 'center', elevation: 5, width: '90%', maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: Colors[colorScheme].text },
    buttonClose: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, elevation: 2, marginTop: 15, width: '100%' },
    textStyle: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
    studentItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border, width: '100%' },
    studentName: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 5 },
    studentInfo: { fontSize: 14, color: Colors[colorScheme].text, opacity: 0.9, marginTop: 4 }
});

export default ProfessorMyClassesScreen;
