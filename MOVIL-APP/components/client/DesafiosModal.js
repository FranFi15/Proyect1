import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ScrollView,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    useColorScheme,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { format, parseISO, isBefore } from 'date-fns';
import { Colors } from '@/constants/Colors';
import apiClient from '@/services/apiClient';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';
import CustomAlert from '@/components/CustomAlert';

const METRIC_LABELS = {
    peso: 'Peso (kg)',
    tiempo: 'Tiempo',
    distancia: 'Distancia (mts)',
    repeticiones: 'Repeticiones',
    calorias: 'Calorías',
};

const METRIC_PLACEHOLDERS = {
    peso: 'Ej: 80.5',
    tiempo: 'Ej: 12:30',
    distancia: 'Ej: 5000',
    repeticiones: 'Ej: 50',
    calorias: 'Ej: 300',
};

const emptyScores = () => ({
    peso: '',
    tiempo: '',
    distancia: '',
    repeticiones: '',
    calorias: '',
    nota: '',
});

const formatResult = (entry) => {
    if (!entry) return 'Sin datos';
    const parts = [];
    if (entry.peso) parts.push(`${entry.peso}kg`);
    if (entry.tiempo) parts.push(entry.tiempo);
    if (entry.repeticiones) parts.push(`${entry.repeticiones} reps`);
    if (entry.distancia) parts.push(`${entry.distancia}m`);
    if (entry.calorias) parts.push(`${entry.calorias} cal`);
    return parts.length ? parts.join(' · ') : 'Sin datos';
};

const Medal = ({ position, size = 16, accent }) => {
    if (position === 1) return <FontAwesome5 name="medal" size={size} color="#FFD700" />;
    if (position === 2) return <FontAwesome5 name="medal" size={size} color="#C0C0C0" />;
    if (position === 3) return <FontAwesome5 name="medal" size={size} color="#CD7F32" />;
    return (
        <Text style={{ fontSize: size + 2, fontWeight: '800', color: accent || '#1a5276' }}>
            #{position}
        </Text>
    );
};

/**
 * Client Desafíos sheet: list → submit/edit score → ranking.
 */
