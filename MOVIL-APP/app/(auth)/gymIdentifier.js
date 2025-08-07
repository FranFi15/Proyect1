import { useState } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    Image,
    useColorScheme,
    Linking,
    // --- NUEVOS IMPORTS ---
    KeyboardAvoidingView,
    ScrollView,
    Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';

const SUPER_ADMIN_API_URL = process.env.EXPO_PUBLIC_SUPER_ADMIN_URL;

export default function GymIdentifierScreen() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { setGymContext, gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    
    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    // La lógica de tus funciones no necesita cambios.
    const handleContinue = async () => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
        setAlertInfo({
            visible: true,
            title: 'Error',
            message: 'Por favor, introduce el código de tu institución.',
            buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
        });
        return;
    }

    setLoading(true);
    try {
        // 2. Apuntamos a la RUTA CORRECTA del backend
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/public/gym/${trimmedIdentifier}`);
        if (!response.data?.clientId) {
            throw new Error("La respuesta del servidor no incluyó un ID de cliente.");
        }
        
        await setGymContext(response.data);
        router.replace('/(auth)/login');

    } catch (error) {
        let message = 'No se pudo conectar al servidor. Revisa tu conexión a internet.';
        if (error.response && error.response.status === 404) {
            message = 'El código de la institución no fue encontrado. Por favor, verifica que sea correcto.';
        }
        setAlertInfo({
            visible: true,
            title: 'Error',
            message: message,
            buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
        });
    } finally {
        setLoading(false);
    }
};

    const handleWhatsAppContact = () => {
        const phoneNumber = `549${process.env.EXPO_PUBLIC_WSP_NUM}`;
        const message = 'Hola, estoy interesado/a en obtener una app para mi institución. ¿Podrían pasarme información?';
        const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        Linking.openURL(url).catch(() => {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'Asegúrate de tener WhatsApp instalado para continuar.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        });
    };

    const styles = getStyles(colorScheme, gymColor);

    return (
        <ThemedView style={styles.outerContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <Image
                        source={
                            colorScheme === 'dark'
                                ? require('../../assets/images/modo-oscuro-logo.png')
                                : require('../../assets/images/modo-claro-logo.png')
                        }
                        style={styles.logo}
                    />
                    <ThemedText type="title" style={styles.title}>Introduce tu Código</ThemedText>

                    <TextInput
                        style={styles.input}
                        placeholder="xxxx-xxxx-xxxx"
                        placeholderTextColor={Colors[colorScheme].icon}
                        value={identifier}
                        onChangeText={setIdentifier}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continuar</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleWhatsAppContact} style={styles.contactButton}>
                        <ThemedText style={styles.contactText}>
                            Simplifica la gestión de turnos.
                        </ThemedText>
                        <Text style={styles.contactLink}>
                            Obtén tu app aquí.
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* El CustomAlert se queda fuera del ScrollView para que se superponga a todo */}
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
}

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    // Nuevos estilos para la estructura
    outerContainer: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30
    },
    // El resto de tus estilos permanecen igual
    logo: {
        width: 450,
        height: 200,
        resizeMode: 'cover', 

    },
    title: {
        marginBottom: 15,
        padding: 5,
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    input: {
        width: '100%',
        height: 50,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        fontSize: 16,
        color: Colors[colorScheme].text,
        backgroundColor: Colors[colorScheme].cardBackground
    },
    button: {
        width: '100%',
        height: 50,
        backgroundColor: gymColor || '#000000ff',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    contactButton: { // Contenedor para el texto de contacto para un área de toque más grande
        marginTop: 20,
        padding: 10,
    },
    contactText: {
        textAlign: 'center',
        fontSize: 14,
    },
    contactLink: {
        textAlign: 'center',
        color: '#25d366',
        fontSize: 14,
        marginTop: 5, // Reducido el margen
        fontWeight: 'bold',
    },
});