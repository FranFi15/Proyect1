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
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/services/apiClient';
import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';

const TABS = [
    { id: 'resumen', label: 'Resumen', icon: 'stats-chart-outline' },
    { id: 'venta', label: 'Venta', icon: 'cart-outline' },
    { id: 'pendientes', label: 'Pendientes', icon: 'time-outline' },
    { id: 'descuentos', label: 'Descuentos', icon: 'pricetag-outline' },
];

const METHODS = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transfer', label: 'Transferencia' },
    { id: 'mercadopago', label: 'Mercado Pago' },
];

const PACKAGE_TYPE_FILTERS = [
    { id: 'credits', label: 'Créditos' },
    { id: 'pase', label: 'Acceso libre' },
    { id: 'membresia', label: 'Membresía' },
];

const SALE_MODE_FILTERS = [
    { id: 'paquete', label: 'Paquete' },
    { id: 'abono', label: 'Abono / a favor' },
    { id: 'gasto', label: 'Gasto' },
];

const GASTO_CATEGORIES = [
    { id: 'alquiler', label: 'Alquiler' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'sueldos', label: 'Sueldos' },
    { id: 'insumos', label: 'Insumos' },
    { id: 'mantenimiento', label: 'Mantenimiento' },
    { id: 'impuestos', label: 'Impuestos' },
    { id: 'otros', label: 'Otros' },
];

const CLIENT_PREVIEW_COUNT = 5;

const toFilterOptions = (items) =>
    (items || []).map((i) => ({
        _id: i.id || i._id,
        nombre: i.label || i.nombre || String(i.id || i._id),
    }));

