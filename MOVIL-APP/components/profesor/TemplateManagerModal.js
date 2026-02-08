import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
    TextInput, ActivityIndicator, Alert, useColorScheme, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons, FontAwesome6, Octicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient';
import { ThemedText } from '@/components/ThemedText';

// 1. IMPORTAR EL EDITOR
import RichTextEditor from '@/components/RichTextEditor';

const TemplateManagerModal = ({ visible, onClose, onSelectTemplate, gymColor, colorScheme }) => {
    const styles = getStyles(colorScheme, gymColor);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
    
    const [formData, setFormData] = useState({ id: null, name: '', description: '', content: '' });

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
            Alert.alert("Error", "No se pudieron cargar las plantillas");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.content) {
            return Alert.alert("Error", "Nombre y contenido son obligatorios");
        }
        setLoading(true);
        try {
            if (formData.id) {
                await apiClient.put(`/plans/templates/${formData.id}`, formData);
            } else {
                await apiClient.post('/plans/templates', formData);
            }
            await fetchTemplates();
            setViewMode('list');
        } catch (error) {
            Alert.alert("Error", "No se pudo guardar la plantilla");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert(
            "Eliminar Plantilla",
            "¿Estás seguro? Esto no afectará a los planes ya asignados.",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: async () => {
                    try {
                        await apiClient.delete(`/plans/templates/${id}`);
                        fetchTemplates();
                    } catch (e) { Alert.alert("Error", "No se pudo eliminar"); }
                }}
            ]
        );
    };

    const openForm = (template = null) => {
        if (template) {
            setFormData({ id: template._id, name: template.name, description: template.description || '', content: template.content });
        } else {
            setFormData({ id: null, name: '', description: '', content: '' });
        }
        setViewMode('form');
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <TouchableOpacity 
                style={styles.cardContent} 
                onPress={() => onSelectTemplate ? onSelectTemplate(item) : openForm(item)}
            >
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
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
    );

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            {/* Agregamos KeyboardAvoidingView para que el teclado no tape el editor */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                            {viewMode === 'list' ? 'Plantillas' : (formData.id ? 'Editar Plantilla' : 'Nueva Plantilla')}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </View>

                    {/* CONTENIDO */}
                    {loading && <ActivityIndicator style={{margin: 20}} color={gymColor} />}
                    
                    {!loading && viewMode === 'list' && (
                        <>
                            <FlatList 
                                data={templates} 
                                renderItem={renderItem} 
                                keyExtractor={item => item._id}
                                contentContainerStyle={{padding: 15, paddingBottom: 80}}
                                ListEmptyComponent={<Text style={styles.emptyText}>No hay plantillas creadas.</Text>}
                            />
                            <TouchableOpacity style={styles.fab} onPress={() => openForm()}>
                                <Ionicons name="add" size={30} color="#fff" />
                            </TouchableOpacity>
                        </>
                    )}

                    {!loading && viewMode === 'form' && (
                        <ScrollView style={styles.formContainer} contentContainerStyle={{paddingBottom: 20}}>
                            <ThemedText style={styles.label}>Nombre</ThemedText>
                            <TextInput 
                                style={styles.input} 
                                value={formData.name} 
                                onChangeText={t => setFormData({...formData, name: t})} 
                                placeholder="Ej: Hipertrofia Intermedia"
                                placeholderTextColor={Colors[colorScheme].icon}
                            />

                            <ThemedText style={styles.label}>Descripción</ThemedText>
                            <TextInput 
                                style={styles.input} 
                                value={formData.description} 
                                onChangeText={t => setFormData({...formData, description: t})} 
                                placeholder="Breve descripción..."
                                placeholderTextColor={Colors[colorScheme].icon}
                            />

                            <ThemedText style={styles.label}>Contenido (Plan)</ThemedText>
                            
                            {/* 2. REEMPLAZO POR RICH TEXT EDITOR */}
                            {/* Usamos 'key' para forzar reinicio si cambiamos de plantilla */}
                            <RichTextEditor
                                key={formData.id || 'new'} 
                                initialContent={formData.content}
                                onChange={(html) => setFormData(prev => ({...prev, content: html}))}
                                colorScheme={colorScheme}
                                gymColor={gymColor}
                                placeholder="Diseña tu plantilla aquí..."
                            />

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Guardar Plantilla</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
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