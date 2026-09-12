import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    useColorScheme,
    ActivityIndicator,
    Switch,
    Image,
    Platform,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import CustomAlert from '@/components/CustomAlert';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';
import FilterModal from '@/components/FilterModal';

const STATUS_LABEL = {
    pending: 'Pendiente',
    paid: 'Confirmado',
    rejected: 'Rechazado',
    delivered: 'Entregado',
};

const emptyItemForm = () => ({
    name: '',
    price: '',
    optionRows: [{ name: '', amount: '0' }],
    isActive: true,
    imageUrl: '',
    imageAsset: null,
    clearImage: false,
});

const normalizeOptionRowsFromItem = (item) => {
    const raw = item?.options || [];
    if (!Array.isArray(raw) || raw.length === 0) {
        return [{ name: '', amount: String(item?.amount ?? 0) }];
    }
    return raw.map((entry) => {
        if (typeof entry === 'string') {
            return { name: entry, amount: '0' };
        }
        return {
            name: entry?.name || '',
            amount: String(entry?.amount ?? 0),
        };
    });
};

const formatOptionStockLabel = (item) => {
    const opts = (item?.options || [])
        .map((entry) => {
            if (typeof entry === 'string') return null;
            const name = entry?.name;
            if (!name) return null;
            return `${name}: ${Number(entry.amount) || 0}`;
        })
        .filter(Boolean);
    if (opts.length > 0) return opts.join(' · ');
    return `Stock ${item?.amount ?? 0}`;
};

