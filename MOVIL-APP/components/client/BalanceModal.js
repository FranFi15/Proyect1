import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    useColorScheme,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import apiClient from '../../services/apiClient';
import CustomAlert from '@/components/CustomAlert';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';

const BalanceModal = ({ onClose }) => {
    const { user, gymColor } = useAuth();
    const accent = gymColor || '#1a5276';
    const [profile, setProfile] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [imageViewerData, setImageViewerData] = useState(null);
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, accent);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    const fetchData = useCallback(async ({ silent = false } = {}) => {
        if (!user?._id) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        if (silent) setRefreshing(true);
        try {
            const [profileResponse, transactionsResponse] = await Promise.all([
                apiClient.get('/users/me'),
                apiClient.get('/transactions/my-transactions'),
            ]);
            setProfile(profileResponse.data);
            setTransactions(transactionsResponse.data);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudo cargar tu información de saldo.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?._id]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!user?._id) {
                if (!cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
                return;
            }
            try {
                const [profileResponse, transactionsResponse] = await Promise.all([
                    apiClient.get('/users/me'),
                    apiClient.get('/transactions/my-transactions'),
                ]);
                if (cancelled) return;
                setProfile(profileResponse.data);
                setTransactions(transactionsResponse.data);
            } catch (error) {
                if (cancelled) return;
                setAlertInfo({
                    visible: true,
                    title: 'Error',
                    message: 'No se pudo cargar tu información de saldo.',
                    buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
                });
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?._id]);

    const onRefresh = () => {
        fetchData({ silent: true });
    };

    const balance = profile?.balance ?? 0;
    const isDebt = balance < 0;

    const renderTransaction = ({ item }) => {
        const isCharge = item.type === 'charge';
        return (
            <View style={styles.transactionCard}>
                <View style={[styles.txIcon, { backgroundColor: isCharge ? '#a7282818' : '#28a74518' }]}>
                    <Ionicons
                        name={isCharge ? 'arrow-up' : 'arrow-down'}
                        size={16}
                        color={isCharge ? '#a72828' : '#28a745'}
                    />
                </View>
                <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDescription} numberOfLines={2}>{item.description}</Text>
                    <Text style={styles.transactionDate}>
                        {format(new Date(item.createdAt), "d MMM yyyy · HH:mm", { locale: es })}
                    </Text>
                    {!!item.receiptUrl && (
                        <TouchableOpacity
                            style={[styles.viewReceiptBtn, { backgroundColor: accent + '18' }]}
                            onPress={() => setImageViewerData(item.receiptUrl)}
                        >
                            <Ionicons name="image-outline" size={14} color={accent} />
                            <Text style={[styles.viewReceiptText, { color: accent }]}>Ver comprobante</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={[styles.transactionAmount, isCharge ? styles.debtText : styles.okText]}>
                    {isCharge ? '-' : '+'}${parseFloat(item.amount).toFixed(2)}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.root}>
            <KeyboardAwareSheet
                onDismiss={onClose}
                backgroundColor={Colors[colorScheme].background}
                borderRadius={20}
                style={styles.sheet}
            >
                <View style={[styles.header, { backgroundColor: accent }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerKicker}>Cuenta</Text>
                        <Text style={styles.headerTitle}>Historial de saldo</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                        <Ionicons name="close" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loading}>
                        <ActivityIndicator color={accent} size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={transactions}
                        renderItem={renderTransaction}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryLabel}>Saldo actual</Text>
                                <Text style={[styles.summaryBalance, isDebt ? styles.debtText : styles.okText]}>
                                    ${balance.toFixed(2)}
                                </Text>
                                <Text style={styles.summaryHint}>
                                    {isDebt ? 'Tenés un saldo pendiente' : 'Tu cuenta está al día'}
                                </Text>
                            </View>
                        }
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No tenés movimientos recientes.</Text>
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={accent}
                                colors={[accent]}
                            />
                        }
                    />
                )}
            </KeyboardAwareSheet>

            {!!imageViewerData && (
                <View style={styles.imageViewerOverlay}>
                    <TouchableOpacity
                        style={styles.imageViewerBackdrop}
                        activeOpacity={1}
                        onPress={() => setImageViewerData(null)}
                    />
                    <TouchableOpacity
                        style={styles.imageViewerClose}
                        onPress={() => setImageViewerData(null)}
                        hitSlop={12}
                    >
                        <Ionicons name="close" size={32} color="#fff" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: imageViewerData }}
                        style={styles.imageViewerImage}
                        resizeMode="contain"
                    />
                </View>
            )}

            <CustomAlert
                inline
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo((prev) => ({ ...prev, visible: false }))}
                gymColor={accent}
            />
        </View>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';
    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        sheet: {
            width: '100%',
            height: '92%',
            maxHeight: '92%',
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 18,
            paddingHorizontal: 18,
        },
        headerKicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 4,
        },
        headerTitle: {
            color: '#fff',
            fontSize: 20,
            fontWeight: '700',
        },
        closeBtn: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        loading: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        listContent: {
            padding: 16,
            paddingBottom: 32,
            flexGrow: 1,
        },
        summaryCard: {
            backgroundColor: soft,
            borderRadius: 16,
            paddingVertical: 20,
            paddingHorizontal: 16,
            alignItems: 'center',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        summaryLabel: {
            fontSize: 13,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            color: colors.text,
            opacity: 0.55,
        },
        summaryBalance: {
            fontSize: 34,
            fontWeight: '900',
            marginTop: 6,
        },
        summaryHint: {
            marginTop: 6,
            fontSize: 13,
            color: colors.text,
            opacity: 0.65,
        },
        transactionCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: soft,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
        },
        txIcon: {
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
        },
        transactionInfo: {
            flex: 1,
        },
        transactionDescription: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
        },
        transactionDate: {
            fontSize: 12,
            color: colors.text,
            opacity: 0.55,
            marginTop: 3,
        },
        transactionAmount: {
            fontSize: 15,
            fontWeight: '800',
            marginTop: 2,
        },
        debtText: { color: '#a72828' },
        okText: { color: '#28a745' },
        emptyText: {
            textAlign: 'center',
            paddingVertical: 28,
            color: colors.text,
            opacity: 0.65,
        },
        viewReceiptBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 8,
            alignSelf: 'flex-start',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            gap: 4,
        },
        viewReceiptText: {
            fontSize: 12,
            fontWeight: '700',
        },
        imageViewerOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.92)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 30,
        },
        imageViewerBackdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        imageViewerClose: {
            position: 'absolute',
            top: 48,
            right: 20,
            zIndex: 2,
            padding: 4,
        },
        imageViewerImage: {
            width: '100%',
            height: '80%',
            zIndex: 1,
        },
    });
};

export default BalanceModal;
