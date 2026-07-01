import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../services/apiClient';
import CustomAlert from '@/components/CustomAlert';
import { useAuth } from '../../contexts/AuthContext';

const FotoPerfilModal = ({ onClose, profile, onUpdate }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);

    const [image, setImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '' });

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlertInfo({ visible: true, title: 'Permiso denegado', message: 'Necesitamos acceso a tu galería para cambiar tu foto de perfil.' });
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
        });

        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    const handleSubmit = async () => {
        if (!image) {
            return setAlertInfo({ visible: true, title: 'Atención', message: 'Por favor selecciona una foto de perfil.' });
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            let filename = image.uri.split('/').pop() || 'profile.jpg';

            if (Platform.OS === 'web') {
                const response = await fetch(image.uri);
                const blob = await response.blob();
                formData.append('fotoPerfil', blob, filename);
            } else {
                const localUri = image.uri;
                if (!filename.includes('.')) filename = 'profile.jpg';

                let mimeType = image.mimeType;
                if (!mimeType) {
                    const match = /\.(\w+)$/.exec(filename);
                    mimeType = match ? `image/${match[1]}` : `image/jpeg`;
                }
                if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

                formData.append('fotoPerfil', {
                    uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
                    name: filename,
                    type: mimeType
                });
            }

            await apiClient.post('/users/upload-foto-perfil', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setAlertInfo({
                visible: true,
                title: '¡Éxito!',
                message: 'Tu foto de perfil se actualizó correctamente.',
                buttons: [{
                    text: 'Genial',
                    style: 'primary',
                    onPress: () => {
                        setAlertInfo({ ...alertInfo, visible: false });
                        if (onUpdate) onUpdate();
                        onClose();
                    }
                }]
            });
        } catch (error) {
            console.error('Error uploading foto perfil:', error);
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo subir la foto de perfil. Intenta nuevamente.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ ...alertInfo, visible: false }) }]
            });
        } finally {
            setSubmitting(false);
        }
    };

    const currentUrl = image?.uri || profile?.fotoPerfil;

    return (
        <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalView}>
                <View style={styles.header}>
                    <ThemedText style={styles.modalTitle}>Foto de Perfil</ThemedText>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <ThemedText style={styles.description}>
                        Selecciona una foto para personalizar tu perfil y tu credencial.
                    </ThemedText>

                    {currentUrl ? (
                        <View style={styles.imageContainer}>
                            <Image source={{ uri: currentUrl }} style={styles.previewAvatar} resizeMode="cover" />
                            <TouchableOpacity style={styles.changeImageBtn} onPress={handlePickImage}>
                                <Ionicons name="camera" size={18} color="#fff" />
                                <Text style={styles.changeImageBtnText}>Elegir Otra Foto</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickImage}>
                            <Ionicons name="person-circle-outline" size={72} color={gymColor || '#007bff'} />
                            <ThemedText style={styles.uploadText}>Toca para elegir foto de perfil</ThemedText>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.submitBtn, (!image || submitting) && styles.disabledBtn, { backgroundColor: gymColor || '#007bff' }]}
                        onPress={handleSubmit}
                        disabled={!image || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="cloud-upload" size={20} color="#fff" />
                                <Text style={styles.submitBtnText}>Guardar Foto</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>

                <CustomAlert
                    visible={alertInfo.visible}
                    title={alertInfo.title}
                    message={alertInfo.message}
                    buttons={alertInfo.buttons}
                    onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                    gymColor={gymColor}
                />
            </ThemedView>
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalView: {
        width: '100%',
        maxHeight: '85%',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].cardBackground,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 20,
        alignItems: 'center',
    },
    description: {
        textAlign: 'center',
        marginBottom: 20,
        opacity: 0.8,
        fontSize: 14,
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    previewAvatar: {
        width: 140,
        height: 140,
        borderRadius: 70,
        marginBottom: 12,
        borderWidth: 3,
        borderColor: gymColor || '#007bff',
    },
    changeImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6c757d',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    changeImageBtnText: {
        color: '#fff',
        fontWeight: '600',
        marginLeft: 6,
        fontSize: 13,
    },
    uploadPlaceholder: {
        width: '100%',
        height: 180,
        borderWidth: 2,
        borderColor: gymColor || '#007bff',
        borderStyle: 'dashed',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        padding: 20,
    },
    uploadText: {
        marginTop: 10,
        fontWeight: '600',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 10,
    },
    disabledBtn: {
        opacity: 0.5,
    },
    submitBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
});

export default FotoPerfilModal;
