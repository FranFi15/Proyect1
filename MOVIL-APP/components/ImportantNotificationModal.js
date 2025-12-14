import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Image} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons'; 
import { useAuth } from '../contexts/AuthContext';

const ImportantNotificationModal = ({ visible, notification, onClose }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme);
    const { gymLogo, gymColor } = useAuth();
    

    if (!visible || !notification) {
        return null;
    }

    return (
        <Modal
            animationType="fade" 
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <ThemedView style={styles.modalView}>
                   {gymLogo ? (
                        <View style={styles.logoContainer}>
                            <Image 
                                source={{ uri: gymLogo }} 
                                style={styles.gymLogo} 
                                resizeMode="contain" 
                            />
                        </View>
                    ) : (
                        // Fallback si no hay logo: Ícono genérico
                        <Ionicons 
                            name="notifications" 
                            size={50} 
                            color={gymColor || '#f9a825'} 
                            style={styles.modalIcon} 
                        />
                    )}
                    
                    <ThemedText style={styles.modalTitle}>
                        {notification.title || '¡Aviso Importante!'}
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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)', 
    },
    modalView: {
        margin: 20,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 5, 
        borderColor:  gymColor,
        paddingHorizontal: 25,
        paddingBottom: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        width: '90%',
    },
    logoContainer: {
        width: 150,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 5,
        overflow: 'hidden',
        elevation: 2,
    },
    gymLogo: {
        width: '100%',
        height: '100%',
    },
    modalIcon: {
        marginBottom: 15,
    },
    modalTitle: {
        marginTop: 1,
        fontSize: 20, 
        fontWeight: 'bold',
        marginBottom: 15,
        color: Colors[colorScheme].text,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        marginBottom: 30, 
        color: Colors[colorScheme].text,
        textAlign: 'center',
        lineHeight: 24,
    },
    closeButton: {
        backgroundColor:  gymColor || '#1a5276',
        borderRadius: 5, 
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
