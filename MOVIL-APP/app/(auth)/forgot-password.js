import React, { useState } from 'react';
import {
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    ScrollView,
    Platform
} from 'react-native';
import Animated from 'react-native-reanimated';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import { useRouter } from 'expo-router';
import CustomAlert from '@/components/CustomAlert';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStaggerEnter } from '@/hooks/useEntranceEpoch';

const ForgotPasswordScreen = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { gymColor, gymLogo, gymName } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const enter = useStaggerEnter();

    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });
    const router = useRouter();

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
            console.error('Error al solicitar reseteo:', error.response ? error.response.data : error);
            let alertMessage = 'Ocurrió un error inesperado. Por favor, intenta de nuevo.';
            if (error.response?.data?.message) {
                alertMessage = error.response.data.message;
            } else if (!error.response) {
                alertMessage = 'No se pudo conectar. Por favor, verifica tu conexión a internet.';
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

    const styles = getStyles(colorScheme, gymColor);

    return (
        <ThemedView style={styles.outerContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <Animated.View entering={enter(0)}>
                        {gymLogo ? (
                            <Image source={{ uri: gymLogo }} style={styles.logo} resizeMode="contain" />
                        ) : (
                            <ThemedText style={styles.gymName}>{gymName || 'Gimnasio'}</ThemedText>
                        )}
                    </Animated.View>
                    <Animated.View entering={enter(1)}>
                        <ThemedText type="title" style={styles.title}>Recuperar Contraseña</ThemedText>
                        <ThemedText style={styles.subtitle}>
                            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                        </ThemedText>
                    </Animated.View>

                    <Animated.View entering={enter(2)}>
                        <TextInput
                            style={styles.input}
                            placeholder="Tu correo electrónico"
                            placeholderTextColor={Colors[colorScheme].icon}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </Animated.View>

                    <Animated.View entering={enter(3)}>
                        <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={isLoading}>
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Enviar Enlace</Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                    <Animated.View entering={enter(4)}>
                        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                            <Text style={styles.loginLink}>Volver a Inicio de Sesión</Text>
                        </TouchableOpacity>
                    </Animated.View>
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
    outerContainer: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    logo: {
        width: 200,
        height: 200,
        alignSelf: 'center',
        marginBottom: 20,
    },
    gymName: {
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
        borderColor: Colors[colorScheme].border,
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
    loginLink: { fontSize: 14, color: Colors[colorScheme].icon, fontWeight: 'bold', marginLeft: 5, alignSelf: 'center', marginTop: 30 },
});

export default ForgotPasswordScreen;
