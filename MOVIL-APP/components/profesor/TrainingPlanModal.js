import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Switch, ScrollView, useColorScheme, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { FontAwesome6, Ionicons, Octicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

// Usamos el editor para la creación/edición
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';

const TrainingPlanModal = ({ clients, visible, onClose }) => {
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [plans, setPlans] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list'); 
    const [currentPlan, setCurrentPlan] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ visible: false });

    const [targetConfig, setTargetConfig] = useState({ type: 'manual', id: null, name: '' });
    const [showClassSelector, setShowClassSelector] = useState(false);

    const isManualSelection = clients && clients.length > 0;
    const isSingleClient = isManualSelection && clients.length === 1;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const promises = [apiClient.get('/plans/templates')];
            
            if (isSingleClient) {
                promises.push(apiClient.get(`/plans/user/${clients[0]._id}`));
            }
            if (!isManualSelection) {
                promises.push(apiClient.get('/classes/admin')); 
            }

            const results = await Promise.all(promises);
            setTemplates(results[0].data);
            
            if (isSingleClient) {
                setPlans(results[1].data);
                setView('list');
            } else {
                setPlans([]);
                setView('newPlan');
                setCurrentPlan({ name: '', description: '', content: '', isVisibleToUser: false });
                if (!isManualSelection && results[1]) setAvailableClasses(results[1].data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [clients, isManualSelection, isSingleClient]);

    useEffect(() => {
        if (visible) fetchData();
    }, [visible, fetchData]);

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

            setAlertInfo({ visible: true, title: 'Éxito', message: 'Plan asignado correctamente.' });
            
            if (isSingleClient) {
                fetchData();
                setView('list');
            } else {
                setTimeout(() => onClose(true), 1500);
            }
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo guardar el plan.' });
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
            case 'selectTemplate':
                return (
                    <TemplateSelector 
                        templates={templates} 
                        onSelect={(t) => {
                            setCurrentPlan({ name: t.name, description: t.description, content: t.content, isVisibleToUser: false });
                            setView('newPlan');
                        }} 
                        onCancel={() => isSingleClient ? setView('list') : onClose()} 
                        colorScheme={colorScheme} 
                    />
                );
            default:
                return (
                    <PlanList 
                        plans={plans} 
                        onEdit={(p) => { setCurrentPlan(p); setView('editPlan'); }} 
                        onDelete={handleDeletePlan} 
                        onNewPlan={() => { setCurrentPlan({ name: '', description: '', content: '', isVisibleToUser: false }); setView('newPlan'); }} 
                        onNewFromTemplate={() => setView('selectTemplate')} 
                        colorScheme={colorScheme} 
                    />
                );
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={() => onClose()}>
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
                                        <Text style={styles.listItemSubtext}>{item.horaInicio}hs ({item.diaDeSemana[0]})</Text>
                                    </TouchableOpacity>
                                )}
                            />
                            <TouchableOpacity onPress={() => setShowClassSelector(false)} style={{padding: 15, alignItems: 'center'}}>
                                <Text style={{color: 'red'}}>Cancelar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={[{ text: 'OK', onPress: () => setAlertInfo({ visible: false }) }]} onClose={() => setAlertInfo({ visible: false })} gymColor={gymColor} />
            </View>
        </Modal>
    );
};

