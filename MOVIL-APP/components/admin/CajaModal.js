import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/services/apiClient';
import CustomAlert from '@/components/CustomAlert';

const TABS = [
    { id: 'resumen', label: 'Resumen', icon: 'stats-chart-outline' },
    { id: 'venta', label: 'Nueva venta', icon: 'cart-outline' },
    { id: 'pendientes', label: 'Pendientes', icon: 'time-outline' },
    { id: 'descuentos', label: 'Descuentos', icon: 'pricetag-outline' },
];

const METHODS = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transfer', label: 'Transferencia' },
    { id: 'mercadopago', label: 'Mercado Pago' },
];

const money = (n, currency = 'ARS') =>
    `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const CajaModal = ({ visible, onClose, clients = [], onRefresh }) => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const colors = Colors[colorScheme];
    const styles = useMemo(() => getStyles(colorScheme, accent), [colorScheme, accent]);

    const [tab, setTab] = useState('resumen');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [dashboard, setDashboard] = useState(null);
    const [packages, setPackages] = useState([]);
    const [discounts, setDiscounts] = useState([]);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    // Sale form
    const [clientQuery, setClientQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedPkgIds, setSelectedPkgIds] = useState({}); // id -> qty
    const [freeAmount, setFreeAmount] = useState('');
    const [method, setMethod] = useState('efectivo');
    const [selectedDiscountId, setSelectedDiscountId] = useState(null);
    const [adhocPercent, setAdhocPercent] = useState('');

    // Discount form
    const [newDiscount, setNewDiscount] = useState({ name: '', type: 'percent', value: '' });

    const showAlert = (title, message) => {
        setAlertInfo({
            visible: true,
            title,
            message,
            buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
        });
    };

    const loadAll = useCallback(async () => {
        if (!visible) return;
        setLoading(true);
        try {
            const [dashRes, pkgRes, discRes] = await Promise.all([
                apiClient.get('/caja/dashboard'),
                apiClient.get('/payments/packages'),
                apiClient.get('/caja/discounts?all=true'),
            ]);
            setDashboard(dashRes.data);
            setPackages(pkgRes.data || []);
            setDiscounts(discRes.data || []);
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo cargar la caja.');
        } finally {
            setLoading(false);
        }
    }, [visible]);

    useEffect(() => {
        if (visible) {
            setTab('resumen');
            loadAll();
        }
    }, [visible, loadAll]);

    const filteredClients = useMemo(() => {
        const q = clientQuery.trim().toLowerCase();
        if (!q) return (clients || []).slice(0, 12);
        return (clients || [])
            .filter((c) => {
                const name = `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase();
                const dni = String(c.dni || '').toLowerCase();
                const email = String(c.email || '').toLowerCase();
                return name.includes(q) || dni.includes(q) || email.includes(q);
            })
            .slice(0, 20);
    }, [clients, clientQuery]);

    const cartItems = useMemo(
        () =>
            packages
                .filter((p) => selectedPkgIds[p._id])
                .map((p) => ({ pkg: p, quantity: selectedPkgIds[p._id] })),
        [packages, selectedPkgIds]
    );

    const catalogSubtotal = useMemo(
        () => cartItems.reduce((s, e) => s + Number(e.pkg.price) * e.quantity, 0),
        [cartItems]
    );

    const activeDiscounts = useMemo(
        () => discounts.filter((d) => d.isActive),
        [discounts]
    );

    const previewDiscount = useMemo(() => {
        if (selectedDiscountId) {
            const d = discounts.find((x) => x._id === selectedDiscountId);
            if (!d) return 0;
            if (d.type === 'percent') return Math.min(catalogSubtotal, (catalogSubtotal * Number(d.value)) / 100);
            return Math.min(catalogSubtotal, Number(d.value) || 0);
        }
        if (adhocPercent) {
            const pct = Math.min(100, Math.max(0, Number(adhocPercent) || 0));
            return Math.min(catalogSubtotal, (catalogSubtotal * pct) / 100);
        }
        return 0;
    }, [selectedDiscountId, adhocPercent, discounts, catalogSubtotal]);

    const totalToCharge = Math.max(
        0,
        catalogSubtotal - previewDiscount + (Number(freeAmount) || 0)
    );

    const togglePackage = (pkgId) => {
        setSelectedPkgIds((prev) => {
            const next = { ...prev };
            if (next[pkgId]) delete next[pkgId];
            else next[pkgId] = 1;
            return next;
        });
    };

    const resetSaleForm = () => {
        setSelectedClient(null);
        setClientQuery('');
        setSelectedPkgIds({});
        setFreeAmount('');
        setMethod('efectivo');
        setSelectedDiscountId(null);
        setAdhocPercent('');
    };

    const handleSale = async () => {
        if (!selectedClient?._id) {
            showAlert('Falta cliente', 'Seleccioná un cliente para la venta.');
            return;
        }
        if (cartItems.length === 0 && !(Number(freeAmount) > 0)) {
            showAlert('Falta producto', 'Elegí un paquete o un monto libre.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                userId: selectedClient._id,
                items: cartItems.map((e) => ({ packageId: e.pkg._id, quantity: e.quantity })),
                freeAmount: Number(freeAmount) || 0,
                method,
            };
            if (selectedDiscountId) payload.discountId = selectedDiscountId;
            else if (adhocPercent) payload.discountPercent = Number(adhocPercent);

            const res = await apiClient.post('/caja/sale', payload);
            showAlert('Venta OK', res.data.message + (res.data.benefitMessage ? `\n${res.data.benefitMessage}` : ''));
            resetSaleForm();
            await loadAll();
            onRefresh?.();
            setTab('resumen');
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo registrar la venta.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleProcessTicket = async (ticketId, action) => {
        setSubmitting(true);
        try {
            await apiClient.put(`/payments/ticket/${ticketId}/process`, { action });
            showAlert('Listo', action === 'approve' ? 'Pago aprobado.' : 'Pago rechazado.');
            await loadAll();
            onRefresh?.();
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo procesar el ticket.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleProcessStore = async (orderId, action) => {
        setSubmitting(true);
        try {
            await apiClient.put(`/store/orders/${orderId}/process`, { action });
            showAlert('Listo', action === 'approve' || action === 'paid' ? 'Pedido aprobado.' : 'Pedido rechazado.');
            await loadAll();
            onRefresh?.();
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo procesar el pedido.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateDiscount = async () => {
        if (!newDiscount.name || !newDiscount.value) {
            showAlert('Datos incompletos', 'Completá nombre y valor del descuento.');
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.post('/caja/discounts', {
                name: newDiscount.name,
                type: newDiscount.type,
                value: Number(newDiscount.value),
            });
            setNewDiscount({ name: '', type: 'percent', value: '' });
            await loadAll();
            showAlert('Éxito', 'Descuento creado.');
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo crear el descuento.');
        } finally {
            setSubmitting(false);
        }
    };

    const toggleDiscountActive = async (d) => {
        try {
            if (d.isActive) await apiClient.delete(`/caja/discounts/${d._id}`);
            else await apiClient.put(`/caja/discounts/${d._id}`, { isActive: true });
            await loadAll();
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo actualizar.');
        }
    };

    if (!visible) return null;

    const currency = dashboard?.currency || 'ARS';
    const pendingCount =
        (dashboard?.pending?.transfers?.count || 0) +
        (dashboard?.pending?.mercadopago?.count || 0) +
        (dashboard?.pending?.store?.count || 0);

    const renderResumen = () => (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.kpiGrid}>
                <View style={[styles.kpiCard, { borderColor: accent }]}>
                    <Text style={styles.kpiLabel}>Período</Text>
                    <Text style={styles.kpiValue}>{money(dashboard?.totals?.range, currency)}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Hoy</Text>
                    <Text style={styles.kpiValue}>{money(dashboard?.totals?.today, currency)}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Mes</Text>
                    <Text style={styles.kpiValue}>{money(dashboard?.totals?.month, currency)}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Pendiente</Text>
                    <Text style={[styles.kpiValue, { color: '#e67e22' }]}>
                        {money(
                            (dashboard?.pending?.transfers?.amount || 0) +
                                (dashboard?.pending?.mercadopago?.amount || 0) +
                                (dashboard?.pending?.store?.amount || 0),
                            currency
                        )}
                    </Text>
                    <Text style={styles.kpiHint}>{pendingCount} pendientes</Text>
                </View>
                <View style={[styles.kpiCard, styles.kpiWide]}>
                    <Text style={styles.kpiLabel}>Deuda clientes</Text>
                    <Text style={[styles.kpiValue, { color: '#e74c3c' }]}>
                        {money(dashboard?.debt?.totalDebt, currency)}
                    </Text>
                    <Text style={styles.kpiHint}>{dashboard?.debt?.debtorCount || 0} deudores</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Por método</Text>
            <View style={styles.rowWrap}>
                {Object.entries(dashboard?.byMethod || {}).map(([k, v]) => (
                    <View key={k} style={styles.chip}>
                        <Text style={styles.chipLabel}>{k}</Text>
                        <Text style={styles.chipValue}>{money(v, currency)}</Text>
                    </View>
                ))}
            </View>

            <Text style={styles.sectionTitle}>Últimos movimientos</Text>
            {(dashboard?.movements || []).length === 0 ? (
                <Text style={styles.empty}>Sin movimientos en el período.</Text>
            ) : (
                (dashboard?.movements || []).slice(0, 40).map((m) => (
                    <View key={m._id} style={styles.movementRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.movementClient}>{m.clientName}</Text>
                            <Text style={styles.movementDesc} numberOfLines={2}>{m.description}</Text>
                            <Text style={styles.movementMeta}>
                                {format(new Date(m.date), "d MMM · HH:mm", { locale: es })}
                                {' · '}
                                {m.method || 'manual'}
                                {m.discountAmount > 0 ? ` · dto $${m.discountAmount}` : ''}
                            </Text>
                        </View>
                        <Text style={styles.movementAmount}>{money(m.amount, currency)}</Text>
                    </View>
                ))
            )}

            {(dashboard?.recentMercadoPago || []).length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Mercado Pago recientes</Text>
                    {dashboard.recentMercadoPago.map((m) => (
                        <View key={m._id} style={styles.movementRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.movementClient}>{m.clientName}</Text>
                                <Text style={styles.movementMeta}>
                                    {m.date ? format(new Date(m.date), "d MMM · HH:mm", { locale: es }) : '—'}
                                    {' · '}
                                    {m.status}
                                </Text>
                            </View>
                            <Text style={styles.movementAmount}>{money(m.amount, currency)}</Text>
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    const renderVenta = () => (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Cliente</Text>
            {selectedClient ? (
                <View style={styles.selectedClient}>
                    <Text style={styles.selectedClientName}>
                        {selectedClient.nombre} {selectedClient.apellido}
                    </Text>
                    <Text style={styles.kpiHint}>Saldo: {money(selectedClient.balance)}</Text>
                    <TouchableOpacity onPress={() => setSelectedClient(null)}>
                        <Text style={{ color: accent, fontWeight: '700' }}>Cambiar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <TextInput
                        style={styles.input}
                        placeholder="Buscar por nombre, DNI o email..."
                        placeholderTextColor={colors.icon}
                        value={clientQuery}
                        onChangeText={setClientQuery}
                    />
                    {filteredClients.map((c) => (
                        <TouchableOpacity
                            key={c._id}
                            style={styles.listItem}
                            onPress={() => setSelectedClient(c)}
                        >
                            <Text style={styles.listItemTitle}>
                                {c.nombre} {c.apellido}
                            </Text>
                            <Text style={styles.kpiHint}>{c.dni || c.email}</Text>
                        </TouchableOpacity>
                    ))}
                </>
            )}

            <Text style={styles.sectionTitle}>Paquetes</Text>
            {packages.map((p) => {
                const selected = !!selectedPkgIds[p._id];
                return (
                    <TouchableOpacity
                        key={p._id}
                        style={[styles.listItem, selected && { borderColor: accent, borderWidth: 2 }]}
                        onPress={() => togglePackage(p._id)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listItemTitle}>{p.name}</Text>
                            <Text style={styles.kpiHint}>
                                {money(p.price)}
                                {p.creditsAmount ? ` · ${p.creditsAmount} créditos` : ''}
                                {p.isPaseLibre ? ' · Pase libre' : ''}
                                {p.isMembresia ? ' · Membresía' : ''}
                            </Text>
                        </View>
                        <Ionicons
                            name={selected ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={selected ? accent : colors.icon}
                        />
                    </TouchableOpacity>
                );
            })}

            <Text style={styles.sectionTitle}>Abono libre (deuda / extra)</Text>
            <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.icon}
                value={freeAmount}
                onChangeText={setFreeAmount}
            />

            <Text style={styles.sectionTitle}>Descuento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <TouchableOpacity
                    style={[styles.filterChip, !selectedDiscountId && { backgroundColor: accent }]}
                    onPress={() => { setSelectedDiscountId(null); }}
                >
                    <Text style={[styles.filterChipText, !selectedDiscountId && { color: '#fff' }]}>Ninguno</Text>
                </TouchableOpacity>
                {activeDiscounts.map((d) => (
                    <TouchableOpacity
                        key={d._id}
                        style={[styles.filterChip, selectedDiscountId === d._id && { backgroundColor: accent }]}
                        onPress={() => { setSelectedDiscountId(d._id); setAdhocPercent(''); }}
                    >
                        <Text style={[styles.filterChipText, selectedDiscountId === d._id && { color: '#fff' }]}>
                            {d.name} ({d.type === 'percent' ? `${d.value}%` : money(d.value)})
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {!selectedDiscountId && (
                <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="% descuento ad-hoc (opcional)"
                    placeholderTextColor={colors.icon}
                    value={adhocPercent}
                    onChangeText={setAdhocPercent}
                />
            )}

            <Text style={styles.sectionTitle}>Método de pago</Text>
            <View style={styles.rowWrap}>
                {METHODS.map((m) => (
                    <TouchableOpacity
                        key={m.id}
                        style={[styles.filterChip, method === m.id && { backgroundColor: accent }]}
                        onPress={() => setMethod(m.id)}
                    >
                        <Text style={[styles.filterChipText, method === m.id && { color: '#fff' }]}>{m.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.totalBox}>
                <Text style={styles.kpiHint}>
                    Subtotal paquetes {money(catalogSubtotal)}
                    {previewDiscount > 0 ? ` − dto ${money(previewDiscount)}` : ''}
                    {Number(freeAmount) > 0 ? ` + abono ${money(freeAmount)}` : ''}
                </Text>
                <Text style={styles.totalValue}>Total: {money(totalToCharge)}</Text>
            </View>

            <TouchableOpacity
                style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSale}
                disabled={submitting}
            >
                {submitting ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.primaryBtnText}>Confirmar venta</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );

    const renderTicketCard = (item, kind) => {
        const items = Array.isArray(item.items) ? item.items.filter((i) => i.package) : [];
        let label = 'Abono / monto libre';
        if (items.length > 0) {
            label = items.map((i) => {
                const name = i.package?.name || 'Paquete';
                return i.quantity > 1 ? `${name} x${i.quantity}` : name;
            }).join(', ');
        } else if (item.package?.name) {
            label = item.package.name;
        }
        return (
            <View key={item._id} style={styles.pendingCard}>
                <Text style={styles.listItemTitle}>
                    {item.user?.nombre} {item.user?.apellido}
                </Text>
                <Text style={styles.kpiHint}>{label}</Text>
                <Text style={styles.movementAmount}>{money(item.amountTransferred)}</Text>
                <Text style={styles.kpiHint}>
                    {item.method || kind} · {format(new Date(item.createdAt), "d MMM HH:mm", { locale: es })}
                </Text>
                {kind !== 'store' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.secondaryBtn, { borderColor: '#e74c3c' }]}
                            onPress={() => handleProcessTicket(item._id, 'reject')}
                            disabled={submitting}
                        >
                            <Text style={{ color: '#e74c3c', fontWeight: '700' }}>Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]}
                            onPress={() => handleProcessTicket(item._id, 'approve')}
                            disabled={submitting}
                        >
                            <Text style={styles.primaryBtnText}>Aprobar</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {kind === 'store' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.secondaryBtn, { borderColor: '#e74c3c' }]}
                            onPress={() => handleProcessStore(item._id, 'reject')}
                            disabled={submitting}
                        >
                            <Text style={{ color: '#e74c3c', fontWeight: '700' }}>Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]}
                            onPress={() => handleProcessStore(item._id, 'approve')}
                            disabled={submitting}
                        >
                            <Text style={styles.primaryBtnText}>Aprobar</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderPendientes = () => (
        <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionTitle}>
                Transferencias ({dashboard?.pending?.transfers?.count || 0})
            </Text>
            {(dashboard?.pending?.transfers?.items || []).length === 0 ? (
                <Text style={styles.empty}>No hay transferencias pendientes.</Text>
            ) : (
                dashboard.pending.transfers.items.map((t) => renderTicketCard(t, 'transfer'))
            )}

            <Text style={styles.sectionTitle}>
                Mercado Pago pendientes ({dashboard?.pending?.mercadopago?.count || 0})
            </Text>
            {(dashboard?.pending?.mercadopago?.items || []).length === 0 ? (
                <Text style={styles.empty}>
                    {dashboard?.mercadoPagoLinked
                        ? 'No hay pagos MP pendientes.'
                        : 'Mercado Pago no está vinculado.'}
                </Text>
            ) : (
                dashboard.pending.mercadopago.items.map((t) => renderTicketCard(t, 'mp'))
            )}

            <Text style={styles.sectionTitle}>
                Tienda ({dashboard?.pending?.store?.count || 0})
            </Text>
            {(dashboard?.pending?.store?.items || []).length === 0 ? (
                <Text style={styles.empty}>No hay pedidos de tienda pendientes.</Text>
            ) : (
                dashboard.pending.store.items.map((t) => renderTicketCard(t, 'store'))
            )}
        </ScrollView>
    );

    const renderDescuentos = () => (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Crear descuento</Text>
            <TextInput
                style={styles.input}
                placeholder="Nombre (ej: Promo 20%)"
                placeholderTextColor={colors.icon}
                value={newDiscount.name}
                onChangeText={(t) => setNewDiscount((p) => ({ ...p, name: t }))}
            />
            <View style={styles.rowWrap}>
                {['percent', 'fixed'].map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.filterChip, newDiscount.type === t && { backgroundColor: accent }]}
                        onPress={() => setNewDiscount((p) => ({ ...p, type: t }))}
                    >
                        <Text style={[styles.filterChipText, newDiscount.type === t && { color: '#fff' }]}>
                            {t === 'percent' ? 'Porcentaje' : 'Monto fijo'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder={newDiscount.type === 'percent' ? 'Porcentaje' : 'Monto'}
                placeholderTextColor={colors.icon}
                value={newDiscount.value}
                onChangeText={(t) => setNewDiscount((p) => ({ ...p, value: t }))}
            />
            <TouchableOpacity
                style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreateDiscount}
                disabled={submitting}
            >
                <Text style={styles.primaryBtnText}>Guardar descuento</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Descuentos guardados</Text>
            {discounts.length === 0 ? (
                <Text style={styles.empty}>Todavía no hay descuentos.</Text>
            ) : (
                discounts.map((d) => (
                    <View key={d._id} style={styles.listItem}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listItemTitle}>{d.name}</Text>
                            <Text style={styles.kpiHint}>
                                {d.type === 'percent' ? `${d.value}%` : money(d.value)}
                                {' · '}
                                {d.isActive ? 'Activo' : 'Inactivo'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => toggleDiscountActive(d)}>
                            <Text style={{ color: accent, fontWeight: '700' }}>
                                {d.isActive ? 'Desactivar' : 'Activar'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </ScrollView>
    );

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.root, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { backgroundColor: accent }]}>
                    <View>
                        <Text style={styles.headerKicker}>Finanzas del gimnasio</Text>
                        <Text style={styles.headerTitle}>Caja</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={12}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.tabBar}>
                    {TABS.map((t) => {
                        const selected = tab === t.id;
                        const badge = t.id === 'pendientes' && pendingCount > 0 ? pendingCount : null;
                        return (
                            <TouchableOpacity
                                key={t.id}
                                style={[styles.tabBtn, selected && { backgroundColor: accent }]}
                                onPress={() => setTab(t.id)}
                            >
                                <Ionicons name={t.icon} size={14} color={selected ? '#fff' : colors.text} />
                                <Text style={[styles.tabText, selected && { color: '#fff' }]} numberOfLines={1}>
                                    {t.label}
                                    {badge != null ? ` (${badge})` : ''}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {loading && !dashboard ? (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color={accent} />
                    </View>
                ) : (
                    <>
                        {tab === 'resumen' && renderResumen()}
                        {tab === 'venta' && renderVenta()}
                        {tab === 'pendientes' && renderPendientes()}
                        {tab === 'descuentos' && renderDescuentos()}
                    </>
                )}

                <CustomAlert
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
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    return StyleSheet.create({
        root: { flex: 1, paddingTop: Platform.OS === 'ios' ? 48 : 24 },
        header: {
            marginHorizontal: 12,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        headerKicker: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
        headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
        tabBar: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
        tabBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: colors.cardBackground || colors.background,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
        },
        tabText: { fontSize: 12, fontWeight: '700', color: colors.text, maxWidth: 100 },
        scroll: { padding: 14, paddingBottom: 40 },
        loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
        kpiCard: {
            width: '48%',
            backgroundColor: colors.cardBackground || colors.background,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border || '#e5e5e5',
        },
        kpiWide: { width: '100%' },
        kpiLabel: { fontSize: 12, color: colors.icon, fontWeight: '600' },
        kpiValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
        kpiHint: { fontSize: 12, color: colors.icon, marginTop: 2 },
        sectionTitle: {
            fontSize: 15,
            fontWeight: '800',
            color: colors.text,
            marginTop: 14,
            marginBottom: 8,
        },
        rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        chip: {
            backgroundColor: colors.cardBackground || colors.background,
            borderRadius: 10,
            padding: 10,
            borderWidth: 1,
            borderColor: colors.border || '#e5e5e5',
            minWidth: '45%',
        },
        chipLabel: { fontSize: 11, color: colors.icon, textTransform: 'capitalize' },
        chipValue: { fontSize: 14, fontWeight: '700', color: colors.text },
        movementRow: {
            flexDirection: 'row',
            gap: 10,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border || '#ddd',
        },
        movementClient: { fontWeight: '700', color: colors.text },
        movementDesc: { color: colors.text, fontSize: 13, marginTop: 2 },
        movementMeta: { color: colors.icon, fontSize: 11, marginTop: 2 },
        movementAmount: { fontWeight: '800', color: '#1e7e34', fontSize: 15 },
        empty: { color: colors.icon, fontStyle: 'italic', marginBottom: 8 },
        input: {
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: colors.text,
            marginBottom: 8,
            backgroundColor: colors.cardBackground || colors.background,
        },
        listItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            marginBottom: 8,
            backgroundColor: colors.cardBackground || colors.background,
        },
        listItemTitle: { fontWeight: '700', color: colors.text },
        selectedClient: {
            padding: 12,
            borderRadius: 10,
            backgroundColor: colors.cardBackground || colors.background,
            borderWidth: 1,
            borderColor: accent,
            marginBottom: 8,
            gap: 4,
        },
        selectedClientName: { fontWeight: '800', fontSize: 16, color: colors.text },
        filterChip: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            marginRight: 6,
            marginBottom: 6,
        },
        filterChipText: { fontWeight: '700', fontSize: 12, color: colors.text },
        totalBox: {
            marginTop: 12,
            padding: 14,
            borderRadius: 12,
            backgroundColor: colors.cardBackground || colors.background,
            borderWidth: 1,
            borderColor: accent,
        },
        totalValue: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
        primaryBtn: {
            marginTop: 14,
            backgroundColor: accent,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
        },
        primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
        secondaryBtn: {
            flex: 1,
            borderWidth: 1.5,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
        },
        actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
        pendingCard: {
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            marginBottom: 10,
            backgroundColor: colors.cardBackground || colors.background,
            gap: 4,
        },
    });
};

export default CajaModal;
