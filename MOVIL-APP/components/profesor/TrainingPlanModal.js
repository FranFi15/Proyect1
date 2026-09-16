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
    KeyboardAvoidingView, 
    Platform, 
    Keyboard 
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';
import { format, isBefore, startOfDay, parseISO } from 'date-fns';

import RichTextEditor from '@/components/RichTextEditor';
import PlanContentEditor from './PlanContentEditor';
import TemplateManagerModal from './TemplateManagerModal'; 

// --- COMPONENTE INTERNO: EDITOR DE PLANES ---
const PlanEditor = ({ plan, onSave, onCancel, colorScheme, isBulk, targetName, setPlan }) => { 
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    const [templatesVisible, setTemplatesVisible] = useState(false);

    const parseStructured = (content) => {
        if (!content) return false;
        try { return JSON.parse(content).type === 'structured'; } catch (e) { return false; }
    };
    const [editorMode, setEditorMode] = useState(() => parseStructured(plan.content) || !plan.content ? 'structured' : 'html');

    // Función para cuando se selecciona una plantilla
    const handleTemplateSelected = (template) => {
        const isStruct = parseStructured(template.content);
        setEditorMode(isStruct ? 'structured' : 'html');
        setPlan(prev => ({
            ...prev,
            name: template.name,
            description: template.description || '',
            content: template.content,
            templateId: template._id 
        }));
        setTemplatesVisible(false);
    };

    return (
        <KeyboardAvoidingView 
            // CORRECCIÓN 1: Evitar "height" en Android para prevenir el rebote
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
            <ScrollView 
                style={{flex: 1}} 
                keyboardShouldPersistTaps="handled"
                // CORRECCIÓN EXTRA: Ayuda a cerrar el teclado suavemente
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
            >
                {isBulk && <Text style={{color: gymColor, marginBottom: 10, fontWeight:'bold', textAlign:'center'}}>Asignando a: {targetName}</Text>}
                
                <TouchableOpacity 
                    style={styles.templateButton} 
                    onPress={() => setTemplatesVisible(true)}
                >
                    <MaterialCommunityIcons name="file-document-edit-outline" size={24} color="#fff" />
                    <Text style={styles.templateButtonText}>Cargar desde Plantilla</Text>
                </TouchableOpacity>

                {editorMode === 'html' && (
                    <>
                        <Text style={styles.label}>Título <Text style={{color:'red'}}>*</Text></Text>
                        <TextInput 
                            style={styles.input} 
                            value={plan.name} 
                            onChangeText={t => setPlan(p => ({ ...p, name: t }))} 
                            placeholder="Ej: Hipertrofia Mes 1" 
                            placeholderTextColor={Colors[colorScheme].icon}
                            returnKeyType="next"
                        />
                        
                        <Text style={styles.label}>Descripción</Text>
                        <TextInput 
                            style={styles.input} 
                            value={plan.description} 
                            onChangeText={t => setPlan(p => ({ ...p, description: t }))} 
                            placeholder="Opcional..." 
                            placeholderTextColor={Colors[colorScheme].icon}
                        />
                    </>
                )}

                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Visible para el Cliente</Text>
                    <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={v => setPlan(p => ({ ...p, isVisibleToUser: v }))} value={plan.isVisibleToUser} />
                </View>

                <Text style={styles.label}>Contenido <Text style={{color:'red'}}>*</Text></Text>
                <PlanContentEditor
                    key={plan.templateId || 'custom-plan'} 
                    initialContent={plan.content}
                    onChange={(contentStr) => setPlan(p => ({ ...p, content: contentStr }))}
                    colorScheme={colorScheme}
                    gymColor={gymColor}
                    mode={editorMode}
                    onModeChange={setEditorMode}
                />
            </ScrollView>

            <View style={styles.footerButtons}>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onCancel}>
                    <Text style={styles.buttonTextSecondary}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={() => onSave(plan)}>
                    <Text style={styles.buttonText}>{isBulk ? 'Asignar' : 'Guardar'}</Text>
                </TouchableOpacity>
            </View>

            <TemplateManagerModal 
                visible={templatesVisible} 
                onClose={() => setTemplatesVisible(false)}
                onSelectTemplate={handleTemplateSelected} 
                gymColor={gymColor}
                colorScheme={colorScheme}
            />
        </KeyboardAvoidingView>
    );
};

