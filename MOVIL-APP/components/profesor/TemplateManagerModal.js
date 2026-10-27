import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ActivityIndicator, useColorScheme, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons, FontAwesome6, Octicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import { ThemedText } from '@/components/ThemedText';

import { format } from 'date-fns';
import PlanContentEditor from './PlanContentEditor';
import CustomAlert from '@/components/CustomAlert';

const TemplateManagerModal = ({ visible, onClose, onSelectTemplate, gymColor, colorScheme }) => {
    const styles = getStyles(colorScheme, gymColor);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
    
    // Estado para CustomAlert
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    const [formData, setFormData] = useState({ id: null, name: '', description: '', content: '' });

    const parseStructured = (content) => {
        if (!content) return false;
        try { return JSON.parse(content).type === 'structured'; } catch (e) { return false; }
    };

    const summarizeTemplate = (item) => {
        try {
            const parsed = JSON.parse(item.content);
            if (parsed?.type === 'structured' && Array.isArray(parsed.days)) {
                const exercises = parsed.days.reduce(
                    (total, day) => total + (Array.isArray(day.exercises) ? day.exercises.length : 0),
                    0
                );
                return { kind: 'structured', days: parsed.days.length, exercises };
            }
        } catch (e) {}
        return { kind: 'html', days: 0, exercises: 0 };
    };
    const [editorMode, setEditorMode] = useState('structured');

    useEffect(() => {
        if (visible) {
            fetchTemplates();
            setViewMode('list');
        }
    }, [visible]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/plans/templates');
            setTemplates(res.data);
        } catch (error) {
            setAlertInfo({ 
                visible: true, 
                title: "Error", 
                message: "No se pudieron cargar las plantillas",
                buttons: [{ text: "OK", onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        let nameToSave = formData.name?.trim();
        try {
            const parsed = JSON.parse(formData.content);
            if (parsed && parsed.type === 'structured' && !nameToSave) {
                nameToSave = `Plantilla: ${parsed.days?.[0]?.name || 'Por Días'}`;
            }
        } catch (e) {}

        if (!nameToSave || !formData.content) {
            setAlertInfo({ 
                visible: true, 
                title: "Campos Incompletos", 
                message: "Asegúrate de completar el contenido de la plantilla.",
                buttons: [{ text: "Entendido", onPress: () => setAlertInfo({ visible: false }) }]
            });
            return;
        }
        setLoading(true);
        try {
            const dataToSave = { ...formData, name: nameToSave };
            if (formData.id) {
                await apiClient.put(`/plans/templates/${formData.id}`, dataToSave);
            } else {
                await apiClient.post('/plans/templates', dataToSave);
            }
            await fetchTemplates();
            setViewMode('list');
        } catch (error) {
            setAlertInfo({ 
                visible: true, 
                title: "Error", 
                message: "No se pudo guardar la plantilla.",
                buttons: [{ text: "OK", onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        setAlertInfo({
            visible: true,
            title: "Eliminar Plantilla",
            message: "¿Estás seguro? Esto no afectará a los planes ya asignados.",
            buttons: [
                { 
                    text: "Cancelar", 
                    style: "cancel", 
                    onPress: () => setAlertInfo({ visible: false }) 
                },
                { 
                    text: "Eliminar", 
                    style: "destructive", 
                    onPress: async () => {
                        setAlertInfo({ visible: false }); // Cerrar alerta
                        try {
                            await apiClient.delete(`/plans/templates/${id}`);
                            fetchTemplates();
                        } catch (e) { 
                            setAlertInfo({ 
                                visible: true, 
                                title: "Error", 
                                message: "No se pudo eliminar la plantilla.",
                                buttons: [{ text: "OK", onPress: () => setAlertInfo({ visible: false }) }]
                            });
                        }
                    }
                }
            ]
        });
    };

    const openForm = (template = null) => {
        if (template) {
            const isStruct = parseStructured(template.content);
            setEditorMode(isStruct ? 'structured' : 'html');
            setFormData({ id: template._id, name: template.name, description: template.description || '', content: template.content });
        } else {
            setEditorMode('structured');
            setFormData({ id: null, name: '', description: '', content: '' });
        }
        setViewMode('form');
    };

    const renderItem = ({ item }) => {
        const hasValidDesc = item.description && !item.description.trim().startsWith('{') && !item.description.trim().startsWith('<');
        const summary = summarizeTemplate(item);
        const accent = gymColor || '#1a5276';
        return (
            <View style={styles.card}>
                <View style={[styles.accentBar, { backgroundColor: accent }]} />
                <TouchableOpacity
                    style={styles.cardBody}
                    onPress={() => onSelectTemplate ? onSelectTemplate(item) : openForm(item)}
                    activeOpacity={0.85}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                        {hasValidDesc ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                        <View style={styles.metaRow}>
                            <Ionicons name="calendar-outline" size={12} color={Colors[colorScheme].icon} />
                            <Text style={styles.metaText}>
                                {item.updatedAt ? format(new Date(item.updatedAt), 'dd/MM/yyyy') : 'Sin fecha'}
                            </Text>
                            <View style={[styles.pill, { backgroundColor: accent + '22' }]}>
                                <Text style={[styles.pillText, { color: accent }]}>
                                    {summary.kind === 'structured'
                                        ? `${summary.days} día${summary.days === 1 ? '' : 's'}`
                                        : 'Texto libre'}
                                </Text>
                            </View>
                            {summary.kind === 'structured' && summary.exercises > 0 ? (
                                <Text style={styles.metaText}>{summary.exercises} ejercicios</Text>
                            ) : null}
                        </View>
                    </View>
                </TouchableOpacity>
                <View style={styles.cardActions}>
                    {onSelectTemplate ? (
                        <TouchableOpacity
                            onPress={() => onSelectTemplate(item)}
                            style={[styles.useChip, { backgroundColor: accent }]}
                            hitSlop={6}
                        >
                            <Text style={styles.useChipText}>Usar</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => openForm(item)} style={styles.iconBtn} hitSlop={8}>
                        <FontAwesome6 name="edit" size={16} color={accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.iconBtn} hitSlop={8}>
                        <Octicons name="trash" size={16} color={Colors[colorScheme].text} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            {/* KeyboardAvoidingView configurado para evitar el rebote en Android */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.header, { backgroundColor: gymColor || '#1a5276' }]}>
                        {viewMode === 'form' ? (
                            <TouchableOpacity onPress={() => setViewMode('list')} style={styles.headerIconBtn}>
                                <Ionicons name="arrow-back" size={22} color="#fff" />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.headerIconBtn} />
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>
                                {viewMode === 'list' ? (onSelectTemplate ? 'Seleccionar Plantilla' : 'Plantillas') : (formData.id ? 'Editar Plantilla' : 'Nueva Plantilla')}
                            </Text>
                            <Text style={styles.headerSub}>
                                {viewMode === 'list' ? 'Rutinas guardadas para reutilizar' : 'Nombre, notas y contenido'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.headerIconBtn}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* CONTENIDO */}
                    {loading && <ActivityIndicator style={{margin: 20}} color={gymColor} />}
                    
                    {!loading && viewMode === 'list' && (
                        <>
                            <TouchableOpacity 
                                style={[styles.createButtonHeader, { backgroundColor: gymColor || '#007bff' }]} 
                                activeOpacity={0.85}
                                onPress={() => openForm()}
                            >
                                <View style={styles.createButtonIconWrapper}>
                                    <Ionicons name="add" size={24} color={gymColor || '#007bff'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.createButtonTitle}>Crear Nueva Plantilla</Text>
                                    <Text style={styles.createButtonSub}>Diseña y guarda una rutina en tu biblioteca</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>

                            <FlatList 
                                data={templates} 
                                renderItem={renderItem} 
                                keyExtractor={item => item._id}
                                contentContainerStyle={{padding: 15, paddingBottom: 80}}
                                ListEmptyComponent={<Text style={styles.emptyText}>No hay plantillas creadas. ¡Presiona el botón de arriba para crear una!</Text>}
                            />
                        </>
                    )}

                    {!loading && viewMode === 'form' && (
                        <ScrollView style={styles.formContainer} contentContainerStyle={{paddingBottom: 20}}>
                            <ThemedText style={styles.label}>Nombre de la Plantilla <Text style={{color:'red'}}>*</Text></ThemedText>
                            <TextInput 
                                style={styles.input} 
                                value={formData.name} 
                                onChangeText={t => setFormData({...formData, name: t})} 
                                placeholder="Ej: Rutina Hipertrofia 3 Días"
                                placeholderTextColor={Colors[colorScheme].icon}
                            />

                            <ThemedText style={styles.label}>Descripción / Notas (Opcional)</ThemedText>
                            <TextInput 
                                style={styles.input} 
                                value={formData.description} 
                                onChangeText={t => setFormData({...formData, description: t})} 
                                placeholder="Ej: Recomendado para nivel intermedio/avanzado"
                                placeholderTextColor={Colors[colorScheme].icon}
                            />

                            <ThemedText style={styles.label}>Contenido (Plan) <Text style={{color:'red'}}>*</Text></ThemedText>
                            
                            {/* EDITOR */}
                            <PlanContentEditor
                                key={formData.id || 'new'} 
                                initialContent={formData.content}
                                onChange={(contentStr) => setFormData(prev => ({...prev, content: contentStr}))}
                                colorScheme={colorScheme}
                                gymColor={gymColor}
                                mode={editorMode}
                                onModeChange={setEditorMode}
                            />

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Guardar Plantilla</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>

                {/* --- CUSTOM ALERT --- */}
                <CustomAlert 
                    visible={alertInfo.visible} 
                    title={alertInfo.title} 
                    message={alertInfo.message} 
                    buttons={alertInfo.buttons} 
                    onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                    gymColor={gymColor} 
                />

            </KeyboardAvoidingView>
        </Modal>
    );
};

const getStyles = (ColorScheme, gymColor) => {
    const soft = ColorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f7f8fa';
    return StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
    modalContainer: { width: '100%', height: '88%', backgroundColor: Colors[ColorScheme].background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, gap: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    headerSub: { fontSize: 12, color: '#fff', opacity: 0.85, marginTop: 2 },
    headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: soft,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors[ColorScheme].border,
        marginBottom: 10,
        overflow: 'hidden',
    },
    accentBar: { width: 5, alignSelf: 'stretch' },
    cardBody: { flex: 1, paddingVertical: 14, paddingLeft: 12, paddingRight: 4 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: Colors[ColorScheme].text },
    cardDesc: { fontSize: 13, color: Colors[ColorScheme].text, opacity: 0.65, marginTop: 3, lineHeight: 18 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
    metaText: { fontSize: 12, fontWeight: '500', color: Colors[ColorScheme].icon },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    pillText: { fontSize: 11, fontWeight: '800' },
    cardActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
    useChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginRight: 2 },
    useChipText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    iconBtn: { padding: 8 },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: gymColor, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    createButtonHeader: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        marginHorizontal: 15, 
        marginTop: 15, 
        marginBottom: 10,
        borderRadius: 14, 
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4
    },
    createButtonIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14
    },
    createButtonTitle: { 
        color: '#fff', 
        fontWeight: 'bold', 
        fontSize: 16 
    },
    createButtonSub: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginTop: 2
    },
    emptyText: { textAlign: 'center', marginTop: 50, color: Colors[ColorScheme].text, opacity: 0.5 },
    formContainer: { padding: 20, flex: 1 },
    label: { fontSize: 14, marginBottom: 5, color: Colors[ColorScheme].text, fontWeight: '600' },
    input: { backgroundColor: Colors[ColorScheme].cardBackground, borderRadius: 8, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: Colors[ColorScheme].border, color: Colors[ColorScheme].text },
    saveButton: { backgroundColor: gymColor, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 30 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
    });
};

export default TemplateManagerModal;