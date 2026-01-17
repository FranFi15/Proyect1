import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import apiClient from '../../services/apiClient';

// Importamos TU alerta personalizada
import CustomAlert from '@/components/CustomAlert';

// Fórmula de Epley para 1RM
const calculate1RM = (weight, reps) => {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
};

const RMCalculatorModal = ({ visible, onClose, initialRecords = [], colorScheme, gymColor }) => {
    const styles = getStyles(colorScheme, gymColor);
    
    const [tab, setTab] = useState('list'); 
    const [records, setRecords] = useState(initialRecords);
    
    // Estados de la calculadora
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [calculatedRM, setCalculatedRM] = useState(0);
    const [exerciseName, setExerciseName] = useState('');

    // Estado para CustomAlert
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    useEffect(() => {
        setRecords(initialRecords);
    }, [initialRecords]);

    useEffect(() => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);
        if (!isNaN(w) && !isNaN(r)) {
            setCalculatedRM(calculate1RM(w, r));
        } else {
            setCalculatedRM(0);
        }
    }, [weight, reps]);

    // Función auxiliar para cerrar la alerta
    const closeAlert = () => setAlertInfo({ ...alertInfo, visible: false });

    const handleSaveRM = async () => {
        if (!exerciseName.trim()) {
            setAlertInfo({
                visible: true,
                title: 'Falta información',
                message: 'Por favor escribe el nombre del ejercicio.',
                buttons: [{ text: 'Entendido', onPress: closeAlert }]
            });
            return;
        }
        if (!weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0) {
            setAlertInfo({
                visible: true,
                title: 'Falta información',
                message: 'Por favor escribe el peso del ejercicio.',
                buttons: [{ text: 'Entendido', onPress: closeAlert }]
            });
            return;
        }
        if (!reps || isNaN(parseFloat(reps)) || parseFloat(reps) <= 0) {
            setAlertInfo({
                visible: true,
                title: 'Falta información',
                message: 'Por favor escribe las repeticiones del ejercicio.',
                buttons: [{ text: 'Entendido', onPress: closeAlert }]
            });
            return;
        }

        const newRecord = {
            exercise: exerciseName,
            weight: calculatedRM > 0 ? calculatedRM : parseFloat(weight),
            date: new Date()
        };

        const updatedList = [...records, newRecord];
        
        // Optimistic UI update (Actualizamos localmente primero)
        setRecords(updatedList);
        
        try {
            await apiClient.put('/users/profile/rm', { rmRecords: updatedList });
            
            // Limpiamos form
            setWeight('');
            setReps('');
            setExerciseName('');
            
            // Notificamos éxito y volvemos a la lista
            setAlertInfo({
                visible: true,
                title: '¡Guardado!',
                message: `Nuevo RM para ${newRecord.exercise} registrado.`,
                buttons: [{ 
                    text: 'Ver Lista', 
                    onPress: () => {
                        closeAlert();
                        setTab('list');
                    }
                }]
            });

        } catch (error) {
            // Revertimos si falla
            setRecords(records); 
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudo guardar el récord. Intenta nuevamente.',
                buttons: [{ text: 'OK', onPress: closeAlert }]
            });
        }
    };

    const confirmDelete = (index) => {
        setAlertInfo({
            visible: true,
            title: 'Eliminar Récord',
            message: '¿Estás seguro de que quieres eliminar este registro de RM?',
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: closeAlert },
                { 
                    text: 'Eliminar', 
                    style: 'destructive', 
                    onPress: () => {
                        closeAlert();
                        handleDelete(index);
                    }
                }
            ]
        });
    };

    const handleDelete = async (index) => {
        const updatedList = records.filter((_, i) => i !== index);
        setRecords(updatedList);
        try {
            await apiClient.put('/users/profile/rm', { rmRecords: updatedList });
        } catch (error) {
            console.error(error);
        }
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
                                onPress={() => setTab('list')}
                            >
                                <Text style={[styles.tabText, tab === 'list' && styles.activeTabText]}>Mis RMs</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.tab, tab === 'calculator' && styles.activeTab]} 
                                onPress={() => setTab('calculator')}
                            >
                                <Text style={[styles.tabText, tab === 'calculator' && styles.activeTabText]}>Calculadora</Text>
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
                                            <View>
                                                <Text style={styles.recordTitle}>{item.exercise}</Text>
                                                <Text style={styles.recordDate}>{new Date(item.date).toLocaleDateString()}</Text>
                                            </View>
                                            <View style={{flexDirection:'row', alignItems:'center', gap: 15}}>
                                                <Text style={styles.recordWeight}>{item.weight} kg</Text>
                                                <TouchableOpacity onPress={() => confirmDelete(index)}>
                                                    <Ionicons name="trash-outline" size={20} color="red" style={{opacity:0.6}} />
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
                                                value={weight}
                                                onChangeText={setWeight}
                                            />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Repeticiones</Text>
                                            <TextInput 
                                                style={styles.input} 
                                                keyboardType="numeric" 
                                                placeholder="0" 
                                                placeholderTextColor={Colors[colorScheme].icon}
                                                value={reps}
                                                onChangeText={setReps}
                                            />
                                        </View>
                                    </View>

                                    {/* RESULTADO VISUAL */}
                                    <View style={styles.resultBox}>
                                        <Text style={styles.resultLabel}>Tu 1RM Estimado</Text>
                                        <Text style={styles.resultValue}>{calculatedRM} kg</Text>
                                        
                                        
                                    </View>

                                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveRM}>
                                        <Text style={styles.saveButtonText}>Guardar este RM</Text>
                                    </TouchableOpacity>

                                    <Text style={styles.disclaimer}>*Usando la fórmula de Epley.</Text>
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

                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', },
    modalContainer: { backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 5, borderTopRightRadius: 5, height: '85%', overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, },
    tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    tab: { flex: 1, padding: 15, alignItems: 'center' },
    activeTab: { borderBottomWidth: 2, borderBottomColor: gymColor },
    tabText: { color: Colors[colorScheme].icon, fontWeight: '600' },
    activeTabText: { color: gymColor, fontWeight: 'bold' },
    content: { flex: 1, padding: 20 },
    emptyText: { color: Colors[colorScheme].text, marginTop: 10, fontSize: 16 },
    // Estilos Lista
    recordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    recordTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text },
    recordDate: { fontSize: 12, color: Colors[colorScheme].icon, marginTop: 2 },
    recordWeight: { fontSize: 18, fontWeight: 'bold', color: gymColor },
    // Estilos Calculadora
    label: { color: Colors[colorScheme].text, marginBottom: 5, fontWeight:'600' },
    input: { backgroundColor: Colors[colorScheme].inputBackground, color: Colors[colorScheme].text, padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: Colors[colorScheme].border },
    resultBox: { backgroundColor: Colors[colorScheme].cardBackground, padding: 20, borderRadius: 10, alignItems: 'center', marginVertical: 10, borderWidth: 1, borderColor: gymColor },
    resultLabel: { color: Colors[colorScheme].text, fontSize: 14, marginBottom: 5 },
    resultValue: { color: gymColor, fontSize: 32, fontWeight: 'bold' },
    saveButton: { backgroundColor: gymColor, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    disclaimer: { color: Colors[colorScheme].icon, fontSize: 10, textAlign: 'center', marginTop: 15 }
});

export default RMCalculatorModal;