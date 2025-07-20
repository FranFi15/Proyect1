import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons'; // Se importa Ionicons

const ImportantNotificationModal = ({ visible, notification, onClose }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);

    if (!visible || !notification) {
        return null;
    }

    return (
        <Modal
            animationType="slide" // Animación más suave
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <ThemedView style={styles.modalView}>
                    {/* Ícono de alerta añadido */}
                    <Ionicons 
                        name="alert-circle-outline" 
                        size={50} 
                        color={'#f9a825'} // Un color amarillo para la advertencia
                        style={styles.modalIcon} 
                    />
                    
                    {/* Título dinámico */}
                    <ThemedText style={styles.modalTitle}>
                        {notification.title || '¡Noticia Importante!'}
                    </ThemedText>
                    
                    <ThemedText style={styles.modalMessage}>
                        {notification.message}
                    </ThemedText>
                    
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
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
        backgroundColor: 'rgba(0,0,0,0.8)', // Fondo más oscuro para mayor enfoque
    },
    modalView: {
        margin: 20,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 2, // Bordes más redondeados
        padding: 25,
        paddingTop: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        width: '85%',
        maxWidth: 400,
    },
    modalIcon: {
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 30, // Título más grande
        fontWeight: 'bold',
        marginBottom: 15,
        color: Colors[colorScheme].text,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 16,
        marginBottom: 30, // Más espacio antes del botón
        color: Colors[colorScheme].text,
        textAlign: 'center',
        lineHeight: 24,
    },
    closeButton: {
        backgroundColor: '#1a5276',
        borderRadius: 2, // Botón con forma de píldora
        paddingVertical: 14,
        paddingHorizontal: 30,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    closeButtonText: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16,
    },
});

export default ImportantNotificationModal;
