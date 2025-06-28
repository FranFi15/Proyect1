// app/index.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';


// Asumimos un identificador de gym por ahora. En una app real, podrías
// obtenerlo de un deep link, un QR o pidiéndoselo al usuario.
const GYM_IDENTIFIER = 'hola'; // Reemplaza con un identificador de tu SUPER-ADMIN

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      setError('');
      const credentials = { email, contraseña: password };
      await login(credentials, GYM_IDENTIFIER);


    } catch (e) {
      setError(e.message || 'Error al iniciar sesión');
    }
  };
  
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({ /* ... tus estilos ... */ });
export default LoginPage;