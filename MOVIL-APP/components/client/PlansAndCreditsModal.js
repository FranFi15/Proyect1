import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../services/apiClient';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado
import { format, parseISO, isValid } from 'date-fns';

const formatDateUTC = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const PlansAndCreditsModal = ({ onClose }) => {
    const { user, gymColor } = useAuth();
    const [profile, setProfile] = useState(null);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);

    // Estado para manejar la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    useFocusEffect(
        useCallback(() => {
            const fetchData = async () => {
                setLoading(true);
                try {
                    const [profileResponse, typesResponse] = await Promise.all([
                        apiClient.get('/users/me'),
                        apiClient.get('/tipos-clase')
                    ]);
                    setProfile(profileResponse.data);
                    setClassTypes(typesResponse.data.tiposClase || []);
                } catch (error) {
                    setAlertInfo({
                        visible: true,
                        title: 'Error',
                        message: 'No se pudo cargar tu información.',
                        buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
                    });
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }, [])
    );

    if (loading || !profile) {
        return (
            <View style={styles.modalContainer}>
                <View style={styles.modalView}>
                    <ActivityIndicator size="large" color={gymColor} />
                </View>
            </View>
        );
    }
    
    const creditosDisponibles = profile.creditosPorTipo ? Object.entries(profile.creditosPorTipo)
        .map(([typeId, amount]) => {
            const classType = classTypes.find(ct => ct._id === typeId);
            return amount > 0 ? { name: classType?.nombre || 'Clase Desconocida', amount } : null;
        })
        .filter(Boolean)
        : [];

    
    const fixedPlans = profile.planesFijos || [];

    const hasPaseLibre = profile.paseLibreHasta && isValid(parseISO(profile.paseLibreHasta));

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color="#ccc" />
                </TouchableOpacity>
                <ScrollView>
                    <Text style={styles.modalTitle}>Créditos</Text>

                    {hasPaseLibre && (
                        <ThemedView style={[styles.card,]}>
                            <ThemedText style={[styles.cardTitle]}>Pase Libre </ThemedText>
                            <View style={styles.infoRow}>
                                <ThemedText style={[styles.infoLabelBold]}>Válido hasta:</ThemedText>
                                <ThemedText style={styles.infoValue}>
                                    {formatDateUTC(profile.paseLibreHasta)}
                                </ThemedText>
                            </View>
                        </ThemedView>
                    )}
                    {creditosDisponibles.length > 0 && (
                         <ThemedView style={styles.card}>
                            <ThemedText style={styles.cardTitle}>Créditos Disponibles</ThemedText>
                            {creditosDisponibles.map((credito, index) => (
                                <View key={index} style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabelBold}>{credito.name}:</ThemedText>
                                    <ThemedText style={styles.infoValue}>{credito.amount}</ThemedText>
                                </View>
                            ))}
                        </ThemedView>
                    )}
                    {!hasPaseLibre && fixedPlans.length === 0 && creditosDisponibles.length === 0 && (
                        <ThemedText style={{ textAlign: 'center', marginTop: 20, opacity: 0.6 }}>
                            No tenes plan, ni créditos.
                        </ThemedText>
                    )}
                </ScrollView>
            </View>
             <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={gymColor} 
            />
        </View>
    );
};

const getStyles = (colorScheme) => {
    
    return StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '85%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 5, borderTopRightRadius: 5, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, padding: 20, marginVertical: 6, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, borderWidth: 1, borderColor: 'transparent' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: Colors[colorScheme].text },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    infoLabel: { fontSize: 16, color: Colors[colorScheme].text },
    infoLabelBold: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text },
    infoValue: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.8 },
});}

export default PlansAndCreditsModal;
