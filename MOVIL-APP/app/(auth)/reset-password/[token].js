import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import apiClient from '../../../services/apiClient'; // Revisa esta ruta
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';


const ResetPasswordScreen = () => {
    const { token } = useLocalSearchParams(); // Obtiene el token de la URL
    const router = useRouter();
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const styles = getStyles(colorScheme, gymColor);

    const handlePasswordReset = async () => {
        if (!password || !confirmPassword) {
            Alert.alert('Campos vacíos', 'Por favor, completa ambos campos.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden.');
            return;
        }

        setIsLoading(true);
        try {
            // --- 💡 LLAMADA A LA API CON EL TOKEN Y LA NUEVA CONTRASEÑA ---
            await apiClient.put(`/users/reset-password/${token}`, { password });

            Alert.alert(
                'Éxito',
                'Tu contraseña ha sido actualizada. Ahora puedes iniciar sesión.',
                [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }] // Redirige al login
            );

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'El token es inválido o ha expirado. Por favor, solicita un nuevo enlace.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
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
                {isLoading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Restablecer Contraseña</Text>
                )}
            </TouchableOpacity>
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
    input: { height: 45, borderColor: Colors[colorScheme].icon, borderWidth: 1, borderRadius: 2, paddingHorizontal: 12, backgroundColor: Colors[colorScheme].background, color: Colors[colorScheme].text, fontSize: 16, marginBottom: 20 },
    button: { backgroundColor: gymColor || '#00177d', paddingVertical: 12, borderRadius: 2, alignItems: 'center', justifyContent: 'center', height: 50 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default ResetPasswordScreen;