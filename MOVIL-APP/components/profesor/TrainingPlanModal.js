import React, { useState, useEffect, useCallback } from 'react';
import { 
    Modal, 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    FlatList, 
    ActivityIndicator, 
    TextInput, 
    Switch, 
    ScrollView, 
    useColorScheme,
    KeyboardAvoidingView, // <--- IMPORTANTE
    Platform,             // <--- IMPORTANTE
    Keyboard              // <--- IMPORTANTE
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';
import { format, isBefore, startOfDay, parseISO } from 'date-fns';

import RichTextEditor from '@/components/RichTextEditor';

const TrainingPlanModal = ({ clients, visible, onClose }) => {
    // ... (Todo el código del componente principal TrainingPlanModal se mantiene IGUAL)
    // ... (fetchData, useEffect, handleDeleteAll, handleSaveChanges, etc.)

    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [plans, setPlans] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list'); 
    const [currentPlan, setCurrentPlan] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [targetConfig, setTargetConfig] = useState({ type: 'manual', id: null, name: '' });
    const [showClassSelector, setShowClassSelector] = useState(false);

    const isManualSelection = clients && clients.length > 0;
    const isSingleClient = isManualSelection && clients.length === 1;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (isSingleClient) {
                const plansRes = await apiClient.get(`/plans/user/${clients[0]._id}`);
                setPlans(plansRes.data);
                setView('list'); 
            } 
            else {
                setPlans([]);
                setCurrentPlan({ name: '', description: '', content: '', isVisibleToUser: false });
                setView('newPlan'); 

                if (!isManualSelection) {
                    const classesRes = await apiClient.get('/classes/profesor/me');
                    const allClasses = classesRes.data;
                    const today = startOfDay(new Date());
                    const futureClasses = allClasses.filter(cls => !isBefore(parseISO(cls.fecha), today))
                        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                    setAvailableClasses(futureClasses);
                }
            }
        } catch (error) {
            console.error(error);
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar los datos.', buttons: [{text: 'OK', onPress: () => setAlertInfo({visible:false})}] });
        } finally {
            setLoading(false);
        }
    }, [clients, isManualSelection, isSingleClient]);

    useEffect(() => {
        if (visible) fetchData();
    }, [visible, fetchData]);

    const handleDeleteAll = () => {
        if (!isSingleClient) return;
        setAlertInfo({
            visible: true,
            title: "Eliminar Historial",
            message: `¿Estás seguro de que deseas eliminar TODOS los planes de ${clients[0].nombre}? Esta acción no se puede deshacer.`,
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Eliminar Todo",
                    style: "destructive",
                    onPress: async () => {
                        setAlertInfo({ visible: false });
                        setLoading(true);
                        try {
                            await apiClient.delete(`/plans/user/${clients[0]._id}/all`);
                            fetchData();
                        } catch (error) {
                            setAlertInfo({ 
                                visible: true, title: "Error", message: "No se pudieron eliminar los planes.",
                                buttons: [{text: 'OK', onPress: () => setAlertInfo({visible:false})}]
                            });
                            setLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const handleSaveChanges = async (planToSave) => {
        try {
            const payload = { ...planToSave };
            if (isManualSelection) {
                if (planToSave._id) {
                    await apiClient.put(`/plans/${planToSave._id}`, payload);
                } else {
                    payload.userIds = clients.map(c => c._id);
                    payload.targetType = 'user';
                    await apiClient.post('/plans', payload);
                }
            } else {
                payload.targetType = targetConfig.type;
                payload.targetId = targetConfig.id;
                await apiClient.post('/plans', payload);
            }
            setAlertInfo({ 
                visible: true, title: 'Éxito', message: 'Plan asignado correctamente.',
                buttons: [{text: 'OK', onPress: () => {
                    setAlertInfo({visible: false});
                    if (isSingleClient) { fetchData(); setView('list'); } else { onClose(true); }
                }}]
            });
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo guardar el plan.', buttons: [{text: 'OK', onPress: () => setAlertInfo({visible:false})}] });
        }
    };

    const handleDeletePlan = async (planId) => {
        try {
            await apiClient.delete(`/plans/${planId}`);
            fetchData();
        } catch (error) { console.error(error); }
    };

    const renderTargetSelector = () => {
        if (isManualSelection || view !== 'newPlan') return null;
        return (
            <View style={{marginBottom: 15}}>
                <Text style={styles.label}>Asignar a:</Text>
                <View style={{flexDirection: 'row', gap: 10}}>
                    <TouchableOpacity 
                        style={[styles.filterButton, targetConfig.type === 'all' && styles.filterButtonActive]}
                        onPress={() => setTargetConfig({ type: 'all', id: null, name: 'Todos los Clientes' })}
                    >
                        <Text style={[styles.filterButtonText, targetConfig.type === 'all' && {color: '#fff'}]}>Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.filterButton, targetConfig.type === 'class' && styles.filterButtonActive]}
                        onPress={() => setShowClassSelector(true)}
                    >
                        <Text style={[styles.filterButtonText, targetConfig.type === 'class' && {color: '#fff'}]}>
                            {targetConfig.type === 'class' ? (targetConfig.name || 'Clase...') : 'Por Clase'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderContent = () => {
        if (loading) return <ActivityIndicator color={gymColor} size="large" style={{flex: 1}} />;

        switch (view) {
            case 'editPlan': 
            case 'newPlan':  
                return (
                    <PlanEditor 
                        plan={currentPlan} 
                        onSave={handleSaveChanges} 
                        onCancel={() => isSingleClient ? setView('list') : onClose()} 
                        colorScheme={colorScheme} 
                        isBulk={!isSingleClient}
                        targetName={isManualSelection ? (isSingleClient ? clients[0].nombre : `${clients.length} seleccionados`) : targetConfig.name || 'Todos'}
                    />
                );
            default: 
                return (
                    <PlanList 
                        plans={plans} 
                        onEdit={(p) => { setCurrentPlan(p); setView('editPlan'); }} 
                        onDelete={handleDeletePlan} 
                        onDeleteAll={handleDeleteAll}
                        onNewPlan={() => { setCurrentPlan({ name: '', description: '', content: '', isVisibleToUser: false }); setView('newPlan'); }} 
                        colorScheme={colorScheme} 
                    />
                );
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={() => onClose()}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {isSingleClient ? `Planes de ${clients[0].nombre}` : `Gestión de Planes`}
                        </Text>
                        <TouchableOpacity onPress={() => onClose()}><Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} /></TouchableOpacity>
                    </View>
                    
                    {renderTargetSelector()}
                    {renderContent()}
                </View>

                {/* Modal selector de clase */}
                <Modal visible={showClassSelector} transparent={true} animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContainer, {height: '50%'}]}>
                            <Text style={styles.headerTitle}>Seleccionar Clase</Text>
                            <FlatList 
                                data={availableClasses}
                                keyExtractor={item => item._id}
                                renderItem={({item}) => (
                                    <TouchableOpacity style={styles.listItem} onPress={() => {
                                        setTargetConfig({ type: 'class', id: item._id, name: `${item.nombre} ${item.horaInicio}` });
                                        setShowClassSelector(false);
                                    }}>
                                        <Text style={styles.listItemText}>{item.nombre} - {item.tipoClase?.nombre}</Text>
                                        <Text style={styles.listItemSubtext}>{item.diaDeSemana[0]} {format(new Date(item.fecha), 'dd/MM')} {item.horaInicio}hs</Text>
                                    </TouchableOpacity>
                                )}
                            />
                            <TouchableOpacity onPress={() => setShowClassSelector(false)} style={{padding: 15, alignItems: 'center'}}>
                                <Text style={{color: 'red'}}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={alertInfo.buttons} onClose={() => setAlertInfo({ visible: false })} gymColor={gymColor} />
            </View>
        </Modal>
    );
};

// --- AQUÍ ESTÁ LA SOLUCIÓN DEL TECLADO ---
const PlanEditor = ({ plan: initialPlan, onSave, onCancel, colorScheme, isBulk, targetName }) => {
    const [plan, setPlan] = useState(initialPlan);
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);

    return (
        // Usamos KeyboardAvoidingView como contenedor principal
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
            // Ajusta este offset si el teclado tapa algo en iOS (ej: si tienes header)
            keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
            <ScrollView 
                style={{flex: 1}} 
                keyboardShouldPersistTaps="handled"
                // Esta propiedad permite bajar el teclado arrastrando hacia abajo
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {isBulk && <Text style={{color: gymColor, marginBottom: 10, fontWeight:'bold', textAlign:'center'}}>Asignando a: {targetName}</Text>}
                
                <Text style={styles.label}>Título</Text>
                <TextInput 
                    style={styles.input} 
                    value={plan.name} 
                    onChangeText={t => setPlan(p => ({ ...p, name: t }))} 
                    placeholder="Ej: Hipertrofia Mes 1" 
                    placeholderTextColor={Colors[colorScheme].icon}
                    // Esto ayuda a cerrar teclado al dar "Enter" en campos de una línea
                    returnKeyType="done"
                />

                <Text style={styles.label}>Contenido</Text>
                <RichTextEditor
                    initialContent={plan.content}
                    onChange={(html) => setPlan(p => ({ ...p, content: html }))}
                    colorScheme={colorScheme}
                    gymColor={gymColor}
                    placeholder="Escribe la rutina aquí..."
                />

                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Visible para el Cliente</Text>
                    <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={v => setPlan(p => ({ ...p, isVisibleToUser: v }))} value={plan.isVisibleToUser} />
                </View>
            </ScrollView>

            <View style={styles.footerButtons}>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onCancel}>
                    <Text style={styles.buttonTextSecondary}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={() => onSave(plan)}>
                    <Text style={styles.buttonText}>{isBulk ? 'Asignar' : 'Guardar'}</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const PlanList = ({ plans, onEdit, onDelete, onDeleteAll, onNewPlan, colorScheme }) => {
    // ... (PlanList se mantiene IGUAL)
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    
    const stripHtml = (html) => {
        if (!html) return '';
        return html.replace(/<[^>]+>/g, ' ').substring(0, 50) + '...';
    };

    const renderItem = ({ item }) => (
        <View style={styles.planCard}>
            <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{item.name}</Text>
                <Text style={styles.planDate}>Creado: {new Date(item.createdAt).toLocaleDateString()}</Text>
                <Text style={{color: Colors[colorScheme].icon, fontSize: 12, marginTop: 2}}>
                    {stripHtml(item.content)}
                </Text>
            </View>
            <View style={styles.planActions}>
                <TouchableOpacity onPress={() => onEdit(item)}><FontAwesome6 name="edit" size={21} color={gymColor} /></TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item._id)}><Octicons name="trash" size={24} color={Colors[colorScheme].text} /></TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{flex: 1}}>
            <FlatList 
                data={plans} 
                renderItem={renderItem} 
                keyExtractor={(item) => item._id} 
                ListEmptyComponent={<Text style={styles.emptyText}>Sin planes asignados.</Text>} 
                contentContainerStyle={{ paddingBottom: 20 }}
            />
            
            <View style={styles.footerContainer}>
                <TouchableOpacity 
                    style={[styles.button, {marginBottom: 10}]} 
                    onPress={onNewPlan}
                >
                    <Text style={styles.buttonText}>Crear Nuevo Plan</Text>
                </TouchableOpacity>

                {plans.length > 0 && (
                    <TouchableOpacity 
                        style={[styles.button, styles.buttonDestructive]} 
                        onPress={onDeleteAll}
                    >
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                            <Octicons name="trash" size={16} color="#fff" />
                            <Text style={styles.buttonText}>Eliminar Todos los Planes</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

// ... (getStyles se mantiene igual)
const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { height: '85%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    planCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, padding: 20, marginVertical: 6, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, borderWidth: 1, borderColor: 'transparent' },
    planTitle: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text },
    planDate: { fontSize: 12, opacity: 0.6, marginTop: 4, color: Colors[colorScheme].text },
    planActions: { flexDirection: 'row', gap: 15, marginTop: 5 },
    footerContainer: { marginTop: 10, marginBottom: 20 },
    footerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 20, gap: 10 },
    button: { padding: 12, borderRadius: 5, alignItems: 'center', backgroundColor: gymColor, justifyContent: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors[colorScheme].border },
    buttonTextSecondary: { color: Colors[colorScheme].text },
    buttonDestructive: { backgroundColor: '#ff4444', marginTop: 5 },
    emptyText: { textAlign: 'center', marginTop: 50, color: Colors[colorScheme].text },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 15, color: Colors[colorScheme].text },
    input: { borderWidth: 1, borderColor: Colors[colorScheme].border, borderRadius: 5, paddingHorizontal: 10, backgroundColor: Colors[colorScheme].inputBackground, fontSize: 16, height: 45, color: Colors[colorScheme].text },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingVertical: 10 },
    filterButton: { padding: 10, borderRadius: 5, borderWidth: 1, borderColor: Colors[colorScheme].border, marginRight: 10 },
    filterButtonActive: { backgroundColor: gymColor, borderColor: gymColor },
    filterButtonText: { color: Colors[colorScheme].text },
    listItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    listItemText: { color: Colors[colorScheme].text, fontSize: 16 },
    listItemSubtext: { color: Colors[colorScheme].text, opacity: 0.7, fontSize: 12 },
});

export default TrainingPlanModal;