import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

export default function AdminRegisterScreen() {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const router = useRouter();
  const { register } = useAdminAuth();

  const handleRegister = async () => {
    if (!name || !lastName || !email || !password || !birthDate) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }
    try {
      await register({ name, lastName, email, password, birthDate });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error de Registro', error.message || 'No se pudo completar el registro.');
    }
  };

  return (
    <ScrollView contentContainerStyle={registerStyles.container}>
      <Text style={registerStyles.title}>Registro de Administrador</Text>
      <TextInput style={registerStyles.input} placeholder="Nombre" value={name} onChangeText={setName} />
      <TextInput style={registerStyles.input} placeholder="Apellido" value={lastName} onChangeText={setLastName} />
      <TextInput style={registerStyles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={registerStyles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={registerStyles.input} placeholder="Fecha de Nacimiento (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} />
      <Button title="Registrar" onPress={handleRegister} />
    </ScrollView>
  );
}

const registerStyles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#333' },
  input: {
    height: 50,
    backgroundColor: 'white',
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
  },
});