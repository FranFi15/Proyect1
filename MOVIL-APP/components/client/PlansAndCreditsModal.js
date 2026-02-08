import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import apiClient from '../../services/apiClient';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import CustomAlert from '@/components/CustomAlert';
import { parseISO, isValid } from 'date-fns';

const formatDateUTC = (dateString) => {
    if (!dateString) return 'Sin fecha';
    const date = new Date(dateString);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const PlansAndCreditsModal = ({ onClose }) => {
    const { gymColor } = useAuth();
    const [profile, setProfile] = useState(null);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

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

    // --- LÓGICA CORREGIDA PARA VENCIMIENTOS ---
    const detailedCredits = useMemo(() => {
        if (!profile || !classTypes.length) return [];

        const groups = {};

        // 1. Procesar vencimientos detallados
        if (profile.vencimientosDetallados && profile.vencimientosDetallados.length > 0) {
            profile.vencimientosDetallados.forEach(item => {
                const typeId = item.tipoClaseId;
                
                // Buscamos la configuración de este tipo de clase
                const cType = classTypes.find(ct => ct._id === typeId);
                const isResetEnabled = cType ? cType.resetMensual : false; // ¿Tiene vencimiento?

                if (!groups[typeId]) {
                    groups[typeId] = {
                        name: cType ? cType.nombre : 'Crédito',
                        resetMensual: isResetEnabled,
                        total: 0,
                        batches: []
                    };
                }
                
                groups[typeId].total += item.cantidad;
                
                // --- LÓGICA CLAVE ---
                // Si 'isResetEnabled' es true, mostramos la fecha real.
                // Si es false, forzamos null para que la UI diga "Sin vencimiento".
                groups[typeId].batches.push({
                    amount: item.cantidad,
                    date: isResetEnabled ? item.fechaVencimiento : null 
                });
            });
        }

        // 2. Revisar créditos "sueltos" (fallback para datos viejos)
        if (profile.creditosPorTipo) {
            Object.entries(profile.creditosPorTipo).forEach(([typeId, amount]) => {
                if (amount > 0) {
                    if (!groups[typeId]) {
                        const cType = classTypes.find(ct => ct._id === typeId);
                        const isResetEnabled = cType ? cType.resetMensual : false;

                        groups[typeId] = {
                            name: cType ? cType.nombre : 'Crédito',
                            resetMensual: isResetEnabled,
                            total: amount,
                            batches: [{ 
                                amount: amount, 
                                date: null // Aquí siempre es null porque no tenemos el detalle
                            }] 
                        };
                    } else {
                        // Si ya existe en 'detailed', asumimos que el total ya se sumó correctamente allí
                        // O ajustamos si hay discrepancia (opcional, por simplicidad confiamos en el detalle)
                    }
                }
            });
        }

        // Ordenar batches: Los que tienen fecha primero (más próxima), luego los null
        Object.values(groups).forEach(g => {
            g.batches.sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date) - new Date(b.date);
            });
        });

        return Object.values(groups);
    }, [profile, classTypes]);


    if (loading || !profile) {
        return (
            <View style={styles.modalContainer}>
                <View style={styles.modalView}>
                    <ActivityIndicator size="large" color={gymColor} />
                </View>
            </View>
        );
    }

    const hasPaseLibre = profile.paseLibreHasta && isValid(parseISO(profile.paseLibreHasta));

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                </TouchableOpacity>
                
                <View style={styles.header}>
                    <ThemedText style={styles.modalTitle}>Mis Créditos y Planes</ThemedText>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>

                    {/* --- SECCIÓN PASE LIBRE --- */}
                    {hasPaseLibre && (
                        <ThemedView style={styles.paseLibreCard}>
                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                                <FontAwesome5 name="star" size={20} color="#FFD700" style={{marginRight: 10}} />
                                <ThemedText style={styles.cardTitle}>Pase Libre Activo</ThemedText>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>Válido hasta:</ThemedText>
                                <ThemedText style={styles.infoValueBold}>
                                    {formatDateUTC(profile.paseLibreHasta)}
                                </ThemedText>
                            </View>
                        </ThemedView>
                    )}

                    {/* --- SECCIÓN CRÉDITOS DETALLADOS --- */}
                    {detailedCredits.length > 0 ? (
                        detailedCredits.map((group, index) => (
                            <ThemedView key={index} style={styles.card}>
                                <View style={styles.cardHeaderRow}>
                                    <ThemedText style={styles.cardTitle}>{group.name}</ThemedText>
                                    <View style={[styles.badge, {backgroundColor: gymColor + '20'}]}>
                                        <Text style={[styles.badgeText, {color: gymColor}]}>Total: {group.total}</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.divider} />
                                
                                {group.batches.map((batch, i) => (
                                    <View key={i} style={styles.batchRow}>
                                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                            <Ionicons name="ticket-outline" size={16} color={Colors[colorScheme].text} style={{marginRight: 8}} />
                                            <ThemedText style={styles.batchAmount}>{batch.amount} créditos</ThemedText>
                                        </View>
                                        
                                        <ThemedText style={styles.batchDate}>
                                            {/* Si hay fecha (porque resetMensual=true), la mostramos. Si no, "Sin vencimiento" */}
                                            {batch.date 
                                                ? `Vence: ${formatDateUTC(batch.date)}` 
                                                : 'Sin vencimiento'
                                            }
                                        </ThemedText>
                                        
                                    </View>
                                ))}
                            </ThemedView>
                        ))
                    ) : (
                        !hasPaseLibre && (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="wallet-outline" size={50} color={Colors[colorScheme].icon} style={{opacity: 0.5}} />
                                <ThemedText style={styles.emptyText}>
                                    No tienes créditos disponibles actualmente.
                                </ThemedText>
                            </View>
                        )
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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '85%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 20, elevation: 5 },
    
    header: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: Colors[colorScheme].text },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    
    // Cards
    card: { 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 10, 
        padding: 15, 
        marginBottom: 15, 
        elevation: 2, 
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
        borderWidth: 1, borderColor: Colors[colorScheme].border
    },
    paseLibreCard: {
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 10, 
        padding: 15, 
        marginBottom: 20,
        borderWidth: 1, borderColor: '#FFD700', // Borde dorado
        elevation: 3
    },
    
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    
    divider: { height: 1, backgroundColor: Colors[colorScheme].border, marginVertical: 10 },
    
    // Detalles de Lotes
    batchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    batchAmount: { fontSize: 15, fontWeight: '500', color: Colors[colorScheme].text },
    batchDate: { fontSize: 14, color: Colors[colorScheme].icon }, 
    
    // Info general
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { fontSize: 16, color: Colors[colorScheme].text },
    infoValueBold: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text },

    // Badges
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    badgeText: { fontSize: 12, fontWeight: 'bold' },

    // Empty state
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { marginTop: 15, fontSize: 16, color: Colors[colorScheme].text, opacity: 0.7 },
});

export default PlansAndCreditsModal;