const PlanList = ({ plans, onEdit, onDelete, onDeleteAll, onNewPlan, colorScheme }) => {
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    
    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.planCard}
            onPress={() => onEdit(item)}
            activeOpacity={0.85}
        >
            <View style={[styles.accentBar, { backgroundColor: gymColor || '#1a5276' }]} />
            <View style={styles.planCardBody}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle} numberOfLines={2}>{item.name}</Text>
                    {!!item.description && (
                        <Text style={styles.planDesc} numberOfLines={2}>{item.description}</Text>
                    )}
                    <View style={styles.planMetaRow}>
                        <Ionicons name="calendar-outline" size={12} color={Colors[colorScheme].icon} />
                        <Text style={styles.planDate}>
                            {item.createdAt
                                ? format(new Date(item.createdAt), 'dd/MM/yyyy')
                                : 'Sin fecha'}
                        </Text>
                        {item.isVisibleToUser ? (
                            <View style={[styles.planPill, { backgroundColor: (gymColor || '#1a5276') + '22' }]}>
                                <Text style={[styles.planPillText, { color: gymColor || '#1a5276' }]}>Visible</Text>
                            </View>
                        ) : (
                            <View style={styles.planPillMuted}>
                                <Text style={styles.planPillMutedText}>Oculto</Text>
                            </View>
                        )}
                    </View>
                </View>
                <TouchableOpacity onPress={() => onEdit(item)} style={styles.iconBtn} hitSlop={8}>
                    <FontAwesome6 name="edit" size={18} color={gymColor || '#1a5276'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item._id)} style={styles.iconBtn} hitSlop={8}>
                    <Octicons name="trash" size={18} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color={Colors[colorScheme].icon} />
            </View>
        </TouchableOpacity>
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

const ClientFeedbackHistorial = ({ feedbacks, colorScheme, gymColor }) => {
    const styles = getStyles(colorScheme, gymColor);
    const accent = gymColor || '#1a5276';

    const renderItem = ({ item }) => (
        <View style={styles.feedbackCard}>
            <View style={[styles.accentBar, { backgroundColor: accent }]} />
            <View style={styles.feedbackCardBody}>
                <View style={styles.feedbackTopRow}>
                    <Text style={styles.feedbackPlanName} numberOfLines={1}>
                        {item.plan?.name || 'Plan'}
                    </Text>
                    {!!item.rating && (
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Ionicons
                                    key={star}
                                    name={star <= item.rating ? 'star' : 'star-outline'}
                                    size={14}
                                    color={star <= item.rating ? accent : '#9aa0a6'}
                                />
                            ))}
                        </View>
                    )}
                </View>
                {!!item.comment ? (
                    <Text style={styles.feedbackComment}>{item.comment}</Text>
                ) : (
                    <Text style={styles.feedbackCommentMuted}>Sin comentario</Text>
                )}
                <View style={styles.planMetaRow}>
                    <Ionicons name="calendar-outline" size={12} color={Colors[colorScheme].icon} />
                    <Text style={styles.feedbackDate}>
                        {item.updatedAt
                            ? format(new Date(item.updatedAt), 'dd/MM/yyyy HH:mm')
                            : ''}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <FlatList
            data={feedbacks}
            renderItem={renderItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
            ListEmptyComponent={
                <Text style={styles.emptyText}>
                    Este cliente todavía no dejó feedback en sus planes.
                </Text>
            }
        />
    );
};

