import React, { useEffect, useMemo, useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
    useColorScheme, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { ThemedText } from '@/components/ThemedText';
import FilterModal from '@/components/FilterModal';

const PACKAGE_TYPES = [
    {
        id: 'creditos',
        title: 'Créditos',
        subtitle: 'Pack de clases de un tipo'
    },
    {
        id: 'pase',
        title: 'Pase Libre',
        subtitle: 'Turnos ilimitados + QR'
    },
    {
        id: 'membresia',
        title: 'Membresía',
        subtitle: 'Solo acceso por QR'
    }
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
    tipoClase: defaultTipoClase
});

const PackageFormModal = ({
    visible,
    onClose,
    onSubmit,
    editingPackage,
    classTypes = [],
    gymColor
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);
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
                tipoClase: editingPackage.tipoClase?._id || editingPackage.tipoClase || classTypes[0]?._id || ''
            });
        } else {
            setForm(emptyForm(classTypes[0]?._id || ''));
        }
        setError('');
    }, [visible, editingPackage, classTypes]);

    const setField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

    const selectedType = useMemo(
        () => classTypes.find(t => t._id === form.tipoClase),
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
            tipoClase: form.type === 'creditos' ? form.tipoClase : null
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
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={[styles.header, { backgroundColor: gymColor || '#1a5276' }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>{editingPackage ? 'Editar paquete' : 'Nuevo paquete'}</Text>
                            <Text style={styles.headerSub}>Así lo van a ver los clientes al comprar</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={styles.sectionTitle}>Tipo de producto</Text>
                        <View style={styles.typeGrid}>
                            {PACKAGE_TYPES.map(type => {
                                const selected = form.type === type.id;
                                return (
                                    <TouchableOpacity
                                        key={type.id}
                                        style={[styles.typeCard, selected && { borderColor: gymColor, backgroundColor: gymColor + '14' }]}
                                        onPress={() => setField('type', type.id)}
                                    >
                                        <Text style={[styles.typeTitle, selected && { color: gymColor }]}>{type.title}</Text>
                                        <Text style={styles.typeSub}>{type.subtitle}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.inputLabel}>Nombre</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={form.type === 'pase' ? 'Ej: Pase Libre 30 días' : form.type === 'membresia' ? 'Ej: Membresía mensual' : 'Ej: Pack 8 clases'}
                            placeholderTextColor="#999"
                            value={form.name}
                            onChangeText={(text) => setField('name', text)}
                        />

                        <Text style={styles.inputLabel}>Precio ($)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 25000"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={form.price}
                            onChangeText={(text) => setField('price', text)}
                        />

                        <Text style={styles.inputLabel}>Descripción (opcional)</Text>
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                            placeholder="Qué incluye, vigencia, condiciones..."
                            placeholderTextColor="#999"
                            multiline
                            value={form.description}
                            onChangeText={(text) => setField('description', text)}
                        />

                        {form.type === 'creditos' ? (
                            <>
                                <Text style={styles.inputLabel}>Cantidad de créditos</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                                    {CREDIT_PRESETS.map(amount => (
                                        <TouchableOpacity
                                            key={amount}
                                            style={[styles.chip, form.creditsAmount === String(amount) && { backgroundColor: gymColor, borderColor: gymColor }]}
                                            onPress={() => setField('creditsAmount', String(amount))}
                                        >
                                            <Text style={[styles.chipText, form.creditsAmount === String(amount) && { color: '#fff' }]}>{amount}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TextInput
                                    style={styles.input}
                                    placeholder="O ingresá otra cantidad"
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                    value={form.creditsAmount}
                                    onChangeText={(text) => setField('creditsAmount', text)}
                                />

                                <Text style={styles.inputLabel}>¿Qué crédito entrega?</Text>
                                <TouchableOpacity
                                    style={styles.filterButton}
                                    onPress={() => setClassTypePickerVisible(true)}
                                >
                                    <Text style={styles.filterButtonText} numberOfLines={1}>
                                        {selectedType?.nombre || 'Elegí un tipo de crédito'}
                                    </Text>
                                    <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.inputLabel}>Duración</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                                    {DURATION_PRESETS.map(days => (
                                        <TouchableOpacity
                                            key={days}
                                            style={[styles.chip, form.durationDays === String(days) && { backgroundColor: gymColor, borderColor: gymColor }]}
                                            onPress={() => setField('durationDays', String(days))}
                                        >
                                            <Text style={[styles.chipText, form.durationDays === String(days) && { color: '#fff' }]}>{days} días</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TextInput
                                    style={styles.input}
                                    placeholder="O ingresá otra duración en días"
                                    placeholderTextColor="#999"
                                    keyboardType="numeric"
                                    value={form.durationDays}
                                    onChangeText={(text) => setField('durationDays', text)}
                                />
                            </>
                        )}

                        <View style={styles.previewCard}>
                            <Text style={styles.previewKicker}>Vista previa</Text>
                            <ThemedText style={styles.previewName}>{form.name || 'Nombre del paquete'}</ThemedText>
                            <Text style={[styles.previewPrice, { color: gymColor }]}>
                                {form.price ? `$${Number(form.price).toLocaleString('es-AR')}` : '$0'}
                            </Text>
                            <Text style={styles.previewMeta}>{previewLabel}</Text>
                            {form.description ? <Text style={styles.previewDesc}>{form.description}</Text> : null}
                        </View>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <View style={styles.actions}>
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                                <Text style={styles.buttonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: gymColor || '#1a5276' }]}
                                onPress={handleSave}
                                disabled={submitting}
                            >
                                {submitting ? <ActivityIndicator color="#fff" /> : (
                                    <Text style={styles.buttonText}>{editingPackage ? 'Guardar' : 'Crear paquete'}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
            <FilterModal
                visible={classTypePickerVisible}
                onClose={() => setClassTypePickerVisible(false)}
                options={classTypes.map(type => ({ _id: type._id, nombre: type.nombre }))}
                onSelect={(id) => {
                    setField('tipoClase', id);
                    setClassTypePickerVisible(false);
                }}
                selectedValue={form.tipoClase}
                title="Tipo de crédito"
                theme={{ colors: Colors[colorScheme], gymColor }}
            />
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
        width: '100%',
        maxHeight: '92%',
        backgroundColor: Colors[colorScheme].background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden'
    },
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 },
    headerTitle: { fontSize: 19, fontWeight: 'bold', color: '#fff' },
    headerSub: { fontSize: 13, color: '#fff', opacity: 0.85, marginTop: 2 },
    closeBtn: { padding: 4 },
    content: { padding: 20, paddingBottom: 36 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 12 },
    typeGrid: { flexDirection: 'row', gap: 8, marginBottom: 18 },
    typeCard: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 14,
        padding: 12,
        minHeight: 96,
        justifyContent: 'center'
    },
    typeTitle: { fontSize: 13, fontWeight: '800', color: Colors[colorScheme].text },
    typeSub: { fontSize: 11, color: Colors[colorScheme].text, opacity: 0.65, marginTop: 4, lineHeight: 14 },
    inputLabel: { fontSize: 14, marginBottom: 8, color: Colors[colorScheme].text, fontWeight: 'bold' },
    input: {
        minHeight: 50,
        borderColor: Colors[colorScheme].border,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 15,
        marginBottom: 16,
        backgroundColor: Colors[colorScheme].cardBackground,
        color: Colors[colorScheme].text,
        fontSize: 16
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].cardBackground,
        marginRight: 8,
        marginBottom: 8
    },
    chipText: { color: Colors[colorScheme].text, fontWeight: '700', fontSize: 13 },
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
        marginBottom: 16
    },
    filterButtonText: { fontSize: 16, color: Colors[colorScheme].text, flexShrink: 1 },
    previewCard: {
        borderRadius: 16,
        padding: 16,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        marginTop: 8,
        marginBottom: 12
    },
    previewKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.5, color: Colors[colorScheme].text },
    previewName: { fontSize: 18, fontWeight: '800', marginTop: 6 },
    previewPrice: { fontSize: 22, fontWeight: '900', marginTop: 4 },
    previewMeta: { fontSize: 13, marginTop: 4, color: Colors[colorScheme].text, opacity: 0.75 },
    previewDesc: { fontSize: 13, marginTop: 8, color: Colors[colorScheme].text, opacity: 0.7 },
    errorText: { color: '#c0392b', fontWeight: '600', marginBottom: 10 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancelButton: { backgroundColor: '#6c757d' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default PackageFormModal;
