import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, 
    TouchableOpacity, 
    ActivityIndicator, 
    Image, 
    ScrollView, 
    KeyboardAvoidingView, 
    Platform,
    useColorScheme, 
    TextInput,
    Text,
    View 
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
// --- COMPONENTES TEMÁTICOS ---
import { ThemedView } from '@/components/ThemedView'; 
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors'; // Paleta de colores para el tema

const RegisterPage = () => {
    // --- Estados para todos los campos (sin cambios) ---
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [dni, setDni] = useState('');
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [fechaNacimiento, setFechaNacimiento] = useState('');
    const [telefonoEmergencia, setTelefonoEmergencia] = useState('');
    const [sexo, setSexo] = useState('');
    const [direccion, setDireccion] = useState('');
    const [numeroTelefono, setNumeroTelefono] = useState('');
    const [obraSocial, setObraSocial] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, gymName, gymLogo, gymColor } = useAuth(); 
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light'; // Detecta el tema y usa 'light' como fallback

    // useEffect para unir la fecha (sin cambios)
    useEffect(() => {
        if (day && month && year && year.length === 4) {
            setFechaNacimiento(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        } else {
            setFechaNacimiento('');
        }
    }, [day, month, year]);


    const handleRegister = async () => {
        // Lógica de registro (sin cambios)
        if (!nombre || !apellido || !email || !password || !dni || !fechaNacimiento || !telefonoEmergencia) {
            setError('Por favor, completa todos los campos obligatorios.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const userData = { nombre, apellido, email, contraseña: password, dni, fechaNacimiento, telefonoEmergencia, sexo: sexo || 'Otro', direccion, numeroTelefono, obraSocial };
            await register(userData);
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Error al registrarse');
        } finally {
            setIsLoading(false);
        }
    };

    // --- ESTILOS DINÁMICOS BASADOS EN EL TEMA ---
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

                    <ThemedText type="title" style={styles.title}>Crear Cuenta</ThemedText>

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <TextInput style={styles.input} placeholder="Nombre (*)" placeholderTextColor={Colors[colorScheme].text} value={nombre} onChangeText={setNombre} />
                    <TextInput style={styles.input} placeholder="Apellido (*)" placeholderTextColor={Colors[colorScheme].text} value={apellido} onChangeText={setApellido} />
                    <TextInput style={styles.input} placeholder="Email (*)" placeholderTextColor={Colors[colorScheme].text} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                    <TextInput style={styles.input} placeholder="Contraseña (*)" placeholderTextColor={Colors[colorScheme].text} value={password} onChangeText={setPassword} secureTextEntry />
                    <TextInput style={styles.input} placeholder="DNI (*)" placeholderTextColor={Colors[colorScheme].text} value={dni} onChangeText={setDni} keyboardType="numeric" />
                    
                    <ThemedText style={styles.label}>Fecha de Nacimiento (*)</ThemedText>
                    <View style={styles.dateInputContainer}>
                        <TextInput style={styles.dateInput} placeholder="DD" placeholderTextColor={Colors[colorScheme].text} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} />
                        <TextInput style={styles.dateInput} placeholder="MM" placeholderTextColor={Colors[colorScheme].text} value={month} onChangeText={setMonth} keyboardType="number-pad" maxLength={2} />
                        <TextInput style={styles.dateInput} placeholder="AAAA" placeholderTextColor={Colors[colorScheme].text} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
                    </View>

                    <TextInput style={styles.input} placeholder="Teléfono de Emergencia (*)" placeholderTextColor={Colors[colorScheme].text} value={telefonoEmergencia} onChangeText={setTelefonoEmergencia} keyboardType="phone-pad" />
                    
                    <ThemedText style={styles.label}>Sexo</ThemedText>
                    <View style={styles.genderSelector}>
                        {['Femenino', 'Masculino', 'Otro'].map((option) => (
                            <TouchableOpacity
                                key={option}
                                style={[styles.genderButton, sexo === option && styles.genderButtonSelected]}
                                onPress={() => setSexo(option)}
                            >
                                <Text style={[styles.genderButtonText, sexo === option && styles.genderButtonTextSelected]}>{option}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput style={styles.input} placeholder="Dirección " placeholderTextColor={Colors[colorScheme].text} value={direccion} onChangeText={setDireccion} />
                    <TextInput style={styles.input} placeholder="Teléfono " placeholderTextColor={Colors[colorScheme].text} value={numeroTelefono} onChangeText={setNumeroTelefono} keyboardType="phone-pad"/>
                    <TextInput style={styles.input} placeholder="Obra Social " placeholderTextColor={Colors[colorScheme].text} value={obraSocial} onChangeText={setObraSocial} />

                    <TouchableOpacity 
                        style={styles.registerButtonContainer} 
                        onPress={handleRegister} 
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.registerButtonText}>Registrarse</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.loginContainer}>
                        <ThemedText style={styles.loginText}>¿Ya tienes una cuenta? </ThemedText>
                        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                            <Text style={styles.loginLink}>Inicia Sesión</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
};

// Función que genera los estilos dinámicamente
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    outerContainer: { flex: 1 },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    logo: { width: '80%', height: 100, alignSelf: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    gymName: { fontSize: 22, color: '#007BFF', textAlign: 'center', marginBottom: 20 },
    error: { color: 'red', marginBottom: 10, textAlign: 'center' },
    label: { color: Colors[colorScheme].text, marginBottom: 5, marginLeft: 5, opacity: 0.8 },
    input: { 
        height: 45, 
        borderColor: Colors[colorScheme].icon, // Un color de borde sutil
        borderWidth: 1, 
        borderRadius: 8, 
        marginBottom: 12, 
        paddingHorizontal: 12,
        backgroundColor: Colors[colorScheme].background, // Fondo del tema
        color: Colors[colorScheme].text, // Color de texto del tema
        fontSize: 16
    },
    dateInputContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    dateInput: { 
        height: 45, 
        borderColor: Colors[colorScheme].icon, 
        borderWidth: 1, 
        borderRadius: 8, 
        paddingHorizontal: 8, 
        textAlign: 'center', 
        flex: 1, 
        marginHorizontal: 4,
        backgroundColor: Colors[colorScheme].background,
        color: Colors[colorScheme].text,
        fontSize: 16
    },
    genderSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
    genderButton: { 
        paddingVertical: 10, 
        paddingHorizontal: 20, 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].icon, 
        borderRadius: 8 
    },
    genderButtonSelected: { 
        backgroundColor: gymColor || '#00177d', 
        borderColor: '#ffffff' 
    },
    genderButtonText: { 
        color: Colors[colorScheme].text 
    },
    genderButtonTextSelected: { 
        color: '#fff',
        fontWeight: 'bold'
    },
    registerButtonContainer: { backgroundColor: gymColor || '#00177d', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10, height: 50 },
    registerButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    loginContainer: { marginTop: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    loginText: { fontSize: 16 },
    loginLink: { fontSize: 16, color: gymColor || '#00177d', fontWeight: 'bold', marginLeft: 5 },
});

export default RegisterPage;
