import React, { useState, useCallback } from 'react';
import {
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    useColorScheme,
    View,
    TouchableOpacity,
    Modal,
    Text,
    TextInput,
} from 'react-native';
import { useCachedFocusEffect } from '@/hooks/useCachedFocusEffect';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';
import KeyboardAwareSheet from '@/components/KeyboardAwareSheet';
import { Ionicons, Octicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import PlanContentViewer from '@/components/PlanContentViewer';

const getCreatorFullName = (createdBy) => {
    if (!createdBy || typeof createdBy !== 'object') return null;
    const full = [createdBy.nombre, createdBy.apellido]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean)
        .join(' ');
    return full || null;
};

const StarRating = ({ value, onChange, accent, size = 28 }) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => onChange(star)} hitSlop={6}>
                <Ionicons
                    name={star <= value ? 'star' : 'star-outline'}
                    size={size}
                    color={star <= value ? accent : '#9aa0a6'}
                />
            </TouchableOpacity>
        ))}
    </View>
);

const PlanDetailBody = ({
    plan,
    onClose,
    gymColor,
    colorScheme,
    onFeedbackSubmitted,
}) => {
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);
    const [showFeedback, setShowFeedback] = useState(false);
    const [rating, setRating] = useState(plan.feedback?.rating || 0);
    const [comment, setComment] = useState(plan.feedback?.comment || '');
    const [submitting, setSubmitting] = useState(false);
    const [localAlert, setLocalAlert] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });

    const closeLocalAlert = () => setLocalAlert((prev) => ({ ...prev, visible: false }));

    const handleSubmitFeedback = async () => {
        if (!rating && !comment.trim()) {
            setLocalAlert({
                visible: true,
                title: 'Feedback',
                message: 'Elegí una calificación o escribí un comentario.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeLocalAlert }],
            });
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.post(`/plans/${plan._id}/feedback`, {
                rating: rating || null,
                comment: comment.trim(),
            });
            onFeedbackSubmitted?.(plan._id, {
                rating: rating || null,
                comment: comment.trim(),
                updatedAt: new Date().toISOString(),
            });
            setShowFeedback(false);
            setLocalAlert({
                visible: true,
                title: '¡Gracias!',
                message: 'Tu feedback se envió al profesor.',
                buttons: [
                    {
                        text: 'OK',
                        style: 'primary',
                        onPress: () => {
                            closeLocalAlert();
                            onClose();
                        },
                    },
                ],
            });
        } catch (error) {
            setLocalAlert({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo enviar el feedback.',
                buttons: [{ text: 'OK', style: 'primary', onPress: closeLocalAlert }],
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <View style={styles.detailRoot}>
                <KeyboardAwareSheet
                    onDismiss={onClose}
                    backgroundColor={Colors[colorScheme].background}
                    style={styles.detailSheet}
                >
                    <View style={[styles.detailHeader, { backgroundColor: accent }]}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={styles.detailKicker}>Plan de entrenamiento</Text>
                            <Text style={styles.detailHeaderTitle} numberOfLines={2}>{plan.name}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.detailCloseBtn} hitSlop={10}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {!showFeedback ? (
                        <>
                            <ScrollView
                                contentContainerStyle={styles.detailScroll}
                                showsVerticalScrollIndicator={false}
                            >
                                {!!plan.description && (
                                    <View style={styles.detailDescCard}>
                                        <Text style={styles.detailDesc}>{plan.description}</Text>
                                    </View>
                                )}
                                <View style={styles.detailMetaRow}>
                                    {!!getCreatorFullName(plan.createdBy) && (
                                        <>
                                            <Ionicons name="person-outline" size={14} color={Colors[colorScheme].icon} />
                                            <Text style={styles.detailMetaText}>
                                                Creado por {getCreatorFullName(plan.createdBy)}
                                            </Text>
                                        </>
                                    )}
                                    {!!plan.createdAt && (
                                        <>
                                            <Ionicons name="calendar-outline" size={14} color={Colors[colorScheme].icon} />
                                            <Text style={styles.detailMetaText}>
                                                {format(new Date(plan.createdAt), 'dd/MM/yyyy')}
                                            </Text>
                                        </>
                                    )}
                                    {!!plan.hasFeedback && (
                                        <View style={styles.donePill}>
                                            <Text style={styles.donePillText}>Hecho</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.contentCard}>
                                    <PlanContentViewer content={plan.content} colorScheme={colorScheme} />
                                </View>
                            </ScrollView>

                            <View style={styles.detailFooter}>
                                <TouchableOpacity
                                    style={[styles.finishBtn, { backgroundColor: accent }]}
                                    onPress={() => setShowFeedback(true)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                                    <Text style={styles.finishBtnText}>
                                        {plan.hasFeedback ? 'Actualizar feedback' : 'Finalicé el entrenamiento'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.feedbackScroll}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.feedbackTitle}>¿Cómo te fue?</Text>
                            <Text style={styles.feedbackHint}>
                                Tu profesor recibe una notificación con este feedback.
                            </Text>

                            <Text style={styles.feedbackLabel}>Calificación</Text>
                            <StarRating value={rating} onChange={setRating} accent={accent} />

                            <Text style={[styles.feedbackLabel, { marginTop: 18 }]}>Comentario</Text>
                            <TextInput
                                style={styles.feedbackInput}
                                placeholder="Contale cómo te sentiste, qué te costó, qué te gustó..."
                                placeholderTextColor={Colors[colorScheme].icon}
                                value={comment}
                                onChangeText={setComment}
                                multiline
                                textAlignVertical="top"
                                maxLength={2000}
                            />

                            <View style={styles.feedbackActions}>
                                <TouchableOpacity
                                    style={styles.feedbackCancel}
                                    onPress={() => setShowFeedback(false)}
                                    disabled={submitting}
                                >
                                    <Text style={styles.feedbackCancelText}>Volver</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.feedbackSubmit, { backgroundColor: accent }]}
                                    onPress={handleSubmitFeedback}
                                    disabled={submitting}
                                    activeOpacity={0.85}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.feedbackSubmitText}>Enviar</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </KeyboardAwareSheet>
            </View>

            <CustomAlert
                visible={localAlert.visible}
                title={localAlert.title}
                message={localAlert.message}
                buttons={localAlert.buttons}
                onClose={closeLocalAlert}
                gymColor={accent}
            />
        </>
    );
};

const PlanDetailModal = ({
    visible,
    plan,
    onClose,
    gymColor,
    colorScheme,
    onFeedbackSubmitted,
}) => (
    <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
        presentationStyle="overFullScreen"
    >
        {visible && plan ? (
            <PlanDetailBody
                key={plan._id}
                plan={plan}
                onClose={onClose}
                gymColor={gymColor}
                colorScheme={colorScheme}
                onFeedbackSubmitted={onFeedbackSubmitted}
            />
        ) : null}
    </Modal>
);


const MyPlanScreen = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const { gymColor } = useAuth();
    const accent = gymColor || '#1a5276';
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, accent);

    const [alertInfo, setAlertInfo] = useState({
        visible: false,
        title: '',
        message: '',
        buttons: [],
    });
    const closeAlert = () => setAlertInfo((prev) => ({ ...prev, visible: false }));

    const fetchPlans = useCallback(async () => {
        try {
            const response = await apiClient.get('/plans/my-plans');
            setPlans(response.data || []);
        } catch (error) {
            console.log('Error al cargar los planes visibles.');
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: 'No se pudo cargar tu plan de entrenamiento.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo((p) => ({ ...p, visible: false })) }],
            });
        }
    }, []);

    const { refresh } = useCachedFocusEffect(
        async ({ isInitial }) => {
            if (isInitial) setLoading(true);
            try {
                await fetchPlans();
            } finally {
                if (isInitial) setLoading(false);
            }
        },
        { ttlMs: 60_000 }
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }, [refresh]);

    const handlePlanPress = (plan) => {
        setSelectedPlan(plan);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setSelectedPlan(null);
    };

    const handleFeedbackSubmitted = (planId, feedback) => {
        setPlans((prev) =>
            prev.map((p) =>
                p._id === planId
                    ? { ...p, hasFeedback: true, feedback }
                    : p
            )
        );
        setSelectedPlan((prev) =>
            prev && prev._id === planId
                ? { ...prev, hasFeedback: true, feedback }
                : prev
        );
    };

    const handleDeleteSinglePlan = (planId, planName) => {
        setAlertInfo({
            visible: true,
            title: 'Eliminar plan',
            message: `¿Eliminar el plan "${planName}"?`,
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: closeAlert },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        closeAlert();
                        try {
                            await apiClient.delete(`/plans/${planId}`);
                            setPlans((prev) => prev.filter((p) => p._id !== planId));
                            setTimeout(() => {
                                setAlertInfo({
                                    visible: true,
                                    title: 'Listo',
                                    message: 'Plan eliminado correctamente.',
                                    buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
                                });
                            }, 250);
                        } catch (error) {
                            setTimeout(() => {
                                setAlertInfo({
                                    visible: true,
                                    title: 'Error',
                                    message: 'No se pudo eliminar el plan.',
                                    buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
                                });
                            }, 250);
                        }
                    },
                },
            ],
        });
    };

    const handleDeleteAllPlans = () => {
        if (plans.length === 0) return;

        setAlertInfo({
            visible: true,
            title: 'Eliminar todos',
            message: '¿Eliminar TODOS tus planes de entrenamiento? Esta acción no se puede deshacer.',
            buttons: [
                { text: 'Cancelar', style: 'cancel', onPress: closeAlert },
                {
                    text: 'Eliminar todo',
                    style: 'destructive',
                    onPress: async () => {
                        closeAlert();
                        try {
                            await apiClient.delete('/plans/my-plans/all');
                            setPlans([]);
                            setTimeout(() => {
                                setAlertInfo({
                                    visible: true,
                                    title: 'Listo',
                                    message: 'Todos tus planes fueron eliminados.',
                                    buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
                                });
                            }, 250);
                        } catch (error) {
                            setTimeout(() => {
                                setAlertInfo({
                                    visible: true,
                                    title: 'Error',
                                    message: 'No se pudieron eliminar los planes.',
                                    buttons: [{ text: 'OK', style: 'primary', onPress: closeAlert }],
                                });
                            }, 250);
                        }
                    },
                },
            ],
        });
    };

    if (loading) {
        return (
            <ThemedView style={styles.centeredFull}>
                <ActivityIndicator size="large" color={accent} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <View style={[styles.headerBanner, { backgroundColor: accent }]}>
                <Text style={styles.headerKicker}>Entrenamiento</Text>
                <Text style={styles.headerTitle}>Mis planes</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />
                }
            >
                {plans.length > 0 ? (
                    <>
                        <View style={styles.listHeaderRow}>
                            <Text style={styles.listCount}>
                                {plans.length} {plans.length === 1 ? 'plan' : 'planes'}
                            </Text>
                            <TouchableOpacity
                                style={styles.deleteAllChip}
                                onPress={handleDeleteAllPlans}
                            >
                                <Octicons name="trash" size={14} color="#e74c3c" />
                                <Text style={styles.deleteAllText}>Eliminar todos</Text>
                            </TouchableOpacity>
                        </View>

                        {plans.map((plan) => (
                            <TouchableOpacity
                                key={plan._id}
                                style={styles.planCard}
                                onPress={() => handlePlanPress(plan)}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.accentBar, { backgroundColor: accent }]} />
                                <View style={styles.planCardBody}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.planName} numberOfLines={2}>{plan.name}</Text>
                                        {!!plan.description && (
                                            <Text style={styles.planDesc} numberOfLines={2}>
                                                {plan.description}
                                            </Text>
                                        )}
                                        <View style={styles.planMetaRow}>
                                            {!!getCreatorFullName(plan.createdBy) && (
                                                <>
                                                    <Ionicons name="person-outline" size={12} color={Colors[colorScheme].icon} />
                                                    <Text style={styles.planDate} numberOfLines={1}>
                                                        {getCreatorFullName(plan.createdBy)}
                                                    </Text>
                                                </>
                                            )}
                                            <Ionicons name="calendar-outline" size={12} color={Colors[colorScheme].icon} />
                                            <Text style={styles.planDate}>
                                                {plan.createdAt
                                                    ? format(new Date(plan.createdAt), 'dd/MM/yyyy')
                                                    : 'Sin fecha'}
                                            </Text>
                                            {!!plan.hasFeedback && (
                                                <View style={styles.donePill}>
                                                    <Text style={styles.donePillText}>Hecho</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteSinglePlan(plan._id, plan.name)}
                                        style={styles.deleteBtn}
                                        hitSlop={8}
                                    >
                                        <Octicons name="trash" size={18} color={Colors[colorScheme].text} />
                                    </TouchableOpacity>
                                    <Ionicons name="chevron-forward" size={18} color={Colors[colorScheme].icon} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </>
                ) : (
                    <View style={styles.emptyWrap}>
                        <View style={[styles.emptyIconWrap, { backgroundColor: accent + '18' }]}>
                            <Ionicons name="clipboard-outline" size={32} color={accent} />
                        </View>
                        <Text style={styles.emptyTitle}>Sin planes asignados</Text>
                        <Text style={styles.emptyHint}>
                            Cuando tu profesor te asigne un plan de entrenamiento, aparecerá acá.
                        </Text>
                    </View>
                )}
            </ScrollView>

            <PlanDetailModal
                visible={isModalVisible}
                plan={selectedPlan}
                onClose={handleCloseModal}
                gymColor={accent}
                colorScheme={colorScheme}
                onFeedbackSubmitted={handleFeedbackSubmitted}
            />

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={closeAlert}
                gymColor={accent}
            />
        </ThemedView>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f7f8fa';

    return StyleSheet.create({
        container: { flex: 1 },
        centeredFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        headerBanner: {
            paddingTop: 18,
            paddingBottom: 20,
            paddingHorizontal: 20,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
        },
        headerKicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 2,
        },
        headerTitle: {
            color: '#fff',
            fontSize: 22,
            fontWeight: '800',
        },
        contentContainer: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 40,
        },
        listHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        listCount: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.icon,
        },
        deleteAllChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 10,
        },
        deleteAllText: {
            fontSize: 13,
            fontWeight: '800',
            color: '#e74c3c',
        },
        planCard: {
            flexDirection: 'row',
            backgroundColor: soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
        planName: {
            fontSize: 16,
            fontWeight: '800',
            color: colors.text,
        },
        planDesc: {
            marginTop: 3,
            fontSize: 13,
            color: colors.text,
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
        planDate: {
            fontSize: 12,
            color: colors.icon,
            fontWeight: '500',
        },
        donePill: {
            marginLeft: 4,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: accent + '22',
        },
        donePillText: {
            fontSize: 11,
            fontWeight: '800',
            color: accent,
        },
        deleteBtn: {
            padding: 8,
        },
        emptyWrap: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 64,
            paddingHorizontal: 28,
        },
        emptyIconWrap: {
            width: 72,
            height: 72,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 6,
        },
        emptyHint: {
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
            color: colors.text,
            opacity: 0.65,
        },
        detailRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
        detailSheet: {
            width: '100%',
            height: '90%',
            maxHeight: '90%',
            overflow: 'hidden',
        },
        detailHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16,
        },
        detailKicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 2,
        },
        detailHeaderTitle: {
            color: '#fff',
            fontSize: 18,
            fontWeight: '800',
        },
        detailCloseBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        detailScroll: {
            padding: 16,
            paddingBottom: 24,
        },
        detailDescCard: {
            backgroundColor: soft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 12,
        },
        detailDesc: {
            fontSize: 14,
            lineHeight: 20,
            color: colors.text,
            opacity: 0.85,
        },
        detailMetaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 14,
            flexWrap: 'wrap',
        },
        detailMetaText: {
            fontSize: 12,
            color: colors.icon,
            fontWeight: '600',
        },
        contentCard: {
            backgroundColor: soft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            overflow: 'hidden',
        },
        detailFooter: {
            paddingHorizontal: 16,
            paddingBottom: 20,
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        finishBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 14,
            paddingVertical: 14,
        },
        finishBtnText: {
            color: '#fff',
            fontSize: 15,
            fontWeight: '800',
        },
        feedbackScroll: {
            padding: 20,
            paddingBottom: 40,
        },
        feedbackTitle: {
            fontSize: 20,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 6,
        },
        feedbackHint: {
            fontSize: 14,
            lineHeight: 20,
            color: colors.text,
            opacity: 0.65,
            marginBottom: 20,
        },
        feedbackLabel: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.icon,
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
        },
        feedbackInput: {
            minHeight: 120,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            fontSize: 15,
            color: colors.text,
            backgroundColor: soft,
        },
        feedbackActions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 20,
        },
        feedbackCancel: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
        },
        feedbackCancelText: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        feedbackSubmit: {
            flex: 1.2,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 14,
            minHeight: 50,
        },
        feedbackSubmitText: {
            color: '#fff',
            fontSize: 15,
            fontWeight: '800',
        },
    });
};

export default MyPlanScreen;
