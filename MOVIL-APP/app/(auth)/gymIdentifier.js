import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const SUPER_ADMIN_API_URL = 'http://192.168.0.111:6001/api/public';

export default function GymIdentifierScreen() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    // Renombramos la función para que sea más claro lo que hace
    const { setGymContext } = useAuth();

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
            <ThemedText type="title" style={styles.title}>Identifica tu Gimnasio</ThemedText>
            <ThemedText style={styles.subtitle}>
                Introduce el código único proporcionado por tu gimnasio para continuar.
            </ThemedText>
            <TextInput
                style={styles.input}
                placeholder="Código del Gimnasio"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                placeholderTextColor="#888"
            />
            <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continuar</Text>}
            </TouchableOpacity>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    title: { marginBottom: 10 },
    subtitle: { marginBottom: 30, textAlign: 'center', paddingHorizontal: 20 },
    input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 15, marginBottom: 20, fontSize: 16, color: '#333', backgroundColor: '#fff' },
    button: { width: '100%', height: 50, backgroundColor: '#150224', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});