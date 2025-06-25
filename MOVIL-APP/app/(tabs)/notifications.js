// app/(tabs)/notifications.js
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import apiClient from '../../services/apiClient';
import { useFocusEffect } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const NotificationsScreen = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/notifications/me');
            setNotifications(response.data || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar las notificaciones.');
        } finally {
            setLoading(false);
        }
    };
    
    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [])
    );
    
    if (loading) {
        return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
    }

    return (
        <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
                <View style={[styles.notificationItem, !item.read && styles.unread]}>
                    <Text style={styles.message}>{item.message}</Text>
                    <Text style={styles.date}>
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}
                    </Text>
                </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No tienes notificaciones.</Text>}
        />
    );
};

const styles = StyleSheet.create({
    notificationItem: { padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
    unread: { backgroundColor: '#f0eaff' },
    message: { fontSize: 16 },
    date: { fontSize: 12, color: '#666', marginTop: 5 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16 }
});

export default NotificationsScreen;