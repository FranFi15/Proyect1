// app/(auth)/forgot-password.js

import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';

const ForgotPasswordScreen = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Error', 'Por favor, ingresa tu correo electrónico.');
            return;
        }
        setIsLoading(true);
        try {
            // Aquí iría la lógica para llamar a tu API
            // Por ejemplo: await apiClient.post('/auth/forgot-password', { email });

            Alert.alert(
                'Solicitud Enviada', 
                'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
            );
        } catch (error) {
            // Manejar el error sin revelar si el email existe o no
             Alert.alert(
                'Solicitud Enviada', 
                'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>Recuperar Contraseña</ThemedText>
            <ThemedText style={styles.subtitle}>
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </ThemedText>
            
            <TextInput
                style={styles.input}
                placeholder="Tu correo electrónico"
                placeholderTextColor={Colors[colorScheme].icon}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={isLoading}>
                {isLoading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Enviar Enlace</Text>
                )}
            </TouchableOpacity>
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        opacity: 0.8,
    },
    input: {
        height: 45,
        borderColor: Colors[colorScheme].icon,
        borderWidth: 1,
        borderRadius: 2,
        paddingHorizontal: 12,
        backgroundColor: Colors[colorScheme].background,
        color: Colors[colorScheme].text,
        fontSize: 16,
        marginBottom: 20,
    },
    button: {
        backgroundColor: gymColor || '#00177d',
        paddingVertical: 12,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ForgotPasswordScreen;