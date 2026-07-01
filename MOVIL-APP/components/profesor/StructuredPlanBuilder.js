import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

const StructuredPlanBuilder = ({ initialData, onChange, colorScheme, gymColor }) => {
    const defaultDay = {
        id: 'day-' + Date.now(),
        name: 'Día 1',
        exercises: [
            {
                id: 'ex-' + Date.now(),
                name: '',
                series: '4',
                reps: '10-12',
                notes: '',
                videoUrl: ''
            }
        ]
    };

    const [days, setDays] = useState(() => {
        if (initialData && Array.isArray(initialData) && initialData.length > 0) {
            return initialData;
        }
        return [defaultDay];
    });

    const [activeDayIndex, setActiveDayIndex] = useState(0);

    const notifyChange = (updatedDays) => {
        setDays(updatedDays);
        if (onChange) {
            onChange(JSON.stringify({ type: 'structured', days: updatedDays }));
        }
    };

    const handleAddDay = () => {
        const newDayNumber = days.length + 1;
        const newDay = {
            id: 'day-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: `Día ${newDayNumber}`,
            exercises: [
                {
                    id: 'ex-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                    name: '',
                    series: '4',
                    reps: '10-12',
                    notes: '',
                    videoUrl: ''
                }
            ]
        };
        const updated = [...days, newDay];
        notifyChange(updated);
        setActiveDayIndex(updated.length - 1);
    };

    const handleDeleteDay = (index) => {
        if (days.length <= 1) return;
        const updated = days.filter((_, i) => i !== index);
        notifyChange(updated);
        if (activeDayIndex >= updated.length) {
            setActiveDayIndex(updated.length - 1);
        }
    };

    const handleDayNameChange = (text) => {
        const updated = days.map((day, i) => i === activeDayIndex ? { ...day, name: text } : day);
        notifyChange(updated);
    };

    const handleAddExercise = () => {
        const currentDay = days[activeDayIndex];
        if (!currentDay) return;
        const newEx = {
            id: 'ex-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: '',
            series: '3',
            reps: '10',
            notes: '',
            videoUrl: ''
        };
        const updatedExercises = [...(currentDay.exercises || []), newEx];
        const updatedDays = days.map((day, i) => i === activeDayIndex ? { ...day, exercises: updatedExercises } : day);
        notifyChange(updatedDays);
    };

    const handleDeleteExercise = (exIndex) => {
        const currentDay = days[activeDayIndex];
        if (!currentDay) return;
        const updatedExercises = currentDay.exercises.filter((_, i) => i !== exIndex);
        const updatedDays = days.map((day, i) => i === activeDayIndex ? { ...day, exercises: updatedExercises } : day);
        notifyChange(updatedDays);
    };

    const handleExerciseChange = (exIndex, field, value) => {
        const currentDay = days[activeDayIndex];
        if (!currentDay) return;
        const updatedExercises = currentDay.exercises.map((ex, i) => i === exIndex ? { ...ex, [field]: value } : ex);
        const updatedDays = days.map((day, i) => i === activeDayIndex ? { ...day, exercises: updatedExercises } : day);
        notifyChange(updatedDays);
    };

    const currentDay = days[activeDayIndex] || days[0];
    const textColor = Colors[colorScheme || 'light'].text;
    const borderColor = Colors[colorScheme || 'light'].border || '#ddd';
    const primaryColor = gymColor || '#007bff';

    return (
        <View style={styles.container}>
            {/* Pestañas de Días */}
            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
                    {days.map((day, idx) => {
                        const isActive = idx === activeDayIndex;
                        return (
                            <TouchableOpacity
                                key={day.id || idx}
                                style={[styles.dayTab, isActive && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                                onPress={() => setActiveDayIndex(idx)}
                            >
                                <Text style={[styles.dayTabText, isActive ? { color: '#fff' } : { color: textColor }]}>
                                    {day.name || `Día ${idx + 1}`}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                    <TouchableOpacity style={[styles.addDayTab, { borderColor: primaryColor }]} onPress={handleAddDay}>
                        <Ionicons name="add" size={16} color={primaryColor} />
                        <Text style={[styles.addDayTabText, { color: primaryColor }]}>Añadir Día</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Configuración del Día Activo */}
            {currentDay && (
                <View style={[styles.dayContainer, { borderColor: borderColor }]}>
                    <View style={styles.dayHeaderRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={[styles.label, { color: textColor }]}>Nombre del Día</Text>
                            <TextInput
                                style={[styles.dayNameInput, { color: textColor, borderColor: borderColor }]}
                                value={currentDay.name}
                                onChangeText={handleDayNameChange}
                                placeholder="Ej: Día 1 - Pecho y Tríceps"
                                placeholderTextColor="#999"
                            />
                        </View>
                        {days.length > 1 && (
                            <TouchableOpacity
                                style={styles.deleteDayButton}
                                onPress={() => handleDeleteDay(activeDayIndex)}
                            >
                                <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Lista de Ejercicios */}
                    <Text style={[styles.exercisesSectionTitle, { color: textColor }]}>Ejercicios ({currentDay.exercises?.length || 0})</Text>

                    {currentDay.exercises?.map((exercise, exIdx) => (
                        <View key={exercise.id || exIdx} style={[styles.exerciseCard, { borderColor: borderColor }]}>
                            <View style={styles.exerciseCardHeader}>
                                <Text style={[styles.exerciseNumber, { color: primaryColor }]}>#{exIdx + 1}</Text>
                                <TouchableOpacity onPress={() => handleDeleteExercise(exIdx)} style={styles.deleteExButton}>
                                    <Ionicons name="close-circle-outline" size={22} color="#e74c3c" />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.inputLabel, { color: textColor }]}>Nombre del Ejercicio</Text>
                            <TextInput
                                style={[styles.input, { color: textColor, borderColor: borderColor }]}
                                value={exercise.name}
                                onChangeText={(val) => handleExerciseChange(exIdx, 'name', val)}
                                placeholder="Ej: Press de Banca Plano"
                                placeholderTextColor="#999"
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 4 }}>
                                    <Text style={[styles.inputLabel, { color: textColor }]}>Series</Text>
                                    <TextInput
                                        style={[styles.input, { color: textColor, borderColor: borderColor }]}
                                        value={exercise.series}
                                        onChangeText={(val) => handleExerciseChange(exIdx, 'series', val)}
                                        placeholder="4"
                                        placeholderTextColor="#999"
                                    />
                                </View>
                                <View style={{ flex: 1, marginHorizontal: 4 }}>
                                    <Text style={[styles.inputLabel, { color: textColor }]}>Reps</Text>
                                    <TextInput
                                        style={[styles.input, { color: textColor, borderColor: borderColor }]}
                                        value={exercise.reps}
                                        onChangeText={(val) => handleExerciseChange(exIdx, 'reps', val)}
                                        placeholder="10-12"
                                        placeholderTextColor="#999"
                                    />
                                </View>
                                <View style={{ flex: 1.5, marginLeft: 4 }}>
                                    <Text style={[styles.inputLabel, { color: textColor }]}>Peso / Notas</Text>
                                    <TextInput
                                        style={[styles.input, { color: textColor, borderColor: borderColor }]}
                                        value={exercise.notes}
                                        onChangeText={(val) => handleExerciseChange(exIdx, 'notes', val)}
                                        placeholder="Ej: RIR 2 / 60kg"
                                        placeholderTextColor="#999"
                                    />
                                </View>
                            </View>

                            <Text style={[styles.inputLabel, { color: textColor }]}>Video explicativo (Link YouTube / MP4)</Text>
                            <View style={[styles.videoInputContainer, { borderColor: borderColor }]}>
                                <MaterialCommunityIcons name="video-outline" size={20} color={primaryColor} style={{ marginRight: 6 }} />
                                <TextInput
                                    style={[styles.videoInput, { color: textColor }]}
                                    value={exercise.videoUrl}
                                    onChangeText={(val) => handleExerciseChange(exIdx, 'videoUrl', val)}
                                    placeholder="https://youtube.com/watch?v=..."
                                    placeholderTextColor="#999"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={[styles.addExerciseButton, { backgroundColor: primaryColor + '15', borderColor: primaryColor }]}
                        onPress={handleAddExercise}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={primaryColor} />
                        <Text style={[styles.addExerciseButtonText, { color: primaryColor }]}>Añadir Ejercicio</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8
    },
    tabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 10
    },
    dayTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ccc',
        marginRight: 8
    },
    dayTabText: {
        fontSize: 13,
        fontWeight: 'bold'
    },
    addDayTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    addDayTabText: {
        fontSize: 13,
        fontWeight: 'bold',
        marginLeft: 4
    },
    dayContainer: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginTop: 4
    },
    dayHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 14
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4
    },
    dayNameInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        fontWeight: 'bold'
    },
    deleteDayButton: {
        padding: 8,
        marginBottom: 2
    },
    exercisesSectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10
    },
    exerciseCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.02)'
    },
    exerciseCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    exerciseNumber: {
        fontSize: 14,
        fontWeight: '900'
    },
    deleteExButton: {
        padding: 2
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 3,
        marginTop: 6
    },
    input: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 13
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4
    },
    videoInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 4
    },
    videoInput: {
        flex: 1,
        fontSize: 13,
        paddingVertical: 2
    },
    addExerciseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginTop: 6
    },
    addExerciseButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 6
    }
});

export default StructuredPlanBuilder;
