import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

const PaymentSuccessScreen = () => {
    const { gymColor } = useAuth();
    const styles = getStyles(gymColor);

    return (
        <ThemedView style={styles.container}>
            <Ionicons name="checkmark-circle" size={100} color="#2ecc71" />
            <ThemedText style={styles.title}>¡Pago Exitoso!</ThemedText>
            <ThemedText style={styles.message}>
                Tus créditos han sido añadidos a tu cuenta. Ya puedes usarlos para inscribirte en tus turnos.
            </ThemedText>
            <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
                <Text style={styles.buttonText}>Volver al Inicio</Text>
            </TouchableOpacity>
        </ThemedView>
    );
};

const getStyles = (gymColor) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        opacity: 0.8,
    },
    button: {
        backgroundColor: gymColor || '#1a5276',
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default PaymentSuccessScreen;