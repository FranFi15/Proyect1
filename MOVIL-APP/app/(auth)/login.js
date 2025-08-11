import React, { useState } from 'react';
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
    Platform
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
// --- 1. Importar CustomAlert ---
import CustomAlert from '@/components/CustomAlert';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, logout, gymName, gymLogo, gymColor } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';

    // --- 2. Reemplazar el estado de 'error' por 'alertInfo' ---
    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const credentials = { email, contraseña: password };
            await login(credentials);
        } catch (e) {
            // --- 3. Usar setAlertInfo para mostrar el error en el modal ---
            setAlertInfo({
                visible: true,
                title: 'Error de Autenticación',
                message: e.message || 'Usuario o contraseña incorrectos. Por favor, intenta de nuevo.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
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
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container}>
                    {gymLogo ? (
                        <Image source={{ uri: gymLogo }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <ThemedText style={styles.gymName}>{gymName || 'Gimnasio'}</ThemedText>
                    )}

                    <ThemedText type="title" style={styles.title}>Iniciar Sesión</ThemedText>
                    
                    {/* El Text de error se elimina de aquí */}

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={Colors[colorScheme].icon}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Contraseña"
                        placeholderTextColor={Colors[colorScheme].icon}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TouchableOpacity onPress={goToForgotPassword}>
                        <Text style={styles.forgotPasswordLink}>¿Olvidaste tu contraseña?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.loginButton}
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
                        <TouchableOpacity onPress={goToRegister}>
                            <Text style={styles.registerLink}>Regístrate</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.changeGymButton} onPress={handleGoBackToIdentifier}>
                        <Ionicons name="swap-horizontal-outline" size={16} color={styles.changeGymText.color} />
                        <Text style={styles.changeGymText}>{" "} Cambiar de Institución</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* --- 4. Añadir el componente CustomAlert al final --- */}
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
    outerContainer: { flex: 1 },
    container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    logo: { width: 200, height: 200, alignSelf: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    gymName: { fontSize: 22, color: '#4b187b', textAlign: 'center', marginBottom: 20 },
    input: {
        height: 45,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 12,
        paddingHorizontal: 12,
        backgroundColor: Colors[colorScheme].background,
        color: Colors[colorScheme].text,
        fontSize: 16
    },
    loginButton: {
        backgroundColor: gymColor || '#00177d',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        height: 50,
    },
    loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    forgotPasswordLink: {
        color: gymColor || '#00177d',
        textAlign: 'right',
        fontWeight: 'bold',
        marginBottom: 20,
        fontSize: 14,
    },
    registerContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    registerText: { fontSize: 14 },
    registerLink: { fontSize: 14, color: gymColor || '#00177d', fontWeight: 'bold', marginLeft: 5 },
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