import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    useColorScheme,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';

const screenWidth = Dimensions.get('window').width;

const TABS = [
    { id: 'totales', label: 'Totales', icon: 'stats-chart-outline' },
    { id: 'last30Days', label: 'Últimos 30 días', icon: 'calendar-outline' },
];

const ClientStatsModal = ({ visible, onClose, gymColor, apiClient, userId, userName }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);
    const colors = Colors[colorScheme];

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState('totales');

    const fetchStats = useCallback(async () => {
        if (!apiClient || !visible || !userId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/stats/client/${userId}`);
            setStats(res.data);
        } catch (error) {
            console.error('Error cargando estadísticas del cliente:', error);
        } finally {
            setLoading(false);
        }
    }, [apiClient, visible, userId]);

    useEffect(() => {
        if (visible) {
            setActiveTab('totales');
            fetchStats();
        }
    }, [visible, fetchStats]);

    if (!visible) return null;

    const chartConfig = {
        backgroundGradientFrom: colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7',
        backgroundGradientTo: colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7',
        color: (opacity = 1) =>
            accent
                ? `${accent}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
                : `rgba(26, 82, 118, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
        labelColor: () => colors.text,
        propsForBackgroundLines: {
            stroke: colors.border,
            strokeDasharray: '',
        },
    };

    const activeData = activeTab === 'totales' ? stats?.totales : stats?.last30Days;

    let attendanceRate = 0;
    if (activeData?.attendanceData?.totalInscripciones > 0) {
        attendanceRate = Math.round(
            (activeData.attendanceData.totalAsistencias / activeData.attendanceData.totalInscripciones) * 100
        );
    }

    const rateColor = attendanceRate > 70 ? '#1e7e34' : attendanceRate < 40 ? '#a72828' : '#c9a227';

    let favoriteData = [];
    if (activeData?.favoriteClasses) {
        const pieColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
        favoriteData = activeData.favoriteClasses.map((d, idx) => ({
            name: d._id,
            population: d.count,
            color: pieColors[idx % pieColors.length],
            legendFontColor: colors.text,
            legendFontSize: 12,
        }));
    }

    let activityData = null;
    if (stats?.activityByMonth && stats.activityByMonth.length > 0) {
        activityData = {
            labels: stats.activityByMonth.map((d) => {
                const [year, month] = d._id.split('-');
                return format(new Date(year, month - 1, 1), 'MMM', { locale: es });
            }),
            datasets: [{ data: stats.activityByMonth.map((d) => d.count) }],
        };
    }

    const chartWidth = Math.min(screenWidth - 56, 420);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
            statusBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={[styles.header, { backgroundColor: accent }]}>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.headerKicker}>Estadísticas</Text>
                            <Text style={styles.headerTitle} numberOfLines={1}>{userName || 'Socio'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tabBar}>
                        {TABS.map((tab) => {
                            const selected = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tabBtn, selected && { backgroundColor: accent }]}
                                    onPress={() => setActiveTab(tab.id)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name={tab.icon} size={15} color={selected ? '#fff' : colors.text} />
                                    <Text style={[styles.tabText, selected && styles.tabTextSelected]} numberOfLines={1}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color={accent} />
                            <Text style={styles.loadingText}>Cargando métricas...</Text>
                        </View>
                    ) : !stats ? (
                        <View style={styles.loadingWrap}>
                            <Ionicons name="bar-chart-outline" size={40} color={colors.icon} />
                            <Text style={styles.loadingText}>No se encontraron datos.</Text>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.scroll}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.kpiRow}>
                                <View style={styles.kpiCard}>
                                    <Text style={styles.kpiLabel}>Inscripciones</Text>
                                    <Text style={[styles.kpiValue, { color: accent }]}>
                                        {activeData?.attendanceData?.totalInscripciones || 0}
                                    </Text>
                                </View>
                                <View style={styles.kpiCard}>
                                    <Text style={styles.kpiLabel}>Asistencias</Text>
                                    <Text style={[styles.kpiValue, { color: accent }]}>
                                        {activeData?.attendanceData?.totalAsistencias || 0}
                                    </Text>
                                </View>
                                <View style={styles.kpiCard}>
                                    <Text style={styles.kpiLabel}>Tasa</Text>
                                    <Text style={[styles.kpiValue, { color: rateColor }]}>{attendanceRate}%</Text>
                                </View>
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Inscripciones por mes</Text>
                                <Text style={styles.cardSub}>Evolución de actividad reciente.</Text>
                                {activityData ? (
                                    <LineChart
                                        data={activityData}
                                        width={chartWidth}
                                        height={210}
                                        chartConfig={{ ...chartConfig, decimalPlaces: 0 }}
                                        bezier
                                        style={styles.chart}
                                        fromZero
                                    />
                                ) : (
                                    <Text style={styles.emptyText}>Sin actividad reciente</Text>
                                )}
                            </View>

                            <View style={[styles.card, { marginTop: 12 }]}>
                                <Text style={styles.cardTitle}>Clases más elegidas</Text>
                                <Text style={styles.cardSub}>Preferencias según el período seleccionado.</Text>
                                {favoriteData.length > 0 ? (
                                    <PieChart
                                        data={favoriteData}
                                        width={chartWidth}
                                        height={160}
                                        chartConfig={chartConfig}
                                        accessor="population"
                                        backgroundColor="transparent"
                                        paddingLeft="12"
                                    />
                                ) : (
                                    <Text style={styles.emptyText}>Sin historial de clases</Text>
                                )}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const softCard = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';

    return StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        sheet: {
            width: '100%',
            height: '92%',
            maxHeight: '92%',
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 18,
            paddingHorizontal: 18,
        },
        headerTextWrap: { flex: 1, paddingRight: 10 },
        headerKicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 4,
        },
        headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
        closeBtn: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        tabBar: {
            flexDirection: 'row',
            marginHorizontal: 14,
            marginTop: 12,
            marginBottom: 4,
            padding: 4,
            borderRadius: 12,
            backgroundColor: softCard,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 4,
        },
        tabBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 10,
        },
        tabText: { fontSize: 12, fontWeight: '700', color: colors.text },
        tabTextSelected: { color: '#fff' },
        loadingWrap: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 10,
        },
        loadingText: { color: colors.text, opacity: 0.7, fontSize: 14 },
        scroll: { padding: 14, paddingBottom: 40 },
        kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
        kpiCard: {
            flex: 1,
            backgroundColor: softCard,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 8,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
        },
        kpiLabel: { fontSize: 11, fontWeight: '600', color: colors.text, opacity: 0.6, textAlign: 'center' },
        kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 6, textAlign: 'center' },
        card: {
            backgroundColor: softCard,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        cardSub: { fontSize: 13, color: colors.text, opacity: 0.6, marginTop: 4, marginBottom: 12 },
        chart: { borderRadius: 12, alignSelf: 'center' },
        emptyText: {
            textAlign: 'center',
            color: colors.text,
            opacity: 0.55,
            fontSize: 13,
            paddingVertical: 24,
        },
    });
};

export default ClientStatsModal;
