import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const ImportantNotificationModal = ({ visible, notification, onClose }) => {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme);

  if (!visible || !notification) {
    return null; // Don't render if not visible or no notification
  }

  return (
    <Modal
      animationType="fade" // Smooth fade effect
      transparent={true} // Allows dimming background
      visible={visible}
      onRequestClose={onClose} // For handling Android's back button
    >
      <View style={styles.centeredView}>
        <ThemedView style={styles.modalView}>
          <ThemedText style={styles.modalTitle}>¡Noticia Importante!</ThemedText>
          <ThemedText style={styles.modalMessage}>{notification.message}</ThemedText>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose} // Call onClose when button is pressed
          >
            <ThemedText style={styles.closeButtonText}>Entendido</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
};

const getStyles = (colorScheme) => StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', // Dark semi-transparent background
  },
  modalView: {
    margin: 20,
    backgroundColor: Colors[colorScheme].background, // Dynamic background based on theme
    borderRadius: 10,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: Colors[colorScheme].text, // Dynamic text color
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 25,
    color: Colors[colorScheme].text, // Dynamic text color
    textAlign: 'center',
    lineHeight: 24,
  },
  closeButton: {
    backgroundColor: Colors[colorScheme].tint, // Dynamic tint color for button
    borderRadius: 8,
    padding: 12,
    elevation: 2,
    minWidth: 100,
  },
  closeButtonText: {
    color: 'white', // White text on the button
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default ImportantNotificationModal;