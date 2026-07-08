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
                const typeId = (item.tipoClaseId?._id || item.tipoClaseId)?.toString();
                if (!typeId) return;
                
                // Buscamos la configuración de este tipo de clase
                const cType = classTypes.find(ct => ct._id?.toString() === typeId);
                const isResetEnabled = cType ? cType.resetMensual : false; // ¿Tiene vencimiento?

                if (!groups[typeId]) {
                    groups[typeId] = {
                        _id: typeId,
                        name: cType ? cType.nombre : 'Crédito',
                        resetMensual: isResetEnabled,
                        total: 0,
                        batches: []
                    };
                }
                
                groups[typeId].total += (item.cantidad || 0);
                
                groups[typeId].batches.push({
                    amount: item.cantidad || 0,
                    date: isResetEnabled ? item.fechaVencimiento : null 
                });
            });
        }

        // 2. Revisar créditos "sueltos" desde creditosPorTipo (fuente principal de verdad)
        if (profile.creditosPorTipo) {
            Object.entries(profile.creditosPorTipo).forEach(([rawTypeId, rawAmount]) => {
                const typeId = rawTypeId?.toString();
                const amount = Number(rawAmount) || 0;
                if (amount > 0) {
                    if (!groups[typeId]) {
                        const cType = classTypes.find(ct => ct._id?.toString() === typeId);
                        const isResetEnabled = cType ? cType.resetMensual : false;

                        groups[typeId] = {
                            _id: typeId,
                            name: cType ? cType.nombre : 'Crédito',
                            resetMensual: isResetEnabled,
                            total: amount,
                            batches: [{ 
                                amount: amount, 
                                date: null 
                            }] 
                        };
                    } else if (amount > groups[typeId].total) {
                        // Si en creditosPorTipo hay más créditos que en vencimientosDetallados, sumamos la diferencia
                        const diff = amount - groups[typeId].total;
                        groups[typeId].total = amount;
                        groups[typeId].batches.push({
                            amount: diff,
                            date: null
                        });
                    } else if (groups[typeId].total > amount) {
                        // Respetar el total exacto en creditosPorTipo
                        groups[typeId].total = amount;
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
            <View style={[styles.modalView, { padding: 0, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerBannerTitle}>Mis Créditos y Planes</Text>
                        <Text style={styles.headerBannerSub}>Revisa tus pases y créditos disponibles</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButtonBanner}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding: 20}}>

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

                    {/* --- SECCIÓN PASE LIBRE HORARIO (OFF-PEAK) --- */}
                    {profile?.hasPaseLibreHorario && (
                        <ThemedView style={[styles.paseLibreCard, { borderColor: '#00bcd4' }]}>
                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 10}}>
                                <Ionicons name="time" size={22} color="#00bcd4" style={{marginRight: 10}} />
                                <View style={{flex: 1}}>
                                    <ThemedText style={styles.cardTitle}>Acceso Libre Horario</ThemedText>
                                    <Text style={{fontSize: 12, color: Colors[colorScheme].text, opacity: 0.8}}>
                                        {profile.paseLibreHorarioDias?.length > 0 ? profile.paseLibreHorarioDias.join(', ') : 'Días seleccionados'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>Horario permitido:</ThemedText>
                                <ThemedText style={[styles.infoValueBold, { color: '#00bcd4' }]}>
                                    {profile.paseLibreHorarioInicio || '00:00'} - {profile.paseLibreHorarioFin || '23:59'} hs
                                </ThemedText>
                            </View>
                        </ThemedView>
                    )}

                    {/* --- SECCIÓN CRÉDITOS --- */}
                    {detailedCredits && detailedCredits.filter(g => g.total > 0).length > 0 ? (
                        detailedCredits.filter(g => g.total > 0).map((group, index) => (
                            <ThemedView key={group._id || index} style={styles.card}>
                                <View style={styles.cardHeaderRow}>
                                    <ThemedText style={styles.cardTitle}>{group.name}</ThemedText>
                                    <View style={[styles.badge, { backgroundColor: group.total > 0 ? (gymColor || '#28a745') : '#dc3545' }]}>
                                        <Text style={[styles.badgeText, { color: '#fff' }]}>
                                            {group.total} disponibles
                                        </Text>
                                    </View>
                                </View>
                                
                                {group.batches && group.batches.length > 0 && (
                                    <>
                                        <View style={styles.divider} />
                                        {group.batches.map((lote, batchIdx) => (
                                            <View key={batchIdx} style={styles.batchRow}>
                                                <ThemedText style={styles.batchAmount}>
                                                    + {lote.amount} créditos
                                                </ThemedText>
                                                <ThemedText style={styles.batchDate}>
                                                    {lote.date ? `Vence: ${formatDateUTC(lote.date)}` : 'Sin vencimiento'}
                                                </ThemedText>
                                            </View>
                                        ))}
                                    </>
                                )}
                            </ThemedView>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <FontAwesome5 name="ticket-alt" size={40} color={Colors[colorScheme].icon} />
                            <ThemedText style={styles.emptyText}>No tienes planes ni créditos activos.</ThemedText>
                        </View>
                    )}
                </ScrollView>
            </View>

            <CustomAlert 
                visible={alertInfo.visible} 
                title={alertInfo.title} 
                message={alertInfo.message} 
                buttons={alertInfo.buttons || [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ ...alertInfo, visible: false }) }]} 
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={gymColor} 
            />
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '85%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 15, borderTopRightRadius: 15, elevation: 5 },
    
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
    headerBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    headerBannerTitle: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerBannerSub: {
        fontSize: 13,
        color: '#fff',
        opacity: 0.85,
        marginTop: 2,
    },
    closeButtonBanner: {
        padding: 4,
    }
});

export default PlansAndCreditsModal;