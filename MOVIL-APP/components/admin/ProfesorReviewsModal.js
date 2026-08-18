import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity, ScrollView,
    useColorScheme, StyleSheet, ActivityIndicator
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';

const ProfesorReviewsModal = ({ visible, onClose, gymColor, apiClient, profesorId, profesorName }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [loading, setLoading] = useState(false);
    const [reviewsData, setReviewsData] = useState(null);

    const fetchReviews = useCallback(async () => {
        if (!apiClient || !visible || !profesorId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/reviews/profesor/${profesorId}`);
            setReviewsData(res.data);
        } catch (error) {
            console.error("Error cargando reseñas:", error);
        } finally {
            setLoading(false);
        }
    }, [apiClient, visible, profesorId]);

    useEffect(() => {
        if (visible) fetchReviews();
    }, [visible, fetchReviews]);

    if (!visible) return null;

    const renderStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Ionicons 
                    key={i} 
                    name={i <= rating ? "star" : "star-outline"} 
                    size={16} 
                    color="#FFD700" 
                />
            );
        }
        return <View style={{ flexDirection: 'row', marginTop: 4 }}>{stars}</View>;
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
            <View style={styles.modalContainer}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="chevron-down" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Reseñas: {profesorName}</Text>
                    <View style={{ width: 28 }} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={gymColor || Colors[colorScheme].tint} />
                        <Text style={{ marginTop: 10, color: Colors[colorScheme].text }}>Cargando reseñas...</Text>
                    </View>
                ) : !reviewsData || reviewsData.totalRatings === 0 ? (
                    <View style={styles.loadingContainer}>
                        <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors[colorScheme].icon} style={{ opacity: 0.5, marginBottom: 10 }} />
                        <Text style={{ color: Colors[colorScheme].text, opacity: 0.7 }}>Aún no hay reseñas para este profesor.</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Promedio</Text>
                            <Text style={styles.summaryRating}>{reviewsData.averageRating}</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                                {renderStars(Math.round(reviewsData.averageRating))}
                            </View>
                            <Text style={styles.summaryTotalText}>Basado en {reviewsData.totalRatings} reseñas (Anónimas)</Text>
                        </View>

                        {reviewsData.reviews.map((review, idx) => (
                            <View key={idx} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    {renderStars(review.rating)}
                                    <Text style={styles.reviewDate}>
                                        {format(new Date(review.createdAt), "d MMM yyyy", { locale: es })}
                                    </Text>
                                </View>
                                {review.comment ? (
                                    <Text style={styles.reviewComment}>"{review.comment}"</Text>
                                ) : (
                                    <Text style={[styles.reviewComment, { fontStyle: 'italic', opacity: 0.5 }]}>Sin comentario</Text>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, backgroundColor: Colors[colorScheme].background },
    headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 15, justifyContent: 'space-between' },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
    closeButton: { padding: 4 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 15, paddingBottom: 50 },
    summaryCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        alignItems: 'center',
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3
    },
    summaryTitle: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.8, marginBottom: 5 },
    summaryRating: { fontSize: 48, fontWeight: 'bold', color: gymColor || Colors[colorScheme].tint },
    summaryTotalText: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.6, marginTop: 10 },
    reviewCard: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 12,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    reviewDate: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.5 },
    reviewComment: { fontSize: 14, color: Colors[colorScheme].text, lineHeight: 20 }
});

export default ProfesorReviewsModal;
