import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Image, useColorScheme, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert'; // 1. Importar CustomAlert

const SUPER_ADMIN_API_URL = process.env.EXPO_PUBLIC_SUPER_ADMIN_URL;

export default function GymIdentifierScreen() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { setGymContext, gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // 2. Añadir estado para la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const handleContinue = async () => {
        if (!identifier) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'Por favor, introduce el código de tu gimnasio.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            return;
        }
        setLoading(true);
        try {
            const response = await axios.get(`${SUPER_ADMIN_API_URL}/gym/${identifier}`);
            
            const clientId = response.data?.clientId;

            if (!clientId) {
                throw new Error("La respuesta del servidor no incluyó un ID de cliente.");
            }
            
            await setGymContext(response.data);
            
            router.replace('/(auth)/login');

        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'El código del gimnasio no es válido o no se pudo conectar al servidor.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsAppContact = () => {
        // Reemplaza este número con tu número de contacto de WhatsApp
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

    return (
        <ThemedView style={styles.container}>
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
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
            />
            <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continuar</Text>}
            </TouchableOpacity>
             <TouchableOpacity onPress={handleWhatsAppContact}>
                <ThemedText style={styles.contactText}>
                    Simplifica la gestión de turnos.
                </ThemedText>
                <Text style={styles.contactLink}>
                    Obtén tu app aquí.
                </Text>
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
}

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    logo: {
        width: 450,
        height: 200,
        resizeMode: 'cover',
    },
    title: { marginBottom: 15, padding:5, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 15, marginBottom: 20, fontSize: 16, color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].cardBackground },
    button: { width: '100%', height: 50, backgroundColor: gymColor || '#000000ff', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
     contactText: {
        marginTop: 20,
        textAlign: 'center',
        fontSize: 14,
        
    },
    contactLink: {
        textAlign: 'center',
        color: '#25d366', 
        fontSize: 14,
        marginTop: 10,
    },
});
