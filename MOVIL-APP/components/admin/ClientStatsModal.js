import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity, ScrollView,
    useColorScheme, StyleSheet, ActivityIndicator, Dimensions
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';

const screenWidth = Dimensions.get("window").width;

const ClientStatsModal = ({ visible, onClose, gymColor, apiClient, userId, userName }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);

    const fetchStats = useCallback(async () => {
        if (!apiClient || !visible || !userId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/stats/client/${userId}`);
            setStats(res.data);
        } catch (error) {
            console.error("Error cargando estadísticas del cliente:", error);
        } finally {
            setLoading(false);
        }
    }, [apiClient, visible, userId]);

    useEffect(() => {
        if (visible) fetchStats();
    }, [visible, fetchStats]);

    if (!visible) return null;

    const chartConfig = {
        backgroundGradientFrom: Colors[colorScheme].cardBackground,
        backgroundGradientTo: Colors[colorScheme].cardBackground,
        color: (opacity = 1) => gymColor ? `${gymColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` : `rgba(26, 82, 118, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
        labelColor: (opacity = 1) => Colors[colorScheme].text,
    };

    // 1. Asistencia General
    let attendanceRate = 0;
    if (stats?.attendanceData?.totalInscripciones > 0) {
        attendanceRate = Math.round((stats.attendanceData.totalAsistencias / stats.attendanceData.totalInscripciones) * 100);
    }

    // 2. Clases Favoritas
    let favoriteData = [];
    if (stats?.favoriteClasses) {
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
        favoriteData = stats.favoriteClasses.map((d, idx) => ({
            name: d._id,
            population: d.count,
            color: colors[idx % colors.length],
            legendFontColor: Colors[colorScheme].text,
            legendFontSize: 12
        }));
    }

    // 3. Actividad por Mes
    let activityData = null;
    if (stats?.activityByMonth && stats.activityByMonth.length > 0) {
        activityData = {
            labels: stats.activityByMonth.map(d => {
                const [year, month] = d._id.split('-');
                return format(new Date(year, month - 1, 1), 'MMM', { locale: es });
            }),
            datasets: [{ data: stats.activityByMonth.map(d => d.count) }]
        };
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
            <View style={styles.modalContainer}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="chevron-down" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Actividad: {userName}</Text>
                    <View style={{ width: 28 }} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={gymColor || Colors[colorScheme].tint} />
                        <Text style={{ marginTop: 10, color: Colors[colorScheme].text }}>Cargando métricas...</Text>
                    </View>
                ) : !stats ? (
                    <View style={styles.loadingContainer}>
                        <Text style={{ color: Colors[colorScheme].text }}>No se encontraron datos.</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent}>

                        {/* Resumen General */}
                        <View style={styles.rowCards}>
                            <View style={[styles.card, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.kpiLabel}>Inscripciones</Text>
                                <Text style={styles.kpiValue}>{stats.attendanceData?.totalInscripciones || 0}</Text>
                            </View>
                            <View style={[styles.card, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.kpiLabel}>Asistencias</Text>
                                <Text style={styles.kpiValue}>{stats.attendanceData?.totalAsistencias || 0}</Text>
                            </View>
                            <View style={[styles.card, { flex: 1 }]}>
                                <Text style={styles.kpiLabel}>Tasa de Asistencia</Text>
                                <Text style={[styles.kpiValue, { color: attendanceRate > 70 ? '#4BC0C0' : (attendanceRate < 40 ? '#FF6384' : '#FFCE56') }]}>
                                    {attendanceRate}%
                                </Text>
                            </View>
                        </View>

                        {/* Actividad Reciente */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Inscripciones por Mes</Text>
                            {activityData ? (
                                <LineChart
                                    data={activityData}
                                    width={screenWidth - 40}
                                    height={220}
                                    chartConfig={{ ...chartConfig, decimalPlaces: 0 }}
                                    bezier
                                    style={styles.chartStyle}
                                    fromZero
                                />
                            ) : <Text style={styles.emptyText}>Sin actividad reciente</Text>}
                        </View>

                        {/* Clases Favoritas */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Clases Más Elegidas</Text>
                            {favoriteData.length > 0 ? (
                                <PieChart
                                    data={favoriteData}
                                    width={screenWidth - 40}
                                    height={150}
                                    chartConfig={chartConfig}
                                    accessor={"population"}
                                    backgroundColor={"transparent"}
                                    paddingLeft={"15"}
                                />
                            ) : <Text style={styles.emptyText}>Sin historial de clases</Text>}
                        </View>

                    </ScrollView>
                )}
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, backgroundColor: Colors[colorScheme].background },
    headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 15, justifyContent: 'space-between' },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
    closeButton: { padding: 4 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 15, paddingBottom: 50 },
    card: { 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 16, 
        padding: 15, 
        marginBottom: 15,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3
    },
    rowCards: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    cardTitle: { fontSize: 15, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 15, textAlign: 'center' },
    kpiLabel: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.7, textAlign: 'center' },
    kpiValue: { fontSize: 24, fontWeight: 'bold', color: gymColor || Colors[colorScheme].tint, textAlign: 'center', marginTop: 5 },
    chartStyle: { borderRadius: 16, alignSelf: 'center' },
    emptyText: { textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.6, fontStyle: 'italic', paddingVertical: 20 },
});

export default ClientStatsModal;
