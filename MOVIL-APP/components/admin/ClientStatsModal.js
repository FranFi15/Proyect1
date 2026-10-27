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
import StatsPeriodBar, { useStatsPeriod, statsModalVisible, StatsPeriodPicker } from './StatsPeriodBar';

const screenWidth = Dimensions.get('window').width;

const money = (n) =>
    `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

const bucketLabel = (id) => {
    const parts = String(id).split('-');
    if (parts.length >= 3) {
        return format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])), 'dd/MM');
    }
    return format(new Date(Number(parts[0]), Number(parts[1]) - 1, 1), 'MMM', { locale: es });
};

const ClientStatsModal = ({ visible, onClose, gymColor, apiClient, userId, userName }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);
    const colors = Colors[colorScheme];

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const period = useStatsPeriod();

    const fetchStats = useCallback(async () => {
        if (!apiClient || !visible || !userId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/stats/client/${userId}`, {
                params: { from: period.fromDate, to: period.toDate },
            });
            setStats(res.data);
        } catch (error) {
            console.error('Error cargando estadísticas del cliente:', error);
        } finally {
            setLoading(false);
        }
    }, [apiClient, visible, userId, period.fromDate, period.toDate]);

    useEffect(() => {
        if (visible) fetchStats();
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

    let attendanceRate = 0;
    if (stats?.attendanceData?.totalInscripciones > 0) {
        attendanceRate = Math.round(
            (stats.attendanceData.totalAsistencias / stats.attendanceData.totalInscripciones) * 100
        );
    }

    const rateColor = attendanceRate > 70 ? '#1e7e34' : attendanceRate < 40 ? '#a72828' : '#c9a227';

    let favoriteData = [];
    if (stats?.favoriteClasses) {
        const pieColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];
        favoriteData = stats.favoriteClasses.map((d, idx) => ({
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
            labels: stats.activityByMonth.map((d) => bucketLabel(d._id)),
            datasets: [{ data: stats.activityByMonth.map((d) => d.count) }],
        };
    }

    const chartWidth = Math.min(screenWidth - 56, 420);

    return (
        <>
        <Modal
            visible={statsModalVisible(visible, period)}
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

                    <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
                        <StatsPeriodBar period={period} gymColor={accent} />
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
                                        {stats?.attendanceData?.totalInscripciones || 0}
                                    </Text>
                                </View>
                                <View style={styles.kpiCard}>
                                    <Text style={styles.kpiLabel}>Asistencias</Text>
                                    <Text style={[styles.kpiValue, { color: accent }]}>
                                        {stats?.attendanceData?.totalAsistencias || 0}
                                    </Text>
                                </View>
                                <View style={styles.kpiCard}>
                                    <Text style={styles.kpiLabel}>Tasa</Text>
                                    <Text style={[styles.kpiValue, { color: rateColor }]}>{attendanceRate}%</Text>
                                </View>
                            </View>

                            <View style={[styles.card, { marginBottom: 12 }]}>
                                <Text style={styles.cardTitle}>Ventas</Text>
                                <Text style={styles.cardSub}>Paquetes por tipo y tienda del período.</Text>
                                {[
                                    { key: 'creditos', label: 'Créditos' },
                                    { key: 'pase', label: 'Acceso libre' },
                                    { key: 'membresia', label: 'Membresía' },
                                ].map((kind) => {
                                    const row = stats?.packageSales?.[kind.key];
                                    return (
                                        <View key={kind.key} style={styles.saleBlock}>
                                            <View style={styles.saleHead}>
                                                <Text style={styles.saleLabel}>{kind.label}</Text>
                                                <Text style={[styles.saleValue, { color: accent }]}>
                                                    {row?.count || 0} · {money(row?.amount)}
                                                </Text>
                                            </View>
                                            {kind.key === 'creditos' && (row?.byType || []).map((typeRow) => (
                                                <View key={typeRow.id} style={styles.typeRow}>
                                                    <Text style={styles.typeName} numberOfLines={1}>{typeRow.name}</Text>
                                                    <Text style={styles.typeAmount}>{typeRow.count} · {money(typeRow.amount)}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    );
                                })}
                                <View style={styles.saleHead}>
                                    <Text style={styles.saleLabel}>Tienda</Text>
                                    <Text style={[styles.saleValue, { color: accent }]}>
                                        {stats?.storeSales?.count || 0} · {money(stats?.storeSales?.amount)}
                                    </Text>
                                </View>
                                <Text style={styles.kpiHint}>
                                    {stats?.storeSales?.units || 0} productos
                                </Text>
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Inscripciones del período</Text>
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
        <StatsPeriodPicker period={period} gymColor={accent} />
        </>
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
        kpiHint: { fontSize: 11, color: colors.text, opacity: 0.65, marginTop: 4, textAlign: 'center' },
        card: {
            backgroundColor: softCard,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        cardSub: { fontSize: 13, color: colors.text, opacity: 0.6, marginTop: 4, marginBottom: 12 },
        saleBlock: { marginBottom: 10 },
        saleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
        saleLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
        saleValue: { fontSize: 14, fontWeight: '800' },
        typeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 6,
            paddingLeft: 10,
            gap: 12,
        },
        typeName: { flex: 1, fontSize: 13, color: colors.text, opacity: 0.8 },
        typeAmount: { fontSize: 13, fontWeight: '600', color: colors.text },
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
