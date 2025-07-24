import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Text, ActivityIndicator, Image } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import apiClient from '../../services/apiClient';
import CustomAlert from '@/components/CustomAlert'; // 1. Importar CustomAlert

const ForgotPasswordScreen = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { gymColor ,gymLogo, gymName } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // 2. Añadir estado para la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const handleResetPassword = async () => {
        if (!email) {
            setAlertInfo({
                visible: true,
                title: 'Campo vacío',
                message: 'Por favor, ingresa tu correo electrónico.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            return;
        }
        setIsLoading(true);
        try {
            await apiClient.post('/users/forgot-password', { email });

            setAlertInfo({
                visible: true,
                title: 'Solicitud Enviada',
                message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });

        } catch (error) {
            console.error('Error al solicitar reseteo:', error.response ? error.response.data : (error.toJSON ? error.toJSON() : error));

            let alertMessage = 'Ocurrió un error inesperado. Por favor, intenta de nuevo.';
            if (error.response && error.response.data && error.response.data.message) {
                 if (String(error.response.status).startsWith('5')) {
                    alertMessage = 'Estamos experimentando problemas técnicos. Por favor, inténtalo de nuevo más tarde.';
                 } else {
                    alertMessage = error.response.data.message;
                 }
            } else {
                alertMessage = 'No se pudo conectar. Por favor, verifica tu conexión a internet e inténtalo de nuevo.';
            }
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: alertMessage,
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
             {gymLogo ? (
                <Image source={{ uri: gymLogo }} style={styles.logo} resizeMode="contain" />
            ) : (
                <ThemedText style={styles.gymName}>{gymName || 'Gimnasio'}</ThemedText>
            )}
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

            {/* 3. Renderizar el componente CustomAlert */}
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
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    logo: {
        width: 200,
        height: 200,
        alignSelf: 'center',
        marginBottom: 20,
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
