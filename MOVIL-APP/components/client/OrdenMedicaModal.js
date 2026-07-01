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
                message: 'Tu estudio / orden médica se cargó correctamente.',
                buttons: [{
                    text: 'Genial',
                    style: 'primary',
                    onPress: () => {
                        setAlertInfo({ visible: false });
                        if (onUpdate) onUpdate();
                        onClose();
                    }
                }]
            });
        } catch (error) {
            setAlertInfo({
                visible: true,
                title: 'Error de carga',
                message: error.response?.data?.message || 'No pudimos subir tu archivo en este momento.'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const currentUrl = image?.uri || profile?.ordenMedicaUrl;

    return (
        <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalView}>
                <View style={styles.header}>
                    <ThemedText style={styles.modalTitle}>Estudio Clínico / Orden Médica</ThemedText>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 15,
    },
    modalView: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '85%',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    content: {
        alignItems: 'center',
        paddingBottom: 10,
    },
    description: {
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.8,
        marginBottom: 20,
    },
    uploadPlaceholder: {
        width: '100%',
        height: 180,
        borderWidth: 2,
        borderColor: gymColor || '#007bff',
        borderStyle: 'dashed',
        borderRadius: 10,
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
});

export default OrdenMedicaModal;
