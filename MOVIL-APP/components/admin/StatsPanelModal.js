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

const screenWidth = Dimensions.get("window").width;

const StatsPanelModal = ({ visible, onClose, gymColor, apiClient }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [activeClassTab, setActiveClassTab] = useState('average'); // 'average' | 'percentage'

    const fetchStats = useCallback(async () => {
        if (!apiClient || !visible) return;
        setLoading(true);
        try {
            const res = await apiClient.get('/stats/dashboard');
            setStats(res.data);
        } catch (error) {
            console.error("Error cargando estadísticas:", error);
        } finally {
            setLoading(false);
        }
    }, [apiClient, visible]);

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
            labels: stats.newUsersByMonth.map(d => {
                const [year, month] = d._id.split('-');
                return format(new Date(year, month - 1, 1), 'MMM', { locale: es });
            }),
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
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
            <View style={styles.modalContainer}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="chevron-down" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Panel de Estadísticas</Text>
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

                        {/* Nuevos Usuarios */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Nuevos Usuarios por Mes</Text>
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
                            <Text style={styles.cardTitle}>Popularidad de Clases (Últimos 30 días)</Text>
                            
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
    }
});

export default StatsPanelModal;
