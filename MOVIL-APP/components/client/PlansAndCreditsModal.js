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
import es from 'date-fns/locale/es';

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

    const monthlySubscriptions = profile.monthlySubscriptions || [];
    const fixedPlans = profile.planesFijos || [];

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color="#ccc" />
                </TouchableOpacity>
                <ScrollView>
                    <Text style={styles.modalTitle}>Mis Planes y Créditos</Text>

                    {monthlySubscriptions.length > 0 && (
                        <ThemedView style={styles.card}>
                            <ThemedText style={styles.cardTitle}>Suscripciones</ThemedText>
                            {monthlySubscriptions.map((sub, index) => (
                                <View key={index} style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabelBold}>{sub.tipoClase?.nombre || 'Clase'}</ThemedText>
                                    <ThemedText style={styles.infoValue}>{sub.autoRenewAmount} créditos/mes</ThemedText>
                                </View>
                            ))}
                        </ThemedView>
                    )}
                    {fixedPlans.length > 0 && (
                        <ThemedView style={styles.card}>
                            <ThemedText style={styles.cardTitle}>Planes Fijos</ThemedText>
                            {fixedPlans.map((plan, index) => (
                                <View key={index} style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabelBold}>{plan.tipoClase?.nombre || 'Clase'}</ThemedText>
                                    <ThemedText style={styles.infoValue}>{plan.diasDeSemana.join(', ')} - {plan.horaInicio}</ThemedText>
                                </View>
                            ))}
                        </ThemedView>
                    )}
                    {creditosDisponibles.length > 0 && (
                         <ThemedView style={styles.card}>
                            <ThemedText style={styles.cardTitle}>Créditos Disponibles</ThemedText>
                            {creditosDisponibles.map((credito, index) => (
                                <View key={index} style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabel}>{credito.name}:</ThemedText>
                                    <ThemedText style={styles.infoValue}>{credito.amount}</ThemedText>
                                </View>
                            ))}
                        </ThemedView>
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
    const shadowProp = {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    };
    
    return StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '85%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    card: { backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, padding: 20, marginBottom: 15, ...shadowProp },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: Colors[colorScheme].text },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    infoLabel: { fontSize: 16, color: Colors[colorScheme].text },
    infoLabelBold: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text },
    infoValue: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.8 },
});}

export default PlansAndCreditsModal;
