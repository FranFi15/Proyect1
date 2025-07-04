// MOVIL-APP/app/_layout.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext'; // Ensure useAuth is imported
import * as SplashScreen from 'expo-splash-screen';

// Imports for push notifications
import * as Notifications from 'expo-notifications'; // Import expo-notifications
import * as Device from 'expo-device'; // Import expo-device for device type check
import Constants from 'expo-constants'; // For getting device year class etc.
import { Platform, Alert } from 'react-native'; // Import Platform and Alert for push notif logic

// Import necessary components and services for the modal
import notificationService from '../services/notificationService'; // Ensure this service is created
import ImportantNotificationModal from '../components/ImportantNotificationModal'; // Ensure this component is created

import { useColorScheme } from '@/hooks/useColorScheme'; 

// Prevent the native splash screen from auto-hiding immediately.
SplashScreen.preventAutoHideAsync();

// Configure Expo Notifications handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Helper function to find the most recent unread important notification
const findMostRecentImportantUnread = (notifications) => {
  if (!notifications || notifications.length === 0) return null;
  const unreadImportant = notifications.filter(n => !n.read && n.isImportant);
  if (unreadImportant.length === 0) return null;
  // Sort by createdAt descending to get the most recent
  return unreadImportant.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
};

// Function to register for push notifications and send token to backend
async function registerForPushNotificationsAsync(userId, updatePushTokenBackend) {
  let token;

  if (Platform.OS === 'android') {
    // Set notification channel for Android (required for Android 8.0+)
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Check if device is a physical device
  if (Device.isDevice) {
    // Ask for notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permiso de Notificaciones', 'No se concedió permiso para recibir notificaciones push.');
      return;
    }

    // Get the Expo push token
    try {
      // Use your EAS project ID here, found in app.json under "extra.eas.projectId"
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig.extra.eas.projectId, 
      })).data;
      console.log('Expo Push Token:', token);
    } catch (e) {
      console.error('Error getting Expo Push Token:', e);
      return;
    }

    // Send the token to your backend
    if (token && userId) {
      try {
        await updatePushTokenBackend(token); // Function to send token to backend
        console.log('Push token sent to backend successfully.');
      } catch (error) {
        console.error('Failed to send push token to backend:', error);
      }
    }
  } else {
    // Alert for non-device platforms (web, desktop, generic emulators)
    Alert.alert('Notificaciones Push', 'Debes usar un dispositivo físico o emulador/simulador para recibir notificaciones push.');
  }

  return token;
}


export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <AppContent colorScheme={colorScheme} />
    </AuthProvider>
  );
}

function AppContent({ colorScheme }) {
  const { user, clientId, loading, refreshUser } = useAuth();
  const segments = useSegments(); // Used for navigation logic
  const router = useRouter(); // Used for navigation logic

  const [modalVisible, setModalVisible] = useState(false);
  const [currentImportantNotification, setCurrentImportantNotification] = useState(null);

  // Refs for notification listeners to clean up
  const notificationListener = useRef();
  const responseListener = useRef();

  // Function to send push token to backend (passed down to registerForPushNotificationsAsync)
  const updatePushTokenBackend = useCallback(async (token) => {
    // This calls your GYM-APP backend API to save the push token for the current user
    try {
      await notificationService.updateUserPushToken(token); // This method needs to be implemented in notificationService
    } catch (error) {
      console.error("Error sending push token to backend:", error);
      // Handle error, maybe retry or inform user
    }
  }, []);

  const handleModalClose = useCallback(async () => {
    if (currentImportantNotification) {
      try {
        await notificationService.markNotificationAsRead(currentImportantNotification._id);
        refreshUser(); 
      } catch (error) {
        console.error("Error marking important notification as read:", error);
      }
    }
    setModalVisible(false);
    setCurrentImportantNotification(null);
  }, [currentImportantNotification, refreshUser]);

  // Effect for handling initial navigation based on auth state
  // This is your core authentication and routing logic
  useEffect(() => {
    if (loading) {
        return;
    }

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';

    if (!user) { // If no user (not logged in)
        if (!clientId) { // And no client ID found (first time or reset)
            router.replace('/(auth)/gymIdentifier'); // Go to gym identifier
        } else if (!inAuthGroup) { // Client ID found, but no user, and not in auth screens
            router.replace('/(auth)/login'); // Go to login
        }
    } else { // User is logged in
        if (inAuthGroup) { // If user is logged in but still on an auth screen
            router.replace('/(tabs)'); // Go to main app tabs
        }
        // If user is logged in and not in auth group, they are already in the app, no redirect needed here.
    }

  }, [loading, user, clientId, segments, router]); 


  // Effect for push notification registration and listeners
  useEffect(() => {
    if (user && !loading) {
        // Register for push notifications once user is loaded
        registerForPushNotificationsAsync(user._id, updatePushTokenBackend);
    }

    // Set up notification listeners
    // Listener for notifications received while app is in foreground or background
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received (foreground/background):', notification);
      const { title, body, data } = notification.request.content;
      // If the notification is marked important and not yet read, show modal
      if (data && data.isImportant && !data.read) { 
        setCurrentImportantNotification({ _id: data.notificationId, title: title, message: body, isImportant: data.isImportant, read: false });
        setModalVisible(true);
      } else {
        // Handle non-important notifications (e.g., just let it show in notification tray/list)
      }
    });

    // Listener for when user taps on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received (tapped):', response);
      const { notificationId, type, isImportant, classId } = response.notification.request.content.data;
      
      // Mark as read if it was important and tapped, then dismiss modal
      if (isImportant && notificationId) {
        handleModalClose(); // This will also mark it as read via service call
      }

      // Example deep linking: navigate based on notification type
      if (type === 'class_update' && classId) {
        // Example: router.push(`/my-classes/${classId}`); // Adjust path as per your app structure
        console.log(`Navigating to class: ${classId}`);
      }
      // You might add logic for other types like 'credit_update', etc.
    });

    // Cleanup listeners on unmount or when dependencies change
    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [user, loading, updatePushTokenBackend, handleModalClose]); // Added handleModalClose to dependencies

  // Effect for checking and displaying important notifications (polling)
  // This polling runs independently for in-app modal, but can be influenced by push.
  useEffect(() => {
    let intervalId;
    if (user && !loading) {
      const checkImportantNotificationsPolling = async () => { 
        try {
          const notifications = await notificationService.getNotifications();
          const mostRecentImportantUnread = findMostRecentImportantUnread(notifications);
          if (mostRecentImportantUnread) {
            setCurrentImportantNotification(mostRecentImportantUnread);
            setModalVisible(true);
          }
        } catch (error) {
          console.error("Error checking for important notifications (polling):", error);
        }
      };

      checkImportantNotificationsPolling();
      intervalId = setInterval(checkImportantNotificationsPolling, 5 * 60 * 1000); // Poll every 5 minutes
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, loading, refreshUser]); // Dependencies for polling

  

  return (
    <>
      <Slot />
      {/* Important Notification Modal, rendered globally */}
      <ImportantNotificationModal
        visible={modalVisible}
        notification={currentImportantNotification}
        onClose={handleModalClose}
      />
    </>
  );
}