const AdminStoreModal = ({ visible, onClose, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);

    const [tab, setTab] = useState('products'); // products | orders
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [items, setItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [orderFilter, setOrderFilter] = useState('pending');
    const [form, setForm] = useState(emptyItemForm());
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [receiptViewer, setReceiptViewer] = useState(null);
    const [orderFilterVisible, setOrderFilterVisible] = useState(false);

    const loadData = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const [itemsRes, ordersRes] = await Promise.all([
                apiClient.get('/store/items?all=1'),
                apiClient.get(`/store/orders?status=${orderFilter === 'all' ? 'all' : orderFilter}`),
            ]);
            setItems(itemsRes.data || []);
            setOrders(ordersRes.data || []);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo cargar la tienda.',
                buttons: [{ text: 'OK', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [orderFilter]);

    const onRefresh = useCallback(() => loadData({ silent: true }), [loadData]);

    // Reset to productos only when the modal opens — not when orderFilter/loadData changes.
    useEffect(() => {
        if (!visible) return undefined;
        setTab('products');
        loadData();
        return undefined;
        // intentionally omit loadData: including it re-ran this and kicked users off Pedidos
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    useEffect(() => {
        if (!visible) return undefined;
        loadData({ silent: true });
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderFilter]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyItemForm());
        setShowForm(true);
    };

    const openEdit = (item) => {
        setEditingId(item._id);
        setForm({
            ...emptyItemForm(),
            name: item.name || '',
            price: String(item.price ?? ''),
            optionRows: normalizeOptionRowsFromItem(item),
            isActive: item.isActive !== false,
            imageUrl: item.imageUrl || '',
            imageAsset: null,
            clearImage: false,
        });
        setShowForm(true);
    };

    const updateOptionRow = (index, field, value) => {
        setForm((prev) => {
            const rows = Array.isArray(prev.optionRows) ? prev.optionRows : [{ name: '', amount: '0' }];
            const optionRows = rows.map((row, i) =>
                i === index ? { ...row, [field]: value } : row
            );
            return { ...prev, optionRows };
        });
    };

    const bumpOptionAmount = (index, delta) => {
        setForm((prev) => {
            const rows = Array.isArray(prev.optionRows) ? prev.optionRows : [{ name: '', amount: '0' }];
            const optionRows = rows.map((row, i) => {
                if (i !== index) return row;
                const next = Math.max(0, (Number(row.amount) || 0) + delta);
                return { ...row, amount: String(next) };
            });
            return { ...prev, optionRows };
        });
    };

    const addOptionRow = () => {
        setForm((prev) => {
            const rows = Array.isArray(prev.optionRows) ? prev.optionRows : [];
            return {
                ...prev,
                optionRows: [...rows, { name: '', amount: '0' }],
            };
        });
    };

    const removeOptionRow = (index) => {
        setForm((prev) => {
            const rows = Array.isArray(prev.optionRows) ? prev.optionRows : [];
            const optionRows = rows.filter((_, i) => i !== index);
            return {
                ...prev,
                optionRows: optionRows.length > 0 ? optionRows : [{ name: '', amount: '0' }],
            };
        });
    };

    const pickItemImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlertInfo({
                visible: true,
                title: 'Permiso denegado',
                message: 'Necesitamos acceso a la galería para subir la foto del producto.',
                buttons: [{ text: 'OK', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
            });
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]) {
            setForm((p) => ({
                ...p,
                imageAsset: result.assets[0],
                clearImage: false,
            }));
        }
    };

    const removeItemImage = () => {
        setForm((p) => ({
            ...p,
            imageAsset: null,
            imageUrl: '',
            clearImage: true,
        }));
    };

    const handleSaveItem = async () => {
        if (!form.name.trim() || form.price === '') {
            setAlertInfo({
                visible: true,
                title: 'Faltan datos',
                message: 'Nombre y precio son obligatorios.',
                buttons: [{ text: 'OK', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
            });
            return;
        }
        const options = (form.optionRows || [])
            .map((row) => ({
                name: (row.name || '').trim(),
                amount: Math.max(0, Number(row.amount) || 0),
            }))
            .filter((row) => row.name);
        if (options.length === 0) {
            setAlertInfo({
                visible: true,
                title: 'Faltan opciones',
                message: 'Agregá al menos una opción con su stock.',
                buttons: [{ text: 'OK', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
            });
            return;
        }
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('name', form.name.trim());
            formData.append('price', String(Number(form.price)));
            formData.append('options', JSON.stringify(options));
            formData.append('isActive', form.isActive ? 'true' : 'false');
            if (form.clearImage && !form.imageAsset) {
                formData.append('clearImage', 'true');
            }

            if (form.imageAsset?.uri) {
                const uri = form.imageAsset.uri;
                let filename = form.imageAsset.fileName || uri.split('/').pop() || 'producto.jpg';
                if (!filename.includes('.')) filename = 'producto.jpg';
                if (Platform.OS === 'web') {
                    const response = await fetch(uri);
                    const blob = await response.blob();
                    formData.append('image', blob, filename);
                } else {
                    let mimeType = form.imageAsset.mimeType;
                    if (!mimeType) {
                        const match = /\.(\w+)$/.exec(filename);
                        mimeType = match ? `image/${match[1]}` : 'image/jpeg';
                    }
                    if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
                    formData.append('image', {
                        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
                        name: filename,
                        type: mimeType,
                    });
                }
            }

            const headers = { Accept: 'application/json' };
            if (Platform.OS !== 'web') headers['Content-Type'] = 'multipart/form-data';

            if (editingId) {
                await apiClient.put(`/store/items/${editingId}`, formData, { headers });
            } else {
                await apiClient.post('/store/items', formData, { headers });
            }
            setShowForm(false);
            await loadData();
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo guardar.',
                buttons: [{ text: 'OK', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = (item) => {
        setAlertInfo({
            visible: true,
            title: 'Desactivar producto',
            message: `¿Ocultar "${item.name}" de la tienda?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) },
                {
                    text: 'Desactivar',
                    style: 'destructive',
                    onPress: async () => {
                        setAlertInfo((p) => ({ ...p, visible: false }));
                        try {
                            await apiClient.delete(`/store/items/${item._id}`);
                            await loadData();
                        } catch (error) {
                            setAlertInfo({
                                visible: true,
                                title: 'Error',
                                message: error.response?.data?.message || 'No se pudo desactivar.',
                                buttons: [{ text: 'OK', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
                            });
                        }
                    },
                },
            ],
        });
    };

    const processOrder = (order, action) => {
        const titles = {
            approve: 'Confirmar pago',
            reject: 'Rechazar pedido',
            deliver: 'Marcar entregado',
        };
        const messages = {
            approve: `¿Confirmás el pago del pedido ${order.orderCode}? Se avisará al cliente con el código.`,
            reject: `¿Rechazar el pedido ${order.orderCode}?`,
            deliver: `¿El cliente retiró el pedido ${order.orderCode}?`,
        };
        setAlertInfo({
            visible: true,
            title: titles[action],
            message: messages[action],
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) },
                {
                    text: 'Confirmar',
                    style: 'primary',
                    onPress: async () => {
                        setAlertInfo((p) => ({ ...p, visible: false }));
                        try {
                            await apiClient.put(`/store/orders/${order._id}/process`, { action });
                            await loadData();
                        } catch (error) {
                            setAlertInfo({
                                visible: true,
                                title: 'Error',
                                message: error.response?.data?.message || 'No se pudo actualizar el pedido.',
                                buttons: [{ text: 'OK', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
                            });
                        }
                    },
                },
            ],
        });
    };

    const orderFilters = useMemo(
        () => [
            { id: 'pending', label: 'Pendientes' },
            { id: 'paid', label: 'Confirmados' },
            { id: 'delivered', label: 'Entregados' },
            { id: 'all', label: 'Todos' },
        ],
        []
    );
    const selectedOrderFilterLabel =
        orderFilters.find((f) => f.id === orderFilter)?.label || 'Pendientes';

    return (
        <>
        <Modal visible={visible && !showForm && !receiptViewer} transparent animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <KeyboardAwareSheet
                    onDismiss={onClose}
                    backgroundColor={Colors[colorScheme].background}
                    borderRadius={20}
                    style={styles.sheet}
                >
                    <View style={[styles.header, { backgroundColor: accent }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerKicker}>Administración</Text>
                            <Text style={styles.headerTitle}>Tienda</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tabBar}>
                        {[
                            { id: 'products', label: 'Productos', icon: 'cube-outline' },
                            { id: 'orders', label: 'Pedidos', icon: 'receipt-outline' },
                        ].map((t) => {
                            const selected = tab === t.id;
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[styles.tabBtn, selected && { backgroundColor: accent }]}
                                    onPress={() => setTab(t.id)}
                                >
                                    <Ionicons name={t.icon} size={16} color={selected ? '#fff' : Colors[colorScheme].text} />
                                    <Text style={[styles.tabText, selected && { color: '#fff' }]}>{t.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {loading ? (
                        <View style={styles.loading}>
                            <ActivityIndicator color={accent} size="large" />
                        </View>
                    ) : tab === 'products' ? (
                        <ScrollView
                            contentContainerStyle={styles.scroll}
                            keyboardShouldPersistTaps="handled"
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />
                            }
                        >
                            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={openCreate}>
                                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                                <Text style={styles.primaryBtnText}>Nuevo producto</Text>
                            </TouchableOpacity>

                            {items.length === 0 ? (
                                <Text style={styles.empty}>Todavía no hay productos en la tienda.</Text>
                            ) : (
                                items.map((item) => (
                                    <View key={item._id} style={styles.card}>
                                        {!!item.imageUrl && (
                                            <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cardTitle}>{item.name}</Text>
                                            <Text style={styles.cardMeta}>
                                                ${Number(item.price).toLocaleString('es-AR')}
                                                {!item.isActive ? ' · Oculto' : ''}
                                            </Text>
                                            <Text style={styles.cardSub}>{formatOptionStockLabel(item)}</Text>
                                        </View>
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                                            <Ionicons name="create-outline" size={20} color={Colors[colorScheme].text} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeactivate(item)}>
                                            <Ionicons name="trash-outline" size={20} color="#a72828" />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.scroll}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />
                            }
                        >
                            <TouchableOpacity
                                style={styles.filterButton}
                                onPress={() => setOrderFilterVisible(true)}
                            >
                                <Text style={styles.filterButtonText} numberOfLines={1}>
                                    {selectedOrderFilterLabel}
                                </Text>
                                <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                            </TouchableOpacity>

                            {orders.length === 0 ? (
                                <Text style={styles.empty}>No hay pedidos en este filtro.</Text>
                            ) : (
                                orders.map((order) => {
                                    const userName = `${order.user?.nombre || ''} ${order.user?.apellido || ''}`.trim();
                                    return (
                                        <View key={order._id} style={styles.card}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.cardTitle}>{order.orderCode}</Text>
                                                <Text style={styles.cardMeta}>
                                                    {userName || 'Cliente'} · ${Number(order.amountTransferred).toLocaleString('es-AR')}
                                                </Text>
                                                <Text style={styles.cardSub}>
                                                    {STATUS_LABEL[order.status] || order.status} · {order.method === 'mercadopago' ? 'Mercado Pago' : 'Transferencia'}
                                                </Text>
                                                {(order.items || []).map((line, idx) => (
                                                    <Text key={`${order._id}_${idx}`} style={styles.cardSub}>
                                                        • {line.name}
                                                        {line.selectedOption ? ` (${line.selectedOption})` : ''}
                                                        {line.quantity > 1 ? ` x${line.quantity}` : ''}
                                                    </Text>
                                                ))}
                                                {!!order.receiptUrl && (
                                                    <TouchableOpacity onPress={() => setReceiptViewer(order.receiptUrl)}>
                                                        <Text style={[styles.link, { color: accent }]}>Ver comprobante</Text>
                                                    </TouchableOpacity>
                                                )}
                                                <View style={styles.orderActions}>
                                                    {order.status === 'pending' && (
                                                        <>
                                                            <TouchableOpacity
                                                                style={[styles.smallBtn, { backgroundColor: '#1e7e34' }]}
                                                                onPress={() => processOrder(order, 'approve')}
                                                            >
                                                                <Text style={styles.smallBtnText}>Confirmar</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={[styles.smallBtn, { backgroundColor: '#a72828' }]}
                                                                onPress={() => processOrder(order, 'reject')}
                                                            >
                                                                <Text style={styles.smallBtnText}>Rechazar</Text>
                                                            </TouchableOpacity>
                                                        </>
                                                    )}
                                                    {order.status === 'paid' && (
                                                        <TouchableOpacity
                                                            style={[styles.smallBtn, { backgroundColor: accent }]}
                                                            onPress={() => processOrder(order, 'deliver')}
                                                        >
                                                            <Text style={styles.smallBtnText}>Entregado</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    )}
                </KeyboardAwareSheet>

                <CustomAlert
                    inline
                    visible={alertInfo.visible && !showForm}
                    title={alertInfo.title}
                    message={alertInfo.message}
                    buttons={alertInfo.buttons}
                    onClose={() => setAlertInfo((p) => ({ ...p, visible: false }))}
                    gymColor={accent}
                />

                <FilterModal
                    embedded
                    visible={orderFilterVisible}
                    onClose={() => setOrderFilterVisible(false)}
                    options={orderFilters.map((f) => ({ _id: f.id, nombre: f.label }))}
                    onSelect={(id) => {
                        setOrderFilter(id);
                        setOrderFilterVisible(false);
                    }}
                    selectedValue={orderFilter}
                    title="Estado del pedido"
                    theme={{ colors: Colors[colorScheme], gymColor: accent }}
                />
            </View>
        </Modal>

            <Modal
                visible={showForm}
                transparent
                animationType="slide"
                onRequestClose={() => setShowForm(false)}
                presentationStyle="overFullScreen"
                statusBarTranslucent
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <KeyboardAwareSheet
                        onDismiss={() => setShowForm(false)}
                        backgroundColor={Colors[colorScheme].background}
                        borderRadius={20}
                        style={styles.formSheet}
                    >
                        <View style={[styles.formHeader, { backgroundColor: accent }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.headerKicker}>
                                    {editingId ? 'Editar producto' : 'Nuevo producto'}
                                </Text>
                                <Text style={styles.headerTitle} numberOfLines={1}>
                                    {form.name.trim() || 'Producto de tienda'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeBtn} hitSlop={10}>
                                <Ionicons name="close" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.formBody}
                            contentContainerStyle={styles.formScroll}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                        >
                            <Text style={styles.label}>Foto</Text>
                            {(form.imageAsset?.uri || form.imageUrl) ? (
                                <View style={styles.imagePreviewWrap}>
                                    <Image
                                        source={{ uri: form.imageAsset?.uri || form.imageUrl }}
                                        style={styles.imagePreview}
                                    />
                                    <View style={styles.imageActions}>
                                        <TouchableOpacity style={[styles.imageActionBtn, { borderColor: accent }]} onPress={pickItemImage}>
                                            <Text style={[styles.imageActionText, { color: accent }]}>Cambiar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.imageActionBtn} onPress={removeItemImage}>
                                            <Text style={styles.imageActionText}>Quitar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <TouchableOpacity style={[styles.imagePickerBtn, { borderColor: accent }]} onPress={pickItemImage}>
                                    <Ionicons name="camera-outline" size={22} color={accent} />
                                    <Text style={[styles.imagePickerText, { color: accent }]}>Agregar foto</Text>
                                </TouchableOpacity>
                            )}

                            <Text style={styles.label}>Nombre</Text>
                            <TextInput
                                style={styles.input}
                                value={form.name}
                                onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
                                placeholder="Ej: Remera Gain"
                                placeholderTextColor={Colors[colorScheme].icon}
                            />
                            <Text style={styles.label}>Precio</Text>
                            <TextInput
                                style={styles.input}
                                value={form.price}
                                onChangeText={(t) => setForm((p) => ({ ...p, price: t }))}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={Colors[colorScheme].icon}
                            />

                            <Text style={styles.label}>Opciones y stock</Text>
                            {(form.optionRows || [{ name: '', amount: '0' }]).map((row, index) => {
                                const amountNum = Math.max(0, Number(row?.amount) || 0);
                                return (
                                    <View key={`opt_${index}`} style={styles.optionRow}>
                                        <TextInput
                                            style={[styles.input, styles.optionNameInput]}
                                            value={row?.name || ''}
                                            onChangeText={(t) => updateOptionRow(index, 'name', t)}
                                            placeholder="Ej: Talle M"
                                            placeholderTextColor={Colors[colorScheme].icon}
                                        />
                                        <View style={styles.qtyStepper}>
                                            <TouchableOpacity
                                                style={[styles.qtyBtn, amountNum <= 0 && { opacity: 0.4 }]}
                                                onPress={() => bumpOptionAmount(index, -1)}
                                                disabled={amountNum <= 0}
                                            >
                                                <Text style={styles.qtyBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.qtyValueInput}
                                                value={row?.amount ?? '0'}
                                                onChangeText={(t) => updateOptionRow(index, 'amount', t.replace(/[^0-9]/g, ''))}
                                                keyboardType="number-pad"
                                                selectTextOnFocus
                                            />
                                            <TouchableOpacity
                                                style={[styles.qtyBtn, { backgroundColor: accent, borderColor: accent }]}
                                                onPress={() => bumpOptionAmount(index, 1)}
                                            >
                                                <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity style={styles.optionRemoveBtn} onPress={() => removeOptionRow(index)}>
                                            <Ionicons name="trash-outline" size={18} color="#a72828" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                            <TouchableOpacity style={[styles.addOptionBtn, { borderColor: accent }]} onPress={addOptionRow}>
                                <Ionicons name="add-circle-outline" size={18} color={accent} />
                                <Text style={[styles.addOptionText, { color: accent }]}>Agregar opción</Text>
                            </TouchableOpacity>

                            <View style={styles.switchRow}>
                                <Text style={[styles.label, { marginBottom: 0 }]}>Visible en tienda</Text>
                                <Switch
                                    value={form.isActive}
                                    onValueChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                                    trackColor={{ true: accent }}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.formFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: accent, flex: 1, marginTop: 0, marginBottom: 0 }]}
                                onPress={handleSaveItem}
                                disabled={saving}
                            >
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAwareSheet>

                    <CustomAlert
                        inline
                        visible={alertInfo.visible && showForm}
                        title={alertInfo.title}
                        message={alertInfo.message}
                        buttons={alertInfo.buttons}
                        onClose={() => setAlertInfo((p) => ({ ...p, visible: false }))}
                        gymColor={accent}
                    />
                </View>
            </Modal>

            <Modal
                visible={!!receiptViewer}
                transparent
                animationType="fade"
                onRequestClose={() => setReceiptViewer(null)}
                presentationStyle="overFullScreen"
                statusBarTranslucent
            >
                <View style={styles.receiptOverlay}>
                    <TouchableOpacity
                        style={styles.receiptBackdrop}
                        activeOpacity={1}
                        onPress={() => setReceiptViewer(null)}
                    />
                    <TouchableOpacity style={styles.receiptClose} onPress={() => setReceiptViewer(null)} hitSlop={12}>
                        <Ionicons name="close" size={32} color="#fff" />
                    </TouchableOpacity>
                    {!!receiptViewer && (
                        <Image source={{ uri: receiptViewer }} style={styles.receiptImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';
    return StyleSheet.create({
        sheet: { width: '100%', height: '92%', maxHeight: '92%', overflow: 'hidden' },
        header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 18 },
        headerKicker: { color: '#fff', opacity: 0.8, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
        headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
        closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
        tabBar: { flexDirection: 'row', margin: 12, padding: 4, borderRadius: 12, backgroundColor: soft, borderWidth: 1, borderColor: colors.border, gap: 4 },
        tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
        tabText: { fontSize: 13, fontWeight: '700', color: colors.text },
        loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        scroll: { padding: 14, paddingBottom: 40 },
        primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, marginBottom: 14 },
        primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
        empty: { textAlign: 'center', color: colors.text, opacity: 0.6, marginTop: 30 },
        card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: soft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10, gap: 8 },
        thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.border },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        cardMeta: { fontSize: 13, color: colors.text, opacity: 0.75, marginTop: 4 },
        cardSub: { fontSize: 12, color: colors.text, opacity: 0.55, marginTop: 3 },
        iconBtn: { padding: 6 },
        filterButton: {
            height: 50,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 15,
            borderRadius: 10,
            backgroundColor: colors.cardBackground || soft,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 14,
        },
        filterButtonText: { fontSize: 16, color: colors.text, flexShrink: 1 },
        orderActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
        smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
        smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
        link: { marginTop: 6, fontWeight: '700', fontSize: 13 },
        formSheet: {
            width: '100%',
            height: '92%',
            maxHeight: '92%',
            overflow: 'hidden',
        },
        formHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 18,
            paddingHorizontal: 18,
        },
        formBody: {
            flex: 1,
            minHeight: 0,
        },
        formScroll: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 20,
        },
        formFooter: {
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 18,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
        },
        label: { fontSize: 12, fontWeight: '600', color: colors.text, opacity: 0.7, marginBottom: 6 },
        input: { height: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, color: colors.text, backgroundColor: soft },
        textArea: { height: 90, textAlignVertical: 'top', paddingTop: 10 },
        optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
        optionNameInput: { flex: 1, marginBottom: 8 },
        qtyStepper: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 8,
        },
        qtyBtn: {
            width: 34,
            height: 34,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: soft,
            borderWidth: 1,
            borderColor: colors.border,
        },
        qtyBtnText: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 20 },
        qtyValueInput: {
            width: 48,
            height: 34,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            textAlign: 'center',
            color: colors.text,
            backgroundColor: colors.background,
            paddingHorizontal: 4,
            paddingVertical: 0,
            fontWeight: '700',
        },
        optionRemoveBtn: { padding: 8, marginBottom: 8 },
        addOptionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderRadius: 12,
            paddingVertical: 12,
            marginBottom: 14,
            backgroundColor: soft,
        },
        addOptionText: { fontWeight: '700', fontSize: 13 },
        imagePickerBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderRadius: 12,
            paddingVertical: 18,
            marginBottom: 12,
            backgroundColor: soft,
        },
        imagePickerText: { fontWeight: '700', fontSize: 14 },
        imagePreviewWrap: { marginBottom: 12 },
        imagePreview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: soft },
        imageActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
        imageActionBtn: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: soft,
        },
        imageActionText: { fontWeight: '700', color: colors.text },
        switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
        cancelBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: soft },
        cancelText: { color: colors.text, fontWeight: '600' },
        receiptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
        receiptBackdrop: { ...StyleSheet.absoluteFillObject },
        receiptClose: { position: 'absolute', top: 48, right: 20, zIndex: 2, padding: 4 },
        receiptImage: { width: '100%', height: '75%', zIndex: 1 },
    });
};

export default AdminStoreModal;
