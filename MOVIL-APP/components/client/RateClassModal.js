import React, { useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, TextInput,
    useColorScheme, StyleSheet, ActivityIndicator
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

const RateClassModal = ({ visible, onClose, gymColor, apiClient, claseId, profesorId, className, profesorName }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '' });

    if (!visible) return null;

    const handleRate = async () => {
        if (rating === 0) {
            setAlertInfo({ visible: true, title: 'Atención', message: 'Por favor selecciona al menos 1 estrella.' });
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.post('/reviews', {
                claseId,
                profesorId,
                rating,
                comment
            });
            setAlertInfo({ visible: true, title: '¡Gracias!', message: 'Tu reseña ha sido enviada.' });
        } catch (error) {
            console.error("Error al enviar reseña:", error);
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo enviar la reseña.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseAlert = () => {
        setAlertInfo({ visible: false, title: '', message: '' });
        if (alertInfo.title === '¡Gracias!') {
            onClose(); // Cerrar modal al enviar con éxito
        }
    };

    const renderStars = () => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <TouchableOpacity key={i} onPress={() => setRating(i)} style={{ padding: 5 }}>
                    <Ionicons 
                        name={i <= rating ? "star" : "star-outline"} 
                        size={40} 
                        color={i <= rating ? "#FFD700" : Colors[colorScheme].icon} 
                    />
                </TouchableOpacity>
            );
        }
        return <View style={styles.starsContainer}>{stars}</View>;
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
                    </TouchableOpacity>
                    
                    <Text style={styles.title}>¿Qué te pareció la clase?</Text>
                    <Text style={styles.subtitle}>{className}</Text>
                    <Text style={styles.profesorName}>Prof. {profesorName}</Text>

                    {renderStars()}

                    <Text style={styles.label}>Comentario (Opcional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Escribe tu opinión (será anónima)..."
                        placeholderTextColor="#999"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                    />

                    <TouchableOpacity 
                        style={[styles.submitButton, { backgroundColor: gymColor || Colors[colorScheme].tint, opacity: submitting ? 0.7 : 1 }]} 
                        onPress={handleRate}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>Enviar Reseña</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <CustomAlert 
                visible={alertInfo.visible} 
                title={alertInfo.title} 
                message={alertInfo.message} 
                onClose={handleCloseAlert} 
                gymColor={gymColor} 
            />
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: { width: '90%', backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 20, padding: 25, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    title: { fontSize: 20, fontWeight: 'bold', color: Colors[colorScheme].text, textAlign: 'center', marginBottom: 5 },
    subtitle: { fontSize: 16, color: gymColor || Colors[colorScheme].tint, textAlign: 'center', fontWeight: 'bold' },
    profesorName: { fontSize: 14, color: Colors[colorScheme].text, textAlign: 'center', opacity: 0.7, marginBottom: 20 },
    starsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    label: { fontSize: 14, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 10 },
    input: { height: 100, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 10, padding: 15, backgroundColor: Colors[colorScheme].background, color: Colors[colorScheme].text, textAlignVertical: 'top', marginBottom: 20 },
    submitButton: { paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default RateClassModal;
