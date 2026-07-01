import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme, Linking, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const OrdenMedicaAdminModal = ({ visible, onClose, client, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    if (!client) return null;

    const imageUrl = client.ordenMedicaUrl;

    const handleOpenInBrowser = () => {
        if (imageUrl) {
            Linking.openURL(imageUrl);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalView}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>

                    <ThemedText style={styles.modalTitle}>Orden Médica</ThemedText>
                    <ThemedText style={styles.clientName}>{client.nombre} {client.apellido}</ThemedText>

                    {imageUrl ? (
                        <View style={styles.contentContainer}>
                            <Image 
                                source={{ uri: imageUrl }} 
                                style={styles.image} 
                                resizeMode="contain" 
                            />
                            <TouchableOpacity style={styles.linkButton} onPress={handleOpenInBrowser}>
                                <Ionicons name="open-outline" size={18} color="#fff" />
                                <Text style={styles.linkButtonText}>Abrir imagen completa</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={60} color="#dc3545" />
                            <ThemedText style={styles.emptyText}>
                                Este socio aún no ha cargado una imagen de su orden médica.
                            </ThemedText>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 20,
    },
    modalView: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    clientName: {
        fontSize: 16,
        opacity: 0.7,
        marginBottom: 15,
    },
    contentContainer: {
        width: '100%',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: 300,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        marginBottom: 15,
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: gymColor || '#007bff',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    linkButtonText: {
        color: '#fff',
        fontWeight: '600',
        marginLeft: 8,
    },
    emptyContainer: {
        padding: 30,
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 15,
        fontSize: 15,
        color: '#dc3545',
    },
});

export default OrdenMedicaAdminModal;
