import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    Image,
    useColorScheme,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import apiClient from '../../../services/apiClient';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';

// NOTA: No importamos useAuth para evitar conflictos de redirección si el usuario no está logueado.

const ResetPasswordScreen = () => {
    // 1. Obtener parámetros de la URL (Query Params)
    const params = useLocalSearchParams();
    // En web a veces llegan como arrays, aseguramos que sean strings
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    const clientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;

    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';

    // 2. Estado local para configuración visual (independiente del AuthContext)
    const [gymData, setGymData] = useState({
        name: 'Gimnasio',
        color: '#4b187b', // Color default
        logo: null
    });
    const [isFetchingConfig, setIsFetchingConfig] = useState(true);
    
    // Estados del formulario
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    // 3. Efecto: Cargar datos del gimnasio basados en el clientId de la URL
    useEffect(() => {
        const fetchGymConfig = async () => {
            if (!clientId) {
                setIsFetchingConfig(false);
                return;
            }
            try {
                // Intentamos obtener la config pública del gym
                // Si esta ruta específica no existe en tu backend, comenta esta llamada y usa defaults
                const { data } = await apiClient.get(`/public/gym-config/${clientId}`);
                
                setGymData({
                    name: data.gymName || data.name || 'Gimnasio',
                    color: data.primaryColor || '#4b187b',
                    logo: data.logoUrl || null
                });
            } catch (error) {
                console.log('No se pudo cargar config visual del gym, usando defaults.', error);
            } finally {
                setIsFetchingConfig(false);
            }
        };

        fetchGymConfig();
    }, [clientId]);

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
                message: 'Tu contraseña ha sido actualizada.',
                buttons: [{
                    text: 'Iniciar Sesión', style: 'primary', onPress: () => {
                        setAlertInfo({ visible: false });
                        router.replace('/(auth)/login');
                    }
                }]
            });
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'El enlace es inválido o ha expirado.';
            setAlertInfo({ visible: true, title: 'Error', message: errorMessage, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } finally {
            setIsLoading(false);
        }
    };

    const styles = getStyles(colorScheme, gymData.color);

    if (isFetchingConfig) {
        return (
            <ThemedView style={[styles.outerContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors[colorScheme].text} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.outerContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    {gymData.logo ? (
                        <Image source={{ uri: gymData.logo }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <ThemedText style={styles.gymName}>{gymData.name}</ThemedText>
                    )}

                    <ThemedText type="title" style={styles.title}>Nueva Contraseña</ThemedText>

                    <TextInput
                        style={styles.input}
                        placeholder="Nueva Contraseña"
                        placeholderTextColor={Colors[colorScheme].icon || '#ccc'}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Confirmar Contraseña"
                        placeholderTextColor={Colors[colorScheme].icon || '#ccc'}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity style={styles.button} onPress={handlePasswordReset} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Restablecer</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={gymData.color}
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    outerContainer: { flex: 1 },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    logo: { width: 180, height: 180, alignSelf: 'center', marginBottom: 20 },
    gymName: { fontSize: 24, color: gymColor, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
    title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
    input: { height: 50, borderColor: Colors[colorScheme].border || '#ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, backgroundColor: Colors[colorScheme].background, color: Colors[colorScheme].text, fontSize: 16, marginBottom: 20 },
    button: { backgroundColor: gymColor, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', height: 50 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default ResetPasswordScreen;