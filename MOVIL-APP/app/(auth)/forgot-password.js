// app/(auth)/forgot-password.js

import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import apiClient from '../../services/apiClient';

const ForgotPasswordScreen = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Campo vacío', 'Por favor, ingresa tu correo electrónico.');
            return;
        }
        setIsLoading(true);
        try {
            // --- 💡 LLAMADA A LA API ---
            await apiClient.post('/users/forgot-password', { email });

            Alert.alert(
                'Solicitud Enviada',
                'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
            );
            

        } catch (error) {
            console.error('Error al solicitar reseteo:', error.response ? error.response.data : (error.toJSON ? error.toJSON() : error));

            // Si el error tiene una respuesta del servidor (no es un simple error de red)
            if (error.response && error.response.data && error.response.data.message) {
                 // Para errores del servidor (código 5xx), como problemas de base de datos,
                 // mostramos un mensaje genérico para no exponer detalles técnicos al usuario.
                if (String(error.response.status).startsWith('5')) {
                     Alert.alert(
                        'Error en el Servidor',
                        'Estamos experimentando problemas técnicos. Por favor, inténtalo de nuevo más tarde.'
                    );
                } else {
                    // Para otros errores (ej. 400 Bad Request), que pueden ser informativos,
                    // mostramos el mensaje específico que envía el backend.
                    Alert.alert('Error', error.response.data.message);
                }
            } else {
                // Para errores de red (sin respuesta del servidor) o errores inesperados.
                Alert.alert(
                    'Error de Conexión',
                    'No se pudo conectar. Por favor, verifica tu conexión a internet e inténtalo de nuevo.'
                );
            }
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
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: Colors[colorScheme].background,
        color: Colors[colorScheme].text,
        fontSize: 16,
        marginBottom: 20,
    },
    button: {
        backgroundColor: gymColor || '#00177d',
        paddingVertical: 12,
        borderRadius: 8,
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