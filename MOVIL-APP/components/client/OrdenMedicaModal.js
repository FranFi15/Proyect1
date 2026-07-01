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

const OrdenMedicaModal = ({ onClose, profile, onUpdate }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const { gymColor } = useAuth();
    const styles = getStyles(colorScheme, gymColor);

    const [image, setImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '' });

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlertInfo({ visible: true, title: 'Permiso denegado', message: 'Necesitamos acceso a tu galería para adjuntar el estudio médico.' });
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.6,
        });

        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    const handleSubmit = async () => {
        if (!image) {
            return setAlertInfo({ visible: true, title: 'Atención', message: 'Por favor selecciona una foto o archivo de tu estudio médico.' });
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            let filename = image.fileName || 'orden_medica.jpg';

            if (Platform.OS === 'web') {
                const response = await fetch(image.uri);
                const blob = await response.blob();
                formData.append('ordenMedica', blob, filename);
            } else {
                const localUri = image.uri;
                if (!filename.includes('.')) filename = 'orden_medica.jpg';

                let mimeType = image.mimeType;
                if (!mimeType) {
                    const match = /\.(\w+)$/.exec(filename);
                    mimeType = match ? `image/${match[1]}` : `image/jpeg`;
                }
                if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

                formData.append('ordenMedica', {
                    uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
                    name: filename,
                    type: mimeType
                });
            }

            await apiClient.post('/users/upload-orden-medica', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setAlertInfo({
                visible: true,
                title: '¡Éxito!',
                message: 'Tu orden médica se cargó correctamente.',
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
            console.error('Error uploading orden medica:', error);
            setAlertInfo({
                visible: true,
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo subir la orden médica. Intenta nuevamente.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ ...alertInfo, visible: false }) }]
            });
        } finally {
            setSubmitting(false);
        }
    };

    const currentUrl = image?.uri || profile?.ordenMedicaUrl;

    return (
        <View style={styles.modalOverlay}>
            <ThemedView style={[styles.modalView, { padding: 0, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerBannerTitle}>Orden Médica</Text>
                        <Text style={styles.headerBannerSub}>Certificado o apto médico</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButtonBanner}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <ThemedText style={styles.description}>
                        Adjunta aquí la foto del certificado o apto médico emitido por tu profesional de salud.
                    </ThemedText>

                    {currentUrl ? (
                        <View style={styles.imageContainer}>
                            <Image source={{ uri: currentUrl }} style={styles.previewImage} resizeMode="contain" />
                            <TouchableOpacity style={styles.changeImageBtn} onPress={handlePickImage}>
                                <Ionicons name="camera" size={18} color="#fff" />
                                <Text style={styles.changeImageBtnText}>Cambiar Imagen</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickImage}>
                            <Ionicons name="cloud-upload-outline" size={48} color={gymColor || '#007bff'} />
                            <ThemedText style={styles.uploadText}>Toca para elegir de la galería</ThemedText>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.submitBtn, (!image || submitting) && styles.disabledBtn]}
                        onPress={handleSubmit}
                        disabled={!image || submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitBtnText}>Subir Orden Médica</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </ThemedView>

            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={[{ text: 'OK', onPress: () => setAlertInfo({ ...alertInfo, visible: false }) }]}
                gymColor={gymColor}
            />
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalView: {
        height: '85%',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colorScheme === 'dark' ? '#333' : '#eee',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        alignItems: 'center',
        paddingBottom: 30,
        padding: 20,
    },
    description: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        opacity: 0.8,
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
        backgroundColor: colorScheme === 'dark' ? '#1e1e1e' : '#f8f9fa',
        marginBottom: 20,
    },
    uploadText: {
        marginTop: 10,
        fontWeight: '500',
    },
    imageContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 20,
    },
    previewImage: {
        width: '100%',
        height: 220,
        borderRadius: 8,
        backgroundColor: '#eee',
        marginBottom: 10,
    },
    changeImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6c757d',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
    },
    changeImageBtnText: {
        color: '#fff',
        fontWeight: '600',
        marginLeft: 6,
    },
    submitBtn: {
        width: '100%',
        backgroundColor: gymColor || '#007bff',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 5,
    },
    disabledBtn: {
        opacity: 0.5,
    },
    submitBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    headerBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    headerBannerTitle: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerBannerSub: {
        fontSize: 13,
        color: '#fff',
        opacity: 0.85,
        marginTop: 2,
    },
    closeButtonBanner: {
        padding: 4,
    }
});

export default OrdenMedicaModal;
