import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, TextInput, Button, useColorScheme, ScrollView, Switch } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { getTrainingPlansForUser, createTrainingPlan, updateTrainingPlan } from '../../services/managementApi';

const TrainingPlanModal = ({ client, onClose }) => {
    const [plan, setPlan] = useState(null);
    const [content, setContent] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const response = await getTrainingPlansForUser(client._id);
                if (response.data && response.data.length > 0) {
                    const latestPlan = response.data[0];
                    setPlan(latestPlan);
                    setContent(latestPlan.content);
                    setIsVisible(latestPlan.isVisibleToUser);
                }
            } catch (error) {
                // No mostramos alerta si no hay plan, es normal
            }
        };
        fetchPlan();
    }, [client]);

    const handleSavePlan = async () => {
        if (!content) { 
            Alert.alert('Error', 'El contenido del plan no puede estar vacío.'); 
            return; 
        }
        try {
            if (plan) {
                await updateTrainingPlan(plan._id, { content, isVisibleToUser: isVisible });
            } else {
                await createTrainingPlan({ userId: client._id, content, isVisibleToUser: isVisible });
            }
            Alert.alert('Éxito', 'Plan guardado correctamente.');
            onClose();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el plan.');
        }
    };

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color="#ccc" />
                </TouchableOpacity>
                <ScrollView>
                    <Text style={styles.modalTitle}>Plan para {client.nombre}</Text>
                    <Text style={styles.inputLabel}>Diagnóstico / Plan de Entrenamiento</Text>
                    <TextInput 
                        style={styles.textArea} 
                        multiline 
                        value={content} 
                        onChangeText={setContent}
                        placeholder="Escribe aquí los ejercicios, series, repeticiones..."
                        placeholderTextColor={Colors[colorScheme].icon}
                    />
                    <View style={styles.switchContainer}>
                        <Text style={styles.inputLabel}>Visible para el socio</Text>
                        <Switch 
                            trackColor={{ false: "#767577", true: gymColor }} 
                            onValueChange={setIsVisible} 
                            value={isVisible} 
                        />
                    </View>
                    <Button title="Guardar Plan" onPress={handleSavePlan} color={gymColor} />
                </ScrollView>
            </View>
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '90%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    inputLabel: { fontSize: 16, color: Colors[colorScheme].text, marginBottom: 10, fontWeight: '500' },
    textArea: { 
        height: 300, 
        borderColor: Colors[colorScheme].border, 
        borderWidth: 1, 
        borderRadius: 8, 
        padding: 15, 
        fontSize: 16, 
        textAlignVertical: 'top', 
        color: Colors[colorScheme].text 
    },
    switchContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingVertical: 15, 
        marginVertical: 15 
    },
});

export default TrainingPlanModal;
