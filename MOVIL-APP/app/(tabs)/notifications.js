// MOVIL-APP/app/(tabs)/notifications.js
import React, { useState, useEffect, useCallback } from 'react';
import { SectionList, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import notificationService from '../../services/notificationService'; // Ensure this service is created and correct
import { useAuth } from '../../contexts/AuthContext'; // To get userInfo and potentially refresh it
import { Colors } from '@/constants/Colors'; // For dynamic styles
import { useFocusEffect } from 'expo-router'; // To refetch when screen is focused

// --- MOVE groupNotificationsByDate OUTSIDE THE COMPONENT ---
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
    if (notifDate.getTime() === today.getTime()) {
      sectionTitle = 'Hoy';
    } else if (notifDate.getTime() === yesterday.getTime()) {
      sectionTitle = 'Ayer';
    } else {
      sectionTitle = notifDate.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    if (!sectionsMap.has(sectionTitle)) {
      sectionsMap.set(sectionTitle, []);
    }
    sectionsMap.get(sectionTitle).push(notif);
  });

  return Array.from(sectionsMap, ([title, data]) => ({ title, data }));
};
// --- END MOVE ---

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, refreshUser } = useAuth(); // Use user from AuthContext

  const colorScheme = 'light'; // You can use useColorScheme() here for dynamic theme
  const styles = getStyles(colorScheme); // Dynamic styles

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetchedNotifications = await notificationService.getNotifications();
      const grouped = groupNotificationsByDate(fetchedNotifications); // Now accessible
      setNotifications(grouped);
      refreshUser(); 
    } catch (err) {
      setError(err.message || 'Error al cargar notificaciones.');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, refreshUser]);

  // Use useFocusEffect to refetch data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      return () => {
        // Optional cleanup when screen blurs
      };
    }, [fetchNotifications])
  );

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      setNotifications(prevSections => 
        prevSections.map(section => ({
          ...section,
          data: section.data.map(notif =>
            notif._id === notificationId ? { ...notif, read: true } : notif
          ),
        }))
      );
      refreshUser(); 
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo marcar como leída.');
    }
  };

  const handleMarkAllAsRead = async () => {
    Alert.alert(
      "Marcar todas como leídas",
      "¿Estás seguro de que quieres marcar todas las notificaciones como leídas?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            try {
              await notificationService.markAllNotificationsAsRead();
              setNotifications(prevSections =>
                prevSections.map(section => ({
                  ...section,
                  data: section.data.map(notif => ({ ...notif, read: true })),
                }))
              );
              refreshUser(); 
              Alert.alert("Éxito", "Todas las notificaciones han sido marcadas como leídas.");
            } catch (err) {
              Alert.alert('Error', err.message || 'No se pudieron marcar todas como leídas.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <ThemedText style={styles.loadingText}>Cargando notificaciones...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
            <ThemedText style={styles.retryButtonText}>Reintentar</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.notificationItem, !item.read && styles.unreadNotification]}
      onPress={() => handleMarkAsRead(item._id)}
    >
      {/* Display Title and Message */}
      <ThemedText style={styles.notificationTitle}>{item.title}</ThemedText> 
      <ThemedText style={styles.notificationMessage}>{item.message}</ThemedText>
      <ThemedText style={styles.notificationTime}>
        {new Date(item.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </ThemedText>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <ThemedText style={styles.sectionHeader}>{title}</ThemedText>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Notificaciones</ThemedText>
      <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllReadButton}>
        <ThemedText style={styles.markAllReadButtonText}>Marcar todas como leídas</ThemedText>
      </TouchableOpacity>
      {notifications.length === 0 ? (
        <ThemedText style={styles.noNotificationsText}>No tienes notificaciones.</ThemedText>
      ) : (
        <SectionList
          sections={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContentContainer}
        />
      )}
    </ThemedView>
  );
};

const getStyles = (colorScheme) => StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: Colors[colorScheme].background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: Colors[colorScheme].text },
  loadingText: { marginTop: 10, color: Colors[colorScheme].text },
  errorText: { color: Colors.light.error, textAlign: 'center', marginBottom: 20 },
  retryButton: {
    backgroundColor: Colors[colorScheme].tint,
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  markAllReadButton: {
    alignSelf: 'flex-end',
    marginBottom: 15,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: Colors[colorScheme].buttonBackground,
    borderRadius: 5,
  },
  markAllReadButtonText: {
    color: Colors[colorScheme].buttonText,
    fontSize: 14,
    fontWeight: 'bold',
  },
  noNotificationsText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: Colors[colorScheme].text,
    opacity: 0.7,
  },
  listContentContainer: { paddingBottom: 20 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: Colors[colorScheme].background,
    paddingVertical: 10,
    paddingHorizontal: 5,
    color: Colors[colorScheme].text,
  },
  notificationItem: {
    backgroundColor: Colors[colorScheme].cardBackground,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'column', // Changed to column for title/message stack
    alignItems: 'flex-start', // Align content to the left
    borderWidth: 1,
    borderColor: Colors[colorScheme].border,
  },
  unreadNotification: {
    backgroundColor: Colors[colorScheme].unreadBackground, // A lighter tint for unread
    borderColor: Colors[colorScheme].unreadBorder, // A more prominent border for unread
  },
  notificationTitle: { // Style for the new title
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5, // Space between title and message
    color: Colors[colorScheme].text,
  },
  notificationMessage: { 
    fontSize: 16, 
    color: Colors[colorScheme].text,
    width: '100%', // Take full width below title
  },
  notificationTime: { 
    fontSize: 12, 
    color: Colors[colorScheme].text, 
    opacity: 0.6, 
    marginTop: 10, // Space above time
    alignSelf: 'flex-end', // Align time to the right
  },
});

export default NotificationsScreen;