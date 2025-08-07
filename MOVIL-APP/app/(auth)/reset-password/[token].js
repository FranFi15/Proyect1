import React, { useState } from 'react';
import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    Image,
    useColorScheme,
    // --- NUEVOS IMPORTS ---
    KeyboardAvoidingView,
    ScrollView,
    Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import apiClient from '../../../services/apiClient';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';

const ResetPasswordScreen = () => {
    const { token } = useLocalSearchParams();
    const router = useRouter();
    const { gymColor, gymLogo, gymName } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    // Tu lógica de handlePasswordReset no necesita cambios.
    const handlePasswordReset = async () => {
        if (!password || !confirmPassword) {
            setAlertInfo({ visible: true, title: 'Campos vacíos', message: 'Por favor, completa ambos campos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }
        if (password !== confirmPassword) {
            setAlertInfo({ visible: true, title: 'Error', message: 'Las contraseñas no coinciden.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }

        setIsLoading(true);
        try {
            await apiClient.put(`/users/reset-password/${token}`, { password });
            setAlertInfo({
                visible: true,
                title: 'Éxito',
                message: 'Tu contraseña ha sido actualizada. Ahora puedes iniciar sesión.',
                buttons: [{
                    text: 'OK', style: 'primary', onPress: () => {
                        setAlertInfo({ visible: false });
                        router.replace('/(auth)/login');
                    }
                }]
            });
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'El token es inválido o ha expirado. Por favor, solicita un nuevo enlace.';
            setAlertInfo({ visible: true, title: 'Error', message: errorMessage, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } finally {
            setIsLoading(false);
        }
    };

    const styles = getStyles(colorScheme, gymColor);

    return (
        <ThemedView style={styles.outerContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    {gymLogo ? (
                        <Image source={{ uri: gymLogo }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <ThemedText style={styles.gymName}>{gymName || 'Gimnasio'}</ThemedText>
                    )}
                    <ThemedText type="title" style={styles.title}>Establecer Nueva Contraseña</ThemedText>

                    <TextInput
                        style={styles.input}
                        placeholder="Nueva Contraseña"
                        placeholderTextColor={Colors[colorScheme].icon}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Confirmar Nueva Contraseña"
                        placeholderTextColor={Colors[colorScheme].icon}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity style={styles.button} onPress={handlePasswordReset} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Restablecer Contraseña</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

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
    // Nuevos estilos para la estructura
    outerContainer: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20
    },
    // El resto de tus estilos permanecen igual
    logo: {
        width: 200,
        height: 200,
        alignSelf: 'center',
        marginBottom: 20,
    },
    gymName: { // Añadido estilo para gymName por si no hay logo
        fontSize: 22,
        color: gymColor || '#4b187b',
        textAlign: 'center',
        marginBottom: 20,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30
    },
    input: {
        height: 45,
        borderColor: Colors[colorScheme].border, // Corregido para usar 'border' en lugar de 'icon'
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: Colors[colorScheme].background,
        color: Colors[colorScheme].text,
        fontSize: 16,
        marginBottom: 20
    },
    button: {
        backgroundColor: gymColor || '#00177d',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
});

export default ResetPasswordScreen;