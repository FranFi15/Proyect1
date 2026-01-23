import React, { useState, useCallback } from 'react';
import { 
    ScrollView, 
    StyleSheet, 
    ActivityIndicator, 
    RefreshControl, 
    useColorScheme, 
    View, 
    TouchableOpacity,
    Modal,
    Text
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns'; // Importar date-fns

// Importamos el visualizador de contenido HTML/Texto
import PlanContentViewer from '@/components/PlanContentViewer';

// Componente de Modal para los detalles del plan
const PlanDetailModal = ({ visible, plan, onClose, gymColor, colorScheme }) => {
    if (!plan) return null;

    const styles = getStyles(colorScheme, gymColor);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalView}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>
                    
                    <ScrollView contentContainerStyle={styles.modalScrollContainer}>
                        <ThemedText style={styles.modalTitle}>{plan.name}</ThemedText>
                        

                        {plan.description && (
                            <ThemedText style={styles.modalDescription}>{plan.description}</ThemedText>
                        )}
                        
                        {/* CONTENIDO PRINCIPAL RENDERIZADO */}
                        <View style={styles.contentWrapper}>
                            <PlanContentViewer 
                                content={plan.content} 
                                colorScheme={colorScheme} 
                            />
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const MyPlanScreen = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    const fetchPlans = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/plans/my-plans');
            setPlans(response.data);
        } catch (error) {
            console.log("Error al cargar los planes visibles.");
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudo cargar tu plan de entrenamiento.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchPlans(); }, [fetchPlans]));

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPlans().then(() => setRefreshing(false));
    }, [fetchPlans]);

    const handlePlanPress = (plan) => {
        setSelectedPlan(plan);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setSelectedPlan(null);
    };

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Mis Planes</Text>
            </View>
            
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={gymColor} />}
            >
                {plans.length > 0 ? (
                    plans.map(plan => (
                        <TouchableOpacity key={plan._id} style={styles.planButton} onPress={() => handlePlanPress(plan)}>
                            <View style={{flex: 1}}>
                                <ThemedText style={styles.planButtonText}>{plan.name}</ThemedText>
                                <Text style={styles.planButtonDate}>
                                    Creado: {format(new Date(plan.createdAt), 'dd/MM/yyyy')}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={22} color={gymColor} />
                        </TouchableOpacity>
                    ))
                ) : (
                    <ThemedView style={styles.centered}>
                        <Ionicons name="documents-outline" size={64} color={Colors[colorScheme].icon} style={{marginBottom: 10, opacity: 0.5}} />
                        <ThemedText style={styles.noPlanText}>Aún no tienes planes asignados.</ThemedText>
                    </ThemedView>
                )}
            </ScrollView>

            <PlanDetailModal
                visible={isModalVisible}
                plan={selectedPlan}
                onClose={handleCloseModal}
                gymColor={gymColor}
                colorScheme={colorScheme}
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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { flexGrow: 1, padding: 15 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 50 },
    headerContainer: {
        backgroundColor: gymColor,
        paddingVertical: 15,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        elevation: 4
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    planButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, padding: 20, marginVertical: 6, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, borderWidth: 1, borderColor: 'transparent' 
    },
    planButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors[colorScheme].text,
        marginBottom: 4
    },
    planButtonDate: {
        fontSize: 12,
        color: Colors[colorScheme].icon,
    },
    noPlanText: { fontSize: 18, textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.8, fontWeight: '600' },
    noPlanSubText: { fontSize: 14, textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.6, marginTop: 5 },
    
   
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        height: '90%',
        backgroundColor: Colors[colorScheme].background,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
        padding: 20,
        elevation: 5,
    },
    closeButton: {
        alignSelf: 'flex-end',
        marginBottom: 10,
        padding: 5
    },
    modalScrollContainer: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 5,
        color: Colors[colorScheme].text,
        textAlign: 'center',
        borderBottomWidth: 3,
        borderBottomColor: gymColor,
        paddingBottom: 10
    },
    modalDescription: {
        fontSize: 16,
        fontStyle: 'italic',
        color: Colors[colorScheme].text,
        opacity: 0.9,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: gymColor,
        paddingLeft: 15,
        backgroundColor: Colors[colorScheme].cardBackground,
        paddingVertical: 10,
        borderRadius: 4
    },
    contentWrapper: {
        marginTop: 10
    }
});

export default MyPlanScreen;