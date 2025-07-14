import React, { useState, useCallback } from 'react';
import { View, SectionList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, RefreshControl, useColorScheme } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import notificationService from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

const groupNotificationsByDate = (notifs) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sectionsMap = new Map();
    notifs.forEach(notif => {
        const notifDate = new Date(notif.createdAt);
        notifDate.setHours(0, 0, 0, 0);
        let sectionTitle;
        if (notifDate.getTime() === today.getTime()) sectionTitle = 'Hoy';
        else if (notifDate.getTime() === yesterday.getTime()) sectionTitle = 'Ayer';
        else sectionTitle = notifDate.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!sectionsMap.has(sectionTitle)) sectionsMap.set(sectionTitle, []);
        sectionsMap.get(sectionTitle).push(notif);
    });
    return Array.from(sectionsMap, ([title, data]) => ({ title, data }));
};

const getIconForNotification = (type) => {
    switch (type) {
        case 'spot_available': return { name: 'calendar-check', color: '#2ecc71' };
        case 'waitlist_subscription': return { name: 'bell', color: '#3498db' };
        case 'class_cancellation_refund': return { name: 'calendar-times', color: '#e74c3c' };
        case 'monthly_payment_reminder': return { name: 'credit-card', color: '#f39c12' };
        default: return { name: 'info-circle', color: '#95a5a6' };
    }
};

const NotificationsScreen = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);

    const fetchNotifications = useCallback(async () => {
        if (!user) {
            setError("Usuario no autenticado.");
            setLoading(false);
            return;
        }
        if (!isRefreshing) setLoading(true);
        setError(null);
        try {
            const fetchedNotifications = await notificationService.getNotifications();
            const grouped = groupNotificationsByDate(fetchedNotifications);
            setNotifications(grouped);
        } catch (err) {
            setError(err.message || 'Error al cargar notificaciones.');
        } finally {
            if (!isRefreshing) setLoading(false);
        }
    }, [user, isRefreshing]);

    useFocusEffect(useCallback(() => { fetchNotifications(); }, []));
    
    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchNotifications().finally(() => setIsRefreshing(false));
    }, [fetchNotifications]);

    const handleNotificationPress = async (notification) => {
        if (!notification.read) {
            try {
                await notificationService.markNotificationAsRead(notification._id);
                setNotifications(prev => prev.map(s => ({ ...s, data: s.data.map(n => n._id === notification._id ? { ...n, read: true } : n) })));
                refreshUser();
            } catch (err) { console.error('No se pudo marcar como leída:', err); }
        }
        if (notification.class) router.push('/(tabs)/calendar');
    };

    const handleDeleteNotification = (notificationId) => {
        Alert.alert("Eliminar Notificación", "¿Estás seguro?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Eliminar", style: 'destructive',
                onPress: async () => {
                    try {
                        await notificationService.deleteNotification(notificationId);
                        setNotifications(prev => prev.map(s => ({ ...s, data: s.data.filter(n => n._id !== notificationId) })).filter(s => s.data.length > 0));
                    } catch (err) { Alert.alert('Error', err.message || 'No se pudo eliminar.'); }
                },
            },
        ]);
    };

    const handleDeleteAll = () => {
        Alert.alert("Eliminar Todas", "¿Seguro que quieres eliminar TODAS tus notificaciones?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Confirmar", style: 'destructive',
                onPress: async () => {
                    try {
                        await notificationService.deleteAllNotifications();
                        setNotifications([]);
                    } catch (err) { Alert.alert('Error', err.message || 'No se pudieron eliminar.'); }
                },
            },
        ]);
    };

    if (loading) return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={Colors[colorScheme].tint} /></ThemedView>;
    if (error) return <ThemedView style={styles.centered}><ThemedText style={styles.errorText}>{error}</ThemedText></ThemedView>;

    const renderItem = ({ item }) => {
        const iconInfo = getIconForNotification(item.type);
        return (
            <TouchableOpacity style={[styles.notificationItem, !item.read && styles.unreadNotification]} onPress={() => handleNotificationPress(item)} activeOpacity={0.7}>
                <FontAwesome5 name={iconInfo.name} size={24} color={iconInfo.color} style={styles.icon} />
                <View style={styles.notificationContent}>
                    <ThemedText style={styles.notificationTitle}>{item.title}</ThemedText>
                    <ThemedText style={styles.notificationMessage}>{item.message}</ThemedText>
                    <ThemedText style={styles.notificationTime}>{new Date(item.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</ThemedText>
                </View>
                <TouchableOpacity onPress={() => handleDeleteNotification(item._id)} style={styles.deleteButton}>
                    <FontAwesome5 name="trash-alt" size={18} color={Colors[colorScheme].icon} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>Notificaciones</ThemedText>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteAllButton}>
                        <FontAwesome5 name="trash" size={16} color={Colors.light.error} />
                        <ThemedText style={styles.deleteAllButtonText}>Eliminar Todas</ThemedText>
                    </TouchableOpacity>
                )}
            </View>
            
            {notifications.length === 0 ? (
                <ThemedView style={styles.centered}><ThemedText style={styles.noNotificationsText}>No tienes notificaciones.</ThemedText></ThemedView>
            ) : (
                <SectionList
                    sections={notifications}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => <ThemedText style={styles.sectionHeader}>{title}</ThemedText>}
                    contentContainerStyle={styles.listContentContainer}
                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors[colorScheme].tint} />}
                />
            )}
        </ThemedView>
    );
};

const getStyles = (colorScheme) => {
    
    const shadowProp = {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    };

    return StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[colorScheme].background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 15, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: 'bold' },
    deleteAllButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.error },
    deleteAllButtonText: { color: Colors.light.error, fontSize: 13, fontWeight: '600', marginLeft: 8 },
    noNotificationsText: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.7 },
    listContentContainer: { paddingHorizontal: 15, paddingBottom: 20 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', backgroundColor: Colors[colorScheme].background, paddingTop: 20, paddingBottom: 10, color: Colors[colorScheme].text },
    notificationItem: { backgroundColor: Colors[colorScheme].cardBackground, padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', ...shadowProp },
    unreadNotification: { backgroundColor: Colors[colorScheme].unreadBackground },
    icon: { marginRight: 15 },
    notificationContent: { flex: 1 },
    notificationTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    notificationMessage: { fontSize: 14, opacity: 0.9 },
    notificationTime: { fontSize: 12, opacity: 0.6, marginTop: 8, alignSelf: 'flex-end' },
    deleteButton: { padding: 10, marginLeft: 10 },
    errorText: { color: Colors.light.error },
});}

export default NotificationsScreen;