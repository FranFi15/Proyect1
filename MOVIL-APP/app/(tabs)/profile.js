// app/(tabs)/profile.js
import React, { useState, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext'; // Importar hook de autenticación

const ProfileScreen = () => {
    const { logout } = useAuth(); // Usar la función de logout del contexto
    const [profile, setProfile] = useState(null);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            const profileResponse = await apiClient.get('/users/me');
            setProfile(profileResponse.data);

            const typesResponse = await apiClient.get('/tipos-clase');
            setClassTypes(typesResponse.data.tiposClase || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar tu perfil.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchProfileData();
        }, [])
    );
    
    // Aquí iría la lógica y UI para un formulario de suscripción automática
    // que llame a `apiClient.put(`/users/${profile._id}/plan`, { ... })`

    if (loading) {
        return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
    }

    if (!profile) {
        return <Text>No se pudo cargar el perfil.</Text>;
    }
    
    // Mapear los créditos a nombres de clase
    const creditosDisponibles = profile.creditosPorTipo 
      ? Object.entries(profile.creditosPorTipo).map(([typeId, amount]) => {
          const classType = classTypes.find(ct => ct._id === typeId);
          return { name: classType?.nombre || 'Clase Desconocida', amount };
        })
      : [];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{profile.nombre} {profile.apellido}</Text>
            <Text>{profile.email}</Text>
            
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mis Créditos</Text>
                {creditosDisponibles.length > 0 ? (
                    creditosDisponibles.map((credit, index) => (
                        <Text key={index}>{credit.name}: {credit.amount}</Text>
                    ))
                ) : <Text>No tienes créditos disponibles.</Text>}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mis Suscripciones Automáticas</Text>
                {profile.monthlySubscriptions && profile.monthlySubscriptions.length > 0 ? (
                    profile.monthlySubscriptions.map(sub => (
                        <Text key={sub._id}>✔ {sub.tipoClase?.nombre || 'Clase Desconocida'}</Text>
                    ))
                ) : <Text>No tienes suscripciones automáticas activas.</Text>}
            </View>

            <Button title="Cerrar Sesión" color="#dc3545" onPress={logout} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    section: { marginVertical: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', borderBottomWidth: 1, paddingBottom: 5, marginBottom: 10 }
});

export default ProfileScreen;