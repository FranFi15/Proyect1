import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
    ActivityIndicator, ScrollView, useColorScheme, Platform, RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import CustomAlert from '../CustomAlert';
import FilterModal from '../FilterModal';

WebBrowser.maybeCompleteAuthSession();

const formatPrice = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;

const getStoreOptionRows = (item) => {
    const raw = item?.options || [];
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => {
            if (typeof entry === 'string') {
                const name = entry.trim();
                return name ? { name, amount: Number(item?.amount) || 0 } : null;
            }
            const name = String(entry?.name || '').trim();
            if (!name) return null;
            return { name, amount: Math.max(0, Number(entry?.amount) || 0) };
        })
        .filter(Boolean);
};

const getStoreOptionStock = (item, selectedOption = '') => {
    const options = getStoreOptionRows(item);
    if (options.length === 0) return Math.max(0, Number(item?.amount) || 0);
    const match = options.find((o) => o.name === selectedOption);
    return match ? match.amount : 0;
};

const getStoreTotalStock = (item) => {
    const options = getStoreOptionRows(item);
    if (options.length === 0) return Math.max(0, Number(item?.amount) || 0);
    return options.reduce((sum, o) => sum + o.amount, 0);
};

const getPackageKind = (pkg) => {
    if (pkg?.isPaseLibre) return 'pase';
    if (pkg?.isMembresia) return 'membresia';
    return 'creditos';
};

const KIND_META = {
    creditos: { label: 'Créditos' },
    pase: { label: 'Pase Libre' },
    membresia: { label: 'Membresía' }
};

const getPackageBenefit = (pkg) => {
    if (!pkg) return 'Pago de saldo';
    if (pkg.isPaseLibre) return `Acceso libre por ${pkg.durationDays || 30} días`;
    if (pkg.isMembresia) return `Membresía QR por ${pkg.durationDays || 30} días`;
    return `${pkg.creditsAmount || 0} créditos de ${pkg.tipoClase?.nombre || 'clase'}`;
};

