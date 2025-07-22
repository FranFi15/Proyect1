import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, Switch, ScrollView } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

// --- Componente Principal del Modal ---
const TrainingPlanModal = ({ client, visible, onClose }) => {
    const { gymColor } = useAuth();
    const colorScheme = 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [plans, setPlans] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list');
    const [currentPlan, setCurrentPlan] = useState(null);

    const fetchData = useCallback(async () => {
        if (!client) return;
        setLoading(true);
        try {
            // --- CORRECCIÓN: Se separan las llamadas para un mejor debugging ---
            // 1. Cargar los planes del cliente seleccionado.
            const plansRes = await apiClient.get(`/plans/user/${client._id}`);
            setPlans(plansRes.data);

            // 2. Cargar las plantillas del profesor.
            const templatesRes = await apiClient.get('/plans/templates');
            setTemplates(templatesRes.data);

        } catch (error) {
            // --- CORRECCIÓN: Se muestra un mensaje de error detallado ---
            const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
            console.error("Error fetching modal data:", error.response || error);
            Alert.alert(
                'Error al Cargar Datos',
                `No se pudo completar la operación. Razón: ${errorMessage}`
            );
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        if (visible) {
            fetchData();
        }
    }, [visible, fetchData]);

    const handleSaveChanges = async (planToSave) => {
        try {
            const payload = { ...planToSave, userId: client._id };
            if (planToSave._id) {
                await apiClient.put(`/plans/${planToSave._id}`, payload);
            } else {
                await apiClient.post('/plans', payload);
            }
            Alert.alert('Éxito', 'Plan guardado correctamente.');
            fetchData();
            setView('list');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el plan.');
        }
    };

    const handleDeletePlan = (planId) => {
        Alert.alert("Confirmar", "¿Eliminar este plan?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: async () => {
                try {
                    await apiClient.delete(`/plans/${planId}`);
                    fetchData();
                } catch (error) { Alert.alert('Error', 'No se pudo eliminar.'); }
            }},
        ]);
    };

    const renderContent = () => {
        if (loading) return <ActivityIndicator color={gymColor} size="large" style={{flex: 1}} />;
        switch (view) {
            case 'editPlan':
            case 'newPlan':
                return <PlanEditor plan={currentPlan} onSave={handleSaveChanges} onCancel={() => setView('list')} />;
            case 'selectTemplate':
                return <TemplateSelector templates={templates} onSelect={(template) => {
                    setCurrentPlan({ name: template.name, description: template.description, content: template.content, isVisibleToUser: false });
                    setView('newPlan');
                }} onCancel={() => setView('list')} />;
            default:
                return <PlanList plans={plans} onEdit={(plan) => { setCurrentPlan(plan); setView('editPlan'); }} onDelete={handleDeletePlan} onNewPlan={() => { setCurrentPlan({ name: '', description: '', content: '', isVisibleToUser: false }); setView('newPlan'); }} onNewFromTemplate={() => setView('selectTemplate')} />;
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <ThemedView style={styles.modalContainer}>
                    <View style={styles.header}>
                        <ThemedText style={styles.headerTitle}>Planes de {client.nombre}</ThemedText>
                        <TouchableOpacity onPress={() => onClose(false)}><Ionicons name="close-circle" size={30} color={Colors[colorScheme].text} /></TouchableOpacity>
                    </View>
                    {renderContent()}
                </ThemedView>
            </View>
        </Modal>
    );
};

// --- Editor de Planes (Simplificado) ---
const PlanEditor = ({ plan: initialPlan, onSave, onCancel }) => {
    const [plan, setPlan] = useState(initialPlan);
    const { gymColor } = useAuth();
    const styles = getStyles('light', gymColor);

    return (
        <ScrollView style={{flex: 1}}>
            <Text style={styles.label}>Título del Plan</Text>
            <TextInput style={styles.input} value={plan.name} onChangeText={text => setPlan(p => ({ ...p, name: text }))} />
            
            <Text style={styles.label}>Descripción (Opcional)</Text>
            <TextInput style={[styles.input, styles.textArea]} multiline value={plan.description} onChangeText={text => setPlan(p => ({ ...p, description: text }))} />

            <Text style={styles.label}>Contenido del Plan</Text>
            <TextInput style={[styles.input, styles.textArea, {height: 250}]} multiline value={plan.content} onChangeText={text => setPlan(p => ({ ...p, content: text }))} />

            <View style={styles.switchContainer}>
                <Text style={styles.label}>Visible para el Cliente</Text>
                <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={value => setPlan(p => ({ ...p, isVisibleToUser: value }))} value={plan.isVisibleToUser} />
            </View>

            <View style={styles.footerButtons}>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onCancel}><Text style={styles.buttonTextSecondary}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={() => onSave(plan)}><Text style={styles.buttonText}>Guardar</Text></TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const PlanList = ({ plans, onEdit, onDelete, onNewPlan, onNewFromTemplate }) => {
    const { gymColor } = useAuth();
    const styles = getStyles('light', gymColor);
    const renderItem = ({ item }) => (
        <View style={styles.planCard}>
            <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{item.name}</Text>
                <Text style={styles.planDate}>Creado: {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.planActions}>
                <TouchableOpacity onPress={() => onEdit(item)}><Ionicons name="create-outline" size={24} color={gymColor} /></TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item._id)}><Ionicons name="trash-outline" size={24} color={Colors.light.error} /></TouchableOpacity>
            </View>
        </View>
    );
    return (
        <View style={{flex: 1}}>
            <FlatList data={plans} renderItem={renderItem} keyExtractor={(item) => item._id} ListEmptyComponent={<Text style={styles.emptyText}>Este cliente no tiene planes.</Text>} />
            <View style={styles.footerButtons}>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onNewFromTemplate}><Text style={styles.buttonTextSecondary}>Nuevo desde Plantilla</Text></TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={onNewPlan}><Text style={styles.buttonText}>Crear Plan Nuevo</Text></TouchableOpacity>
            </View>
        </View>
    );
};
const TemplateSelector = ({ templates, onSelect, onCancel }) => {
    const { gymColor } = useAuth();
    const styles = getStyles('light', gymColor);
    return (
        <View style={{flex: 1}}>
            <FlatList data={templates} keyExtractor={item => item._id} renderItem={({item}) => (<TouchableOpacity style={styles.planCard} onPress={() => onSelect(item)}><Text style={styles.planTitle}>{item.name}</Text></TouchableOpacity>)} ListEmptyComponent={<Text style={styles.emptyText}>No has creado plantillas.</Text>} />
            <TouchableOpacity style={[styles.button, styles.buttonSecondary, {marginTop: 10}]} onPress={onCancel}><Text style={styles.buttonTextSecondary}>Cancelar</Text></TouchableOpacity>
        </View>
    );
};
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { height: '90%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors[colorScheme].text },
    planCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, marginVertical: 5 },
    planTitle: { fontSize: 16, fontWeight: '600' },
    planDate: { fontSize: 12, opacity: 0.6, marginTop: 4 },
    planActions: { flexDirection: 'row', gap: 15 },
    footerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 },
    button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', backgroundColor: gymColor },
    buttonText: { color: '#fff', fontWeight: 'bold' },
    buttonSecondary: { backgroundColor: Colors[colorScheme].border },
    buttonTextSecondary: { color: Colors[colorScheme].text, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7 },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 5, marginTop: 15 },
    input: { borderWidth: 1, borderColor: Colors[colorScheme].border, borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#fff', paddingVertical: 10, fontSize: 16 },
    textArea: { textAlignVertical: 'top', paddingTop: 10 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }
});

export default TrainingPlanModal;
