import React, { useCallback, useEffect, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import CustomAlert from '@/components/CustomAlert';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';

const emptyForm = () => ({
    name: '',
    description: '',
    isActive: true,
    imageUrl: '',
    imageAsset: null,
    clearImage: false,
});

const AdminBeneficiosModal = ({ visible, onClose, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [items, setItems] = useState([]);
    const [form, setForm] = useState(emptyForm());
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    const closeAlert = () => setAlertInfo((p) => ({ ...p, visible: false }));

    const loadData = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await apiClient.get('/benefits?all=1');
            setItems(res.data || []);
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudieron cargar los beneficios.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (visible) loadData();
    }, [visible, loadData]);

    const openCreate = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
    };

    const openEdit = (item) => {
        setEditingId(item._id);
        setForm({
            name: item.name || '',
            description: item.description || '',
            isActive: item.isActive !== false,
            imageUrl: item.imageUrl || '',
            imageAsset: null,
            clearImage: false,
        });
        setShowForm(true);
    };

    const handleClose = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm());
        onClose?.();
    };

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            setAlertInfo({
                visible: true,
                title: 'Permiso requerido',
                message: 'Necesitamos acceso a tus fotos para subir la imagen.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
            });
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1],
        });
        if (result.canceled || !result.assets?.[0]) return;
        setForm((prev) => ({
            ...prev,
            imageAsset: result.assets[0],
            clearImage: false,
        }));
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.description.trim()) {
            setAlertInfo({
                visible: true,
                title: 'Faltan datos',
                message: 'Nombre y beneficio son obligatorios.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
            });
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('name', form.name.trim());
            formData.append('description', form.description.trim());
            formData.append('isActive', form.isActive ? 'true' : 'false');
            if (form.clearImage && !form.imageAsset) {
                formData.append('clearImage', 'true');
            }

            if (form.imageAsset?.uri) {
                const uri = form.imageAsset.uri;
                let filename = form.imageAsset.fileName || uri.split('/').pop() || 'beneficio.jpg';
                if (!filename.includes('.')) filename = 'beneficio.jpg';
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
                await apiClient.put(`/benefits/${editingId}`, formData, { headers });
            } else {
                await apiClient.post('/benefits', formData, { headers });
            }
            setShowForm(false);
            await loadData();
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo guardar.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = (item) => {
        setAlertInfo({
            visible: true,
            title: 'Desactivar beneficio',
            message: `¿Ocultar "${item.name}" para los clientes?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: closeAlert },
                {
                    text: 'Desactivar',
                    style: 'destructive',
                    onPress: async () => {
                        closeAlert();
                        try {
                            await apiClient.delete(`/benefits/${item._id}`);
                            await loadData();
                        } catch (error) {
                            setAlertInfo({
                                visible: true,
                                title: 'Error',
                                message: error.response?.data?.message || 'No se pudo desactivar.',
                                buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
                            });
                        }
                    },
                },
            ],
        });
    };

    const previewUri = form.imageAsset?.uri || (!form.clearImage ? form.imageUrl : '');

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
                            <Text style={styles.kicker}>Administración</Text>
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
                    ) : showForm ? (
                        <ScrollView
                            contentContainerStyle={styles.formScroll}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.formTitle}>
                                {editingId ? 'Editar beneficio' : 'Nuevo beneficio'}
                            </Text>

                            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
                                {previewUri ? (
                                    <Image source={{ uri: previewUri }} style={styles.previewImage} />
                                ) : (
                                    <View style={styles.imagePlaceholder}>
                                        <Ionicons name="image-outline" size={28} color={Colors[colorScheme].icon} />
                                        <Text style={styles.imagePlaceholderText}>Agregar imagen</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            {(previewUri || form.imageUrl) && (
                                <TouchableOpacity
                                    onPress={() =>
                                        setForm((prev) => ({
                                            ...prev,
                                            imageAsset: null,
                                            imageUrl: '',
                                            clearImage: true,
                                        }))
                                    }
                                    style={styles.clearImageBtn}
                                >
                                    <Text style={styles.clearImageText}>Quitar imagen</Text>
                                </TouchableOpacity>
                            )}

                            <Text style={styles.label}>Nombre</Text>
                            <TextInput
                                style={styles.input}
                                value={form.name}
                                onChangeText={(name) => setForm((p) => ({ ...p, name }))}
                                placeholder="Ej: 20% en suplementos"
                                placeholderTextColor={Colors[colorScheme].icon}
                            />

                            <Text style={styles.label}>Beneficio</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={form.description}
                                onChangeText={(description) => setForm((p) => ({ ...p, description }))}
                                placeholder="Describí el beneficio para el cliente..."
                                placeholderTextColor={Colors[colorScheme].icon}
                                multiline
                                textAlignVertical="top"
                            />

                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Visible para clientes</Text>
                                <Switch
                                    value={form.isActive}
                                    onValueChange={(isActive) => setForm((p) => ({ ...p, isActive }))}
                                    trackColor={{ false: '#ccc', true: accent + '88' }}
                                    thumbColor={form.isActive ? accent : '#f4f3f4'}
                                />
                            </View>

                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.secondaryBtn}
                                    onPress={() => setShowForm(false)}
                                    disabled={saving}
                                >
                                    <Text style={styles.secondaryBtnText}>Volver</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.primaryBtn, { backgroundColor: accent }]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryBtnText}>Guardar</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    ) : (
                        <>
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
                                {items.length === 0 ? (
                                    <View style={styles.emptyWrap}>
                                        <Ionicons name="gift-outline" size={40} color={Colors[colorScheme].icon} />
                                        <Text style={styles.emptyTitle}>Sin beneficios</Text>
                                        <Text style={styles.emptyHint}>
                                            Creá el primero con imagen, nombre y descripción.
                                        </Text>
                                    </View>
                                ) : (
                                    items.map((item) => (
                                        <View
                                            key={item._id}
                                            style={[
                                                styles.card,
                                                !item.isActive && styles.cardInactive,
                                            ]}
                                        >
                                            {item.imageUrl ? (
                                                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
                                            ) : (
                                                <View style={[styles.cardImage, styles.cardImageFallback]}>
                                                    <Ionicons name="gift-outline" size={24} color={accent} />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                                                <Text style={[styles.cardStatus, { color: item.isActive ? accent : '#e74c3c' }]}>
                                                    {item.isActive ? 'Activo' : 'Oculto'}
                                                </Text>
                                            </View>
                                            <View style={styles.cardActions}>
                                                <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}>
                                                    <Ionicons name="create-outline" size={20} color={Colors[colorScheme].text} />
                                                </TouchableOpacity>
                                                {item.isActive && (
                                                    <TouchableOpacity onPress={() => handleDeactivate(item)} hitSlop={8}>
                                                        <Ionicons name="eye-off-outline" size={20} color="#e74c3c" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                            <TouchableOpacity
                                style={[styles.fab, { backgroundColor: accent }]}
                                onPress={openCreate}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="add" size={28} color="#fff" />
                            </TouchableOpacity>
                        </>
                    )}
                </KeyboardAwareSheet>
            </View>

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={closeAlert}
                gymColor={accent}
            />
        </Modal>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f7f8fa';
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
        sheet: { width: '100%', height: '92%', maxHeight: '92%', overflow: 'hidden' },
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
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        listScroll: { padding: 16, paddingBottom: 100 },
        card: {
            flexDirection: 'row',
            gap: 12,
            backgroundColor: soft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 10,
            alignItems: 'center',
        },
        cardInactive: { opacity: 0.65 },
        cardImage: { width: 56, height: 56, borderRadius: 12 },
        cardImageFallback: {
            backgroundColor: accent + '18',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
        cardDesc: { marginTop: 2, fontSize: 13, color: colors.text, opacity: 0.7, lineHeight: 18 },
        cardStatus: { marginTop: 6, fontSize: 12, fontWeight: '700' },
        cardActions: { gap: 14, paddingLeft: 4 },
        emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
        emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: colors.text },
        emptyHint: {
            marginTop: 6,
            fontSize: 14,
            textAlign: 'center',
            color: colors.text,
            opacity: 0.65,
            lineHeight: 20,
        },
        fab: {
            position: 'absolute',
            right: 20,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 6,
        },
        formScroll: { padding: 16, paddingBottom: 40 },
        formTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 14 },
        imagePicker: {
            height: 160,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: soft,
            marginBottom: 8,
        },
        previewImage: { width: '100%', height: '100%' },
        imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
        imagePlaceholderText: { fontSize: 13, fontWeight: '600', color: colors.icon },
        clearImageBtn: { alignSelf: 'flex-start', marginBottom: 12 },
        clearImageText: { color: '#e74c3c', fontWeight: '700', fontSize: 13 },
        label: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.icon,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            marginBottom: 8,
            marginTop: 4,
        },
        input: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: colors.text,
            backgroundColor: soft,
            marginBottom: 12,
        },
        textArea: { minHeight: 110 },
        switchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginVertical: 8,
        },
        switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
        formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
        secondaryBtn: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
        },
        secondaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.text },
        primaryBtn: {
            flex: 1.2,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 14,
            minHeight: 50,
        },
        primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    });
};

export default AdminBeneficiosModal;
