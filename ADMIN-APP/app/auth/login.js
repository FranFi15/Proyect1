import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, TouchableOpacity } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { login } = useAdminAuth();

  const handleLogin = async () => {
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error de Login', error.message || 'No se pudo iniciar sesión.');
    }
  };

  return (
    <View style={loginStyles.container}>
      <Text style={loginStyles.title}>Login de Administrador</Text>
      <TextInput
        style={loginStyles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={loginStyles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Iniciar Sesión" onPress={handleLogin} />
      <Link href="/(auth)/register" asChild>
        <TouchableOpacity style={loginStyles.linkContainer}>
            <Text style={loginStyles.linkText}>¿No tienes una cuenta? Regístrate aquí</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const loginStyles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
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
    linkContainer: {
        marginTop: 20,
    },
    linkText: {
        color: '#007bff',
        textAlign: 'center',
        fontSize: 14,
    }
});