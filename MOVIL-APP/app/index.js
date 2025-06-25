// app/index.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

// Asumimos un identificador de gym por ahora. En una app real, podrías
// obtenerlo de un deep link, un QR o pidiéndoselo al usuario.
const GYM_IDENTIFIER = 'hola'; // Reemplaza con un identificador de tu SUPER-ADMIN

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    console.log('--- PASO 1: handleLogin se ha ejecutado ---');
    try {
      setError('');
      const credentials = { email, contraseña: password };
      
      console.log('--- PASO 2.1: Llamando a login() del contexto... ---'); // <--- AÑADE ESTO
      await login(credentials, GYM_IDENTIFIER);
      console.log('--- PASO 2.2: La llamada a login() del contexto terminó. ---'); // <--- AÑADE ESTO

    } catch (e) {
      console.error('--- ERROR en handleLogin:', e); // <--- AÑADE ESTO para ver errores ocultos
      setError(e.message || 'Error al iniciar sesión');
    }
  };
  
  const router = useRouter();
  // Faltaría el UI para registrarse, que navegaría a `app/register.js`
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión en {GYM_IDENTIFIER}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Ingresar" onPress={handleLogin} />
       <View style={{ marginTop: 20 }}>
        <Button
          title="Prueba de Navegación a Calendario"
          color="#841584"
          onPress={() => {
            console.log("Intentando navegar manualmente a /calendar");
            router.push('/calendar');
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({ /* ... tus estilos ... */ });
export default LoginPage;