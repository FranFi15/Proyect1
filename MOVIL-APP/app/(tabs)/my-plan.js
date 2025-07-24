import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, ActivityIndicator, RefreshControl, useColorScheme, View, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado

const MyPlanScreen = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // Estado para manejar la alerta personalizada
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
                        <ThemedView key={plan._id} style={styles.card}>
                            <ThemedText style={styles.title}>{plan.name}</ThemedText>
                            {plan.description && <ThemedText style={styles.description}>{plan.description}</ThemedText>}
                            <ThemedText style={styles.content}>{plan.content}</ThemedText>
                        </ThemedView>
                    ))
                ) : (
                    <ThemedView style={styles.centered}>
                        <ThemedText style={styles.noPlanText}>Tu profesional aún no ha cargado un plan visible.</ThemedText>
                        <ThemedText style={styles.noPlanSubText}>Arrastra hacia abajo para refrescar.</ThemedText>
                    </ThemedView>
                )}
            </ScrollView>
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
    contentContainer: { flexGrow: 1, paddingBottom: 20 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 8, 
        padding: 20, 
        margin: 15,
        elevation: 3,
    },
    title: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        marginBottom: 10, 
        color: Colors[colorScheme].text 
    },
    description: {
        fontSize: 15,
        fontStyle: 'italic',
        color: Colors[colorScheme].text,
        opacity: 0.8,
        marginBottom: 15,
        borderLeftWidth: 3,
        borderLeftColor: gymColor,
        paddingLeft: 10,
    },
    content: { 
        fontSize: 16, 
        lineHeight: 24, 
        color: Colors[colorScheme].text 
    },
    noPlanText: { fontSize: 18, textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.8 },
    noPlanSubText: { fontSize: 14, textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.6, marginTop: 10 },
});

export default MyPlanScreen;
