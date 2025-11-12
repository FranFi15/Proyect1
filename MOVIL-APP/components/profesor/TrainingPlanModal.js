import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Switch, ScrollView, useColorScheme } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

// --- Componente Principal del Modal ---
const TrainingPlanModal = ({ client, visible, onClose }) => {
    const { gymColor } = useAuth();
    // 1. Detecta el tema real del dispositivo
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [plans, setPlans] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list');
    const [currentPlan, setCurrentPlan] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    const fetchData = useCallback(async () => {
        if (!client) return;
        setLoading(true);
        try {
            const [plansRes, templatesRes] = await Promise.all([
                apiClient.get(`/plans/user/${client._id}`),
                apiClient.get('/plans/templates')
            ]);
            setPlans(plansRes.data);
            setTemplates(templatesRes.data);
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
            console.error("Error fetching modal data:", error.response || error);
            setAlertInfo({
                visible: true,
                title: 'Error al Cargar Datos',
                message: `No se pudo completar la operación. Razón: ${errorMessage}`,
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
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
            setAlertInfo({
                visible: true,
                title: 'Éxito',
                message: 'Plan guardado correctamente.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            fetchData();
            setView('list');
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudo guardar el plan.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
        }
    };

    const handleDeletePlan = (planId) => {
        setAlertInfo({
            visible: true,
            title: "Confirmar",
            message: "¿Eliminar este plan?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                { text: "Eliminar", style: "destructive", onPress: async () => {
                    setAlertInfo({ visible: false });
                    try {
                        await apiClient.delete(`/plans/${planId}`);
                        fetchData();
                    } catch (error) { 
                        setAlertInfo({
                            visible: true,
                            title: 'Error',
                            message: 'No se pudo eliminar.',
                            buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
                        });
                    }
                }},
            ]
        });
    };


    const renderContent = () => {
        if (loading) return <ActivityIndicator color={gymColor} size="large" style={{flex: 1}} />;
        
        // 2. Pasa el colorScheme como prop a los sub-componentes
        switch (view) {
            case 'editPlan':
            case 'newPlan':
                return <PlanEditor plan={currentPlan} onSave={handleSaveChanges} onCancel={() => setView('list')} colorScheme={colorScheme} />;
            case 'selectTemplate':
                return <TemplateSelector templates={templates} onSelect={(template) => {
                    setCurrentPlan({ name: template.name, description: template.description, content: template.content, isVisibleToUser: false });
                    setView('newPlan');
                }} onCancel={() => setView('list')} colorScheme={colorScheme} />;
            default:
                return <PlanList plans={plans} onEdit={(plan) => { setCurrentPlan(plan); setView('editPlan'); }} onDelete={handleDeletePlan} onNewPlan={() => { setCurrentPlan({ name: '', description: '', content: '', isVisibleToUser: false }); setView('newPlan'); }} onNewFromTemplate={() => setView('selectTemplate')} colorScheme={colorScheme} />;
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Planes de {client.nombre}</Text>
                        <TouchableOpacity onPress={() => onClose(false)}><Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} /></TouchableOpacity>
                    </View>
                    {renderContent()}
                </View>
                <CustomAlert
                    visible={alertInfo.visible}
                    title={alertInfo.title}
                    message={alertInfo.message}
                    buttons={alertInfo.buttons}
                    onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                    gymColor={gymColor} 
                />
            </View>
        </Modal>
    );
};

// --- Editor de Planes ---
const PlanEditor = ({ plan: initialPlan, onSave, onCancel, colorScheme }) => {
    const [plan, setPlan] = useState(initialPlan);
    const { gymColor } = useAuth();
    // 3. Usa el colorScheme recibido por props
    const styles = getStyles(colorScheme, gymColor);

    return (
        <ScrollView style={{flex: 1}}>
            <Text style={styles.label}>Título del Plan</Text>
            <TextInput style={styles.input} value={plan.name} onChangeText={text => setPlan(p => ({ ...p, name: text }))} placeholderTextColor={Colors[colorScheme].icon}/>

            <Text style={styles.label}>Contenido del Plan</Text>
            <TextInput style={[styles.input, styles.textArea, {height: 250}]} multiline value={plan.content} onChangeText={text => setPlan(p => ({ ...p, content: text }))} placeholderTextColor={Colors[colorScheme].icon}/>

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

// --- Lista de Planes ---
const PlanList = ({ plans, onEdit, onDelete, onNewPlan, onNewFromTemplate, colorScheme }) => {
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    const renderItem = ({ item }) => (
        <View style={styles.planCard}>
            <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{item.name}</Text>
                <Text style={styles.planDate}>Creado: {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.planActions}>
                <TouchableOpacity onPress={() => onEdit(item)}><FontAwesome6 name="edit" size={21} color={gymColor} /></TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item._id)}><Octicons name="trash" size={24} color={Colors[colorScheme].text} /></TouchableOpacity>
            </View>
        </View>
    );
    return (
        <View style={{flex: 1}}>
            <FlatList data={plans} renderItem={renderItem} keyExtractor={(item) => item._id} ListEmptyComponent={<Text style={styles.emptyText}>Este cliente no tiene planes.</Text>} />
            <View style={styles.footerButtons}>
                <TouchableOpacity style={styles.button} onPress={onNewPlan}><Text style={styles.buttonText}>Crear Plan Nuevo</Text></TouchableOpacity>
            </View>
        </View>
    );
};

// --- Selector de Plantillas ---
const TemplateSelector = ({ templates, onSelect, onCancel, colorScheme }) => {
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    return (
        <View style={{flex: 1}}>
            <FlatList data={templates} keyExtractor={item => item._id} renderItem={({item}) => (<TouchableOpacity style={styles.planCard} onPress={() => onSelect(item)}><Text style={styles.planTitle}>{item.name}</Text></TouchableOpacity>)} ListEmptyComponent={<Text style={styles.emptyText}>No has creado plantillas.</Text>} />
            <TouchableOpacity style={[styles.button, styles.buttonSecondary, {marginTop: 10}]} onPress={onCancel}><Text style={styles.buttonTextSecondary}>Cancelar</Text></TouchableOpacity>
        </View>
    );
};

// 4. Estilos actualizados para ser dinámicos
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { height: '90%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 5, borderTopRightRadius: 5, padding: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors[colorScheme].text },
    planCard: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 20, 
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderRadius: 5, 
        marginVertical: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: colorScheme === 'dark' ? 0.8 : 0.2,
        shadowRadius: 1.41,
        borderWidth: colorScheme === 'dark' ? 1 : 0,
        borderColor: Colors[colorScheme].border
    },
    planTitle: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text },
    planDate: { fontSize: 12, opacity: 0.6, marginTop: 4, color: Colors[colorScheme].text },
    planActions: { flexDirection: 'row', gap: 15 },
    footerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 },
    button: { flex: 1, padding: 15, borderRadius: 5, alignItems: 'center', backgroundColor: gymColor },
    buttonText: { color: '#fff', fontWeight: 'bold' },
    buttonSecondary: { backgroundColor: Colors[colorScheme].cardBackground, borderWidth: 1, borderColor: Colors[colorScheme].border },
    buttonTextSecondary: { color: Colors[colorScheme].text, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
    label: { fontSize: 16, fontWeight: '600', marginBottom: 5, marginTop: 15, color: Colors[colorScheme].text },
    input: { 
        borderWidth: 1, 
        borderColor: Colors[colorScheme].border, 
        borderRadius: 5, 
        paddingHorizontal: 15, 
        backgroundColor: Colors[colorScheme].inputBackground, 
        fontSize: 16,
        height: 50,
        color: Colors[colorScheme].text
    },
    textArea: { 
        textAlignVertical: 'top', 
        paddingTop: 15,
        height: 'auto'
    },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingVertical: 10 }
});

export default TrainingPlanModal;