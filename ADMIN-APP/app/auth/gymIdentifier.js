import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

export default function GymIdentifierScreen() {
  const [clientId, setClientIdState] = useState('');
  const router = useRouter();
  const { setGymClient } = useAdminAuth();

  const handleIdentify = async () => {
    if (!clientId.trim()) {
      Alert.alert('Error', 'Por favor, ingrese el ID del cliente.');
      return;
    }
    try {
        await setGymClient(clientId.trim());
        router.replace('/(auth)/login');
    } catch (error) {
        Alert.alert('Error', 'No se pudo guardar el ID del cliente.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Identificar Gimnasio</Text>
      <TextInput
        style={styles.input}
        placeholder="Ingrese el Client ID del Gimnasio"
        value={clientId}
        onChangeText={setClientIdState}
        autoCapitalize="none"
      />
      <Button title="Continuar" onPress={handleIdentify} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
});