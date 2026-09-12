import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    useColorScheme,
    TextInput,
    View,
    Text,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login, logout, gymName, gymLogo, gymColor } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const [isReady, setIsReady] = useState(false);

    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const showError = (message) => {
        Keyboard.dismiss();
        setAlertInfo({
            visible: true,
            title: 'Error de Autenticación',
            message: message || 'Usuario o contraseña incorrectos. Por favor, intenta de nuevo.',
            buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo((prev) => ({ ...prev, visible: false })) }],
        });
    };

    const handleLogin = async () => {
        if (isLoading) return;
        if (!email.trim() || !password) {
            showError('Completá email y contraseña para continuar.');
            return;
        }

        setIsLoading(true);
        try {
            const credentials = { email: email.trim(), contraseña: password };
            await login(credentials);
        } catch (e) {
            const message =
                e?.response?.data?.message ||
                e?.message ||
                'Usuario o contraseña incorrectos. Por favor, intenta de nuevo.';
            // Ignore session-expired noise if it ever leaks through
            if (message === 'SESSION_EXPIRED') {
                showError('Usuario o contraseña incorrectos. Por favor, intenta de nuevo.');
            } else {
                showError(message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const goToRegister = () => router.push('/(auth)/register');
    const goToForgotPassword = () => router.push('/(auth)/forgot-password');
    const handleGoBackToIdentifier = () => {
        logout();
        router.replace('/');
    };

    const styles = getStyles(colorScheme, gymColor);

    return (
        <ThemedView style={styles.outerContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                enabled={isReady}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    {gymLogo ? (
                        <Image source={{ uri: gymLogo }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <ThemedText style={styles.gymName}>{gymName || 'Gimnasio'}</ThemedText>
                    )}

                    <ThemedText type="title" style={styles.title}>Iniciar Sesión</ThemedText>

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={Colors[colorScheme].icon}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                    />

                    <View style={styles.passwordWrap}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Contraseña"
                            placeholderTextColor={Colors[colorScheme].icon}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isLoading}
                        />
                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword((prev) => !prev)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={22}
                                color={Colors[colorScheme].icon}
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={goToForgotPassword} disabled={isLoading}>
                        <Text style={styles.forgotPasswordLink}>¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.loginButton, isLoading && { opacity: 0.75 }]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Ingresar</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.registerContainer}>
                        <ThemedText style={styles.registerText}>¿No tenés una cuenta? </ThemedText>
                        <TouchableOpacity onPress={goToRegister} disabled={isLoading}>
                            <Text style={styles.registerLink}>Regístrate</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.changeGymButton} onPress={handleGoBackToIdentifier} disabled={isLoading}>
                        <Ionicons name="swap-horizontal-outline" size={16} color={styles.changeGymText.color} />
                        <Text style={styles.changeGymText}>{' '} Cambiar de Institución</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo((prev) => ({ ...prev, visible: false }))}
                gymColor={gymColor}
                inline
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    outerContainer: { flex: 1 },
    container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    logo: { width: 200, height: 200, alignSelf: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    gymName: { fontSize: 22, color: '#4b187b', textAlign: 'center', marginBottom: 20 },
    input: {
        height: 45,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 12,
        paddingHorizontal: 12,
        backgroundColor: Colors[colorScheme].background,
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    passwordWrap: {
        height: 45,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 12,
        backgroundColor: Colors[colorScheme].background,
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 4,
    },
    passwordInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 12,
        color: Colors[colorScheme].text,
        fontSize: 16,
    },
    eyeButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginButton: {
        backgroundColor: gymColor || '#00177d',
        paddingVertical: 12,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        height: 50,
    },
    loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    forgotPasswordLink: {
        color: Colors[colorScheme].icon,
        textAlign: 'right',
        fontWeight: 'bold',
        marginBottom: 20,
        fontSize: 14,
    },
    registerContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    registerText: { fontSize: 14 },
    registerLink: { fontSize: 14, color: Colors[colorScheme].icon, fontWeight: 'bold', marginLeft: 5 },
    changeGymButton: {
        marginTop: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.8,
    },
    changeGymText: {
        color: Colors[colorScheme].text,
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default LoginPage;