const money = (n, currency = 'ARS') =>
    `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const FilterButton = ({ label, onPress, styles, accent, colors }) => (
    <TouchableOpacity style={styles.filterButton} onPress={onPress} activeOpacity={0.85}>
        <Ionicons name="pricetag-outline" size={14} color={accent} />
        <Text style={styles.filterButtonText} numberOfLines={1}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.icon} />
    </TouchableOpacity>
);

const CajaModal = ({ visible, onClose, clients = [], onRefresh }) => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const colors = Colors[colorScheme];
    const styles = useMemo(() => getStyles(colorScheme, accent), [colorScheme, accent]);

    const [tab, setTab] = useState('resumen');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [dashboard, setDashboard] = useState(null);
    const [packages, setPackages] = useState([]);
    const [discounts, setDiscounts] = useState([]);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    // Sale form
    const [clientQuery, setClientQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedPkgIds, setSelectedPkgIds] = useState({}); // id -> qty
    const [saleMode, setSaleMode] = useState('paquete'); // paquete | abono
    const [packageTypeFilter, setPackageTypeFilter] = useState('credits'); // credits | pase | membresia
    const [creditTypeFilter, setCreditTypeFilter] = useState('all');
    const [freeAmount, setFreeAmount] = useState('');
    const [freePaymentName, setFreePaymentName] = useState('');
    const [gastoName, setGastoName] = useState('');
    const [gastoAmount, setGastoAmount] = useState('');
    const [gastoCategory, setGastoCategory] = useState('otros');
    const [gastoCategoryFilter, setGastoCategoryFilter] = useState('all');
    const [method, setMethod] = useState('efectivo');
    const [selectedDiscountId, setSelectedDiscountId] = useState(null);
    const [adhocPercent, setAdhocPercent] = useState('');
    const [activeFilter, setActiveFilter] = useState(null); // which FilterModal is open

    // Discount form
    const [newDiscount, setNewDiscount] = useState({ name: '', type: 'percent', value: '' });
    const [editingDiscountId, setEditingDiscountId] = useState(null);

    useEffect(() => {
        if (!visible) setActiveFilter(null);
    }, [visible]);

    const showAlert = (title, message) => {
        setAlertInfo({
            visible: true,
            title,
            message,
            buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
        });
    };

    const loadAll = useCallback(async ({ silent = false } = {}) => {
        if (!visible) return;
        if (!silent) setLoading(true);
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
            if (!silent) setLoading(false);
        }
    }, [visible]);

    const handlePullRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadAll({ silent: true });
            onRefresh?.();
        } finally {
            setRefreshing(false);
        }
    }, [loadAll, onRefresh]);

    useEffect(() => {
        if (visible) {
            setTab('resumen');
            loadAll();
        }
    }, [visible, loadAll]);

    const refreshControl = (
        <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            tintColor={accent}
            colors={[accent]}
        />
    );

    const filteredClients = useMemo(() => {
        const q = clientQuery.trim().toLowerCase();
        const list = clients || [];
        if (!q) return list.slice(0, CLIENT_PREVIEW_COUNT);
        return list
            .filter((c) => {
                const name = `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase();
                const dni = String(c.dni || '').toLowerCase();
                const email = String(c.email || '').toLowerCase();
                return name.includes(q) || dni.includes(q) || email.includes(q);
            })
            .slice(0, 12);
    }, [clients, clientQuery]);

    const creditTypeOptions = useMemo(() => {
        const map = new Map();
        (packages || []).forEach((p) => {
            if (p.isPaseLibre || p.isMembresia) return;
            const id = p.tipoClase?._id || p.tipoClase || 'sin_tipo';
            const nombre = p.tipoClase?.nombre || 'Sin tipo';
            if (!map.has(String(id))) map.set(String(id), { _id: String(id), nombre });
        });
        return [{ _id: 'all', nombre: 'Todos los créditos' }, ...Array.from(map.values())];
    }, [packages]);

    const filteredPackages = useMemo(() => {
        return (packages || []).filter((p) => {
            if (packageTypeFilter === 'pase') return !!p.isPaseLibre;
            if (packageTypeFilter === 'membresia') return !!p.isMembresia;
            // credits
            if (p.isPaseLibre || p.isMembresia) return false;
            if (creditTypeFilter === 'all') return true;
            const tipoId = String(p.tipoClase?._id || p.tipoClase || 'sin_tipo');
            return tipoId === creditTypeFilter;
        });
    }, [packages, packageTypeFilter, creditTypeFilter]);

    const cartItems = useMemo(
        () =>
            filteredPackages
                .filter((p) => selectedPkgIds[p._id])
                .map((p) => ({ pkg: p, quantity: selectedPkgIds[p._id] })),
        [filteredPackages, selectedPkgIds]
    );

    const catalogSubtotal = useMemo(
        () => cartItems.reduce((s, e) => s + Number(e.pkg.price) * e.quantity, 0),
        [cartItems]
    );

    const activeDiscounts = useMemo(
        () => discounts.filter((d) => d.isActive),
        [discounts]
    );

    const creditTypeLabel = creditTypeOptions.find((o) => o._id === creditTypeFilter)?.nombre || 'Créditos';
    const gastoCategoryLabel = GASTO_CATEGORIES.find((c) => c.id === gastoCategory)?.label || 'Categoría';
    const gastoFilterLabel = gastoCategoryFilter === 'all'
        ? 'Todos los gastos'
        : (GASTO_CATEGORIES.find((c) => c.id === gastoCategoryFilter)?.label || 'Gastos');
    const discountLabel = selectedDiscountId
        ? (activeDiscounts.find((d) => d._id === selectedDiscountId)?.name || 'Descuento')
        : 'Sin descuento';
    const discountTypeLabel = newDiscount.type === 'percent' ? 'Porcentaje' : 'Monto fijo';

    const applySaleMode = (id) => {
        setSaleMode(id);
        if (id === 'abono') {
            setSelectedPkgIds({});
            setSelectedDiscountId(null);
            setAdhocPercent('');
            setGastoName('');
            setGastoAmount('');
        } else if (id === 'gasto') {
            setSelectedClient(null);
            setSelectedPkgIds({});
            setFreeAmount('');
            setFreePaymentName('');
            setSelectedDiscountId(null);
            setAdhocPercent('');
        } else {
            setFreeAmount('');
            setFreePaymentName('');
            setGastoName('');
            setGastoAmount('');
        }
    };

    const activeFilterConfig = useMemo(() => {
        const pending =
            (dashboard?.pending?.transfers?.count || 0) +
            (dashboard?.pending?.mercadopago?.count || 0) +
            (dashboard?.pending?.store?.count || 0);

        switch (activeFilter) {
            case 'section':
                return {
                    title: 'Sección de caja',
                    options: [
                        { _id: 'resumen', nombre: 'Resumen' },
                        { _id: 'venta', nombre: 'Venta / Gasto' },
                        {
                            _id: 'pendientes',
                            nombre: pending > 0 ? `Pendientes (${pending})` : 'Pendientes',
                        },
                        { _id: 'descuentos', nombre: 'Descuentos' },
                    ],
                    selectedValue: tab,
                    onSelect: (id) => { setTab(id); setActiveFilter(null); },
                };
            case 'creditType':
                return {
                    title: 'Tipo de crédito',
                    options: creditTypeOptions,
                    selectedValue: creditTypeFilter,
                    onSelect: (id) => {
                        setCreditTypeFilter(id);
                        setSelectedPkgIds({});
                        setActiveFilter(null);
                    },
                };
            case 'discount':
                return {
                    title: 'Descuento',
                    options: [
                        { _id: 'none', nombre: 'Sin descuento' },
                        ...activeDiscounts.map((d) => ({
                            _id: d._id,
                            nombre: `${d.name} (${d.type === 'percent' ? `${d.value}%` : money(d.value)})`,
                        })),
                    ],
                    selectedValue: selectedDiscountId || 'none',
                    onSelect: (id) => {
                        if (id === 'none') {
                            setSelectedDiscountId(null);
                        } else {
                            setSelectedDiscountId(id);
                            setAdhocPercent('');
                        }
                        setActiveFilter(null);
                    },
                };
            case 'gastoCategory':
                return {
                    title: 'Categoría de gasto',
                    options: toFilterOptions(GASTO_CATEGORIES),
                    selectedValue: gastoCategory,
                    onSelect: (id) => { setGastoCategory(id); setActiveFilter(null); },
                };
            case 'gastoCategoryFilter':
                return {
                    title: 'Filtrar gastos',
                    options: [
                        { _id: 'all', nombre: 'Todos los gastos' },
                        ...toFilterOptions(GASTO_CATEGORIES),
                    ],
                    selectedValue: gastoCategoryFilter,
                    onSelect: (id) => { setGastoCategoryFilter(id); setActiveFilter(null); },
                };
            case 'discountType':
                return {
                    title: 'Tipo de descuento',
                    options: [
                        { _id: 'percent', nombre: 'Porcentaje' },
                        { _id: 'fixed', nombre: 'Monto fijo' },
                    ],
                    selectedValue: newDiscount.type,
                    onSelect: (id) => {
                        setNewDiscount((p) => ({ ...p, type: id }));
                        setActiveFilter(null);
                    },
                };
            default:
                return null;
        }
    }, [
        activeFilter,
        tab,
        dashboard?.pending,
        creditTypeFilter,
        creditTypeOptions,
        activeDiscounts,
        selectedDiscountId,
        gastoCategory,
        gastoCategoryFilter,
        newDiscount.type,
    ]);

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
        saleMode === 'abono'
            ? (Number(freeAmount) || 0)
            : saleMode === 'gasto'
                ? (Number(gastoAmount) || 0)
                : catalogSubtotal - previewDiscount + (Number(freeAmount) || 0)
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
        setSaleMode('paquete');
        setPackageTypeFilter('credits');
        setCreditTypeFilter('all');
        setFreeAmount('');
        setFreePaymentName('');
        setGastoName('');
        setGastoAmount('');
        setGastoCategory('otros');
        setMethod('efectivo');
        setSelectedDiscountId(null);
        setAdhocPercent('');
    };

    const handleSale = async ({ payLater = false } = {}) => {
        if (saleMode === 'gasto') {
            if (!gastoName.trim()) {
                showAlert('Falta nombre', 'Poné un nombre para el gasto.');
                return;
            }
            if (!(Number(gastoAmount) > 0)) {
                showAlert('Falta monto', 'Ingresá el monto del gasto.');
                return;
            }
            setSubmitting(true);
            try {
                await apiClient.post('/caja/gastos', {
                    name: gastoName.trim(),
                    amount: Number(gastoAmount),
                    category: gastoCategory,
                    method,
                });
                showAlert('Gasto OK', 'Gasto registrado en caja.');
                resetSaleForm();
                await loadAll();
                onRefresh?.();
                setTab('resumen');
            } catch (error) {
                showAlert('Error', error.response?.data?.message || 'No se pudo registrar el gasto.');
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (!selectedClient?._id) {
            showAlert('Falta cliente', 'Seleccioná un cliente para la venta.');
            return;
        }

        if (saleMode === 'abono') {
            if (payLater) {
                showAlert('No disponible', 'Paga luego solo aplica a ventas de paquetes.');
                return;
            }
            if (!(Number(freeAmount) > 0)) {
                showAlert('Falta monto', 'Ingresá el monto del abono libre.');
                return;
            }
            if (!freePaymentName.trim()) {
                showAlert('Falta nombre', 'Poné un nombre para este abono (ej: Pago deuda marzo).');
                return;
            }
        } else if (cartItems.length === 0) {
            showAlert('Falta paquete', 'Elegí al menos un paquete.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                userId: selectedClient._id,
                items: saleMode === 'paquete'
                    ? cartItems.map((e) => ({ packageId: e.pkg._id, quantity: e.quantity }))
                    : [],
                freeAmount: payLater
                    ? 0
                    : ((saleMode === 'abono' || saleMode === 'paquete')
                        ? (Number(freeAmount) || 0)
                        : 0),
                method,
                payLater: Boolean(payLater),
            };
            if (saleMode === 'abono') {
                payload.description = freePaymentName.trim();
            } else if (saleMode === 'paquete' && Number(freeAmount) > 0 && !payLater) {
                payload.description = undefined;
            }
            if (saleMode === 'paquete') {
                if (selectedDiscountId) payload.discountId = selectedDiscountId;
                else if (adhocPercent) payload.discountPercent = Number(adhocPercent);
            }

            const res = await apiClient.post('/caja/sale', payload);
            const bal = Number(res.data.newBalance);
            let balMsg = '';
            if (Number.isFinite(bal)) {
                if (bal > 0) balMsg = `\nSaldo a favor: $${bal.toFixed(2)}`;
                else if (bal < 0) balMsg = `\nDeuda restante: $${Math.abs(bal).toFixed(2)}`;
                else balMsg = '\nSaldo: al día';
            }
            showAlert(
                payLater ? 'Deuda cargada' : 'Venta OK',
                (res.data.message || (payLater ? 'Deuda cargada al cliente.' : 'Venta registrada.'))
                    + (res.data.benefitMessage ? `\n${res.data.benefitMessage}` : '')
                    + balMsg
            );
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

    const confirmPayLater = () => {
        if (!selectedClient?._id) {
            showAlert('Falta cliente', 'Seleccioná un cliente para la venta.');
            return;
        }
        if (cartItems.length === 0) {
            showAlert('Falta paquete', 'Elegí al menos un paquete.');
            return;
        }
        setAlertInfo({
            visible: true,
            title: 'Paga luego',
            message: 'No se va a registrar un pago. Se va a cargar la deuda al cliente.',
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) },
                {
                    text: 'Cargar deuda',
                    style: 'primary',
                    onPress: () => {
                        setAlertInfo((p) => ({ ...p, visible: false }));
                        handleSale({ payLater: true });
                    },
                },
            ],
        });
    };

    const handleDeleteGasto = async (gastoId) => {
        setSubmitting(true);
        try {
            await apiClient.delete(`/caja/gastos/${gastoId}`);
            await loadAll();
            showAlert('Listo', 'Gasto eliminado.');
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo eliminar el gasto.');
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

    const resetDiscountForm = () => {
        setNewDiscount({ name: '', type: 'percent', value: '' });
        setEditingDiscountId(null);
    };

    const handleSaveDiscount = async () => {
        if (!newDiscount.name || !newDiscount.value) {
            showAlert('Datos incompletos', 'Completá nombre y valor del descuento.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                name: newDiscount.name,
                type: newDiscount.type,
                value: Number(newDiscount.value),
                isActive: true,
            };
            if (editingDiscountId) {
                await apiClient.put(`/caja/discounts/${editingDiscountId}`, payload);
                showAlert('Éxito', 'Descuento actualizado.');
            } else {
                await apiClient.post('/caja/discounts', payload);
                showAlert('Éxito', 'Descuento creado.');
            }
            resetDiscountForm();
            await loadAll();
        } catch (error) {
            showAlert('Error', error.response?.data?.message || 'No se pudo guardar el descuento.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditDiscount = (d) => {
        setEditingDiscountId(d._id);
        setNewDiscount({
            name: d.name || '',
            type: d.type || 'percent',
            value: String(d.value ?? ''),
        });
    };

    const handleDeleteDiscount = (d) => {
        setAlertInfo({
            visible: true,
            title: 'Eliminar descuento',
            message: `¿Eliminar "${d.name}"? Esta acción no se puede deshacer.`,
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setAlertInfo((p) => ({ ...p, visible: false }));
                        setSubmitting(true);
                        try {
                            await apiClient.delete(`/caja/discounts/${d._id}`);
                            if (editingDiscountId === d._id) resetDiscountForm();
                            if (selectedDiscountId === d._id) setSelectedDiscountId(null);
                            await loadAll();
                            showAlert('Listo', 'Descuento eliminado.');
                        } catch (error) {
                            showAlert('Error', error.response?.data?.message || 'No se pudo eliminar.');
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ],
        });
    };

    const currency = dashboard?.currency || 'ARS';
    const pendingCount =
        (dashboard?.pending?.transfers?.count || 0) +
        (dashboard?.pending?.mercadopago?.count || 0) +
        (dashboard?.pending?.store?.count || 0);

    const sectionLabel = (() => {
        if (tab === 'venta') return 'Venta / Gasto';
        if (tab === 'pendientes' && pendingCount > 0) return `Pendientes (${pendingCount})`;
        return TABS.find((t) => t.id === tab)?.label || 'Sección';
    })();

    if (!visible) return null;

    const renderResumen = () => {
        const filteredGastos = (dashboard?.gastos || []).filter((g) =>
            gastoCategoryFilter === 'all' ? true : g.category === gastoCategoryFilter
        );

        return (
        <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
        >
            <View style={styles.kpiGrid}>
                <View style={[styles.kpiCard, { borderColor: accent }]}>
                    <Text style={styles.kpiLabel}>Ingresos período</Text>
                    <Text style={styles.kpiValue}>{money(dashboard?.totals?.range, currency)}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Gastos período</Text>
                    <Text style={[styles.kpiValue, { color: '#e74c3c' }]}>
                        {money(dashboard?.totals?.gastosRange, currency)}
                    </Text>
                </View>
                <View style={[styles.kpiCard, styles.kpiWide]}>
                    <Text style={styles.kpiLabel}>Neto período</Text>
                    <Text style={[
                        styles.kpiValue,
                        { color: (dashboard?.totals?.netRange || 0) >= 0 ? '#1e7e34' : '#e74c3c' },
                    ]}>
                        {money(dashboard?.totals?.netRange, currency)}
                    </Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Hoy ingresos</Text>
                    <Text style={styles.kpiValue}>{money(dashboard?.totals?.today, currency)}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Hoy gastos</Text>
                    <Text style={[styles.kpiValue, { color: '#e74c3c' }]}>
                        {money(dashboard?.totals?.gastosToday, currency)}
                    </Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Mes ingresos</Text>
                    <Text style={styles.kpiValue}>{money(dashboard?.totals?.month, currency)}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Mes gastos</Text>
                    <Text style={[styles.kpiValue, { color: '#e74c3c' }]}>
                        {money(dashboard?.totals?.gastosMonth, currency)}
                    </Text>
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
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Deuda clientes</Text>
                    <Text style={[styles.kpiValue, { color: '#e74c3c' }]}>
                        {money(dashboard?.debt?.totalDebt, currency)}
                    </Text>
                    <Text style={styles.kpiHint}>{dashboard?.debt?.debtorCount || 0} deudores</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Saldo a favor</Text>
                    <Text style={[styles.kpiValue, { color: '#1a6fb5' }]}>
                        {money(dashboard?.credit?.totalCredit, currency)}
                    </Text>
                    <Text style={styles.kpiHint}>{dashboard?.credit?.creditCount || 0} clientes</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Por método (ingresos)</Text>
            <View style={styles.rowWrap}>
                {Object.entries(dashboard?.byMethod || {}).map(([k, v]) => (
                    <View key={k} style={styles.chip}>
                        <Text style={styles.chipLabel}>{k}</Text>
                        <Text style={styles.chipValue}>{money(v, currency)}</Text>
                    </View>
                ))}
            </View>

            <Text style={styles.sectionTitle}>Gastos por categoría</Text>
            <View style={styles.rowWrap}>
                {Object.keys(dashboard?.gastosByCategory || {}).length === 0 ? (
                    <Text style={styles.empty}>Sin gastos en el período.</Text>
                ) : (
                    Object.entries(dashboard.gastosByCategory).map(([k, v]) => (
                        <View key={k} style={styles.chip}>
                            <Text style={styles.chipLabel}>{k}</Text>
                            <Text style={[styles.chipValue, { color: '#e74c3c' }]}>{money(v, currency)}</Text>
                        </View>
                    ))
                )}
            </View>

            <Text style={styles.sectionTitle}>Filtro gastos</Text>
            <FilterButton
                label={gastoFilterLabel}
                onPress={() => setActiveFilter('gastoCategoryFilter')}
                styles={styles}
                accent={accent}
                colors={colors}
            />

            <Text style={styles.sectionTitle}>Gastos del período</Text>
            {filteredGastos.length === 0 ? (
                <Text style={styles.empty}>Sin gastos para este filtro.</Text>
            ) : (
                filteredGastos.slice(0, 40).map((g) => (
                    <View key={g._id} style={styles.movementRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.movementClient}>{g.name}</Text>
                            <Text style={styles.movementMeta}>
                                {format(new Date(g.date), "d MMM · HH:mm", { locale: es })}
                                {' · '}
                                {g.category}
                                {' · '}
                                {g.method}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={[styles.movementAmount, { color: '#e74c3c' }]}>
                                −{money(g.amount, currency)}
                            </Text>
                            <TouchableOpacity onPress={() => handleDeleteGasto(g._id)} disabled={submitting}>
                                <Text style={{ color: '#e74c3c', fontSize: 11, fontWeight: '700' }}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}

            <Text style={styles.sectionTitle}>Últimos ingresos</Text>
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
    };

    const renderVenta = () => (
        <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
        >
            <Text style={styles.sectionTitle}>Tipo de movimiento</Text>
            <View style={styles.rowWrap}>
                {SALE_MODE_FILTERS.map((m) => (
                    <TouchableOpacity
                        key={m.id}
                        style={[styles.filterPill, saleMode === m.id && { backgroundColor: accent, borderColor: accent }]}
                        onPress={() => applySaleMode(m.id)}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.filterPillText, saleMode === m.id && { color: '#fff' }]}>
                            {m.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {saleMode !== 'gasto' && (
                <>
                    <Text style={styles.sectionTitle}>Cliente</Text>
                    {selectedClient ? (
                        <View style={styles.selectedClient}>
                            <Text style={styles.selectedClientName}>
                                {selectedClient.nombre} {selectedClient.apellido}
                            </Text>
                            <Text style={styles.kpiHint}>
                                {Number(selectedClient.balance) < 0
                                    ? `Debe: ${money(Math.abs(selectedClient.balance))}`
                                    : Number(selectedClient.balance) > 0
                                        ? `A favor: ${money(selectedClient.balance)}`
                                        : 'Saldo: al día'}
                            </Text>
                            <TouchableOpacity onPress={() => setSelectedClient(null)}>
                                <Text style={{ color: accent, fontWeight: '700' }}>Cambiar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <TextInput
                                style={styles.input}
                                placeholder="Escribí para buscar cliente..."
                                placeholderTextColor={colors.icon}
                                value={clientQuery}
                                onChangeText={setClientQuery}
                            />
                            <Text style={styles.kpiHint}>
                                {clientQuery.trim()
                                    ? `${filteredClients.length} resultado(s)`
                                    : `Mostrando ${filteredClients.length} de ${(clients || []).length} — seguí escribiendo`}
                            </Text>
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
                            {clientQuery.trim() && filteredClients.length === 0 && (
                                <Text style={styles.empty}>Ningún cliente coincide con la búsqueda.</Text>
                            )}
                        </>
                    )}
                </>
            )}

            {saleMode === 'paquete' ? (
                <>
                    <Text style={styles.sectionTitle}>Tipo de paquete</Text>
                    <View style={styles.rowWrap}>
                        {PACKAGE_TYPE_FILTERS.map((f) => (
                            <TouchableOpacity
                                key={f.id}
                                style={[
                                    styles.filterPill,
                                    packageTypeFilter === f.id && { backgroundColor: accent, borderColor: accent },
                                ]}
                                onPress={() => {
                                    setPackageTypeFilter(f.id);
                                    setCreditTypeFilter('all');
                                    setSelectedPkgIds({});
                                }}
                                activeOpacity={0.85}
                            >
                                <Text style={[
                                    styles.filterPillText,
                                    packageTypeFilter === f.id && { color: '#fff' },
                                ]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {packageTypeFilter === 'credits' && (
                        <>
                            <Text style={styles.sectionTitle}>Tipo de crédito</Text>
                            <FilterButton
                                label={creditTypeLabel}
                                onPress={() => setActiveFilter('creditType')}
                                styles={styles}
                                accent={accent}
                                colors={colors}
                            />
                        </>
                    )}

                    <Text style={styles.sectionTitle}>Paquetes</Text>
                    {filteredPackages.length === 0 ? (
                        <Text style={styles.empty}>No hay paquetes para este filtro.</Text>
                    ) : (
                        filteredPackages.map((p) => {
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
                                            {p.tipoClase?.nombre ? ` · ${p.tipoClase.nombre}` : ''}
                                            {p.isPaseLibre ? ' · Acceso libre' : ''}
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
                        })
                    )}

                    <Text style={styles.sectionTitle}>Descuento</Text>
                    <FilterButton
                        label={discountLabel}
                        onPress={() => setActiveFilter('discount')}
                        styles={styles}
                        accent={accent}
                        colors={colors}
                    />
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

                    <Text style={styles.sectionTitle}>Monto extra (queda a favor)</Text>
                    <Text style={styles.kpiHint}>
                        Si el cliente paga de más, ese monto queda como saldo a favor.
                    </Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={freeAmount}
                        onChangeText={setFreeAmount}
                    />
                </>
            ) : saleMode === 'abono' ? (
                <>
                    <Text style={styles.sectionTitle}>Nombre del pago</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: Abono deuda, Pago adelantado, Saldo a favor..."
                        placeholderTextColor={colors.icon}
                        value={freePaymentName}
                        onChangeText={setFreePaymentName}
                    />
                    <Text style={styles.sectionTitle}>Monto</Text>
                    <Text style={styles.kpiHint}>
                        Podés cobrar más de la deuda: el excedente queda a favor del cliente.
                    </Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={freeAmount}
                        onChangeText={setFreeAmount}
                    />
                    {selectedClient && (
                        <View style={styles.totalBox}>
                            <Text style={styles.kpiHint}>Saldo actual</Text>
                            <Text style={styles.listItemTitle}>
                                {Number(selectedClient.balance) < 0
                                    ? `Debe ${money(Math.abs(selectedClient.balance))}`
                                    : Number(selectedClient.balance) > 0
                                        ? `A favor ${money(selectedClient.balance)}`
                                        : 'Al día ($0)'}
                            </Text>
                            {Number(freeAmount) > 0 && (
                                <>
                                    <Text style={[styles.kpiHint, { marginTop: 8 }]}>Saldo después del pago</Text>
                                    <Text style={[styles.listItemTitle, {
                                        color: (Number(selectedClient.balance || 0) + Number(freeAmount || 0)) > 0
                                            ? '#1a6fb5'
                                            : (Number(selectedClient.balance || 0) + Number(freeAmount || 0)) < 0
                                                ? '#e74c3c'
                                                : '#1e7e34',
                                    }]}>
                                        {(() => {
                                            const next = Number(selectedClient.balance || 0) + Number(freeAmount || 0);
                                            if (next < 0) return `Debe ${money(Math.abs(next))}`;
                                            if (next > 0) return `A favor ${money(next)}`;
                                            return 'Al día ($0)';
                                        })()}
                                    </Text>
                                </>
                            )}
                        </View>
                    )}
                </>
            ) : (
                <>
                    <Text style={styles.sectionTitle}>Nombre del gasto</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: Luz marzo, Alquiler local..."
                        placeholderTextColor={colors.icon}
                        value={gastoName}
                        onChangeText={setGastoName}
                    />
                    <Text style={styles.sectionTitle}>Categoría</Text>
                    <FilterButton
                        label={gastoCategoryLabel}
                        onPress={() => setActiveFilter('gastoCategory')}
                        styles={styles}
                        accent={accent}
                        colors={colors}
                    />
                    <Text style={styles.sectionTitle}>Monto</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.icon}
                        value={gastoAmount}
                        onChangeText={setGastoAmount}
                    />
                </>
            )}

            <Text style={styles.sectionTitle}>Método de pago</Text>
            <View style={styles.rowWrap}>
                {METHODS.map((m) => (
                    <TouchableOpacity
                        key={m.id}
                        style={[styles.filterPill, method === m.id && { backgroundColor: accent, borderColor: accent }]}
                        onPress={() => setMethod(m.id)}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.filterPillText, method === m.id && { color: '#fff' }]}>
                            {m.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.totalBox}>
                {saleMode === 'paquete' ? (
                    <Text style={styles.kpiHint}>
                        Subtotal {money(catalogSubtotal)}
                        {previewDiscount > 0 ? ` − dto ${money(previewDiscount)}` : ''}
                        {Number(freeAmount) > 0 ? ` + extra a favor ${money(freeAmount)}` : ''}
                    </Text>
                ) : saleMode === 'abono' ? (
                    <Text style={styles.kpiHint}>
                        {freePaymentName.trim() || 'Abono / a favor'} · {money(freeAmount)}
                    </Text>
                ) : (
                    <Text style={styles.kpiHint}>
                        {gastoName.trim() || 'Gasto'} · {gastoCategory} · {money(gastoAmount)}
                    </Text>
                )}
                <Text style={[
                    styles.totalValue,
                    saleMode === 'gasto' && { color: '#e74c3c' },
                ]}>
                    {saleMode === 'gasto' ? 'Gasto: ' : 'Total: '}{money(totalToCharge)}
                </Text>
            </View>

            {saleMode === 'paquete' ? (
                <View style={[styles.actionRow, { marginTop: 14 }]}>
                    <TouchableOpacity
                        style={[
                            styles.secondaryBtn,
                            { borderColor: accent },
                            submitting && { opacity: 0.6 },
                        ]}
                        onPress={confirmPayLater}
                        disabled={submitting}
                    >
                        <Text style={{ color: accent, fontWeight: '800', fontSize: 15 }}>
                            Paga luego
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.primaryBtn,
                            { flex: 1, marginTop: 0 },
                            submitting && { opacity: 0.6 },
                        ]}
                        onPress={() => handleSale()}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryBtnText}>Confirmar venta</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={[
                        styles.primaryBtn,
                        saleMode === 'gasto' && { backgroundColor: '#c0392b' },
                        submitting && { opacity: 0.6 },
                    ]}
                    onPress={() => handleSale()}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryBtnText}>
                            {saleMode === 'gasto' ? 'Registrar gasto' : 'Confirmar venta'}
                        </Text>
                    )}
                </TouchableOpacity>
            )}
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
        <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={refreshControl}
        >
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
        <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
        >
            <Text style={styles.sectionTitle}>
                {editingDiscountId ? 'Editar descuento' : 'Crear descuento'}
            </Text>
            <TextInput
                style={styles.input}
                placeholder="Nombre (ej: Promo 20%)"
                placeholderTextColor={colors.icon}
                value={newDiscount.name}
                onChangeText={(t) => setNewDiscount((p) => ({ ...p, name: t }))}
            />
            <Text style={styles.sectionTitle}>Tipo</Text>
            <FilterButton
                label={discountTypeLabel}
                onPress={() => setActiveFilter('discountType')}
                styles={styles}
                accent={accent}
                colors={colors}
            />
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
                onPress={handleSaveDiscount}
                disabled={submitting}
            >
                <Text style={styles.primaryBtnText}>
                    {editingDiscountId ? 'Guardar cambios' : 'Crear descuento'}
                </Text>
            </TouchableOpacity>
            {editingDiscountId && (
                <TouchableOpacity
                    style={[styles.secondaryBtn, { marginTop: 8, borderColor: colors.border || '#ddd' }]}
                    onPress={resetDiscountForm}
                >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Cancelar edición</Text>
                </TouchableOpacity>
            )}

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
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => handleEditDiscount(d)}>
                                <Text style={{ color: accent, fontWeight: '700' }}>Editar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteDiscount(d)} disabled={submitting}>
                                <Text style={{ color: '#e74c3c', fontWeight: '700' }}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
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

                <View style={styles.sectionFilterWrap}>
                    <FilterButton
                        label={sectionLabel}
                        onPress={() => setActiveFilter('section')}
                        styles={styles}
                        accent={accent}
                        colors={colors}
                    />
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

                {activeFilterConfig && (
                    <FilterModal
                        embedded
                        visible
                        onClose={() => setActiveFilter(null)}
                        onSelect={activeFilterConfig.onSelect}
                        title={activeFilterConfig.title}
                        options={activeFilterConfig.options}
                        selectedValue={activeFilterConfig.selectedValue}
                        theme={{ colors: Colors[colorScheme], gymColor: accent }}
                        gymColor={accent}
                    />
                )}
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
        sectionFilterWrap: {
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 4,
        },
        scroll: { padding: 14, paddingBottom: 40 },
        loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        kpiGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        kpiCard: {
            width: '48.5%',
            backgroundColor: colors.cardBackground || colors.background,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border || '#e5e5e5',
            marginBottom: 8,
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
        filterButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            backgroundColor: colors.cardBackground || colors.background,
            marginBottom: 10,
        },
        filterButtonText: {
            flex: 1,
            fontSize: 13,
            fontWeight: '700',
            color: colors.text,
        },
        filterPill: {
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            backgroundColor: colors.cardBackground || colors.background,
            marginRight: 6,
            marginBottom: 6,
        },
        filterPillText: {
            fontWeight: '700',
            fontSize: 12,
            color: colors.text,
        },
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