const PlanEditor = ({ plan: initialPlan, onSave, onCancel, colorScheme, isBulk, targetName }) => {
    const [plan, setPlan] = useState(initialPlan);
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    const richText = useRef();

    return (
        <View style={{flex: 1}}>
            <ScrollView style={{flex: 1}} keyboardShouldPersistTaps="handled">
                {isBulk && <Text style={{color: gymColor, marginBottom: 10, fontWeight:'bold'}}>Asignando a: {targetName}</Text>}
                
                <Text style={styles.label}>Título</Text>
                <TextInput style={styles.input} value={plan.name} onChangeText={t => setPlan(p => ({ ...p, name: t }))} placeholder="Ej: Hipertrofia Mes 1" placeholderTextColor={Colors[colorScheme].icon}/>

                <Text style={styles.label}>Contenido</Text>
                <RichToolbar
                    editor={richText}
                    actions={[ actions.setBold, actions.setItalic, actions.setUnderline, actions.insertBulletsList, actions.insertOrderedList ]}
                    iconTint={Colors[colorScheme].text}
                    selectedIconTint={gymColor}
                    style={{ backgroundColor: Colors[colorScheme].cardBackground, borderTopLeftRadius: 5, borderTopRightRadius: 5 }}
                />
                <View style={{ borderWidth: 1, borderColor: Colors[colorScheme].border, minHeight: 200, marginBottom: 15 }}>
                    <RichEditor
                        ref={richText}
                        initialContentHTML={plan.content}
                        onChange={html => setPlan(p => ({ ...p, content: html }))}
                        placeholder="Escribe la rutina aquí..."
                        editorStyle={{
                            backgroundColor: Colors[colorScheme].inputBackground,
                            color: Colors[colorScheme].text,
                            placeholderColor: Colors[colorScheme].icon,
                            contentCSSText: 'font-size: 16px; min-height: 200px;'
                        }}
                        style={{ minHeight: 200, flex: 1 }}
                    />
                </View>

                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Visible para el Cliente</Text>
                    <Switch trackColor={{ false: "#767577", true: gymColor }} thumbColor={"#f4f3f4"} onValueChange={v => setPlan(p => ({ ...p, isVisibleToUser: v }))} value={plan.isVisibleToUser} />
                </View>
            </ScrollView>

            <View style={styles.footerButtons}>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onCancel}><Text style={styles.buttonTextSecondary}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={() => onSave(plan)}><Text style={styles.buttonText}>{isBulk ? 'Asignar a Todos' : 'Guardar'}</Text></TouchableOpacity>
            </View>
        </View>
    );
};

const PlanList = ({ plans, onEdit, onDelete, onNewPlan, onNewFromTemplate, colorScheme }) => {
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    
    // --- FUNCIÓN PARA LIMPIAR HTML ---
    const stripHtml = (html) => {
        if (!html) return '';
        return html.replace(/<[^>]+>/g, ' ').substring(0, 50) + '...';
    };

    const renderItem = ({ item }) => (
        <View style={styles.planCard}>
            <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{item.name}</Text>
                <Text style={styles.planDate}>Creado: {new Date(item.createdAt).toLocaleDateString()}</Text>
                {/* Mostramos solo texto plano en la lista */}
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
            <FlatList data={plans} renderItem={renderItem} keyExtractor={(item) => item._id} ListEmptyComponent={<Text style={styles.emptyText}>Sin planes.</Text>} />
            <View style={styles.footerButtons}>
                <TouchableOpacity style={[styles.button, {marginRight: 5}]} onPress={onNewPlan}><Text style={styles.buttonText}>Nuevo Vacío</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, {marginLeft: 5, backgroundColor: '#555'}]} onPress={onNewFromTemplate}><Text style={styles.buttonText}>Desde Plantilla</Text></TouchableOpacity>
            </View>
        </View>
    );
};

const TemplateSelector = ({ templates, onSelect, onCancel, colorScheme }) => {
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);
    return (
        <View style={{flex: 1}}>
            <FlatList data={templates} keyExtractor={item => item._id} renderItem={({item}) => (<TouchableOpacity style={styles.planCard} onPress={() => onSelect(item)}><Text style={styles.planTitle}>{item.name}</Text></TouchableOpacity>)} ListEmptyComponent={<Text style={styles.emptyText}>No hay plantillas.</Text>} />
            <TouchableOpacity style={[styles.button, styles.buttonSecondary, {marginTop: 10}]} onPress={onCancel}><Text style={styles.buttonTextSecondary}>Cancelar</Text></TouchableOpacity>
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { height: '95%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
    planCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 15, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, marginVertical: 5, borderColor: Colors[colorScheme].border, borderWidth: 1 },
    planTitle: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text },
    planDate: { fontSize: 12, opacity: 0.6, marginTop: 4, color: Colors[colorScheme].text },
    planActions: { flexDirection: 'row', gap: 15, marginTop: 5 },
    footerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 20 },
    button: { flex: 1, padding: 12, borderRadius: 5, alignItems: 'center', backgroundColor: gymColor, justifyContent: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors[colorScheme].border, marginRight: 10 },
    buttonTextSecondary: { color: Colors[colorScheme].text },
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