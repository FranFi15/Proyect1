import React, { useCallback, useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Image,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';

const BeneficiosModal = ({ visible, onClose, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payload, setPayload] = useState(null);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState('');

    const loadData = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const res = await apiClient.get('/benefits/me');
            setPayload(res.data || null);
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudieron cargar los beneficios.');
            setPayload(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!visible) return;
        loadData();
    }, [visible, loadData]);

    const eligible = payload?.eligible;
    const benefits = payload?.benefits || [];
    const client = payload?.client;
    const eligibility = payload?.eligibility;
    const lockedMessage =
        payload?.lockedMessage ||
        'Activá tu plan (créditos, acceso libre o membresía) para desbloquear los beneficios.';

    const reasonsLabel = (eligibility?.reasons || []).join(' · ');
    const detailBenefit = visible ? selected : null;

    const handleClose = () => {
        setSelected(null);
        onClose?.();
    };
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
            statusBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={styles.root}>
                <KeyboardAwareSheet
                    onDismiss={handleClose}
                    backgroundColor={Colors[colorScheme].background}
                    style={styles.sheet}
                >
                    <View style={[styles.header, { backgroundColor: accent }]}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={styles.kicker}>Socio</Text>
                            <Text style={styles.headerTitle}>Beneficios</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color={accent} />
                        </View>
                    ) : error ? (
                        <View style={styles.centered}>
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity
                                style={[styles.retryBtn, { backgroundColor: accent }]}
                                onPress={() => loadData()}
                            >
                                <Text style={styles.retryText}>Reintentar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : !eligible ? (
                        <View style={styles.lockedWrap}>
                            <View style={[styles.lockedIcon, { backgroundColor: accent + '18' }]}>
                                <Ionicons name="lock-closed" size={36} color={accent} />
                            </View>
                            <Text style={styles.lockedTitle}>Beneficios bloqueados</Text>
                            <Text style={styles.lockedMessage}>{lockedMessage}</Text>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.listScroll}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={() => loadData({ silent: true })}
                                    tintColor={accent}
                                />
                            }
                        >
                            {reasonsLabel ? (
                                <View style={[styles.accessBanner, { backgroundColor: accent + '14' }]}>
                                    <Ionicons name="checkmark-circle" size={18} color={accent} />
                                    <Text style={[styles.accessBannerText, { color: accent }]}>
                                        Acceso activo: {reasonsLabel}
                                    </Text>
                                </View>
                            ) : null}

                            {benefits.length === 0 ? (
                                <View style={styles.emptyWrap}>
                                    <Ionicons name="gift-outline" size={40} color={Colors[colorScheme].icon} />
                                    <Text style={styles.emptyTitle}>Todavía no hay beneficios</Text>
                                    <Text style={styles.emptyHint}>
                                        Cuando el gimnasio publique beneficios, van a aparecer acá.
                                    </Text>
                                </View>
                            ) : (
                                benefits.map((item) => (
                                    <TouchableOpacity
                                        key={item._id}
                                        style={styles.card}
                                        activeOpacity={0.85}
                                        onPress={() => setSelected(item)}
                                    >
                                        {item.imageUrl ? (
                                            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
                                        ) : (
                                            <View style={[styles.cardImage, styles.cardImageFallback]}>
                                                <Ionicons name="gift-outline" size={26} color={accent} />
                                            </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                                            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={Colors[colorScheme].icon} />
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    )}
                </KeyboardAwareSheet>
            </View>

            <Modal
                visible={Boolean(detailBenefit)}
                transparent
                animationType="fade"
                onRequestClose={() => setSelected(null)}
                statusBarTranslucent
            >
                <View style={styles.validRoot}>
                    <View style={[styles.validCard, { backgroundColor: Colors[colorScheme].cardBackground }]}>
                        <View style={[styles.validBadge, { backgroundColor: accent }]}>
                            <Ionicons name="shield-checkmark" size={18} color="#fff" />
                            <Text style={styles.validBadgeText}>Cliente válido</Text>
                        </View>

                        <View style={styles.validClientRow}>
                            {client?.fotoPerfil ? (
                                <Image source={{ uri: client.fotoPerfil }} style={styles.validAvatar} />
                            ) : (
                                <View style={[styles.validAvatar, { backgroundColor: accent }]}>
                                    <Ionicons name="person" size={22} color="#fff" />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.validClientName}>
                                    {[client?.nombre, client?.apellido].filter(Boolean).join(' ') || 'Cliente'}
                                </Text>
                                {!!client?.dni && (
                                    <Text style={styles.validClientMeta}>DNI {client.dni}</Text>
                                )}
                                {!!reasonsLabel && (
                                    <Text style={[styles.validClientMeta, { color: accent }]}>
                                        Por {reasonsLabel}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {detailBenefit?.imageUrl ? (
                            <Image source={{ uri: detailBenefit.imageUrl }} style={styles.validBenefitImage} />
                        ) : null}

                        <Text style={styles.validBenefitName}>{detailBenefit?.name}</Text>
                        <Text style={styles.validBenefitDesc}>{detailBenefit?.description}</Text>

                        {(eligibility?.paseLibreHasta || eligibility?.membresiaHasta) && (
                            <Text style={styles.validExpiry}>
                                {eligibility?.paseLibreHasta
                                    ? `Acceso libre hasta ${format(new Date(eligibility.paseLibreHasta), 'dd/MM/yyyy')}`
                                    : ''}
                                {eligibility?.paseLibreHasta && eligibility?.membresiaHasta ? ' · ' : ''}
                                {eligibility?.membresiaHasta
                                    ? `Membresía hasta ${format(new Date(eligibility.membresiaHasta), 'dd/MM/yyyy')}`
                                    : ''}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[styles.validCloseBtn, { backgroundColor: accent }]}
                            onPress={() => setSelected(null)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.validCloseText}>Listo</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f7f8fa';
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
        sheet: { width: '100%', height: '90%', maxHeight: '90%', overflow: 'hidden' },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16,
        },
        kicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 2,
        },
        headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
        closeBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
        errorText: { textAlign: 'center', color: colors.text, opacity: 0.8, marginBottom: 14 },
        retryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
        retryText: { color: '#fff', fontWeight: '800' },
        lockedWrap: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
        },
        lockedIcon: {
            width: 84,
            height: 84,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        lockedTitle: {
            fontSize: 20,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 8,
            textAlign: 'center',
        },
        lockedMessage: {
            fontSize: 15,
            lineHeight: 22,
            textAlign: 'center',
            color: colors.text,
            opacity: 0.7,
        },
        listScroll: { padding: 16, paddingBottom: 40 },
        accessBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 14,
        },
        accessBannerText: { flex: 1, fontSize: 13, fontWeight: '700' },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: soft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 10,
        },
        cardImage: { width: 64, height: 64, borderRadius: 14 },
        cardImageFallback: {
            backgroundColor: accent + '18',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
        cardDesc: {
            marginTop: 3,
            fontSize: 13,
            lineHeight: 18,
            color: colors.text,
            opacity: 0.7,
        },
        emptyWrap: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 24 },
        emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: colors.text },
        emptyHint: {
            marginTop: 6,
            fontSize: 14,
            textAlign: 'center',
            color: colors.text,
            opacity: 0.65,
            lineHeight: 20,
        },
        validRoot: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            padding: 22,
        },
        validCard: {
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
        },
        validBadge: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginBottom: 16,
        },
        validBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
        validClientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
        validAvatar: {
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
        },
        validClientName: { fontSize: 17, fontWeight: '800', color: colors.text },
        validClientMeta: { marginTop: 2, fontSize: 13, color: colors.icon, fontWeight: '600' },
        validBenefitImage: {
            width: '100%',
            height: 150,
            borderRadius: 14,
            marginBottom: 14,
            backgroundColor: soft,
        },
        validBenefitName: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 6 },
        validBenefitDesc: {
            fontSize: 14,
            lineHeight: 21,
            color: colors.text,
            opacity: 0.8,
            marginBottom: 12,
        },
        validExpiry: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.icon,
            marginBottom: 16,
        },
        validCloseBtn: {
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            paddingVertical: 14,
        },
        validCloseText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    });
};

export default BeneficiosModal;