const TrainingPlanModal = ({ clients, visible, onClose }) => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [plans, setPlans] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list'); 
    const [listTab, setListTab] = useState('planes'); // planes | historial
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
                const userId = clients[0]._id;
                const [plansRes, feedbackRes] = await Promise.all([
                    apiClient.get(`/plans/user/${userId}`),
                    apiClient.get(`/plans/feedback?userId=${userId}`),
                ]);
                setPlans(plansRes.data || []);
                setFeedbacks(feedbackRes.data || []);
                setView('list');
                setListTab('planes');
            } 
            else {
                setPlans([]);
                setFeedbacks([]);
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
        let nameToSave = planToSave.name?.trim();
        try {
            const parsed = JSON.parse(planToSave.content);
            if (parsed && parsed.type === 'structured' && !nameToSave) {
                nameToSave = `Rutina: ${parsed.days?.[0]?.name || 'Por Días'}`;
            }
        } catch (e) {}

        // --- CORRECCIÓN 2: Validación de campos vacíos ---
        if (!nameToSave || !planToSave.content?.trim()) {
            setAlertInfo({
                visible: true,
                title: 'Campos Requeridos',
                message: 'Por favor, asegúrate de completar el contenido del plan antes de guardar.',
                buttons: [{ text: 'Entendido', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }]
            });
            return;
        }

        try {
            const payload = { ...planToSave, name: nameToSave };
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
                    setTimeout(() => {
                        if (isSingleClient) { fetchData(); setView('list'); } else { if (onClose) onClose(true); }
                    }, 350);
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
                        setPlan={setCurrentPlan} 
                        onSave={handleSaveChanges} 
                        onCancel={() => isSingleClient ? setView('list') : onClose()} 
                        colorScheme={colorScheme} 
                        isBulk={!isSingleClient}
                        targetName={isManualSelection ? (isSingleClient ? clients[0].nombre : `${clients.length} seleccionados`) : targetConfig.name || 'Todos'}
                    />
                );
            default: 
                return (
                    <View style={{ flex: 1 }}>
                        {isSingleClient && (
                            <View style={styles.listTabRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.listTabBtn,
                                        listTab === 'planes' && { backgroundColor: gymColor || '#1a5276' },
                                    ]}
                                    onPress={() => setListTab('planes')}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.listTabText,
                                            listTab === 'planes' && styles.listTabTextActive,
                                        ]}
                                    >
                                        Planes
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.listTabBtn,
                                        listTab === 'historial' && { backgroundColor: gymColor || '#1a5276' },
                                    ]}
                                    onPress={() => setListTab('historial')}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.listTabText,
                                            listTab === 'historial' && styles.listTabTextActive,
                                        ]}
                                    >
                                        Historial{feedbacks.length > 0 ? ` (${feedbacks.length})` : ''}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {listTab === 'historial' && isSingleClient ? (
                            <ClientFeedbackHistorial
                                feedbacks={feedbacks}
                                colorScheme={colorScheme}
                                gymColor={gymColor}
                            />
                        ) : (
                            <PlanList 
                                plans={plans} 
                                onEdit={(p) => { setCurrentPlan(p); setView('editPlan'); }} 
                                onDelete={handleDeletePlan} 
                                onDeleteAll={handleDeleteAll}
                                onNewPlan={() => { setCurrentPlan({ name: '', description: '', content: '', isVisibleToUser: false }); setView('newPlan'); }} 
                                colorScheme={colorScheme} 
                            />
                        )}
                    </View>
                );
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={() => onClose()}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, { padding: 0, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                    <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerBannerTitle}>
                                {isSingleClient ? `Planes de ${clients[0].nombre}` : `Gestión de Planes`}
                            </Text>
                            <Text style={styles.headerBannerSub}>
                                {isSingleClient ? 'Planes y feedback del cliente' : 'Asignación y rutinas'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => onClose()} style={styles.closeButtonBanner}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={{ flex: 1, padding: 15 }}>
                        {renderTargetSelector()}
                        {renderContent()}
                    </View>
                </View>

                {/* Modal selector de clase */}
                <Modal visible={showClassSelector} transparent={true} animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContainer, {height: '50%', padding: 0, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24}]}>
                            <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.headerBannerTitle}>Seleccionar Clase</Text>
                                    <Text style={styles.headerBannerSub}>Elige un turno de la lista</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowClassSelector(false)} style={styles.closeButtonBanner}>
                                    <Ionicons name="close" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1, padding: 15 }}>
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
                    </View>
                </Modal>

                <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={alertInfo.buttons} onClose={() => setAlertInfo({ visible: false })} gymColor={gymColor} />
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => {
    const soft = colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f7f8fa';
    return StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { height: '85%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    planCard: {
        flexDirection: 'row',
        backgroundColor: soft,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        marginBottom: 10,
        overflow: 'hidden',
    },
    accentBar: { width: 5 },
    planCardBody: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        gap: 10,
    },
    planTitle: { fontSize: 16, fontWeight: '800', color: Colors[colorScheme].text },
    planDesc: {
        marginTop: 3,
        fontSize: 13,
        color: Colors[colorScheme].text,
        opacity: 0.65,
        lineHeight: 18,
    },
    planMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 6,
        flexWrap: 'wrap',
    },
    planDate: { fontSize: 12, opacity: 0.7, color: Colors[colorScheme].icon, fontWeight: '500' },
    planPill: {
        marginLeft: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    planPillText: { fontSize: 11, fontWeight: '800' },
    planPillMuted: {
        marginLeft: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: Colors[colorScheme].border,
    },
    planPillMutedText: { fontSize: 11, fontWeight: '700', color: Colors[colorScheme].icon },
    iconBtn: { padding: 6 },
    planActions: { flexDirection: 'row', gap: 15, marginTop: 5 },
    footerContainer: { marginTop: 10, marginBottom: 20 },
    footerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 20, gap: 10 },
    button: { padding: 12, borderRadius: 14, alignItems: 'center', backgroundColor: gymColor, justifyContent: 'center' },
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
    templateButton: {
        flexDirection: 'row',
        backgroundColor: '#34495e',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        elevation: 2
    },
    templateButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 10,
        fontSize: 16
    },
    listTabRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    listTabBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        backgroundColor: soft,
    },
    listTabText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors[colorScheme].text,
    },
    listTabTextActive: {
        color: '#fff',
    },
    feedbackCard: {
        flexDirection: 'row',
        backgroundColor: soft,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        marginBottom: 10,
        overflow: 'hidden',
    },
    feedbackCardBody: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    feedbackTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
    },
    feedbackPlanName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '800',
        color: Colors[colorScheme].text,
    },
    feedbackComment: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors[colorScheme].text,
        opacity: 0.85,
    },
    feedbackCommentMuted: {
        fontSize: 13,
        fontStyle: 'italic',
        color: Colors[colorScheme].icon,
    },
    feedbackDate: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors[colorScheme].icon,
    },
    headerBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    headerBannerTitle: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerBannerSub: {
        fontSize: 13,
        color: '#fff',
        opacity: 0.85,
        marginTop: 2,
    },
    closeButtonBanner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    });
};

export default TrainingPlanModal;
