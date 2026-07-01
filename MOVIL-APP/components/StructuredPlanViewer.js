import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';

const StructuredPlanViewer = ({ days, colorScheme }) => {
    const { gymColor } = useAuth();
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [completedExercises, setCompletedExercises] = useState({});

    if (!days || !Array.isArray(days) || days.length === 0) {
        return <Text style={{ color: Colors[colorScheme || 'light'].text }}>No hay días en esta rutina.</Text>;
    }

    const currentDay = days[selectedDayIndex] || days[0];
    const exercises = currentDay.exercises || [];

    const toggleCompletion = (exIndex) => {
        const key = `${selectedDayIndex}-${exIndex}`;
        setCompletedExercises(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleOpenVideo = async (url) => {
        if (!url) return;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                await Linking.openURL(url);
            }
        } catch (error) {
            Alert.alert('Error de Enlace', 'No se pudo abrir el video en tu navegador o aplicación.');
        }
    };

    const primaryColor = gymColor || '#007bff';
    const textColor = Colors[colorScheme || 'light'].text;
    const borderColor = Colors[colorScheme || 'light'].border || '#e0e0e0';
    const cardBg = colorScheme === 'dark' ? '#1e1e1e' : '#f8f9fa';

    const completedCount = exercises.filter((_, idx) => completedExercises[`${selectedDayIndex}-${idx}`]).length;
    const progressPercent = exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0;

    return (
        <View style={styles.container}>
            {/* Selector de Días */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
                {days.map((day, idx) => {
                    const isActive = idx === selectedDayIndex;
                    return (
                        <TouchableOpacity
                            key={day.id || idx}
                            style={[styles.dayTab, isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : { borderColor: borderColor }]}
                            onPress={() => setSelectedDayIndex(idx)}
                        >
                            <Text style={[styles.dayTabText, isActive ? { color: '#fff' } : { color: textColor }]}>
                                {day.name || `Día ${idx + 1}`}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Progreso del Día */}
            <View style={[styles.progressContainer, { backgroundColor: cardBg, borderColor: borderColor }]}>
                <View style={styles.progressTextRow}>
                    <Text style={[styles.progressTitle, { color: textColor }]}>
                        {currentDay.name || `Día ${selectedDayIndex + 1}`}
                    </Text>
                    <Text style={[styles.progressStats, { color: primaryColor }]}>
                        {completedCount} de {exercises.length} listos
                    </Text>
                </View>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: primaryColor }]} />
                </View>
            </View>

            {/* Lista de Ejercicios */}
            {exercises.length === 0 ? (
                <Text style={{ color: textColor, fontStyle: 'italic', textAlign: 'center', marginVertical: 20 }}>
                    Este día no tiene ejercicios asignados.
                </Text>
            ) : (
                exercises.map((exercise, idx) => {
                    const key = `${selectedDayIndex}-${idx}`;
                    const isDone = !!completedExercises[key];

                    return (
                        <TouchableOpacity
                            key={exercise.id || idx}
                            activeOpacity={0.8}
                            style={[
                                styles.exerciseCard,
                                { backgroundColor: cardBg, borderColor: isDone ? primaryColor : borderColor },
                                isDone && styles.exerciseCardDone
                            ]}
                            onPress={() => toggleCompletion(idx)}
                        >
                            <View style={styles.exerciseTopRow}>
                                {/* Checkbox */}
                                <View style={[styles.checkbox, isDone ? { backgroundColor: primaryColor, borderColor: primaryColor } : { borderColor: '#888' }]}>
                                    {isDone && <Ionicons name="checkmark" size={16} color="#fff" />}
                                </View>

                                {/* Nombre del ejercicio */}
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.exerciseName, { color: textColor }, isDone && styles.exerciseNameDone]}>
                                        {exercise.name || `Ejercicio #${idx + 1}`}
                                    </Text>
                                </View>
                            </View>

                            {/* Detalles: Series, Reps, Peso/Notas */}
                            <View style={styles.badgesRow}>
                                {exercise.series ? (
                                    <View style={[styles.badge, { backgroundColor: primaryColor + '15' }]}>
                                        <Text style={[styles.badgeText, { color: primaryColor }]}>Series: {exercise.series}</Text>
                                    </View>
                                ) : null}

                                {exercise.reps ? (
                                    <View style={[styles.badge, { backgroundColor: primaryColor + '15' }]}>
                                        <Text style={[styles.badgeText, { color: primaryColor }]}>Reps: {exercise.reps}</Text>
                                    </View>
                                ) : null}
                            </View>

                            {exercise.notes ? (
                                <Text style={[styles.exerciseNotes, { color: textColor }]}>
                                    💡 <Text style={{ fontWeight: '600' }}>Nota/Peso:</Text> {exercise.notes}
                                </Text>
                            ) : null}

                            {/* Botón de Video si existe URL */}
                            {exercise.videoUrl ? (
                                <TouchableOpacity
                                    style={[styles.videoButton, { borderColor: primaryColor }]}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleOpenVideo(exercise.videoUrl);
                                    }}
                                >
                                    <MaterialCommunityIcons name="play-circle" size={20} color={primaryColor} />
                                    <Text style={[styles.videoButtonText, { color: primaryColor }]}>Ver Video Explicativo</Text>
                                </TouchableOpacity>
                            ) : null}
                        </TouchableOpacity>
                    );
                })
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingVertical: 5
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingBottom: 12
    },
    dayTab: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 22,
        borderWidth: 1.5,
        marginRight: 10
    },
    dayTabText: {
        fontSize: 14,
        fontWeight: 'bold'
    },
    progressContainer: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16
    },
    progressTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    progressTitle: {
        fontSize: 16,
        fontWeight: 'bold'
    },
    progressStats: {
        fontSize: 13,
        fontWeight: 'bold'
    },
    progressBarBg: {
        height: 8,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 4,
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4
    },
    exerciseCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12
    },
    exerciseCardDone: {
        opacity: 0.85
    },
    exerciseTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: 'bold'
    },
    exerciseNameDone: {
        textDecorationLine: 'line-through',
        opacity: 0.6
    },
    badgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginLeft: 36,
        marginBottom: 6
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    exerciseNotes: {
        fontSize: 13,
        marginLeft: 36,
        marginTop: 4,
        fontStyle: 'italic'
    },
    videoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 12,
        marginLeft: 36,
        backgroundColor: 'rgba(0,123,255,0.05)'
    },
    videoButtonText: {
        fontSize: 13,
        fontWeight: 'bold',
        marginLeft: 6
    }
});

export default StructuredPlanViewer;
