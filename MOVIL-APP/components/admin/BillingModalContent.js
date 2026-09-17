// components/admin/BillingModalContent.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    useColorScheme,
    ActivityIndicator,
    ScrollView,
    Modal,
    Image,
} from 'react-native';
import { getUserTransactions, createTransaction } from '../../services/managementApi';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import CustomAlert from '@/components/CustomAlert';

const TABS = [
    { id: 'register', label: 'Registrar', icon: 'create-outline' },
    { id: 'history', label: 'Historial', icon: 'time-outline' },
];

const BillingModalContent = ({ client, onClose, onRefresh }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('register');
    const [newTransaction, setNewTransaction] = useState({ amount: '', description: '' });
    const [currentClient, setCurrentClient] = useState(client);
    const [imageViewerData, setImageViewerData] = useState(null);

    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);
    const colors = Colors[colorScheme];

    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    const balance = currentClient?.balance ?? 0;
    const isDebtor = balance < 0;
    const fullName = `${currentClient?.nombre || ''} ${currentClient?.apellido || ''}`.trim();

    const fetchData = async () => {
        if (!client?._id) return;
        setLoading(true);
        try {
            const [transactionsResponse, userResponse] = await Promise.all([
                getUserTransactions(client._id),
                apiClient.get(`/users/${client._id}`),
            ]);
            setTransactions(transactionsResponse.data);
            setCurrentClient(userResponse.data);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudo cargar la información del cliente.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [client]);

    const handleCreateTransaction = async (type) => {
        if (!newTransaction.amount || !newTransaction.description) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'Por favor, completa el monto y la descripción.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
            });
            return;
        }
        setSubmitting(true);
        try {
            const response = await createTransaction({
                userId: client._id,
                amount: newTransaction.amount,
                description: newTransaction.description,
                type,
            });

            setCurrentClient((prevClient) => ({ ...prevClient, balance: response.data.newUserBalance }));
            setTransactions((prevTransactions) => [response.data.transaction, ...prevTransactions]);
            setNewTransaction({ amount: '', description: '' });

            onRefresh?.();
            setAlertInfo({
                visible: true,
                title: 'Éxito',
                message: 'Transacción registrada correctamente.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
            });
            setActiveTab('history');
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo crear la transacción.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }],
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.root}>
            <View style={[styles.header, { backgroundColor: accent }]}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.headerKicker}>Balance económico</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>{fullName || 'Socio'}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                    <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={[styles.balanceStrip, isDebtor ? styles.balanceStripDebt : styles.balanceStripOk]}>
                <View>
                    <Text style={styles.balanceLabel}>Saldo actual</Text>
                    <Text style={[styles.balanceValue, isDebtor ? styles.charge : styles.payment]}>
                        {isDebtor ? '-' : ''}${Math.abs(balance).toFixed(2)}
                    </Text>
                </View>
                <View style={[styles.statusChip, isDebtor ? styles.statusDebtBg : styles.statusOkBg]}>
                    <Ionicons
                        name={isDebtor ? 'alert-circle' : 'checkmark-circle'}
                        size={14}
                        color={isDebtor ? '#a72828' : '#1e7e34'}
                    />
                    <Text style={[styles.statusChipText, { color: isDebtor ? '#a72828' : '#1e7e34' }]}>
                        {isDebtor ? 'Con deuda' : 'Al día'}
                    </Text>
                </View>
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
                            <Ionicons
                                name={tab.icon}
                                size={16}
                                color={selected ? '#fff' : colors.text}
                            />
                            <Text style={[styles.tabBtnText, selected && styles.tabBtnTextSelected]}>
                                {tab.label}
                                {tab.id === 'history' ? ` (${transactions.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={accent} size="large" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {activeTab === 'register' ? (
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Nuevo movimiento</Text>
                            <Text style={styles.sectionSub}>Cargá un pago o un cargo para este socio.</Text>

                            <Text style={styles.inputLabel}>Monto</Text>
                            <View style={styles.amountRow}>
                                <Text style={styles.currencyPrefix}>$</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    placeholder="0.00"
                                    placeholderTextColor={colors.icon}
                                    keyboardType="numeric"
                                    value={newTransaction.amount}
                                    onChangeText={(text) => setNewTransaction((p) => ({ ...p, amount: text }))}
                                />
                            </View>

                            <Text style={styles.inputLabel}>Descripción</Text>
                            <TextInput
                                style={styles.input}
                                placeholderTextColor={colors.icon}
                                placeholder="Ej: Pago cuota, cargo inscripción..."
                                value={newTransaction.description}
                                onChangeText={(text) => setNewTransaction((p) => ({ ...p, description: text }))}
                            />

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.paymentBtn, submitting && styles.btnDisabled]}
                                    onPress={() => handleCreateTransaction('payment')}
                                    disabled={submitting}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="arrow-down-circle" size={18} color="#fff" />
                                    <Text style={styles.actionBtnText}>Registrar pago</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.chargeBtn, submitting && styles.btnDisabled]}
                                    onPress={() => handleCreateTransaction('charge')}
                                    disabled={submitting}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="arrow-up-circle" size={18} color="#fff" />
                                    <Text style={styles.actionBtnText}>Añadir cargo</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Historial de movimientos</Text>
                            <Text style={styles.sectionSub}>Pagos y cargos registrados.</Text>

                            {transactions.length === 0 ? (
                                <Text style={styles.emptyText}>Este socio todavía no tiene movimientos.</Text>
                            ) : (
                                transactions.map((item) => {
                                    const isCharge = item.type === 'charge';
                                    return (
                                        <View key={item._id} style={styles.txRow}>
                                            <View style={[styles.txIconWrap, isCharge ? styles.txIconCharge : styles.txIconPayment]}>
                                                <Ionicons
                                                    name={isCharge ? 'remove' : 'add'}
                                                    size={16}
                                                    color={isCharge ? '#a72828' : '#1e7e34'}
                                                />
                                            </View>
                                            <View style={styles.txInfo}>
                                                <Text style={styles.txDescription} numberOfLines={2}>{item.description}</Text>
                                                <Text style={styles.txDate}>
                                                    {format(new Date(item.createdAt), "d MMM yyyy · HH:mm", { locale: es })}
                                                </Text>
                                                {!!item.receiptUrl && (
                                                    <TouchableOpacity
                                                        style={styles.receiptBtn}
                                                        onPress={() => setImageViewerData(item.receiptUrl)}
                                                    >
                                                        <Ionicons name="image-outline" size={13} color={accent} />
                                                        <Text style={[styles.receiptBtnText, { color: accent }]}>Ver comprobante</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            <Text style={[styles.txAmount, isCharge ? styles.charge : styles.payment]}>
                                                {isCharge ? '-' : '+'}${parseFloat(item.amount).toFixed(2)}
                                            </Text>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}
                </ScrollView>
            )}

            {imageViewerData && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setImageViewerData(null)}>
                    <View style={styles.imageViewerOverlay}>
                        <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerData(null)}>
                            <Ionicons name="close" size={40} color="#fff" />
                        </TouchableOpacity>
                        <Image source={{ uri: imageViewerData }} style={styles.imageViewerImage} resizeMode="contain" />
                    </View>
                </Modal>
            )}

            <CustomAlert
                inline
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={accent}
            />
        </View>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const softCard = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';
    const line = colors.border;

    return StyleSheet.create({
        root: {
            width: '100%',
            flex: 1,
            backgroundColor: colors.background,
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
        balanceStrip: {
            marginHorizontal: 16,
            marginTop: 14,
            marginBottom: 10,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
        },
        balanceStripOk: {
            backgroundColor: colorScheme === 'dark' ? '#13251a' : '#eefaf1',
            borderColor: colorScheme === 'dark' ? '#1e7e3466' : '#b7e4c7',
        },
        balanceStripDebt: {
            backgroundColor: colorScheme === 'dark' ? '#2a1515' : '#fdeeee',
            borderColor: colorScheme === 'dark' ? '#a7282866' : '#f1c0c0',
        },
        balanceLabel: { fontSize: 12, color: colors.text, opacity: 0.65, fontWeight: '600' },
        balanceValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
        statusChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 999,
        },
        statusOkBg: { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)' },
        statusDebtBg: { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)' },
        statusChipText: { fontSize: 12, fontWeight: '700' },
        tabBar: {
            flexDirection: 'row',
            marginHorizontal: 16,
            marginBottom: 8,
            padding: 4,
            borderRadius: 12,
            backgroundColor: softCard,
            borderWidth: 1,
            borderColor: line,
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
        tabBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },
        tabBtnTextSelected: { color: '#fff' },
        loadingWrap: { flex: 1, paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
        scrollContent: { padding: 16, paddingBottom: 36 },
        sectionCard: {
            backgroundColor: softCard,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: line,
        },
        sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        sectionSub: { fontSize: 13, color: colors.text, opacity: 0.6, marginTop: 4, marginBottom: 14 },
        inputLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
            opacity: 0.7,
            marginBottom: 6,
        },
        amountRow: {
            flexDirection: 'row',
            alignItems: 'center',
            height: 50,
            borderWidth: 1,
            borderColor: line,
            borderRadius: 12,
            paddingHorizontal: 12,
            marginBottom: 12,
            backgroundColor: colors.background,
        },
        currencyPrefix: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            opacity: 0.55,
            marginRight: 6,
        },
        amountInput: {
            flex: 1,
            height: '100%',
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        input: {
            height: 48,
            borderWidth: 1,
            borderColor: line,
            borderRadius: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
            color: colors.text,
            backgroundColor: colors.background,
        },
        actionRow: { flexDirection: 'row', gap: 10 },
        actionBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 13,
            borderRadius: 12,
        },
        paymentBtn: { backgroundColor: '#28a745' },
        chargeBtn: { backgroundColor: '#a72828' },
        btnDisabled: { opacity: 0.6 },
        actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
        emptyText: {
            textAlign: 'center',
            paddingVertical: 24,
            color: colors.text,
            opacity: 0.6,
            fontSize: 13,
        },
        txRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            paddingVertical: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: line,
        },
        txIconWrap: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
        },
        txIconPayment: { backgroundColor: '#28a74522' },
        txIconCharge: { backgroundColor: '#a7282822' },
        txInfo: { flex: 1 },
        txDescription: { fontSize: 14, fontWeight: '600', color: colors.text },
        txDate: { fontSize: 11, color: colors.text, opacity: 0.55, marginTop: 3 },
        txAmount: { fontSize: 14, fontWeight: '800', marginTop: 2 },
        charge: { color: '#a72828' },
        payment: { color: '#1e7e34' },
        receiptBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
            alignSelf: 'flex-start',
        },
        receiptBtnText: { fontSize: 12, fontWeight: '700' },
        imageViewerOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.9)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        imageViewerClose: { position: 'absolute', top: 40, right: 20, zIndex: 20 },
        imageViewerImage: { width: '100%', height: '80%' },
    });
};

export default BillingModalContent;
