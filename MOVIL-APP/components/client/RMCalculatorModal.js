import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Octicons } from '@expo/vector-icons';
import apiClient from '../../services/apiClient';

// Importamos TU alerta personalizada
import CustomAlert from '@/components/CustomAlert';

// Fórmula de Brzycki
const calculate1RM = (weight, reps) => {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    if (reps > 30) return 0;
    return Math.round(weight / (1.0278 - (0.0278 * reps)));
};

const RMCalculatorModal = ({ visible, onClose, initialRecords = [], colorScheme, gymColor, onRecordsUpdate }) => {
    const styles = getStyles(colorScheme, gymColor);
    
    const [tab, setTab] = useState('list'); 
    const [records, setRecords] = useState(initialRecords);
    
    // --- ESTADOS DE EDICIÓN Y CÁLCULO ---
    const [editingIndex, setEditingIndex] = useState(null);
    const [exerciseName, setExerciseName] = useState('');
    const [weightInput, setWeightInput] = useState(''); // Input Peso
    const [repsInput, setRepsInput] = useState('');     // Input Repes
    const [finalRM, setFinalRM] = useState('');         // El RM Final (Editable)

    // Estado para Modal de Porcentajes
    const [percentageItem, setPercentageItem] = useState(null);

    // Estado para CustomAlert
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    useEffect(() => {
        setRecords(initialRecords);
    }, [initialRecords]);

    // Cálculo automático al escribir peso/repes
    useEffect(() => {
        const w = parseFloat(weightInput);
        const r = parseFloat(repsInput);
        if (!isNaN(w) && !isNaN(r)) {
            const calc = calculate1RM(w, r);
            if (calc > 0) setFinalRM(calc.toString());
        }
    }, [weightInput, repsInput]);

    const closeAlert = () => setAlertInfo({ ...alertInfo, visible: false });

    const resetForm = () => {
        setExerciseName('');
        setWeightInput('');
        setRepsInput('');
        setFinalRM('');
        setEditingIndex(null);
    };

    const handleEdit = (item, index) => {
        setExerciseName(item.exercise);
        setFinalRM(item.weight.toString());
        setWeightInput(''); 
        setRepsInput('');
        setEditingIndex(index);
        setTab('calculator');
    };

    const handleSaveRM = async () => {
        if (!exerciseName.trim() || !finalRM) {
            setAlertInfo({
                visible: true,
                title: 'Falta información',
                message: 'Por favor ingresa nombre y valor de RM.',
                buttons: [{ text: 'Entendido', onPress: closeAlert }]
            });
            return;
        }

        const rmValue = parseFloat(finalRM);
        if (isNaN(rmValue) || rmValue <= 0) return;

        const newRecord = {
            exercise: exerciseName,
            weight: rmValue,
            date: new Date()
        };

        let updatedList = [...records];
        if (editingIndex !== null) {
            updatedList[editingIndex] = newRecord; 
        } else {
            updatedList.push(newRecord); 
        }

        setRecords(updatedList); 
        
        try {
            await apiClient.put('/users/profile/rm', { rmRecords: updatedList });

            if (onRecordsUpdate) {
            onRecordsUpdate(updatedList);
        }
            
            setAlertInfo({
                visible: true,
                title: editingIndex !== null ? 'Actualizado' : 'Guardado',
                message: `RM para ${newRecord.exercise} registrado exitosamente.`,
                buttons: [{ 
                    text: 'Ver Lista', 
                    onPress: () => {
                        closeAlert();
                        resetForm();
                        setTab('list');
                    }
                }]
            });

        } catch (error) {
            setRecords(records); // Revertir
            setAlertInfo({
                visible: true, title: 'Error', message: 'No se pudo guardar.', buttons: [{ text: 'OK', onPress: closeAlert }]
            });
        }
    };

    const confirmDelete = (index) => {
        setAlertInfo({
            visible: true,
            title: 'Eliminar Récord',
            message: '¿Estás seguro de que quieres eliminar este registro?',
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: closeAlert },
                { text: 'Eliminar', style: 'destructive', onPress: () => { closeAlert(); handleDelete(index); } }
            ]
        });
    };

    const handleDelete = async (index) => {
        const updatedList = records.filter((_, i) => i !== index);
        setRecords(updatedList);
        try {
            await apiClient.put('/users/profile/rm', { rmRecords: updatedList });
            if (onRecordsUpdate) {
                onRecordsUpdate(updatedList);
            }
        } catch (error) { console.error(error); }
    };

    // Modal interno de Porcentajes
    const renderPercentageModal = () => {
        if (!percentageItem) return null;
        const percentages = [105, 100, 95, 90, 85, 80, 75, 70, 65, 60, 50];
        
        return (
            <Modal visible={!!percentageItem} transparent={true} animationType="fade" onRequestClose={() => setPercentageItem(null)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPercentageItem(null)}>
                    <View style={[styles.modalContainer, { height: 'auto', maxHeight: '85%', justifyContent: 'flex-start', paddingTop:0 }]}> 
                        <View style={[styles.header, { borderBottomWidth: 1, borderColor: Colors[colorScheme].border, padding: 15 }]}>
                            <View style={{flex:1}}>
                                <Text style={[styles.recordTitle, {fontSize: 18}]}>{percentageItem.exercise}</Text>
                                <Text style={{color: Colors[colorScheme].icon, fontSize:12}}>RM Base: {percentageItem.weight}kg</Text>
                            </View>
                            <TouchableOpacity onPress={() => setPercentageItem(null)}>
                                <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{padding: 15}}>
                            <View style={styles.percentageGrid}>
                                {percentages.map((p) => (
                                    <View key={p} style={styles.percentageRow}>
                                        <Text style={[styles.percentageLabel, p > 100 && {color: gymColor}]}>{p}%</Text>
                                        <Text style={[styles.percentageValue, p > 100 && {color: gymColor, fontWeight:'bold'}]}>
                                            {Math.round(percentageItem.weight * (p / 100))} kg
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        
                        {/* HEADER */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close-circle" size={28} color={Colors[colorScheme].icon} />
                            </TouchableOpacity>
                        </View>

                        {/* TABS */}
                        <View style={styles.tabsContainer}>
                            <TouchableOpacity 
                                style={[styles.tab, tab === 'list' && styles.activeTab]} 
                                onPress={() => { setTab('list'); resetForm(); }}
                            >
                                <Text style={[styles.tabText, tab === 'list' && styles.activeTabText]}>Mis RMs</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.tab, tab === 'calculator' && styles.activeTab]} 
                                onPress={() => setTab('calculator')}
                            >
                                <Text style={[styles.tabText, tab === 'calculator' && styles.activeTabText]}>
                                    {editingIndex !== null ? 'Editar' : 'Calculadora'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* CONTENIDO */}
                        <View style={styles.content}>
                            {tab === 'list' ? (
                                <FlatList
                                    data={records}
                                    keyExtractor={(item, index) => index.toString()}
                                    ListEmptyComponent={
                                        <View style={{alignItems:'center', marginTop: 50}}>
                                            <FontAwesome5 name="dumbbell" size={40} color={Colors[colorScheme].icon} style={{opacity:0.5}}/>
                                            <Text style={styles.emptyText}>No tienes RMs guardados.</Text>
                                            <TouchableOpacity onPress={() => setTab('calculator')} style={{marginTop: 10}}>
                                                <Text style={{color: gymColor, fontWeight:'bold'}}>Calcular uno ahora</Text>
                                            </TouchableOpacity>
                                        </View>
                                    }
                                    renderItem={({ item, index }) => (
                                        <View style={styles.recordItem}>
                                            <View style={{flex: 1}}>
                                                <Text style={styles.recordTitle}>{item.exercise}</Text>
                                                <Text style={styles.recordDate}>{new Date(item.date).toLocaleDateString()}</Text>
                                            </View>
                                            
                                            <View style={styles.actionsContainer}>
                                                {/* BOTÓN % TABLA */}
                                                <TouchableOpacity style={styles.percentButton} onPress={() => setPercentageItem(item)}>
                                                    <MaterialCommunityIcons name="percent" size={16} color={gymColor} />
                                                </TouchableOpacity>

                                                {/* PESO */}
                                                <Text style={styles.recordWeight}>{item.weight} kg</Text>
                                                
                                                {/* EDITAR */}
                                                <TouchableOpacity onPress={() => handleEdit(item, index)} style={{padding: 5}}>
                                                    <FontAwesome5 name="pencil-alt" size={16} color={Colors[colorScheme].icon} />
                                                </TouchableOpacity>

                                                {/* BORRAR */}
                                                <TouchableOpacity onPress={() => confirmDelete(index)} style={{padding: 5}}>
                                                    <Ionicons name="trash-outline" size={20} color="#ff4444" style={{opacity:0.8}} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                />
                            ) : (
                                <View style={{flex: 1}}>
                                    <Text style={styles.label}>Ejercicio</Text>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="Ej: Sentadilla, Press Banca..." 
                                        placeholderTextColor={Colors[colorScheme].icon}
                                        value={exerciseName}
                                        onChangeText={setExerciseName}
                                    />

                                    <View style={{flexDirection:'row', gap: 15}}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Peso (kg)</Text>
                                            <TextInput 
                                                style={styles.input} 
                                                keyboardType="numeric" 
                                                placeholder="0" 
                                                placeholderTextColor={Colors[colorScheme].icon}
                                                value={weightInput}
                                                onChangeText={setWeightInput}
                                            />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Repeticiones</Text>
                                            <TextInput 
                                                style={styles.input} 
                                                keyboardType="numeric" 
                                                placeholder="0" 
                                                placeholderTextColor={Colors[colorScheme].icon}
                                                value={repsInput}
                                                onChangeText={setRepsInput}
                                            />
                                        </View>
                                    </View>

                                    {/* RESULTADO EDITABLE */}
                                    <View style={styles.resultBox}>
                                        <Text style={styles.resultLabel}>RM Calculado</Text>
                                        <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
                                            <TextInput 
                                                style={styles.resultInput}
                                                value={finalRM}
                                                onChangeText={setFinalRM}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={Colors[colorScheme].text}
                                            />
                                            <Text style={{fontSize: 20, color: Colors[colorScheme].text, fontWeight:'bold'}}> kg</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.disclaimer}>*Usando la fórmula de Brzycki.</Text>

                                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveRM}>
                                        <Text style={styles.saveButtonText}>{editingIndex !== null ? 'Actualizar RM' : 'Guardar RM'}</Text>
                                    </TouchableOpacity>

                                    {editingIndex !== null && (
                                        <TouchableOpacity onPress={() => { resetForm(); setTab('list'); }} style={{marginTop:15, alignItems:'center'}}>
                                            <Text style={{color: Colors[colorScheme].icon}}>Cancelar Edición</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    <CustomAlert 
                        visible={alertInfo.visible}
                        title={alertInfo.title}
                        message={alertInfo.message}
                        buttons={alertInfo.buttons}
                        onClose={closeAlert}
                        gymColor={gymColor}
                    />

                    {renderPercentageModal()}
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', },
    modalContainer: { backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 5, borderTopRightRadius: 5, height: '85%', overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 15, paddingTop: 10, },
    tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    tab: { flex: 1, padding: 15, alignItems: 'center' },
    activeTab: { borderBottomWidth: 2, borderBottomColor: gymColor },
    tabText: { color: Colors[colorScheme].icon, fontWeight: '600' },
    activeTabText: { color: gymColor, fontWeight: 'bold' },
    content: { flex: 1, padding: 20 },
    emptyText: { color: Colors[colorScheme].text, marginTop: 10, fontSize: 16 },
    
    // LISTA
    recordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    recordTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text },
    recordDate: { fontSize: 12, color: Colors[colorScheme].icon, marginTop: 2 },
    actionsContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    percentButton: { backgroundColor: gymColor + '20', padding: 6, borderRadius: 5 },
    recordWeight: { fontSize: 18, fontWeight: 'bold', color: gymColor, minWidth: 40, textAlign:'right' },
    
    // CALCULADORA
    label: { color: Colors[colorScheme].text, marginBottom: 5, fontWeight:'600' },
    input: { backgroundColor: Colors[colorScheme].inputBackground, color: Colors[colorScheme].text, padding: 12, borderRadius: 5, marginBottom: 15, borderWidth: 1, borderColor: Colors[colorScheme].border },
    resultBox: { backgroundColor: Colors[colorScheme].cardBackground, padding: 20, borderRadius: 5, alignItems: 'center', marginVertical: 10, borderWidth: 1, borderColor: gymColor },
    resultLabel: { color: Colors[colorScheme].text, fontSize: 14, marginBottom: 5 },
    resultInput: { fontSize: 32, fontWeight: 'bold', color: Colors[colorScheme].text, minWidth: 30, textAlign:'center',  },
    saveButton: { backgroundColor: gymColor, padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    disclaimer: { color: Colors[colorScheme].icon, fontSize: 10, textAlign: 'center', marginTop: 10, marginBottom:10 },

    // TABLA PORCENTAJES
    percentageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 10 },
    percentageRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderColor: Colors[colorScheme].border },
    percentageLabel: { color: Colors[colorScheme].text, fontWeight: '600' },
    percentageValue: { color: Colors[colorScheme].text },
});

export default RMCalculatorModal;