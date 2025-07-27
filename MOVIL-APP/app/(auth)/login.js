import React, { useState } from 'react';
import { 
    StyleSheet, 
    TouchableOpacity, 
    ActivityIndicator, 
    Image,
    useColorScheme, // Hook para detectar el tema
    TextInput,
    View, // Mantenemos View para el contenedor del link de registro
    Text, // Mantenemos Text para el texto del botón y el link
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// --- COMPONENTES TEMÁTICOS ---
import { ThemedView } from '@/components/ThemedView'; 
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors'; // Paleta de colores para el tema

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, logout, gymName, gymLogo, gymColor } = useAuth(); 
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light'; // Detecta el tema

    const handleLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            const credentials = { email, contraseña: password };
            await login(credentials);
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };

    const goToRegister = () => {
        router.push('/(auth)/register');
    };
    
const goToForgotPassword = () => {
        // Esta ruta debe coincidir con el nombre del archivo que crearás en el siguiente paso.
        router.push('/(auth)/forgot-password');
    };

     const handleGoBackToIdentifier = () => {
        logout();
        router.replace('/'); 
    };

    // --- ESTILOS DINÁMICOS BASADOS EN EL TEMA ---
    const styles = getStyles(colorScheme , gymColor);

    return (
        <ThemedView style={styles.container}>
            {gymLogo ? (
                <Image source={{ uri: gymLogo }} style={styles.logo} resizeMode="contain" />
            ) : (
                <ThemedText style={styles.gymName}>{gymName || 'Gimnasio'}</ThemedText>
            )}

            <ThemedText type="title" style={styles.title}>Iniciar Sesión</ThemedText>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            
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
        </ThemedView>
    );
};

// Función que genera los estilos dinámicamente
const getStyles = (colorScheme, gymColor) => StyleSheet.create({ 
    container: { flex: 1, justifyContent: 'center', padding: 20 },
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
        marginBottom: 20,
    },
    gymName: { fontSize: 22, color: '#4b187b', textAlign: 'center', marginBottom: 20 },
    error: { color: Colors.light.error, marginBottom: 10, textAlign: 'center', fontWeight: 'bold' },
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
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    forgotPasswordLink: {
        color: gymColor || '#00177d',
        textAlign: 'right',
        fontWeight: 'bold',
        marginBottom: 20, 
        fontSize: 14,
    },
    registerContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    registerText: { fontSize: 16 },
    registerLink: { fontSize: 16, color: gymColor || '#00177d', fontWeight: 'bold', marginLeft: 5 }, 
     changeGymButton: {
        marginTop: 30, // Más espacio para separarlo
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.8, // Un poco más sutil
    },
    changeGymText: {
        color: Colors[colorScheme].text, // Un color menos prominente
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default LoginPage;