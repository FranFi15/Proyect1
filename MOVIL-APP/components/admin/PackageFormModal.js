import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import FilterModal from '@/components/FilterModal';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';

const PACKAGE_TYPES = [
    { id: 'creditos', title: 'Créditos', subtitle: 'Pack de clases', icon: 'ticket-outline' },
    { id: 'pase', title: 'Pase Libre', subtitle: 'Ilimitado + QR', icon: 'infinite-outline' },
    { id: 'membresia', title: 'Membresía', subtitle: 'Solo acceso QR', icon: 'id-card-outline' },
];

const DURATION_PRESETS = [7, 15, 30, 60, 90];
const CREDIT_PRESETS = [1, 4, 8, 12, 16];

const emptyForm = (defaultTipoClase = '') => ({
    name: '',
    description: '',
    price: '',
    type: 'creditos',
    durationDays: '30',
    creditsAmount: '8',
    tipoClase: defaultTipoClase,
});

const PackageFormModal = ({
    visible,
    onClose,
    onSubmit,
    editingPackage,
    classTypes = [],
    gymColor,
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const colors = Colors[colorScheme];
    const styles = getStyles(colorScheme, accent);
    const [form, setForm] = useState(emptyForm(classTypes[0]?._id || ''));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [classTypePickerVisible, setClassTypePickerVisible] = useState(false);

    useEffect(() => {
        if (!visible) return;
        if (editingPackage) {
            setForm({
                name: editingPackage.name || '',
                description: editingPackage.description || '',
                price: editingPackage.price?.toString() || '',
                type: editingPackage.isPaseLibre ? 'pase' : editingPackage.isMembresia ? 'membresia' : 'creditos',
                durationDays: editingPackage.durationDays?.toString() || '30',
                creditsAmount: editingPackage.creditsAmount?.toString() || '8',
                tipoClase: editingPackage.tipoClase?._id || editingPackage.tipoClase || classTypes[0]?._id || '',
            });
        } else {
            setForm(emptyForm(classTypes[0]?._id || ''));
        }
        setError('');
        setClassTypePickerVisible(false);
    }, [visible, editingPackage, classTypes]);

    const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

    const selectedType = useMemo(
        () => classTypes.find((t) => t._id === form.tipoClase),
        [classTypes, form.tipoClase]
    );

    const previewLabel = useMemo(() => {
        if (form.type === 'pase') return `Acceso libre por ${form.durationDays || 0} días`;
        if (form.type === 'membresia') return `Membresía QR por ${form.durationDays || 0} días`;
        return `${form.creditsAmount || 0} créditos de ${selectedType?.nombre || 'clase'}`;
    }, [form, selectedType]);

    const handleSave = async () => {
        if (!form.name.trim() || !form.price) {
            setError('El nombre y el precio son obligatorios.');
            return;
        }
        if (form.type === 'creditos' && !form.tipoClase) {
            setError('Elegí qué tipo de crédito entrega el paquete.');
            return;
        }

        const payload = {
            name: form.name.trim(),
            description: form.description.trim(),
            price: Number(form.price),
            isPaseLibre: form.type === 'pase',
            isMembresia: form.type === 'membresia',
            durationDays: Number(form.durationDays) || 30,
            creditsAmount: form.type === 'creditos' ? Number(form.creditsAmount) || 0 : 0,
            tipoClase: form.type === 'creditos' ? form.tipoClase : null,
        };

        setSubmitting(true);
        setError('');
        try {
            await onSubmit(payload);
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo guardar el paquete.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="overFullScreen"
            statusBarTranslucent
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <KeyboardAwareSheet
                    onDismiss={onClose}
                    backgroundColor={colors.background}
                    borderRadius={20}
                    style={styles.sheet}
                >
                    <View style={styles.root}>
                        <View style={[styles.header, { backgroundColor: accent }]}>
                            <View style={styles.headerTextWrap}>
                                <Text style={styles.headerKicker}>
                                    {editingPackage ? 'Editar paquete' : 'Nuevo paquete'}
                                </Text>
                                <Text style={styles.headerTitle} numberOfLines={1}>
                                    {form.name.trim() || 'Producto de venta'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                                <Ionicons name="close" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.scroll}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="interactive"
                        >
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Tipo de producto</Text>
                                <Text style={styles.cardSub}>Elegí qué van a comprar los clientes.</Text>
                                <View style={styles.typeGrid}>
                                    {PACKAGE_TYPES.map((type) => {
                                        const selected = form.type === type.id;
                                        return (
                                            <TouchableOpacity
                                                key={type.id}
                                                style={[
                                                    styles.typeCard,
                                                    selected && { borderColor: accent, backgroundColor: accent + '14' },
                                                ]}
                                                onPress={() => setField('type', type.id)}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons
                                                    name={type.icon}
                                                    size={16}
                                                    color={selected ? accent : colors.text}
                                                    style={{ marginBottom: 6 }}
                                                />
                                                <Text style={[styles.typeTitle, selected && { color: accent }]}>
                                                    {type.title}
                                                </Text>
                                                <Text style={styles.typeSub}>{type.subtitle}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <View style={[styles.card, { marginTop: 12 }]}>
                                <Text style={styles.cardTitle}>Información</Text>
                                <Text style={styles.cardSub}>Nombre, precio y detalle visible al comprar.</Text>

                                <Text style={styles.label}>Nombre</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={
                                        form.type === 'pase'
                                            ? 'Ej: Pase Libre 30 días'
                                            : form.type === 'membresia'
                                              ? 'Ej: Membresía mensual'
                                              : 'Ej: Pack 8 clases'
                                    }
                                    placeholderTextColor={colors.icon}
                                    value={form.name}
                                    onChangeText={(text) => setField('name', text)}
                                />

                                <Text style={styles.label}>Precio ($)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej: 25000"
                                    placeholderTextColor={colors.icon}
                                    keyboardType="numeric"
                                    value={form.price}
                                    onChangeText={(text) => setField('price', text)}
                                />

                                <Text style={styles.label}>Descripción (opcional)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Qué incluye, vigencia, condiciones..."
                                    placeholderTextColor={colors.icon}
                                    multiline
                                    value={form.description}
                                    onChangeText={(text) => setField('description', text)}
                                />
                            </View>

                            <View style={[styles.card, { marginTop: 12 }]}>
                                {form.type === 'creditos' ? (
                                    <>
                                        <Text style={styles.cardTitle}>Créditos del pack</Text>
                                        <Text style={styles.cardSub}>Cantidad y tipo de turno que entrega.</Text>

                                        <Text style={styles.label}>Cantidad de créditos</Text>
                                        <View style={styles.chipRow}>
                                            {CREDIT_PRESETS.map((amount) => {
                                                const selected = form.creditsAmount === String(amount);
                                                return (
                                                    <TouchableOpacity
                                                        key={amount}
                                                        style={[
                                                            styles.chip,
                                                            selected && { backgroundColor: accent, borderColor: accent },
                                                        ]}
                                                        onPress={() => setField('creditsAmount', String(amount))}
                                                    >
                                                        <Text style={[styles.chipText, selected && { color: '#fff' }]}>
                                                            {amount}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="O ingresá otra cantidad"
                                            placeholderTextColor={colors.icon}
                                            keyboardType="numeric"
                                            value={form.creditsAmount}
                                            onChangeText={(text) => setField('creditsAmount', text)}
                                        />

                                        <Text style={styles.label}>¿Qué crédito entrega?</Text>
                                        <TouchableOpacity
                                            style={styles.select}
                                            onPress={() => setClassTypePickerVisible(true)}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={styles.selectText} numberOfLines={1}>
                                                {selectedType?.nombre || 'Elegí un tipo de crédito'}
                                            </Text>
                                            <Ionicons name="chevron-down" size={16} color={colors.text} />
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.cardTitle}>Duración</Text>
                                        <Text style={styles.cardSub}>Vigencia del acceso desde la compra.</Text>

                                        <Text style={styles.label}>Días de vigencia</Text>
                                        <View style={styles.chipRow}>
                                            {DURATION_PRESETS.map((days) => {
                                                const selected = form.durationDays === String(days);
                                                return (
                                                    <TouchableOpacity
                                                        key={days}
                                                        style={[
                                                            styles.chip,
                                                            selected && { backgroundColor: accent, borderColor: accent },
                                                        ]}
                                                        onPress={() => setField('durationDays', String(days))}
                                                    >
                                                        <Text style={[styles.chipText, selected && { color: '#fff' }]}>
                                                            {days}d
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="O ingresá otra duración en días"
                                            placeholderTextColor={colors.icon}
                                            keyboardType="numeric"
                                            value={form.durationDays}
                                            onChangeText={(text) => setField('durationDays', text)}
                                        />
                                    </>
                                )}
                            </View>

                            <View style={[styles.previewCard, { marginTop: 12 }]}>
                                <Text style={styles.previewKicker}>Vista previa</Text>
                                <Text style={styles.previewName}>{form.name || 'Nombre del paquete'}</Text>
                                <Text style={[styles.previewPrice, { color: accent }]}>
                                    {form.price ? `$${Number(form.price).toLocaleString('es-AR')}` : '$0'}
                                </Text>
                                <Text style={styles.previewMeta}>{previewLabel}</Text>
                                {form.description ? <Text style={styles.previewDesc}>{form.description}</Text> : null}
                            </View>

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}

                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: accent, opacity: submitting ? 0.7 : 1 }]}
                                onPress={handleSave}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name={editingPackage ? 'save-outline' : 'add-circle-outline'}
                                            size={18}
                                            color="#fff"
                                        />
                                        <Text style={styles.primaryBtnText}>
                                            {editingPackage ? 'Guardar cambios' : 'Crear paquete'}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAwareSheet>

                <FilterModal
                    embedded
                    visible={classTypePickerVisible}
                    onClose={() => setClassTypePickerVisible(false)}
                    options={classTypes.map((type) => ({ _id: type._id, nombre: type.nombre }))}
                    onSelect={(id) => {
                        setField('tipoClase', id);
                        setClassTypePickerVisible(false);
                    }}
                    selectedValue={form.tipoClase}
                    title="Tipo de crédito"
                    theme={{ colors, gymColor: accent }}
                />
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const softCard = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';

    return StyleSheet.create({
        sheet: {
            width: '100%',
            height: '92%',
            maxHeight: '92%',
            overflow: 'hidden',
        },
        root: { flex: 1, width: '100%', backgroundColor: colors.background },
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
        scroll: { padding: 14, paddingBottom: 36 },
        card: {
            backgroundColor: softCard,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        cardSub: { fontSize: 13, color: colors.text, opacity: 0.6, marginTop: 4, marginBottom: 14 },
        typeGrid: { flexDirection: 'row', gap: 8 },
        typeCard: {
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 12,
            minHeight: 98,
        },
        typeTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
        typeSub: { fontSize: 11, color: colors.text, opacity: 0.6, marginTop: 4, lineHeight: 14 },
        label: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
            opacity: 0.7,
            marginBottom: 6,
        },
        input: {
            height: 48,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
            backgroundColor: colors.background,
            color: colors.text,
            fontSize: 15,
        },
        textArea: {
            height: 88,
            textAlignVertical: 'top',
            paddingTop: 12,
        },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
        chip: {
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        chipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
        select: {
            height: 48,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 4,
        },
        selectText: { fontSize: 15, color: colors.text, flexShrink: 1, paddingRight: 8 },
        previewCard: {
            borderRadius: 16,
            padding: 16,
            backgroundColor: softCard,
            borderWidth: 1,
            borderColor: colors.border,
        },
        previewKicker: {
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            opacity: 0.5,
            color: colors.text,
        },
        previewName: { fontSize: 18, fontWeight: '800', marginTop: 6, color: colors.text },
        previewPrice: { fontSize: 22, fontWeight: '900', marginTop: 4 },
        previewMeta: { fontSize: 13, marginTop: 4, color: colors.text, opacity: 0.75 },
        previewDesc: { fontSize: 13, marginTop: 8, color: colors.text, opacity: 0.7 },
        errorText: { color: '#a72828', fontWeight: '600', marginTop: 12, marginBottom: 4 },
        primaryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 13,
            borderRadius: 12,
            marginTop: 16,
        },
        primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    });
};

export default PackageFormModal;
