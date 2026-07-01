import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ActivityIndicator, useColorScheme, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons, FontAwesome6, Octicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import { ThemedText } from '@/components/ThemedText';

import RichTextEditor from '@/components/RichTextEditor';
import PlanContentEditor from './PlanContentEditor';
import CustomAlert from '@/components/CustomAlert'; // <--- IMPORTANTE

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
        return (
            <View style={[styles.card, { flexDirection: 'column' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <TouchableOpacity 
                        style={[styles.cardContent, { flex: 1 }]} 
                        onPress={() => onSelectTemplate ? onSelectTemplate(item) : openForm(item)}
                    >
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        {hasValidDesc ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                    </TouchableOpacity>
                    
                    <View style={styles.cardActions}>
                        <TouchableOpacity onPress={() => openForm(item)} style={styles.iconBtn}>
                            <FontAwesome6 name="edit" size={20} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.iconBtn}>
                            <Octicons name="trash" size={22} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {onSelectTemplate && (
                    <TouchableOpacity 
                        style={[styles.useButton, { backgroundColor: gymColor || '#007bff' }]}
                        onPress={() => onSelectTemplate(item)}
                    >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <Text style={styles.useButtonText}>Seleccionar y Asignar esta Plantilla</Text>
                    </TouchableOpacity>
                )}
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
                    {/* HEADER */}
                    <View style={styles.header}>
                        {viewMode === 'form' ? (
                            <TouchableOpacity onPress={() => setViewMode('list')}>
                                <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                        ) : (
                            <View style={{width: 24}} /> 
                        )}
                        <Text style={styles.headerTitle}>
                            {viewMode === 'list' ? (onSelectTemplate ? 'Seleccionar Plantilla' : 'Plantillas') : (formData.id ? 'Editar Plantilla' : 'Nueva Plantilla')}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </View>

                    {/* CONTENIDO */}
                    {loading && <ActivityIndicator style={{margin: 20}} color={gymColor} />}
                    
                    {!loading && viewMode === 'list' && (
                        <>
                            <TouchableOpacity 
                                style={[styles.createButtonHeader, { backgroundColor: gymColor || '#007bff' }]} 
                                onPress={() => openForm()}
                            >
                                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                                <Text style={styles.createButtonHeaderText}>+ Crear Nueva Plantilla</Text>
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

const getStyles = (ColorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
    modalContainer: { width: '100%', height: '85%', backgroundColor: Colors[ColorScheme].background, borderRadius: 15, overflow: 'hidden',},
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: Colors[ColorScheme].border },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[ColorScheme].text },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',backgroundColor: Colors[ColorScheme].cardBackground, borderRadius: 8, padding: 15, marginVertical: 6, marginHorizontal: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, borderWidth: 1, borderColor: Colors[ColorScheme].border },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[ColorScheme].text },
    cardDesc: { fontSize: 12, color: Colors[ColorScheme].text, opacity: 0.7, marginTop: 4 },
    cardActions: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 10,  },
    iconBtn: { padding: 10 },
    fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: gymColor, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    emptyText: { textAlign: 'center', marginTop: 50, color: Colors[ColorScheme].text, opacity: 0.5 },
    formContainer: { padding: 20, flex: 1 },
    label: { fontSize: 14, marginBottom: 5, color: Colors[ColorScheme].text, fontWeight: '600' },
    input: { backgroundColor: Colors[ColorScheme].cardBackground, borderRadius: 8, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: Colors[ColorScheme].border, color: Colors[ColorScheme].text },
    saveButton: { backgroundColor: gymColor, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 30 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default TemplateManagerModal;