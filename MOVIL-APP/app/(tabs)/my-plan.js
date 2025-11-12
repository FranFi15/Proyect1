import React, { useState, useCallback } from 'react';
import { 
    ScrollView, 
    StyleSheet, 
    ActivityIndicator, 
    RefreshControl, 
    useColorScheme, 
    View, 
    TouchableOpacity,
    Modal // Volvemos a importar Modal
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';

// Componente de Modal para los detalles del plan
const PlanDetailModal = ({ visible, plan, onClose, gymColor, colorScheme }) => {
    if (!plan) return null;

    const styles = getStyles(colorScheme, gymColor);

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <ThemedView style={styles.modalView}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={30} color="#ccc" />
                    </TouchableOpacity>
                    <ScrollView contentContainerStyle={styles.modalScrollContainer}>
                        <ThemedText style={styles.modalTitle}>{plan.name}</ThemedText>
                        {plan.description && (
                            <ThemedText style={styles.modalDescription}>{plan.description}</ThemedText>
                        )}
                        <ThemedText style={styles.modalContent}>{plan.content}</ThemedText>
                    </ScrollView>
                </ThemedView>
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
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={gymColor} />}
            >
                {plans.length > 0 ? (
                    plans.map(plan => (
                        <TouchableOpacity key={plan._id} style={styles.planButton} onPress={() => handlePlanPress(plan)}>
                            <ThemedText style={styles.planButtonText}>{plan.name}</ThemedText>
                            <Ionicons name="chevron-forward" size={22} color={gymColor} />
                        </TouchableOpacity>
                    ))
                ) : (
                    <ThemedView style={styles.centered}>
                        <ThemedText style={styles.noPlanText}>Tu profesional aún no ha cargado un plan visible.</ThemedText>
                        <ThemedText style={styles.noPlanSubText}>Arrastra hacia abajo para refrescar.</ThemedText>
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
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    planButton: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 5,
        paddingVertical: 20,
        paddingHorizontal: 15,
        marginVertical: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    planButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors[colorScheme].text,
        flex: 1, 
    },
    noPlanText: { fontSize: 18, textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.8 },
    noPlanSubText: { fontSize: 14, textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.6, marginTop: 10 },
    
    // Estilos del Modal
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        height: '85%',
        backgroundColor: Colors[colorScheme].background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        elevation: 5,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 1,
    },
    modalScrollContainer: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 15,
        color: Colors[colorScheme].text,
        textAlign: 'center'
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
    },
    modalContent: {
        fontSize: 17,
        lineHeight: 25,
        color: Colors[colorScheme].text,
    },
});

export default MyPlanScreen;
