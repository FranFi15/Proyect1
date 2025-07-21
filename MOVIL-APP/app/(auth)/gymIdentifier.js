import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator, Image, useColorScheme, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from 'react-native/Libraries/NewAppScreen';

const SUPER_ADMIN_API_URL = process.env.EXPO_PUBLIC_SUPER_ADMIN_URL;

export default function GymIdentifierScreen() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    // Renombramos la función para que sea más claro lo que hace
    const { setGymContext } = useAuth();

    const colorScheme = useColorScheme();


    const handleContinue = async () => {
        if (!identifier) {
            Alert.alert('Error', 'Por favor, introduce el código de tu gimnasio.');
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
            
            // 4. Navegamos a la pantalla de Login
            router.replace('/(auth)/login');

        } catch (error) {
            Alert.alert('Error', 'El código del gimnasio no es válido o no se pudo conectar al servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            {/* Imagen local de la app */}
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
                placeholder="Código"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                placeholderTextColor="#888"
            />
            <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continuar</Text>}
            </TouchableOpacity>
             <TouchableOpacity onPress={() => Linking.openURL('mailto:ffdigitallab@hotmail.com')}>
                <ThemedText style={styles.contactText}>
                    Simplifica la gestión de turnos.
                </ThemedText>
                <Text style={styles.contactLink}>
                    Obtén tu app aquí.
                    </Text>
            </TouchableOpacity>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    logo: {
        width: 450,
        height: 200,
        resizeMode: 'cover',
    },
    title: { marginBottom: 15, padding:5, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#ccc', borderRadius: 2, paddingHorizontal: 15, marginBottom: 20, fontSize: 16, color: '#333', backgroundColor: '#fff' },
    button: { width: '100%', height: 50, backgroundColor: '#000000ff', borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
     contactText: {
        marginTop: 20,
        textAlign: 'center',
        fontSize: 14,
        
    },
    // Estilo solo para el correo electrónico
    contactLink: {
        textAlign: 'center',
        color: '#4da1faff', // Color azul para simular un enlace
        fontSize: 14, // Aseguramos que el tamaño de fuente sea el mismo
        marginTop: 10,
    },
});
