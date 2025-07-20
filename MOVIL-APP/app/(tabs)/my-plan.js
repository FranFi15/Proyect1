import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, ActivityIndicator, RefreshControl, useColorScheme } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { getMyVisiblePlan } from '../../services/managementApi';
import { Colors } from '@/constants/Colors';

const MyPlanScreen = () => {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const fetchPlan = useCallback(async () => {
        setLoading(true);
        try {
            const response = await getMyVisiblePlan();
            setPlan(response.data);
        } catch (error) {
            // No mostramos alerta, simplemente no hay plan visible
            console.log("No se encontró un plan visible para el usuario.");
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchPlan();
        }, [fetchPlan])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPlan().then(() => setRefreshing(false));
    }, [fetchPlan]);

    if (loading) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={gymColor} />}
        >
            {plan ? (
                <ThemedView style={styles.card}>
                    <ThemedText style={styles.title}>{plan.title}</ThemedText>
                    <ThemedText style={styles.content}>{plan.content}</ThemedText>
                </ThemedView>
            ) : (
                <ThemedView style={styles.centered}>
                    <ThemedText style={styles.noPlanText}>Tu profesional aún no ha cargado un plan visible para ti.</ThemedText>
                    <ThemedText style={styles.noPlanSubText}>Arrastra hacia abajo para refrescar.</ThemedText>
                </ThemedView>
            )}
        </ScrollView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { 
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
    },
    centered: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 20,
    },
    card: { 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 2, 
        padding: 20, 
        margin: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    title: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        marginBottom: 15, 
        color: Colors[colorScheme].text 
    },
    content: { 
        fontSize: 16, 
        lineHeight: 24, 
        color: Colors[colorScheme].text 
    },
    noPlanText: { 
        fontSize: 18, 
        textAlign: 'center', 
        color: Colors[colorScheme].text, 
        opacity: 0.8 
    },
    noPlanSubText: { 
        fontSize: 14, 
        textAlign: 'center', 
        color: Colors[colorScheme].text, 
        opacity: 0.6, 
        marginTop: 10 
    },
});

export default MyPlanScreen;
