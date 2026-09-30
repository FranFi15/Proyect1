import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../services/apiClient';

const METHODS = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'mercadopago', label: 'MP' },
];

const money = (n) =>
    `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Package picker + price/discount/method + Confirmar venta / Paga luego
 * for the client credits modal (créditos / libre / membresía).
 */
const CreditsPlanSaleBlock = ({
    kind, // 'credits' | 'pase' | 'membresia'
    clientId,
    packages = [],
    discounts = [],
    customItem = null, // built by parent from form fields (without price)
    accent = '#1a5276',
    colors = {},
    onAlert,
    onSuccess,
}) => {
    const [selectedPkgId, setSelectedPkgId] = useState(null);
    const [salePrice, setSalePrice] = useState('');
    const [selectedDiscountId, setSelectedDiscountId] = useState(null);
    const [adhocPercent, setAdhocPercent] = useState('');
    const [method, setMethod] = useState('efectivo');
    const [submitting, setSubmitting] = useState(false);

    const selectedPkg = useMemo(
        () => packages.find((p) => p._id === selectedPkgId) || null,
        [packages, selectedPkgId]
    );

    const activeDiscounts = useMemo(
        () => (discounts || []).filter((d) => d.isActive),
        [discounts]
    );

    const listPrice = useMemo(() => {
        if (selectedPkg) return Number(selectedPkg.price) || 0;
        if (salePrice !== '' && salePrice != null) return Math.max(0, Number(salePrice) || 0);
        return 0;
    }, [selectedPkg, salePrice]);

    const previewDiscount = useMemo(() => {
        if (selectedDiscountId) {
            const d = activeDiscounts.find((x) => x._id === selectedDiscountId);
            if (!d) return 0;
            if (d.type === 'percent') {
                return Math.min(listPrice, Math.round(listPrice * (Number(d.value) / 100) * 100) / 100);
            }
            return Math.min(listPrice, Number(d.value) || 0);
        }
        if (adhocPercent) {
            const pct = Math.min(100, Math.max(0, Number(adhocPercent) || 0));
            return Math.min(listPrice, Math.round(listPrice * (pct / 100) * 100) / 100);
        }
        return 0;
    }, [selectedDiscountId, adhocPercent, activeDiscounts, listPrice]);

    const totalToCharge = Math.max(0, listPrice - previewDiscount);

    const selectPackage = (pkg) => {
        if (selectedPkgId === pkg._id) {
            setSelectedPkgId(null);
            setSalePrice('');
            return;
        }
        setSelectedPkgId(pkg._id);
        setSalePrice(String(pkg.price ?? ''));
    };

    const buildPayload = (payLater) => {
        const payload = {
            userId: clientId,
            method,
            payLater: Boolean(payLater),
        };

        if (selectedDiscountId) payload.discountId = selectedDiscountId;
        else if (adhocPercent) payload.discountPercent = Number(adhocPercent);

        if (selectedPkg) {
            payload.items = [{ packageId: selectedPkg._id, quantity: 1 }];
            const catalog = Number(selectedPkg.price) || 0;
            const override = Number(salePrice);
            if (Number.isFinite(override) && override > 0 && override !== catalog) {
                payload.customPrice = override;
            }
        } else if (customItem) {
            payload.items = [];
            payload.customItem = {
                ...customItem,
                kind,
                price: Number(salePrice) || 0,
            };
        } else {
            return null;
        }

        return payload;
    };

    const validate = () => {
        if (!clientId) {
            onAlert?.('Falta cliente', 'No hay cliente seleccionado.');
            return false;
        }
        if (selectedPkg) {
            if (!(Number(salePrice) > 0) && !(Number(selectedPkg.price) > 0)) {
                onAlert?.('Falta precio', 'El paquete no tiene precio válido.');
                return false;
            }
            return true;
        }
        if (!customItem) {
            onAlert?.(
                'Falta selección',
                kind === 'credits'
                    ? 'Elegí un paquete o completá tipo de turno y créditos.'
                    : 'Elegí un paquete o completá las fechas / duración.'
            );
            return false;
        }
        if (!(Number(salePrice) > 0)) {
            onAlert?.('Falta precio', 'Indicá el precio a cobrar por esta carga personalizada.');
            return false;
        }
        if (kind === 'credits') {
            if (!customItem.tipoClaseId || !(Number(customItem.creditsAmount) > 0)) {
                onAlert?.('Datos incompletos', 'Seleccioná tipo de turno y una cantidad de créditos positiva.');
                return false;
            }
        } else if (!customItem.desde || !customItem.hasta) {
            if (!(Number(customItem.durationDays) > 0)) {
                onAlert?.('Datos incompletos', 'Completá desde/hasta o elegí una duración rápida.');
                return false;
            }
        }
        return true;
    };

    const submitSale = async ({ payLater = false } = {}) => {
        if (!validate()) return;
        const payload = buildPayload(payLater);
        if (!payload) return;

        setSubmitting(true);
        try {
            const res = await apiClient.post('/caja/sale', payload);
            const bal = Number(res.data.newBalance);
            let balMsg = '';
            if (Number.isFinite(bal)) {
                if (bal > 0) balMsg = `\nSaldo a favor: $${bal.toFixed(2)}`;
                else if (bal < 0) balMsg = `\nDeuda restante: $${Math.abs(bal).toFixed(2)}`;
                else balMsg = '\nSaldo: al día';
            }
            onAlert?.(
                payLater ? 'Deuda cargada' : 'Venta OK',
                (res.data.message || (payLater ? 'Deuda cargada al cliente.' : 'Venta registrada.'))
                    + (res.data.benefitMessage ? `\n${res.data.benefitMessage}` : '')
                    + balMsg
            );
            setSelectedPkgId(null);
            setSalePrice('');
            setSelectedDiscountId(null);
            setAdhocPercent('');
            onSuccess?.();
        } catch (error) {
            onAlert?.('Error', error.response?.data?.message || 'No se pudo registrar la venta.');
        } finally {
            setSubmitting(false);
        }
    };

    const confirmPayLater = () => {
        if (!validate()) return;
        onAlert?.(
            'Paga luego',
            'No se va a registrar un pago. Se va a cargar la deuda al cliente.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Cargar deuda',
                    style: 'primary',
                    onPress: () => submitSale({ payLater: true }),
                },
            ]
        );
    };

    const styles = useMemo(() => makeStyles(colors, accent), [colors, accent]);

    return (
        <View style={styles.wrap}>
            <Text style={styles.sectionTitle}>Paquetes</Text>
            {packages.length === 0 ? (
                <Text style={styles.empty}>No hay paquetes activos de este tipo.</Text>
            ) : (
                packages.map((p) => {
                    const selected = selectedPkgId === p._id;
                    return (
                        <TouchableOpacity
                            key={p._id}
                            style={[styles.pkgRow, selected && { borderColor: accent, backgroundColor: accent + '14' }]}
                            onPress={() => selectPackage(p)}
                            activeOpacity={0.85}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pkgName}>{p.name}</Text>
                                <Text style={styles.hint}>
                                    {p.isPaseLibre || p.isMembresia
                                        ? `${p.durationDays || 30} días`
                                        : `${p.creditsAmount || 0} créditos`}
                                    {' · '}
                                    {money(p.price)}
                                </Text>
                            </View>
                            {selected && <Ionicons name="checkmark-circle" size={20} color={accent} />}
                        </TouchableOpacity>
                    );
                })
            )}

            <Text style={styles.sectionTitle}>
                {selectedPkg ? 'Precio (editable)' : 'Precio personalizado'}
            </Text>
            <TextInput
                style={styles.input}
                value={salePrice}
                onChangeText={(t) => {
                    setSalePrice(t);
                    if (t !== '' && selectedPkgId) {
                        // keep package selected; price override allowed
                    }
                }}
                placeholder={selectedPkg ? String(selectedPkg.price ?? '') : 'Ej: 15000'}
                placeholderTextColor={colors.icon}
                keyboardType="decimal-pad"
            />
            {!selectedPkg && (
                <Text style={styles.hint}>
                    Completá arriba el beneficio y poné el precio a cobrar.
                </Text>
            )}

            <Text style={styles.sectionTitle}>Descuento</Text>
            <View style={styles.rowWrap}>
                <TouchableOpacity
                    style={[styles.pill, !selectedDiscountId && { backgroundColor: accent, borderColor: accent }]}
                    onPress={() => { setSelectedDiscountId(null); }}
                >
                    <Text style={[styles.pillText, !selectedDiscountId && { color: '#fff' }]}>Sin dto</Text>
                </TouchableOpacity>
                {activeDiscounts.map((d) => {
                    const selected = selectedDiscountId === d._id;
                    return (
                        <TouchableOpacity
                            key={d._id}
                            style={[styles.pill, selected && { backgroundColor: accent, borderColor: accent }]}
                            onPress={() => {
                                setSelectedDiscountId(d._id);
                                setAdhocPercent('');
                            }}
                        >
                            <Text style={[styles.pillText, selected && { color: '#fff' }]} numberOfLines={1}>
                                {d.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <TextInput
                style={styles.input}
                value={adhocPercent}
                onChangeText={(t) => {
                    setAdhocPercent(t);
                    if (t) setSelectedDiscountId(null);
                }}
                placeholder="% descuento ad-hoc"
                placeholderTextColor={colors.icon}
                keyboardType="decimal-pad"
            />

            <Text style={styles.sectionTitle}>Método</Text>
            <View style={styles.rowWrap}>
                {METHODS.map((m) => (
                    <TouchableOpacity
                        key={m.id}
                        style={[styles.pill, method === m.id && { backgroundColor: accent, borderColor: accent }]}
                        onPress={() => setMethod(m.id)}
                    >
                        <Text style={[styles.pillText, method === m.id && { color: '#fff' }]}>{m.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.totalBox}>
                <Text style={styles.hint}>
                    {listPrice > 0
                        ? `Lista ${money(listPrice)}${previewDiscount > 0 ? ` − dto ${money(previewDiscount)}` : ''}`
                        : 'Sin monto todavía'}
                </Text>
                <Text style={styles.totalValue}>Total: {money(totalToCharge)}</Text>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: accent }, submitting && { opacity: 0.6 }]}
                    onPress={confirmPayLater}
                    disabled={submitting}
                >
                    <Text style={{ color: accent, fontWeight: '800', fontSize: 14 }}>Paga luego</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: accent }, submitting && { opacity: 0.6 }]}
                    onPress={() => submitSale({ payLater: false })}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryBtnText}>Confirmar venta</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const makeStyles = (colors, accent) => StyleSheet.create({
    wrap: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border || '#ddd' },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.text,
        marginTop: 10,
        marginBottom: 8,
    },
    empty: { fontSize: 13, color: colors.icon, marginBottom: 8 },
    hint: { fontSize: 12, color: colors.icon, marginBottom: 8 },
    pkgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border || '#ddd',
        backgroundColor: colors.background,
        marginBottom: 8,
    },
    pkgName: { fontWeight: '700', color: colors.text, fontSize: 14 },
    input: {
        height: 46,
        borderWidth: 1,
        borderColor: colors.border || '#ddd',
        borderRadius: 12,
        paddingHorizontal: 12,
        color: colors.text,
        backgroundColor: colors.background,
        marginBottom: 8,
        fontSize: 15,
    },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border || '#ddd',
        backgroundColor: colors.background,
    },
    pillText: { fontSize: 12, fontWeight: '700', color: colors.text },
    totalBox: {
        marginTop: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: accent,
        backgroundColor: colors.background,
    },
    totalValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    secondaryBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: 12,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtn: {
        flex: 1.2,
        borderRadius: 12,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

export default CreditsPlanSaleBlock;