const TransferPaymentModal = ({ onClose, onPaymentResult }) => {
    const { gymColor, user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);
    const aliveRef = useRef(true);
    const pollAbortRef = useRef(false);

    const [packages, setPackages] = useState([]);
    const [storeItems, setStoreItems] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [checkingPayment, setCheckingPayment] = useState(false);
    const [step, setStep] = useState('shop');
    const [shopTab, setShopTab] = useState('planes'); // planes | tienda
    const [selectedKind, setSelectedKind] = useState('all');
    const [selectedCreditType, setSelectedCreditType] = useState('all');
    const [cart, setCart] = useState({});
    const [storeCart, setStoreCart] = useState({}); // key: itemId::option
    const [optionPickerItem, setOptionPickerItem] = useState(null);
    const [previewImageUrl, setPreviewImageUrl] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [payDebt, setPayDebt] = useState(false);
    const [image, setImage] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [gymBankDetails, setGymBankDetails] = useState(null);
    const [mpLinked, setMpLinked] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('mercadopago');
    const [showBankDetails, setShowBankDetails] = useState(true);
    const [isKindFilterVisible, setIsKindFilterVisible] = useState(false);
    const [isCreditFilterVisible, setIsCreditFilterVisible] = useState(false);

    useEffect(() => {
        aliveRef.current = true;
        pollAbortRef.current = false;
        return () => {
            aliveRef.current = false;
            pollAbortRef.current = true;
        };
    }, []);

    const applyShopPayload = (typesRes, settingsRes, pkgRes, storeRes) => {
        if (typesRes.status === 'fulfilled') {
            setClassTypes(typesRes.value.data.tiposClase || []);
        }
        if (settingsRes.status === 'fulfilled') {
            const settings = settingsRes.value.data || {};
            setGymBankDetails(settings.bankDetails || null);
            const linked = !!settings.mercadoPago?.isLinked;
            setMpLinked(linked);
            const hasBank = !!(settings.bankDetails?.cbu || settings.bankDetails?.alias);
            setPaymentMethod(linked ? 'mercadopago' : 'transfer');
            if (!linked && !hasBank) setPaymentMethod('transfer');
        }
        if (pkgRes.status === 'fulfilled') {
            setPackages(pkgRes.value.data || []);
        }
        if (storeRes.status === 'fulfilled') {
            setStoreItems(storeRes.value.data || []);
        }
    };

    const onRefreshShop = async () => {
        setRefreshing(true);
        try {
            const results = await Promise.allSettled([
                apiClient.get('/tipos-clase'),
                apiClient.get('/settings'),
                apiClient.get('/payments/packages'),
                apiClient.get('/store/items'),
            ]);
            applyShopPayload(...results);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const results = await Promise.allSettled([
                    apiClient.get('/tipos-clase'),
                    apiClient.get('/settings'),
                    apiClient.get('/payments/packages'),
                    apiClient.get('/store/items'),
                ]);
                if (cancelled) return;
                applyShopPayload(...results);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // If the store cart is cleared on checkout, drop back to the shop (render-time sync).
    if (step === 'checkout' && shopTab === 'tienda' && Object.keys(storeCart).length === 0) {
        setStep('shop');
    }

    const hasStore = storeItems.length > 0;

    const hasBankDetails = !!(gymBankDetails?.cbu || gymBankDetails?.alias);
    const owesMoney = user?.balance < 0;
    const debtAmount = owesMoney ? Math.abs(user.balance) : 0;

    const kindFilters = useMemo(() => {
        const counts = {
            all: packages.length,
            creditos: packages.filter(p => getPackageKind(p) === 'creditos').length,
            pase: packages.filter(p => getPackageKind(p) === 'pase').length,
            membresia: packages.filter(p => getPackageKind(p) === 'membresia').length
        };
        return [
            { id: 'all', label: 'Todos', count: counts.all },
            { id: 'creditos', label: 'Créditos', count: counts.creditos },
            { id: 'pase', label: 'Pase Libre', count: counts.pase },
            { id: 'membresia', label: 'Membresía', count: counts.membresia }
        ].filter(item => item.id === 'all' || item.count > 0);
    }, [packages]);

    const creditTypeFilters = useMemo(() => {
        const creditPackages = packages.filter(p => getPackageKind(p) === 'creditos');
        const items = [{ id: 'all', label: 'Todos los créditos', count: creditPackages.length }];
        classTypes.forEach(ct => {
            const count = creditPackages.filter(pkg => {
                const typeId = pkg.tipoClase?._id || pkg.tipoClase;
                return typeId === ct._id;
            }).length;
            if (count > 0) items.push({ id: ct._id, label: ct.nombre, count });
        });
        return items;
    }, [packages, classTypes]);

    const visiblePackages = useMemo(() => {
        return packages.filter(pkg => {
            const kind = getPackageKind(pkg);
            if (selectedKind !== 'all' && kind !== selectedKind) return false;
            if (selectedKind === 'creditos' && selectedCreditType !== 'all') {
                const pkgTypeId = pkg.tipoClase?._id || pkg.tipoClase;
                return pkgTypeId === selectedCreditType;
            }
            return true;
        });
    }, [packages, selectedKind, selectedCreditType]);

    const cartItems = useMemo(() => Object.values(cart), [cart]);
    const cartCount = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
        [cartItems]
    );
    const cartTotal = useMemo(
        () => cartItems.reduce((sum, item) => sum + (Number(item.pkg.price) * item.quantity), 0),
        [cartItems]
    );

    const storeCartItems = useMemo(() => Object.values(storeCart), [storeCart]);
    const storeCartCount = useMemo(
        () => storeCartItems.reduce((sum, item) => sum + item.quantity, 0),
        [storeCartItems]
    );
    const storeCartTotal = useMemo(
        () => storeCartItems.reduce((sum, item) => sum + (Number(item.item.price) * item.quantity), 0),
        [storeCartItems]
    );

    const isStoreMode = shopTab === 'tienda';
    const amountToPay = isStoreMode
        ? storeCartTotal
        : (cartItems.length > 0 ? cartTotal : Number(customAmount));

    const canCheckout = isStoreMode
        ? storeCartItems.length > 0
        : (cartItems.length > 0 || (payDebt && Number(customAmount) > 0));
    const selectedKindMeta = kindFilters.find(cat => cat.id === selectedKind);
    const selectedKindLabel = selectedKindMeta
        ? `${selectedKindMeta.label} (${selectedKindMeta.count})`
        : 'Todos';
    const selectedCreditMeta = creditTypeFilters.find(cat => cat.id === selectedCreditType);
    const selectedCreditLabel = selectedCreditMeta
        ? `${selectedCreditMeta.label} (${selectedCreditMeta.count})`
        : 'Todos los créditos';
    const showCreditFilter = selectedKind === 'creditos' && creditTypeFilters.length > 1;
    const cartSummaryLabel = isStoreMode
        ? (storeCartItems.length === 0
            ? 'Nada seleccionado'
            : storeCartItems.length === 1
                ? `${storeCartItems[0].item.name}${storeCartItems[0].selectedOption ? ` (${storeCartItems[0].selectedOption})` : ''}${storeCartItems[0].quantity > 1 ? ` x${storeCartItems[0].quantity}` : ''}`
                : `${storeCartCount} productos`)
        : (cartItems.length === 0
            ? (payDebt ? 'Pago de saldo' : 'Nada seleccionado')
            : cartItems.length === 1
                ? `${cartItems[0].pkg.name}${cartItems[0].quantity > 1 ? ` x${cartItems[0].quantity}` : ''}`
                : `${cartCount} productos`);

    const showAlert = (payload) => {
        if (!aliveRef.current) return;
        setAlertInfo({
            visible: true,
            title: payload.title,
            message: payload.message,
            buttons: payload.buttons || [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo(prev => ({ ...prev, visible: false })) }]
        });
    };

    /**
     * Hand the result to the parent, then close Comprar.
     * Showing the confirmation inside this Modal (or while it closes) freezes iOS.
     */
    const deliverPaymentResult = (payload) => {
        onPaymentResult?.(payload);
        onClose?.();
    };

    const storeCartKey = (itemId, option = '') => `${itemId}::${option || ''}`;

    const addStoreItem = (item, selectedOption = '') => {
        setPayDebt(false);
        setCustomAmount('');
        setCart({});
        const key = storeCartKey(item._id, selectedOption);
        const available = getStoreOptionStock(item, selectedOption);
        setStoreCart((prev) => {
            const current = prev[key];
            const nextQty = (current?.quantity || 0) + 1;
            if (nextQty > available) {
                showAlert({
                    title: 'Sin stock',
                    message: selectedOption
                        ? `Solo hay ${available} disponible de "${item.name}" (${selectedOption}).`
                        : `Solo hay ${available} disponible de "${item.name}".`,
                });
                return prev;
            }
            return {
                ...prev,
                [key]: { item, selectedOption, quantity: nextQty },
            };
        });
    };

    const requestAddStoreItem = (item) => {
        const options = getStoreOptionRows(item);
        if (options.length > 1) {
            setOptionPickerItem(item);
            return;
        }
        if (options.length === 1) {
            if (options[0].amount <= 0) {
                return showAlert({ title: 'Sin stock', message: `No hay stock de "${item.name}" (${options[0].name}).` });
            }
            addStoreItem(item, options[0].name);
            return;
        }
        addStoreItem(item, '');
    };

    const setStoreCartQuantity = (key, quantity) => {
        setStoreCart((prev) => {
            const next = { ...prev };
            if (quantity <= 0) delete next[key];
            else if (next[key]) next[key] = { ...next[key], quantity };
            return next;
        });
    };

    const addToCart = (pkg) => {
        setPayDebt(false);
        setCustomAmount('');
        setStoreCart({});
        setCart(prev => {
            const current = prev[pkg._id];
            return {
                ...prev,
                [pkg._id]: {
                    pkg,
                    quantity: (current?.quantity || 0) + 1
                }
            };
        });
    };

    const setCartQuantity = (pkgId, quantity) => {
        setCart(prev => {
            const next = { ...prev };
            if (quantity <= 0) {
                delete next[pkgId];
            } else if (next[pkgId]) {
                next[pkgId] = { ...next[pkgId], quantity };
            }
            return next;
        });
    };

    const selectDebtPayment = () => {
        setCart({});
        setStoreCart({});
        setShopTab('planes');
        setPayDebt(true);
        setCustomAmount(debtAmount ? String(debtAmount) : '');
    };

    const goToCheckout = () => {
        if (!canCheckout) {
            return showAlert({
                title: 'Elegí un producto',
                message: isStoreMode
                    ? 'Agregá al menos un producto de la tienda.'
                    : 'Agregá al menos un paquete o un monto para continuar.',
            });
        }
        if (!mpLinked && !hasBankDetails) {
            return showAlert({ title: 'Pagos no disponibles', message: 'El gimnasio todavía no configuró Mercado Pago ni una transferencia.' });
        }
        if (mpLinked) setPaymentMethod('mercadopago');
        else setPaymentMethod('transfer');
        setStep('checkout');
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            return showAlert({ title: 'Permiso denegado', message: 'Necesitamos acceso a tu galería para subir el comprobante.' });
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.5
        });
        if (!result.canceled) setImage(result.assets[0]);
    };

    const pollTicket = async (ticketId, isStore = false) => {
        const path = isStore ? `/store/orders/${ticketId}` : `/payments/ticket/${ticketId}`;
        for (let i = 0; i < 8; i += 1) {
            if (pollAbortRef.current || !aliveRef.current) return 'aborted';
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (pollAbortRef.current || !aliveRef.current) return 'aborted';
            try {
                const { data } = await apiClient.get(path);
                if (isStore) {
                    if (data.status === 'paid' || data.status === 'delivered') return 'approved';
                    if (data.status === 'rejected') return 'rejected';
                } else if (data.status === 'approved' || data.status === 'rejected') {
                    return data.status;
                }
            } catch (_e) {
                // El webhook puede tardar; seguimos intentando.
            }
        }
        return 'pending';
    };

    const handleMercadoPago = async () => {
        if (!mpLinked) {
            return showAlert({ title: 'Mercado Pago no disponible', message: 'Este gimnasio todavía no vinculó su cuenta.' });
        }
        if (!amountToPay || Number.isNaN(amountToPay) || amountToPay <= 0) {
            return showAlert({ title: 'Monto inválido', message: 'Ingresá o seleccioná un monto válido.' });
        }

        setSubmitting(true);
        try {
            let data;
            if (isStoreMode) {
                const payload = {
                    items: storeCartItems.map((entry) => ({
                        storeItemId: entry.item._id,
                        quantity: entry.quantity,
                        selectedOption: entry.selectedOption || '',
                    })),
                };
                ({ data } = await apiClient.post('/store/orders/mercadopago/preference', payload));
            } else {
                const payload = cartItems.length > 0
                    ? {
                        items: cartItems.map(item => ({
                            packageId: item.pkg._id,
                            quantity: item.quantity
                        }))
                    }
                    : { amount: amountToPay };
                ({ data } = await apiClient.post('/payments/mercadopago/preference', payload));
            }
            const redirectUrl = Linking.createURL('payment-result');

            if (Platform.OS === 'web') {
                await Linking.openURL(data.checkoutUrl);
                return;
            }

            const browserResult = await WebBrowser.openAuthSessionAsync(data.checkoutUrl, redirectUrl);
            if (aliveRef.current) setSubmitting(false);

            if (browserResult?.type === 'cancel' || browserResult?.type === 'dismiss') {
                return;
            }

            // Close shop immediately so the user isn't stuck waiting for webhook polling.
            if (aliveRef.current) setCheckingPayment(true);
            const status = await pollTicket(data.ticketId || data.orderId, isStoreMode);
            if (aliveRef.current) setCheckingPayment(false);

            if (status === 'aborted') return;

            if (status === 'approved') {
                deliverPaymentResult({
                    title: isStoreMode ? 'Pedido confirmado' : 'Pago acreditado',
                    message: isStoreMode
                        ? `Tu compra de tienda fue confirmada${data.orderCode ? `. Código: ${data.orderCode}` : ''}. Te avisamos por notificación.`
                        : (cartItems.length > 0
                            ? 'Ya tenés tus productos disponibles.'
                            : 'Tu pago se acreditó correctamente.'),
                });
            } else if (status === 'rejected') {
                deliverPaymentResult({
                    title: 'Pago rechazado',
                    message: 'Mercado Pago no pudo completar el cobro. Podés intentar de nuevo.',
                });
            } else {
                deliverPaymentResult({
                    title: 'Estamos procesando el pago',
                    message: isStoreMode
                        ? 'Si ya pagaste, tu pedido se va a confirmar en unos minutos y vas a recibir el código.'
                        : 'Si ya pagaste, tus créditos o pases se van a acreditar en unos minutos.',
                });
            }
        } catch (error) {
            if (!aliveRef.current) return;
            showAlert({
                title: 'No se pudo iniciar el pago',
                message: error.response?.data?.message || 'Hubo un problema al abrir Mercado Pago.'
            });
        } finally {
            if (aliveRef.current) {
                setSubmitting(false);
                setCheckingPayment(false);
            }
        }
    };

    const handleSubmitTransfer = async () => {
        if (!amountToPay || Number.isNaN(amountToPay) || amountToPay <= 0) {
            return showAlert({ title: 'Error', message: 'Ingresá o seleccioná un monto válido.' });
        }
        if (!image) {
            return showAlert({ title: 'Falta el comprobante', message: 'Adjuntá la captura de la transferencia.' });
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (isStoreMode) {
                formData.append('items', JSON.stringify(storeCartItems.map((entry) => ({
                    storeItemId: entry.item._id,
                    quantity: entry.quantity,
                    selectedOption: entry.selectedOption || '',
                }))));
            } else if (cartItems.length > 0) {
                formData.append('items', JSON.stringify(cartItems.map(item => ({
                    packageId: item.pkg._id,
                    quantity: item.quantity
                }))));
            }
            formData.append('amountTransferred', String(amountToPay));

            let filename = image.fileName || 'comprobante.png';
            if (Platform.OS === 'web') {
                const response = await fetch(image.uri);
                const blob = await response.blob();
                formData.append('receipt', blob, filename);
            } else {
                const localUri = image.uri;
                if (!filename.includes('.')) filename = 'comprobante.jpg';
                let mimeType = image.mimeType;
                if (!mimeType) {
                    const match = /\.(\w+)$/.exec(filename);
                    mimeType = match ? `image/${match[1]}` : 'image/jpeg';
                }
                if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
                formData.append('receipt', {
                    uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
                    name: filename,
                    type: mimeType
                });
            }

            const headers = { Accept: 'application/json' };
            if (Platform.OS !== 'web') headers['Content-Type'] = 'multipart/form-data';
            const endpoint = isStoreMode ? '/store/orders/ticket' : '/payments/ticket';
            await apiClient.post(endpoint, formData, { headers });

            showAlert({
                title: 'Comprobante enviado',
                message: isStoreMode
                    ? 'Tu pedido quedó pendiente de confirmación. Cuando lo aprueben te llega el código por notificación.'
                    : 'Un administrador lo va a revisar y te avisamos cuando esté acreditado.',
                buttons: [{
                    text: 'Listo',
                    style: 'primary',
                    onPress: () => {
                        setAlertInfo(prev => ({ ...prev, visible: false }));
                        setTimeout(() => onClose?.(), 300);
                    }
                }]
            });
        } catch (error) {
            showAlert({
                title: 'Error',
                message: error.response?.data?.message || 'Hubo un problema al enviar el comprobante.'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const renderPackageCard = (pkg) => {
        const inCart = cart[pkg._id];
        const kind = getPackageKind(pkg);
        const meta = KIND_META[kind];
        return (
            <View
                key={pkg._id}
                style={[styles.packageCard, inCart && { borderColor: gymColor, backgroundColor: gymColor + '12' }]}
            >
                <View style={styles.packageTop}>
                    <View style={[styles.kindBadge, inCart && { backgroundColor: gymColor }]}>
                        <Text style={[styles.kindBadgeText, inCart && { color: '#fff' }]}>{meta.label}</Text>
                    </View>
                </View>
                <Text style={styles.packageName}>{pkg.name}</Text>
                {pkg.description ? <Text style={styles.packageDesc} numberOfLines={2}>{pkg.description}</Text> : null}
                <Text style={styles.packageBenefit}>{getPackageBenefit(pkg)}</Text>
                <View style={styles.packageFooter}>
                    <Text style={[styles.packagePrice, { color: gymColor }]}>{formatPrice(pkg.price)}</Text>
                    {inCart ? (
                        <View style={styles.qtyRow}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setCartQuantity(pkg._id, inCart.quantity - 1)}>
                                <Text style={styles.qtyBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.qtyValue}>{inCart.quantity}</Text>
                            <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: gymColor }]} onPress={() => addToCart(pkg)}>
                                <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={[styles.addBtn, { backgroundColor: gymColor }]} onPress={() => addToCart(pkg)}>
                            <Text style={styles.addBtnText}>Agregar</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const storeLinesForItem = (item) =>
        storeCartItems.filter((entry) => entry.item._id === item._id);

    const renderStoreCard = (item) => {
        const lines = storeLinesForItem(item);
        const inCart = lines.length > 0;
        const options = getStoreOptionRows(item);
        const totalStock = getStoreTotalStock(item);
        const outOfStock = totalStock <= 0;
        return (
            <View
                key={item._id}
                style={[styles.packageCard, inCart && { borderColor: gymColor, backgroundColor: gymColor + '12' }]}
            >
                {!!item.imageUrl && (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImageUrl(item.imageUrl)}>
                        <Image source={{ uri: item.imageUrl }} style={styles.storeImage} />
                    </TouchableOpacity>
                )}
                <View style={styles.packageTop}>
                    <View style={[styles.kindBadge, inCart && { backgroundColor: gymColor }]}>
                        <Text style={[styles.kindBadgeText, inCart && { color: '#fff' }]}>Tienda</Text>
                    </View>
                    {totalStock > 0 && totalStock < 5 ? (
                        <Text style={[styles.stockHint, { color: '#c0392b' }]}>Quedan solo {totalStock}</Text>
                    ) : null}
                </View>
                <Text style={styles.packageName}>{item.name}</Text>
                {options.length > 0 ? (
                    <Text style={styles.packageBenefit}>
                        {options.map((o) => o.name).join(' · ')}
                    </Text>
                ) : null}
                {inCart ? (
                    <View style={{ marginTop: 8, gap: 6 }}>
                        {lines.map((entry) => {
                            const key = storeCartKey(entry.item._id, entry.selectedOption);
                            return (
                                <View key={key} style={styles.storeLineRow}>
                                    <Text style={styles.storeLineLabel} numberOfLines={1}>
                                        {entry.selectedOption || 'Sin opción'}
                                    </Text>
                                    <View style={styles.qtyRow}>
                                        <TouchableOpacity
                                            style={styles.qtyBtn}
                                            onPress={() => setStoreCartQuantity(key, entry.quantity - 1)}
                                        >
                                            <Text style={styles.qtyBtnText}>-</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.qtyValue}>{entry.quantity}</Text>
                                        <TouchableOpacity
                                            style={[styles.qtyBtn, { backgroundColor: gymColor }]}
                                            onPress={() => addStoreItem(entry.item, entry.selectedOption)}
                                        >
                                            <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : null}
                <View style={styles.packageFooter}>
                    <Text style={[styles.packagePrice, { color: gymColor }]}>{formatPrice(item.price)}</Text>
                    <TouchableOpacity
                        style={[styles.addBtn, { backgroundColor: gymColor }, outOfStock && { opacity: 0.45 }]}
                        onPress={() => requestAddStoreItem(item)}
                        disabled={outOfStock}
                    >
                        <Text style={styles.addBtnText}>{outOfStock ? 'Sin stock' : inCart ? 'Agregar más' : 'Agregar'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerBannerTitle}>{step === 'shop' ? 'Comprar' : 'Confirmar pago'}</Text>
                        <Text style={styles.headerBannerSub}>
                            {step === 'shop'
                                ? (isStoreMode ? 'Productos de la tienda' : 'Agregá uno o más paquetes al carrito')
                                : 'Mercado Pago o transferencia'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={step === 'checkout' ? () => setStep('shop') : onClose} style={styles.closeButtonBanner}>
                        <Ionicons name={step === 'checkout' ? 'arrow-back' : 'close'} size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {step === 'shop' ? (
                    <>
                        <ScrollView
                            contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefreshShop}
                                    tintColor={gymColor}
                                    colors={[gymColor]}
                                />
                            }
                        >
                            {hasStore && (
                                <View style={styles.shopTabs}>
                                    {[
                                        { id: 'planes', label: 'Planes' },
                                        { id: 'tienda', label: 'Tienda' },
                                    ].map((t) => {
                                        const selected = shopTab === t.id;
                                        return (
                                            <TouchableOpacity
                                                key={t.id}
                                                style={[styles.shopTabBtn, selected && { backgroundColor: gymColor }]}
                                                onPress={() => {
                                                    setShopTab(t.id);
                                                    if (t.id === 'tienda') {
                                                        setCart({});
                                                        setPayDebt(false);
                                                        setCustomAmount('');
                                                    } else {
                                                        setStoreCart({});
                                                    }
                                                }}
                                            >
                                                <Text style={[styles.shopTabText, selected && { color: '#fff' }]}>{t.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {!isStoreMode && owesMoney && (
                                <TouchableOpacity
                                    style={[styles.debtAlert, payDebt && { borderColor: gymColor, backgroundColor: gymColor + '10' }]}
                                    onPress={selectDebtPayment}
                                >
                                    <Ionicons name="warning" size={22} color="#c0392b" />
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={styles.debtText}>Saldo pendiente {formatPrice(debtAmount)}</Text>
                                        <Text style={styles.debtHint}>{payDebt ? 'Vas a pagar este saldo' : 'Tocá para abonar la deuda'}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {!isStoreMode && (
                                <>
                                    <TouchableOpacity
                                        style={styles.filterButton}
                                        onPress={() => setIsKindFilterVisible(true)}
                                    >
                                        <Text style={styles.filterButtonText} numberOfLines={1}>{selectedKindLabel}</Text>
                                        <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                    </TouchableOpacity>

                                    {showCreditFilter && (
                                        <TouchableOpacity
                                            style={styles.filterButton}
                                            onPress={() => setIsCreditFilterVisible(true)}
                                        >
                                            <Text style={styles.filterButtonText} numberOfLines={1}>{selectedCreditLabel}</Text>
                                            <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}

                            {loading ? (
                                <ActivityIndicator color={gymColor} style={{ marginTop: 24 }} />
                            ) : isStoreMode ? (
                                storeItems.length === 0 ? (
                                    <View style={styles.emptyBox}>
                                        <Text style={styles.emptyText}>No hay productos en la tienda.</Text>
                                    </View>
                                ) : (
                                    <View style={styles.packagesGrid}>
                                        {storeItems.map(renderStoreCard)}
                                    </View>
                                )
                            ) : visiblePackages.length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Text style={styles.emptyText}>No hay paquetes en esta categoría.</Text>
                                </View>
                            ) : (
                                <View style={styles.packagesGrid}>
                                    {visiblePackages.map(renderPackageCard)}
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.cartBar}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cartKicker}>
                                    {canCheckout
                                        ? (isStoreMode
                                            ? `Carrito · ${storeCartCount}`
                                            : (cartCount > 0 ? `Carrito · ${cartCount}` : 'Selección'))
                                        : (isStoreMode ? 'Elegí un producto' : 'Elegí un paquete')}
                                </Text>
                                <Text style={styles.cartTitle} numberOfLines={1}>{cartSummaryLabel}</Text>
                                {!isStoreMode && cartItems.length === 1 ? (
                                    <Text style={styles.cartMeta}>{getPackageBenefit(cartItems[0].pkg)}</Text>
                                ) : null}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.cartPrice, { color: gymColor }]}>{canCheckout ? formatPrice(amountToPay) : '$0'}</Text>
                                <TouchableOpacity
                                    style={[styles.cartBtn, { backgroundColor: gymColor }, !canCheckout && { opacity: 0.45 }]}
                                    onPress={goToCheckout}
                                    disabled={!canCheckout}
                                >
                                    <Text style={styles.cartBtnText}>Continuar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                ) : (
                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryKicker}>Resumen</Text>
                            {isStoreMode ? (
                                storeCartItems.map((entry) => {
                                    const key = storeCartKey(entry.item._id, entry.selectedOption);
                                    return (
                                        <View key={key} style={styles.summaryRow}>
                                            <View style={{ flex: 1, paddingRight: 10 }}>
                                                <Text style={styles.summaryName}>{entry.item.name}</Text>
                                                <Text style={styles.summaryMeta}>
                                                    {entry.selectedOption || 'Sin opción'}
                                                </Text>
                                            </View>
                                            <View style={styles.qtyRow}>
                                                <TouchableOpacity
                                                    style={styles.qtyBtn}
                                                    onPress={() => setStoreCartQuantity(key, entry.quantity - 1)}
                                                >
                                                    <Text style={styles.qtyBtnText}>-</Text>
                                                </TouchableOpacity>
                                                <Text style={styles.qtyValue}>{entry.quantity}</Text>
                                                <TouchableOpacity
                                                    style={[styles.qtyBtn, { backgroundColor: gymColor }]}
                                                    onPress={() => addStoreItem(entry.item, entry.selectedOption)}
                                                >
                                                    <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={[styles.summaryLinePrice, { color: gymColor }]}>
                                                {formatPrice(Number(entry.item.price) * entry.quantity)}
                                            </Text>
                                        </View>
                                    );
                                })
                            ) : cartItems.length > 0 ? (
                                cartItems.map(item => (
                                    <View key={item.pkg._id} style={styles.summaryRow}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={styles.summaryName}>{item.pkg.name}</Text>
                                            <Text style={styles.summaryMeta}>{getPackageBenefit(item.pkg)}</Text>
                                        </View>
                                        <View style={styles.qtyRow}>
                                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setCartQuantity(item.pkg._id, item.quantity - 1)}>
                                                <Text style={styles.qtyBtnText}>-</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.qtyValue}>{item.quantity}</Text>
                                            <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: gymColor }]} onPress={() => addToCart(item.pkg)}>
                                                <Text style={[styles.qtyBtnText, { color: '#fff' }]}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={[styles.summaryLinePrice, { color: gymColor }]}>
                                            {formatPrice(Number(item.pkg.price) * item.quantity)}
                                        </Text>
                                    </View>
                                ))
                            ) : (
                                <>
                                    <Text style={styles.summaryName}>Pago de saldo</Text>
                                    <Text style={styles.summaryMeta}>Abono de deuda</Text>
                                </>
                            )}
                            <Text style={[styles.summaryPrice, { color: gymColor }]}>{formatPrice(amountToPay)}</Text>
                        </View>

                        <Text style={styles.sectionTitle}>¿Cómo querés pagar?</Text>
                        <View style={styles.methodRow}>
                            {mpLinked && (
                                <TouchableOpacity
                                    style={[styles.methodCard, paymentMethod === 'mercadopago' && { borderColor: '#009EE3', backgroundColor: '#009EE318' }]}
                                    onPress={() => setPaymentMethod('mercadopago')}
                                >
                                    <Text style={styles.methodTitle}>Mercado Pago</Text>
                                    <Text style={styles.methodSub}>Acreditación automática</Text>
                                </TouchableOpacity>
                            )}
                            {hasBankDetails && (
                                <TouchableOpacity
                                    style={[styles.methodCard, paymentMethod === 'transfer' && { borderColor: gymColor, backgroundColor: gymColor + '14' }]}
                                    onPress={() => setPaymentMethod('transfer')}
                                >
                                    <Text style={styles.methodTitle}>Transferencia</Text>
                                    <Text style={styles.methodSub}>Con comprobante</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {paymentMethod === 'mercadopago' ? (
                            <>
                                {checkingPayment ? (
                                    <View style={styles.checkingBox}>
                                        <ActivityIndicator color="#009EE3" />
                                        <Text style={styles.checkingText}>Confirmando tu pago…</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.submitBtn, { backgroundColor: '#009EE3' }, submitting && { opacity: 0.6 }]}
                                        onPress={handleMercadoPago}
                                        disabled={submitting}
                                    >
                                        {submitting ? <ActivityIndicator color="#fff" /> : (
                                            <Text style={styles.submitBtnText}>Pagar {formatPrice(amountToPay)} con Mercado Pago</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={styles.toggleBankBtn} onPress={() => setShowBankDetails(!showBankDetails)}>
                                    <Ionicons name={showBankDetails ? 'eye-off-outline' : 'eye-outline'} size={20} color={gymColor} />
                                    <Text style={[styles.toggleBankText, { color: gymColor }]}>
                                        {showBankDetails ? 'Ocultar datos bancarios' : 'Ver datos para transferir'}
                                    </Text>
                                </TouchableOpacity>

                                {showBankDetails && hasBankDetails && (
                                    <View style={styles.bankInfoCard}>
                                        {gymBankDetails.cbu ? (
                                            <View style={styles.copyRow}>
                                                <Text style={styles.bankInfoText}>CBU/CVU: {gymBankDetails.cbu}</Text>
                                                <TouchableOpacity onPress={async () => {
                                                    await Clipboard.setStringAsync(gymBankDetails.cbu);
                                                    showAlert({ title: 'Copiado', message: 'CBU copiado al portapapeles.' });
                                                }}>
                                                    <Ionicons name="copy-outline" size={20} color={gymColor} />
                                                </TouchableOpacity>
                                            </View>
                                        ) : null}
                                        {gymBankDetails.alias ? (
                                            <View style={styles.copyRow}>
                                                <Text style={styles.bankInfoText}>Alias: {gymBankDetails.alias}</Text>
                                                <TouchableOpacity onPress={async () => {
                                                    await Clipboard.setStringAsync(gymBankDetails.alias);
                                                    showAlert({ title: 'Copiado', message: 'Alias copiado al portapapeles.' });
                                                }}>
                                                    <Ionicons name="copy-outline" size={20} color={gymColor} />
                                                </TouchableOpacity>
                                            </View>
                                        ) : null}
                                        {gymBankDetails.bankName ? (
                                            <Text style={{ fontSize: 14, color: Colors[colorScheme].text, opacity: 0.8 }}>Entidad: {gymBankDetails.bankName}</Text>
                                        ) : null}
                                    </View>
                                )}

                                {!isStoreMode && cartItems.length === 0 && (
                                    <>
                                        <Text style={styles.sectionTitle}>Monto transferido</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Ej: 15000"
                                            placeholderTextColor="#999"
                                            keyboardType="numeric"
                                            value={customAmount}
                                            onChangeText={setCustomAmount}
                                        />
                                    </>
                                )}

                                <Text style={styles.sectionTitle}>Comprobante</Text>
                                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                                    <Ionicons name="camera" size={24} color={gymColor} style={{ marginRight: 10 }} />
                                    <Text style={[styles.imagePickerText, { color: gymColor }]}>
                                        {image ? 'Cambiar imagen' : 'Seleccionar comprobante'}
                                    </Text>
                                </TouchableOpacity>
                                {image && <Image source={{ uri: image.uri || image }} style={styles.previewImage} />}

                                <TouchableOpacity
                                    style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                    onPress={handleSubmitTransfer}
                                    disabled={submitting}
                                >
                                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Enviar comprobante</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </ScrollView>
                )}

                <FilterModal
                    embedded
                    visible={isKindFilterVisible}
                    onClose={() => setIsKindFilterVisible(false)}
                    options={kindFilters.map(cat => ({ _id: cat.id, nombre: `${cat.label} (${cat.count})` }))}
                    onSelect={(id) => {
                        setSelectedKind(id);
                        if (id !== 'creditos') setSelectedCreditType('all');
                        setIsKindFilterVisible(false);
                    }}
                    selectedValue={selectedKind}
                    title="Tipo de producto"
                    theme={{ colors: Colors[colorScheme], gymColor }}
                />

                <FilterModal
                    embedded
                    visible={isCreditFilterVisible}
                    onClose={() => setIsCreditFilterVisible(false)}
                    options={creditTypeFilters.map(cat => ({ _id: cat.id, nombre: `${cat.label} (${cat.count})` }))}
                    onSelect={(id) => {
                        setSelectedCreditType(id);
                        setIsCreditFilterVisible(false);
                    }}
                    selectedValue={selectedCreditType}
                    title="Tipo de crédito"
                    theme={{ colors: Colors[colorScheme], gymColor }}
                />

                {!!optionPickerItem && (
                    <View style={styles.optionOverlay}>
                        <View style={styles.optionCard}>
                            <Text style={styles.optionTitle}>Elegí una opción</Text>
                            <Text style={styles.optionSub}>{optionPickerItem.name}</Text>
                            {getStoreOptionRows(optionPickerItem).map((opt) => {
                                const disabled = opt.amount <= 0;
                                const lowStock = opt.amount > 0 && opt.amount < 5;
                                return (
                                    <TouchableOpacity
                                        key={opt.name}
                                        style={[styles.optionBtn, disabled && { opacity: 0.45 }]}
                                        disabled={disabled}
                                        onPress={() => {
                                            addStoreItem(optionPickerItem, opt.name);
                                            setOptionPickerItem(null);
                                        }}
                                    >
                                        <Text style={styles.optionBtnText}>
                                            {disabled
                                                ? `${opt.name} · Sin stock`
                                                : lowStock
                                                    ? `${opt.name} · Quedan solo ${opt.amount}`
                                                    : opt.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity style={styles.optionCancel} onPress={() => setOptionPickerItem(null)}>
                                <Text style={styles.optionCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!!previewImageUrl && (
                    <View style={styles.imagePreviewOverlay}>
                        <TouchableOpacity
                            style={styles.imagePreviewBackdrop}
                            activeOpacity={1}
                            onPress={() => setPreviewImageUrl(null)}
                        />
                        <TouchableOpacity
                            style={styles.imagePreviewClose}
                            onPress={() => setPreviewImageUrl(null)}
                            hitSlop={12}
                        >
                            <Ionicons name="close" size={32} color="#fff" />
                        </TouchableOpacity>
                        <Image
                            source={{ uri: previewImageUrl }}
                            style={styles.imagePreviewFull}
                            resizeMode="contain"
                        />
                    </View>
                )}

                <CustomAlert
                    inline
                    visible={alertInfo.visible}
                    title={alertInfo.title}
                    message={alertInfo.message}
                    buttons={alertInfo.buttons?.length ? alertInfo.buttons : [{ text: 'OK', onPress: () => setAlertInfo(prev => ({ ...prev, visible: false })) }]}
                    gymColor={gymColor}
                />
            </View>
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 9999, elevation: 9999
    },
    modalView: {
        backgroundColor: Colors[colorScheme].background,
        height: '90%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden'
    },
    headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, justifyContent: 'space-between' },
    headerBannerTitle: { fontSize: 19, fontWeight: 'bold', color: '#fff' },
    headerBannerSub: { fontSize: 13, color: '#fff', opacity: 0.85, marginTop: 2 },
    closeButtonBanner: { padding: 4 },
    debtAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fdf2f2',
        padding: 12,
        borderRadius: 12,
        borderColor: '#e74c3c',
        borderWidth: 1,
        marginBottom: 14
    },
    debtText: { color: '#c0392b', fontWeight: 'bold' },
    debtHint: { color: '#c0392b', opacity: 0.8, fontSize: 12, marginTop: 2 },
    shopTabs: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
        padding: 4,
        borderRadius: 12,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    shopTabBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
    },
    shopTabText: { fontSize: 14, fontWeight: '800', color: Colors[colorScheme].text },
    stockHint: { fontSize: 12, fontWeight: '600', color: Colors[colorScheme].text, opacity: 0.55 },
    storeImage: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: Colors[colorScheme].border,
    },
    storeLineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    storeLineLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors[colorScheme].text, opacity: 0.8 },
    optionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        padding: 24,
        zIndex: 10000,
    },
    optionCard: {
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    optionTitle: { fontSize: 17, fontWeight: '800', color: Colors[colorScheme].text },
    optionSub: { fontSize: 13, opacity: 0.7, color: Colors[colorScheme].text, marginTop: 4, marginBottom: 14 },
    optionBtn: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        marginBottom: 8,
    },
    optionBtnText: { fontSize: 15, fontWeight: '700', color: Colors[colorScheme].text },
    optionCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    optionCancelText: { fontWeight: '700', color: Colors[colorScheme].text, opacity: 0.65 },
    imagePreviewOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10001,
    },
    imagePreviewBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    imagePreviewClose: {
        position: 'absolute',
        top: 48,
        right: 20,
        zIndex: 2,
        padding: 4,
    },
    imagePreviewFull: {
        width: '100%',
        height: '80%',
        zIndex: 1,
    },
    filterButton: {
        height: 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        borderRadius: 10,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        marginBottom: 14
    },
    filterButtonText: { fontSize: 16, color: Colors[colorScheme].text, flexShrink: 1 },
    packagesGrid: { gap: 12 },
    packageCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1.5,
        borderColor: Colors[colorScheme].border,
        borderRadius: 16,
        padding: 14
    },
    packageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    kindBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: gymColor + '16',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999
    },
    kindBadgeText: { fontSize: 11, fontWeight: '800', color: gymColor },
    packageName: { fontSize: 17, fontWeight: '800', color: Colors[colorScheme].text },
    packageDesc: { marginTop: 4, fontSize: 13, color: Colors[colorScheme].text, opacity: 0.7, lineHeight: 18 },
    packageBenefit: { marginTop: 8, fontSize: 13, fontWeight: '600', color: Colors[colorScheme].text, opacity: 0.8 },
    packageFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    packagePrice: { fontSize: 20, fontWeight: '900' },
    addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qtyBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border
    },
    qtyBtnText: { fontSize: 18, fontWeight: '800', color: Colors[colorScheme].text, lineHeight: 20 },
    qtyValue: { minWidth: 18, textAlign: 'center', fontWeight: '800', color: Colors[colorScheme].text },
    emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { color: Colors[colorScheme].text, opacity: 0.7 },
    cartBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 18,
        backgroundColor: Colors[colorScheme].background,
        borderTopWidth: 1,
        borderTopColor: Colors[colorScheme].border
    },
    cartKicker: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, color: Colors[colorScheme].text },
    cartTitle: { fontSize: 15, fontWeight: '800', color: Colors[colorScheme].text, marginTop: 2 },
    cartMeta: { fontSize: 12, opacity: 0.7, color: Colors[colorScheme].text, marginTop: 2 },
    cartPrice: { fontSize: 18, fontWeight: '900', marginBottom: 6 },
    cartBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    cartBtnText: { color: '#fff', fontWeight: '800' },
    summaryCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        marginBottom: 18
    },
    summaryKicker: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, color: Colors[colorScheme].text, marginBottom: 8 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    summaryName: { fontSize: 15, fontWeight: '800', color: Colors[colorScheme].text },
    summaryMeta: { fontSize: 12, opacity: 0.75, color: Colors[colorScheme].text, marginTop: 2 },
    summaryLinePrice: { fontSize: 14, fontWeight: '800', minWidth: 70, textAlign: 'right' },
    summaryPrice: { fontSize: 24, fontWeight: '900', marginTop: 8 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text, marginTop: 8, marginBottom: 12 },
    methodRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    methodCard: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 14,
        padding: 14
    },
    methodTitle: { fontWeight: '800', color: Colors[colorScheme].text },
    methodSub: { fontSize: 12, opacity: 0.7, color: Colors[colorScheme].text, marginTop: 2 },
    toggleBankBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: gymColor + '15',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: gymColor + '30',
        marginBottom: 10
    },
    toggleBankText: { fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
    bankInfoCard: {
        padding: 15,
        marginBottom: 12,
        borderRadius: 8,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border
    },
    copyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    bankInfoText: { fontSize: 15, color: Colors[colorScheme].text, flex: 1, fontWeight: '600' },
    input: {
        height: 50,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        color: Colors[colorScheme].text,
        marginBottom: 15,
        backgroundColor: Colors[colorScheme].cardBackground
    },
    imagePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 8,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: gymColor,
        marginBottom: 15
    },
    imagePickerText: { fontWeight: 'bold', fontSize: 16 },
    previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 20, resizeMode: 'contain' },
    submitBtn: { backgroundColor: gymColor, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 20 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    checkingBox: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 18,
        marginTop: 8,
        marginBottom: 20,
        borderRadius: 12,
        backgroundColor: '#009EE318',
    },
    checkingText: { color: Colors[colorScheme].text, fontWeight: '700', fontSize: 14 },
});

export default TransferPaymentModal;