export default function DesafiosModal({ visible, onClose, gymColor }) {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);

    const [viewMode, setViewMode] = useState('list'); // list | detail
    const [detailMode, setDetailMode] = useState('ranking'); // form | ranking
    const [activeScoreboards, setActiveScoreboards] = useState([]);
    const [selectedScoreboard, setSelectedScoreboard] = useState(null);
    const [leaderboardData, setLeaderboardData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [scores, setScores] = useState(emptyScores());
    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const showAlert = (title, message, buttons) => {
        setAlertInfo({
            visible: true,
            title,
            message,
            buttons: buttons || [
                { text: 'OK', style: 'primary', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) },
            ],
        });
    };

    const fetchActiveScoreboards = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await apiClient.get('/scoreboards/active');
            setActiveScoreboards(res.data || []);
        } catch (e) {
            console.error(e);
            showAlert('Error', 'No se pudieron cargar los desafíos.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!visible) return;
        setViewMode('list');
        setSelectedScoreboard(null);
        setLeaderboardData(null);
        setDetailMode('form');
        setScores(emptyScores());
        fetchActiveScoreboards();
    }, [visible, fetchActiveScoreboards]);

    const fetchLeaderboard = async (id, { preferFormIfLocked = true } = {}) => {
        setLoading(true);
        try {
            const res = await apiClient.get(`/scoreboards/${id}/leaderboard`);
            setLeaderboardData(res.data);

            if (res.data.userEntry) {
                const e = res.data.userEntry;
                setScores({
                    peso: e.peso?.toString() || '',
                    tiempo: e.tiempo || '',
                    distancia: e.distancia?.toString() || '',
                    repeticiones: e.repeticiones?.toString() || '',
                    calorias: e.calorias?.toString() || '',
                    nota: e.nota || '',
                });
            }

            if (preferFormIfLocked && (res.data.locked || !res.data.userEntry)) {
                setDetailMode('form');
            } else {
                setDetailMode('ranking');
            }
        } catch (e) {
            console.error(e);
            showAlert('Error', 'No se pudo cargar el ranking.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectScoreboard = (scoreboard) => {
        setSelectedScoreboard(scoreboard);
        setScores(emptyScores());
        setLeaderboardData(null);
        setViewMode('detail');
        fetchLeaderboard(scoreboard._id);
    };

    const handleSubmitScore = async () => {
        if (submitLoading || !selectedScoreboard) return;
        setSubmitLoading(true);
        try {
            const payload = {
                scoreboardId: selectedScoreboard._id,
                ...(scores.peso && { peso: Number(scores.peso) }),
                ...(scores.distancia && { distancia: Number(scores.distancia) }),
                ...(scores.repeticiones && { repeticiones: Number(scores.repeticiones) }),
                ...(scores.calorias && { calorias: Number(scores.calorias) }),
                ...(scores.tiempo && { tiempo: scores.tiempo }),
                ...(scores.nota && { nota: scores.nota }),
            };
            await apiClient.post('/scoreboards/submit', payload);
            await fetchLeaderboard(selectedScoreboard._id, { preferFormIfLocked: false });
            setDetailMode('ranking');
            fetchActiveScoreboards({ silent: true });
        } catch (e) {
            showAlert('Error', e?.response?.data?.message || 'No se pudo guardar el resultado.');
        } finally {
            setSubmitLoading(false);
        }
    };

    const goBack = () => {
        if (viewMode === 'detail' && detailMode === 'form' && leaderboardData?.userEntry && !leaderboardData?.locked) {
            setDetailMode('ranking');
            return;
        }
        setViewMode('list');
        setSelectedScoreboard(null);
        setLeaderboardData(null);
    };

    const isExpired = (item) => {
        if (!item?.fechaLimite && !item?.isLimitedTime) return false;
        if (!item.fechaLimite) return false;
        try {
            return isBefore(parseISO(item.fechaLimite), new Date());
        } catch {
            return false;
        }
    };

    const statusForItem = (item) => {
        if (isExpired(item)) return { label: 'Vencido', color: '#e74c3c' };
        if (item.completedByUser) return { label: 'En ranking', color: '#2ecc71' };
        return { label: 'Participar', color: accent };
    };

    const renderListItem = ({ item }) => {
        const status = statusForItem(item);
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => handleSelectScoreboard(item)}
                activeOpacity={0.88}
            >
                <View style={[styles.accentBar, { backgroundColor: status.color }]} />
                <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.nombre}</Text>
                        <View style={[styles.statusPill, { backgroundColor: status.color + '22' }]}>
                            <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                        </View>
                    </View>
                    {!!item.descripcion && (
                        <Text style={styles.cardDesc} numberOfLines={2}>{item.descripcion}</Text>
                    )}
                    <View style={styles.chipRow}>
                        <View style={styles.metaChip}>
                            <Ionicons name="time-outline" size={12} color={Colors[colorScheme].icon} />
                            <Text style={styles.metaChipText}>
                                {item.isLimitedTime || item.fechaLimite
                                    ? `Vence ${format(parseISO(item.fechaLimite), 'dd/MM')}`
                                    : 'Permanente'}
                            </Text>
                        </View>
                        {(item.metrics || []).map((m) => (
                            <View key={m} style={styles.metaChip}>
                                <Text style={styles.metaChipText}>{METRIC_LABELS[m]?.split(' ')[0] || m}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors[colorScheme].icon} style={{ marginRight: 10 }} />
            </TouchableOpacity>
        );
    };

    const renderForm = () => {
        const hasEntry = !!leaderboardData?.userEntry;
        return (
            <ScrollView
                contentContainerStyle={styles.detailScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.detailTitle}>{selectedScoreboard.nombre}</Text>
                {!!selectedScoreboard.descripcion && (
                    <Text style={styles.detailDesc}>{selectedScoreboard.descripcion}</Text>
                )}

                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name={hasEntry ? 'create-outline' : 'trophy-outline'} size={18} color={accent} />
                        <Text style={styles.sectionTitle}>
                            {hasEntry ? 'Actualizá tu resultado' : 'Cargá tu resultado'}
                        </Text>
                    </View>
                    <Text style={styles.sectionHint}>
                        {hasEntry
                            ? 'Modificá tus marcas y guardá para actualizar el ranking.'
                            : 'Guardá tu marca para desbloquear y ver el ranking.'}
                    </Text>

                    {(selectedScoreboard.metrics || []).map((metric) => (
                        <View key={metric} style={styles.fieldBlock}>
                            <Text style={styles.inputLabel}>{METRIC_LABELS[metric] || metric}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={METRIC_PLACEHOLDERS[metric] || ''}
                                placeholderTextColor={Colors[colorScheme].icon}
                                keyboardType={metric === 'tiempo' ? 'default' : 'numeric'}
                                value={scores[metric] || ''}
                                onChangeText={(t) => setScores((prev) => ({ ...prev, [metric]: t }))}
                            />
                        </View>
                    ))}

                    <TouchableOpacity
                        style={[styles.primaryBtn, submitLoading && { opacity: 0.7 }]}
                        onPress={handleSubmitScore}
                        disabled={submitLoading}
                        activeOpacity={0.88}
                    >
                        {submitLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                <Text style={styles.primaryBtnText}>
                                    {hasEntry ? 'Guardar cambios' : 'Guardar y ver ranking'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    const renderRanking = () => {
        const e = leaderboardData?.userEntry;
        const myIndex = (leaderboardData?.entries || []).findIndex(
            (entry) => entry.user?._id === e?.user || entry.user?._id === e?.user?._id
        );
        const position = myIndex >= 0 ? myIndex + 1 : null;

        return (
            <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.detailTitle}>{selectedScoreboard.nombre}</Text>
                {!!selectedScoreboard.descripcion && (
                    <Text style={styles.detailDesc}>{selectedScoreboard.descripcion}</Text>
                )}

                <View style={styles.myResultCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.myResultLabel}>Tu resultado</Text>
                        <Text style={styles.myResultValue}>{formatResult(e)}</Text>
                    </View>
                    {position != null && (
                        <View style={styles.positionWrap}>
                            <Medal position={position} size={18} accent={accent} />
                        </View>
                    )}
                    <TouchableOpacity
                        style={styles.editChip}
                        onPress={() => setDetailMode('form')}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="create-outline" size={16} color={accent} />
                        <Text style={[styles.editChipText, { color: accent }]}>Editar</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.rankingSectionTitle}>Ranking</Text>
                {(leaderboardData?.entries || []).length === 0 ? (
                    <Text style={styles.emptyText}>Todavía no hay resultados.</Text>
                ) : (
                    (leaderboardData.entries || []).map((entry, index) => {
                        const isMe =
                            entry.user?._id === e?.user ||
                            entry.user?._id === e?.user?._id;
                        return (
                            <View
                                key={entry._id || `${entry.user?._id}-${index}`}
                                style={[styles.rankRow, isMe && styles.rankRowMe]}
                            >
                                <View style={styles.rankPos}>
                                    {index < 3 ? (
                                        <Medal position={index + 1} size={14} accent={accent} />
                                    ) : (
                                        <Text style={styles.rankPosText}>{index + 1}</Text>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rankName}>
                                        {entry.user?.nombre} {entry.user?.apellido}
                                        {isMe ? ' (vos)' : ''}
                                    </Text>
                                </View>
                                <Text style={styles.rankResult}>{formatResult(entry)}</Text>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        );
    };

    const headerTitle =
        viewMode === 'list'
            ? 'Desafíos'
            : detailMode === 'form'
                ? (leaderboardData?.userEntry ? 'Editar resultado' : 'Participar')
                : 'Ranking';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={styles.root}>
                <KeyboardAwareSheet
                    onDismiss={onClose}
                    backgroundColor={Colors[colorScheme].background}
                    style={styles.sheet}
                >
                    <View style={[styles.header, { backgroundColor: accent }]}>
                        {viewMode === 'detail' ? (
                            <TouchableOpacity onPress={goBack} style={styles.headerIconBtn}>
                                <Ionicons name="arrow-back" size={22} color="#fff" />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 36 }} />
                        )}
                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                            <Text style={styles.headerKicker}>Retos del gimnasio</Text>
                            <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.headerIconBtn}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {viewMode === 'list' ? (
                        loading && !refreshing ? (
                            <View style={styles.centered}>
                                <ActivityIndicator color={accent} size="large" />
                            </View>
                        ) : (
                            <FlatList
                                data={activeScoreboards}
                                keyExtractor={(item) => item._id}
                                renderItem={renderListItem}
                                contentContainerStyle={styles.listContent}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>No hay desafíos activos.</Text>
                                }
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={() => fetchActiveScoreboards({ silent: true })}
                                        tintColor={accent}
                                    />
                                }
                            />
                        )
                    ) : loading && !leaderboardData ? (
                        <View style={styles.centered}>
                            <ActivityIndicator color={accent} size="large" />
                        </View>
                    ) : detailMode === 'form' ? (
                        renderForm()
                    ) : (
                        renderRanking()
                    )}
                </KeyboardAwareSheet>

                <CustomAlert
                    inline
                    visible={alertInfo.visible}
                    title={alertInfo.title}
                    message={alertInfo.message}
                    buttons={alertInfo.buttons}
                    onClose={() => setAlertInfo((p) => ({ ...p, visible: false }))}
                    gymColor={accent}
                />
            </View>
        </Modal>
    );
}

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
        sheet: { width: '100%', height: '92%', maxHeight: '92%', overflow: 'hidden' },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 14,
        },
        headerKicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 2,
        },
        headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
        headerIconBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        listContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },
        emptyText: {
            textAlign: 'center',
            marginTop: 40,
            fontSize: 15,
            color: colors.text,
            opacity: 0.65,
        },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 10,
            overflow: 'hidden',
        },
        accentBar: { width: 5, alignSelf: 'stretch' },
        cardBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 12 },
        cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
        cardDesc: { marginTop: 4, fontSize: 13, color: colors.text, opacity: 0.7 },
        statusPill: {
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
        },
        statusPillText: { fontSize: 11, fontWeight: '800' },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
        metaChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
        },
        metaChipText: { fontSize: 11, fontWeight: '600', color: colors.text, opacity: 0.75 },
        detailScroll: { padding: 16, paddingBottom: 40 },
        detailTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
        detailDesc: { fontSize: 14, lineHeight: 20, color: colors.text, opacity: 0.72, marginBottom: 14 },
        sectionCard: {
            backgroundColor: soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
        },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
        sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
        sectionHint: { fontSize: 13, color: colors.text, opacity: 0.65, marginBottom: 14, lineHeight: 18 },
        fieldBlock: { marginBottom: 12 },
        inputLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, opacity: 0.85 },
        input: {
            height: 46,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            color: colors.text,
            fontSize: 15,
        },
        primaryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: accent,
            paddingVertical: 14,
            borderRadius: 14,
            marginTop: 8,
        },
        primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
        myResultCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 18,
        },
        myResultLabel: {
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            color: colors.text,
            opacity: 0.55,
        },
        myResultValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
        positionWrap: { minWidth: 36, alignItems: 'center' },
        editChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: accent + '18',
        },
        editChipText: { fontSize: 12, fontWeight: '800' },
        rankingSectionTitle: {
            fontSize: 15,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 10,
        },
        rankRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            gap: 8,
        },
        rankRowMe: {
            backgroundColor: accent + '12',
            borderRadius: 10,
            borderBottomWidth: 0,
            marginBottom: 4,
        },
        rankPos: { width: 32, alignItems: 'center' },
        rankPosText: { fontWeight: '800', color: colors.text },
        rankName: { fontSize: 14, fontWeight: '700', color: colors.text },
        rankResult: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
            opacity: 0.8,
            maxWidth: 110,
            textAlign: 'right',
        },
    });
};
