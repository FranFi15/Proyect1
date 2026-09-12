import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ScrollView,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    useColorScheme,
    Switch,
    Platform,
} from 'react-native';
import { Ionicons, FontAwesome6, Octicons } from '@expo/vector-icons';
import { format, parseISO, isBefore } from 'date-fns';
import { Colors } from '@/constants/Colors';
import apiClient from '@/services/apiClient';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';
import CustomAlert from '@/components/CustomAlert';
import SheetDatePicker from '@/components/SheetDatePicker';
import WebDatePicker from '@/components/WebDatePicker';

const AVAILABLE_METRICS = [
    { id: 'peso', label: 'Peso' },
    { id: 'tiempo', label: 'Tiempo' },
    { id: 'distancia', label: 'Distancia' },
    { id: 'repeticiones', label: 'Reps' },
];

const emptyForm = () => ({
    nombre: '',
    descripcion: '',
    metrics: ['tiempo'],
    metricUnit: '',
    hasDeadline: false,
    fechaLimite: new Date(),
    visible: true,
});

/**
 * Admin Desafíos CRUD sheet.
 */
export default function DesafiosAdminModal({ visible, onClose, gymColor }) {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);

    const [viewMode, setViewMode] = useState('list');
    const [scoreboards, setScoreboards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(emptyForm());
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const showAlert = (title, message, buttons) => {
        setAlertInfo({
            visible: true,
            title,
            message,
            buttons: buttons || [
                { text: 'OK', style: 'primary', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) },
            ],
        });
    };

    const fetchScoreboards = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await apiClient.get('/scoreboards/active');
            setScoreboards(res.data || []);
        } catch (e) {
            console.error(e);
            showAlert('Error', 'No se pudieron cargar los desafíos.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!visible) return;
        setViewMode('list');
        setEditingId(null);
        setFormData(emptyForm());
        setDatePickerVisible(false);
        fetchScoreboards();
    }, [visible, fetchScoreboards]);

    const handleCreate = () => {
        setEditingId(null);
        setFormData(emptyForm());
        setViewMode('form');
    };

    const handleEdit = (item) => {
        setEditingId(item._id);
        setFormData({
            nombre: item.nombre || '',
            descripcion: item.descripcion || '',
            metrics: item.metrics || [],
            metricUnit: item.metricUnit || '',
            hasDeadline: !!item.fechaLimite,
            fechaLimite: item.fechaLimite ? parseISO(item.fechaLimite) : new Date(),
            visible: item.visible !== false,
        });
        setViewMode('form');
    };

    const toggleMetric = (id) => {
        setFormData((prev) => {
            const exists = prev.metrics.includes(id);
            return {
                ...prev,
                metrics: exists ? prev.metrics.filter((m) => m !== id) : [...prev.metrics, id],
            };
        });
    };

    const handleSubmit = async () => {
        if (!formData.nombre.trim()) {
            showAlert('Nombre requerido', 'Ingresá un nombre para el desafío.');
            return;
        }
        if (!formData.metrics.length) {
            showAlert('Métricas', 'Seleccioná al menos una métrica.');
            return;
        }
        setSaving(true);
        const payload = {
            ...formData,
            nombre: formData.nombre.trim(),
            fechaLimite: formData.hasDeadline ? formData.fechaLimite : null,
        };
        try {
            if (editingId) await apiClient.put(`/scoreboards/${editingId}`, payload);
            else await apiClient.post('/scoreboards', payload);
            setViewMode('list');
            setEditingId(null);
            await fetchScoreboards({ silent: true });
            showAlert('Listo', editingId ? 'Desafío actualizado.' : 'Desafío creado.');
        } catch (e) {
            showAlert('Error', e?.response?.data?.message || 'No se pudo guardar el desafío.');
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = (item) => {
        showAlert(
            'Eliminar desafío',
            `¿Eliminar "${item.nombre}"? Esta acción no se puede deshacer.`,
            [
                { text: 'Cancelar', style: 'cancel', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setAlertInfo((p) => ({ ...p, visible: false }));
                        try {
                            await apiClient.delete(`/scoreboards/${item._id}`);
                            fetchScoreboards({ silent: true });
                        } catch (e) {
                            showAlert('Error', e?.response?.data?.message || 'No se pudo eliminar.');
                        }
                    },
                },
            ]
        );
    };

    const renderListItem = ({ item }) => {
        const expired = item.fechaLimite ? isBefore(parseISO(item.fechaLimite), new Date()) : false;
        return (
            <View style={styles.card}>
                <View style={[styles.accentBar, { backgroundColor: item.visible === false ? '#8e8e93' : accent }]} />
                <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.nombre}</Text>
                        <View style={[styles.badge, { backgroundColor: item.visible === false ? '#8e8e9322' : '#2ecc7122' }]}>
                            <Text style={[styles.badgeText, { color: item.visible === false ? '#8e8e93' : '#2ecc71' }]}>
                                {item.visible === false ? 'Oculto' : 'Visible'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={2}>
                        {item.descripcion || 'Sin descripción'}
                    </Text>
                    <View style={styles.chipRow}>
                        <View style={styles.metaChip}>
                            <Ionicons name="time-outline" size={12} color={expired ? '#e74c3c' : Colors[colorScheme].icon} />
                            <Text style={[styles.metaChipText, expired && { color: '#e74c3c' }]}>
                                {item.fechaLimite
                                    ? `Vence ${format(parseISO(item.fechaLimite), 'dd/MM/yyyy')}`
                                    : 'Permanente'}
                            </Text>
                        </View>
                        {(item.metrics || []).map((m) => (
                            <View key={m} style={styles.metaChip}>
                                <Text style={styles.metaChipText}>{m}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.actionChip, { backgroundColor: accent + '18', borderColor: accent + '33' }]}
                            onPress={() => handleEdit(item)}
                        >
                            <FontAwesome6 name="edit" size={13} color={accent} />
                            <Text style={[styles.actionChipText, { color: accent }]}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionChip, { backgroundColor: '#e74c3c18', borderColor: '#e74c3c33' }]}
                            onPress={() => confirmDelete(item)}
                        >
                            <Octicons name="trash" size={14} color="#e74c3c" />
                            <Text style={[styles.actionChipText, { color: '#e74c3c' }]}>Eliminar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const headerTitle =
        viewMode === 'list' ? 'Desafíos' : editingId ? 'Editar desafío' : 'Nuevo desafío';

    const sheetVisible = visible && !(datePickerVisible && Platform.OS !== 'web');

    return (
        <>
            <Modal
                visible={sheetVisible}
                transparent
                animationType="slide"
                onRequestClose={onClose}
                statusBarTranslucent
                presentationStyle="overFullScreen"
            >
                <View style={styles.root}>
                    <KeyboardAwareSheet
                        onDismiss={onClose}
                        backgroundColor={Colors[colorScheme].background}
                        style={styles.sheet}
                    >
                        <View style={[styles.header, { backgroundColor: accent }]}>
                            {viewMode === 'form' ? (
                                <TouchableOpacity onPress={() => setViewMode('list')} style={styles.headerIconBtn}>
                                    <Ionicons name="arrow-back" size={22} color="#fff" />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ width: 36 }} />
                            )}
                            <View style={{ flex: 1, marginHorizontal: 8 }}>
                                <Text style={styles.headerKicker}>Gestión de retos</Text>
                                <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.headerIconBtn}>
                                <Ionicons name="close" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {viewMode === 'list' ? (
                            <>
                                {loading && !refreshing ? (
                                    <View style={styles.centered}>
                                        <ActivityIndicator color={accent} size="large" />
                                    </View>
                                ) : (
                                    <FlatList
                                        data={scoreboards}
                                        keyExtractor={(item) => item._id}
                                        renderItem={renderListItem}
                                        contentContainerStyle={styles.listContent}
                                        ListEmptyComponent={
                                            <View style={styles.emptyWrap}>
                                                <Ionicons name="trophy-outline" size={40} color={Colors[colorScheme].icon} />
                                                <Text style={styles.emptyText}>No hay desafíos todavía.</Text>
                                                <Text style={styles.emptyHint}>Creá el primero con el botón +</Text>
                                            </View>
                                        }
                                        refreshControl={
                                            <RefreshControl
                                                refreshing={refreshing}
                                                onRefresh={() => fetchScoreboards({ silent: true })}
                                                tintColor={accent}
                                            />
                                        }
                                    />
                                )}
                                <TouchableOpacity style={[styles.fab, { backgroundColor: accent }]} onPress={handleCreate}>
                                    <Ionicons name="add" size={28} color="#fff" />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <ScrollView
                                contentContainerStyle={styles.formScroll}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="information-circle-outline" size={18} color={accent} />
                                        <Text style={styles.sectionTitle}>Datos</Text>
                                    </View>
                                    <Text style={styles.inputLabel}>Nombre</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.nombre}
                                        onChangeText={(t) => setFormData((p) => ({ ...p, nombre: t }))}
                                        placeholder="Ej: Murph"
                                        placeholderTextColor={Colors[colorScheme].icon}
                                    />
                                    <Text style={styles.inputLabel}>Descripción</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={formData.descripcion}
                                        onChangeText={(t) => setFormData((p) => ({ ...p, descripcion: t }))}
                                        placeholder="Detalles del reto..."
                                        placeholderTextColor={Colors[colorScheme].icon}
                                        multiline
                                        textAlignVertical="top"
                                    />
                                </View>

                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="speedometer-outline" size={18} color={accent} />
                                        <Text style={styles.sectionTitle}>Métricas</Text>
                                    </View>
                                    <View style={styles.metricsRow}>
                                        {AVAILABLE_METRICS.map((m) => {
                                            const selected = formData.metrics.includes(m.id);
                                            return (
                                                <TouchableOpacity
                                                    key={m.id}
                                                    onPress={() => toggleMetric(m.id)}
                                                    style={[
                                                        styles.metricChip,
                                                        selected && { backgroundColor: accent, borderColor: accent },
                                                    ]}
                                                >
                                                    <Text style={[styles.metricChipText, selected && { color: '#fff' }]}>
                                                        {m.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="calendar-outline" size={18} color={accent} />
                                        <Text style={styles.sectionTitle}>Plazo</Text>
                                    </View>
                                    <View style={styles.switchRow}>
                                        <Text style={styles.inputLabel}>¿Tiene fecha límite?</Text>
                                        <Switch
                                            value={formData.hasDeadline}
                                            onValueChange={(v) => setFormData((p) => ({ ...p, hasDeadline: v }))}
                                            trackColor={{ true: accent }}
                                        />
                                    </View>
                                    {formData.hasDeadline && (
                                        Platform.OS === 'web' ? (
                                            <View style={{ marginTop: 8, zIndex: 20 }}>
                                                <WebDatePicker
                                                    selected={formData.fechaLimite}
                                                    onChange={(date) => setFormData((p) => ({ ...p, fechaLimite: date }))}
                                                    dateFormat="dd/MM/yyyy"
                                                    customInput={
                                                        <TouchableOpacity style={styles.dateBtn}>
                                                            <Text style={styles.dateBtnText}>
                                                                {format(formData.fechaLimite, 'dd/MM/yyyy')}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    }
                                                />
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.dateBtn}
                                                onPress={() => setDatePickerVisible(true)}
                                            >
                                                <Ionicons name="calendar" size={16} color={accent} />
                                                <Text style={styles.dateBtnText}>
                                                    {format(formData.fechaLimite, 'dd/MM/yyyy')}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    )}
                                </View>

                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="eye-outline" size={18} color={accent} />
                                        <Text style={styles.sectionTitle}>Visibilidad</Text>
                                    </View>
                                    <View style={styles.switchRow}>
                                        <Text style={styles.inputLabel}>Visible para clientes</Text>
                                        <Switch
                                            value={formData.visible}
                                            onValueChange={(v) => setFormData((p) => ({ ...p, visible: v }))}
                                            trackColor={{ true: '#2ecc71' }}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
                                    onPress={handleSubmit}
                                    disabled={saving}
                                    activeOpacity={0.88}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="save-outline" size={20} color="#fff" />
                                            <Text style={styles.primaryBtnText}>
                                                {editingId ? 'Guardar cambios' : 'Crear desafío'}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </KeyboardAwareSheet>

                    <CustomAlert
                        inline
                        visible={alertInfo.visible}
                        title={alertInfo.title}
                        message={alertInfo.message}
                        buttons={alertInfo.buttons}
                        onClose={() => setAlertInfo((p) => ({ ...p, visible: false }))}
                        gymColor={accent}
                    />
                </View>
            </Modal>

            {Platform.OS !== 'web' && (
                <SheetDatePicker
                    visible={datePickerVisible}
                    value={formData.fechaLimite}
                    title="Fecha límite"
                    gymColor={accent}
                    onClose={() => setDatePickerVisible(false)}
                    onConfirm={(date) => {
                        setFormData((p) => ({ ...p, fechaLimite: date }));
                        setDatePickerVisible(false);
                    }}
                />
            )}
        </>
    );
}

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
        sheet: { width: '100%', height: '92%', maxHeight: '92%', overflow: 'hidden' },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 14,
        },
        headerKicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 2,
        },
        headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
        headerIconBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        listContent: { padding: 16, paddingBottom: 100, flexGrow: 1 },
        emptyWrap: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
        emptyText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: colors.text },
        emptyHint: { marginTop: 4, fontSize: 13, color: colors.text, opacity: 0.6 },
        card: {
            flexDirection: 'row',
            backgroundColor: soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 10,
            overflow: 'hidden',
        },
        accentBar: { width: 5 },
        cardBody: { flex: 1, padding: 14 },
        cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
        cardDesc: { marginTop: 4, fontSize: 13, color: colors.text, opacity: 0.7 },
        badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
        badgeText: { fontSize: 11, fontWeight: '800' },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
        metaChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
        },
        metaChipText: { fontSize: 11, fontWeight: '600', color: colors.text, opacity: 0.75 },
        actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
        actionChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            flexGrow: 1,
            minWidth: '40%',
            justifyContent: 'center',
        },
        actionChipText: { fontSize: 12, fontWeight: '800' },
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
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
        },
        formScroll: { padding: 16, paddingBottom: 40 },
        sectionCard: {
            backgroundColor: soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 12,
        },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
        sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
        inputLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, opacity: 0.85 },
        input: {
            height: 46,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            color: colors.text,
            fontSize: 15,
            marginBottom: 12,
        },
        textArea: { height: 88, paddingTop: 12 },
        metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        metricChip: {
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        metricChipText: { fontSize: 13, fontWeight: '700', color: colors.text },
        switchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        dateBtn: {
            marginTop: 10,
            height: 46,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        dateBtnText: { fontSize: 15, color: colors.text, fontWeight: '600' },
        primaryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: accent,
            paddingVertical: 15,
            borderRadius: 14,
            marginTop: 4,
        },
        primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    });
};
