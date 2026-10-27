import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity, ScrollView,
    useColorScheme, StyleSheet, ActivityIndicator, Dimensions
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import StatsPeriodBar, { useStatsPeriod, statsModalVisible, StatsPeriodPicker } from './StatsPeriodBar';

const screenWidth = Dimensions.get("window").width;

const money = (n) =>
    `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

const bucketLabel = (id) => {
    const parts = String(id).split('-');
    if (parts.length >= 3) {
        return format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])), 'dd/MM');
    }
    return format(new Date(Number(parts[0]), Number(parts[1]) - 1, 1), 'MMM', { locale: es });
};

const monthSeries = (rows, valueKey = 'amount') => {
    if (!rows?.length) return null;
    return {
        labels: rows.map((d) => bucketLabel(d._id)),
        datasets: [{ data: rows.map((d) => Number(d[valueKey]) || 0) }],
    };
};

const StatsPanelModal = ({ visible, onClose, gymColor, apiClient }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [activeClassTab, setActiveClassTab] = useState('average'); // 'average' | 'percentage'
    const [packageTab, setPackageTab] = useState('creditos');
    const period = useStatsPeriod();

    const fetchStats = useCallback(async () => {
        if (!apiClient || !visible) return;
        setLoading(true);
        try {
            const res = await apiClient.get('/stats/dashboard', {
                params: { from: period.fromDate, to: period.toDate },
            });
            setStats(res.data);
        } catch (error) {
            console.error("Error cargando estadísticas:", error);
        } finally {
            setLoading(false);
        }
    }, [apiClient, visible, period.fromDate, period.toDate]);

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

    // 1. Nuevos Usuarios
    let newUsersData = null;
    if (stats?.newUsersByMonth && stats.newUsersByMonth.length > 0) {
        newUsersData = {
            labels: stats.newUsersByMonth.map(d => bucketLabel(d._id)),
            datasets: [{ data: stats.newUsersByMonth.map(d => d.count) }]
        };
    }

    // 2. Clases (Promedio o Porcentaje)
    let classData = null;
    if (stats?.classAssistance && stats.classAssistance.length > 0) {
        classData = {
            labels: stats.classAssistance.map(d => d._id.substring(0, 8)), // Abreviar
            datasets: [{ 
                data: stats.classAssistance.map(d => 
                    activeClassTab === 'average' 
                        ? (d.averageInscritos || 0) 
                        : (d.attendancePercentage || 0)
                ) 
            }]
        };
    }

    // 3. Distribución por Sexo
    let genderData = [];
    if (stats?.genderDistribution) {
        genderData = stats.genderDistribution.map((d, index) => ({
            name: d._id || 'Otro',
            population: d.count,
            color: ['#FF6384', '#36A2EB', '#FFCE56'][index % 3],
            legendFontColor: Colors[colorScheme].text,
            legendFontSize: 12
        }));
    }

    // 4. Distribución por Edades
    let ageData = [];
    if (stats?.ageDistribution) {
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8A2BE2'];
        let idx = 0;
        for (const [key, value] of Object.entries(stats.ageDistribution)) {
            if (value > 0) {
                ageData.push({
                    name: key,
                    population: value,
                    color: colors[idx % colors.length],
                    legendFontColor: Colors[colorScheme].text,
                    legendFontSize: 12
                });
                idx++;
            }
        }
    }

    return (
        <>
        <Modal visible={statsModalVisible(visible, period)} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
            <View style={styles.modalContainer}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="chevron-down" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Panel de Estadísticas</Text>
                    <View style={{ width: 28 }} />
                </View>

                <View style={{ paddingHorizontal: 15, paddingTop: 12 }}>
                    <StatsPeriodBar period={period} gymColor={gymColor} />
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
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Paquetes</Text>
                            <View style={styles.tabContainer}>
                                {[
                                    { id: 'creditos', label: 'Créditos' },
                                    { id: 'pase', label: 'Acceso libre' },
                                    { id: 'membresia', label: 'Membresía' },
                                ].map((tab) => (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[styles.tabButton, packageTab === tab.id && { backgroundColor: gymColor || '#1a5276' }]}
                                        onPress={() => setPackageTab(tab.id)}
                                    >
                                        <Text style={[styles.tabText, packageTab === tab.id && { color: '#fff' }]}>{tab.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.salesRow}>
                                <View style={styles.salesKpi}>
                                    <Text style={styles.salesKpiLabel}>Ventas</Text>
                                    <Text style={[styles.salesKpiValue, { color: gymColor || '#1a5276' }]}>
                                        {stats.sales?.packages?.[packageTab]?.count || 0}
                                    </Text>
                                    <Text style={styles.salesKpiHint}>{money(stats.sales?.packages?.[packageTab]?.amount)}</Text>
                                </View>
                            </View>
                            {packageTab === 'creditos' && (stats.sales?.packages?.creditos?.byType || []).map((row) => (
                                <View key={row.id} style={styles.typeRow}>
                                    <Text style={styles.typeName} numberOfLines={1}>{row.name}</Text>
                                    <Text style={styles.typeAmount}>{row.count} · {money(row.amount)}</Text>
                                </View>
                            ))}
                            {monthSeries(stats.sales?.packages?.[packageTab]?.byMonth) ? (
                                <BarChart
                                    data={monthSeries(stats.sales.packages[packageTab].byMonth)}
                                    width={screenWidth - 40}
                                    height={200}
                                    yAxisLabel="$"
                                    yAxisSuffix=""
                                    chartConfig={{ ...chartConfig, decimalPlaces: 0 }}
                                    style={styles.chartStyle}
                                    fromZero
                                />
                            ) : <Text style={styles.emptyText}>Sin ventas en este tipo</Text>}
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Tienda</Text>
                            <View style={styles.salesRow}>
                                <View style={styles.salesKpi}>
                                    <Text style={styles.salesKpiLabel}>Pedidos</Text>
                                    <Text style={[styles.salesKpiValue, { color: gymColor || '#1a5276' }]}>
                                        {stats.sales?.store?.count || 0}
                                    </Text>
                                    <Text style={styles.salesKpiHint}>
                                        {stats.sales?.store?.units || 0} productos · {money(stats.sales?.store?.amount)}
                                    </Text>
                                </View>
                            </View>
                            {monthSeries(stats.sales?.store?.byMonth) ? (
                                <BarChart
                                    data={monthSeries(stats.sales.store.byMonth)}
                                    width={screenWidth - 40}
                                    height={200}
                                    yAxisLabel="$"
                                    yAxisSuffix=""
                                    chartConfig={{ ...chartConfig, decimalPlaces: 0 }}
                                    style={styles.chartStyle}
                                    fromZero
                                />
                            ) : <Text style={styles.emptyText}>Sin ventas de tienda</Text>}
                        </View>

                        {/* Nuevos Usuarios */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Nuevos usuarios</Text>
                            {newUsersData ? (
                                <LineChart
                                    data={newUsersData}
                                    width={screenWidth - 40}
                                    height={220}
                                    chartConfig={chartConfig}
                                    bezier
                                    style={styles.chartStyle}
                                />
                            ) : <Text style={styles.emptyText}>Sin datos recientes</Text>}
                        </View>

                        {/* Popularidad de Clases */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Popularidad de clases</Text>
                            
                            {/* Tabs Switcher */}
                            <View style={styles.tabContainer}>
                                <TouchableOpacity 
                                    style={[styles.tabButton, activeClassTab === 'average' && { backgroundColor: gymColor || '#1a5276' }]} 
                                    onPress={() => setActiveClassTab('average')}
                                >
                                    <Text style={[styles.tabText, activeClassTab === 'average' && { color: '#fff' }]}>Inscriptos Promedio</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.tabButton, activeClassTab === 'percentage' && { backgroundColor: gymColor || '#1a5276' }]} 
                                    onPress={() => setActiveClassTab('percentage')}
                                >
                                    <Text style={[styles.tabText, activeClassTab === 'percentage' && { color: '#fff' }]}>% de Asistencia</Text>
                                </TouchableOpacity>
                            </View>

                            {classData ? (
                                <BarChart
                                    data={classData}
                                    width={screenWidth - 40}
                                    height={220}
                                    yAxisLabel=""
                                    yAxisSuffix={activeClassTab === 'percentage' ? "%" : ""}
                                    chartConfig={chartConfig}
                                    style={styles.chartStyle}
                                    showValuesOnTopOfBars
                                />
                            ) : <Text style={styles.emptyText}>Sin clases registradas</Text>}
                        </View>

                        {/* Sexo */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Distribución por Sexo</Text>
                            {genderData.length > 0 ? (
                                <PieChart
                                    data={genderData}
                                    width={screenWidth - 40}
                                    height={150}
                                    chartConfig={chartConfig}
                                    accessor={"population"}
                                    backgroundColor={"transparent"}
                                    paddingLeft={"15"}
                                />
                            ) : <Text style={styles.emptyText}>Sin datos de sexo</Text>}
                        </View>

                        {/* Edades */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Distribución por Edades</Text>
                            {ageData.length > 0 ? (
                                <PieChart
                                    data={ageData}
                                    width={screenWidth - 40}
                                    height={180}
                                    chartConfig={chartConfig}
                                    accessor={"population"}
                                    backgroundColor={"transparent"}
                                    paddingLeft={"15"}
                                />
                            ) : <Text style={styles.emptyText}>Sin datos de edad</Text>}
                        </View>

                    </ScrollView>
                )}
            </View>
        </Modal>
        <StatsPeriodPicker period={period} gymColor={gymColor} />
        </>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, backgroundColor: Colors[colorScheme].background },
    headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 15, justifyContent: 'space-between' },
    headerTitle: { fontSize: 19, fontWeight: 'bold', color: '#fff' },
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
    cardTitle: { fontSize: 15, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 15, textAlign: 'center' },
    chartStyle: { borderRadius: 16, alignSelf: 'center' },
    emptyText: { textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.6, fontStyle: 'italic', paddingVertical: 20 },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 15,
        backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0',
        borderRadius: 8,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    tabText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
    },
    salesRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    salesKpi: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    salesKpiLabel: { fontSize: 12, fontWeight: '600', color: Colors[colorScheme].text, opacity: 0.65, textAlign: 'center' },
    salesKpiValue: { fontSize: 26, fontWeight: '800', marginTop: 4 },
    salesKpiHint: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.7, marginTop: 2, textAlign: 'center' },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colorScheme === 'dark' ? '#333' : '#e6e6e6',
        gap: 12,
    },
    typeName: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors[colorScheme].text },
    typeFigures: { alignItems: 'flex-end' },
    typeAmount: { fontSize: 13, fontWeight: '700', color: Colors[colorScheme].text },
    typeHint: { fontSize: 11, color: Colors[colorScheme].text, opacity: 0.6, marginTop: 2 },
});

export default StatsPanelModal;
