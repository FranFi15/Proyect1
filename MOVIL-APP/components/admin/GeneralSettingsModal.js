import React, { useState, useEffect, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity, TextInput,
    useColorScheme, Switch, KeyboardAvoidingView, ScrollView, Platform, Pressable, StyleSheet, ActivityIndicator
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

const GeneralSettingsModal = ({ visible, onClose, gymColor, apiClient }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [classTypes, setClassTypes] = useState([]);
    const [visibilityDays, setVisibilityDays] = useState('0');
    const [courtesyConfig, setCourtesyConfig] = useState({ isActive: false, amount: '1', tipoClase: '' });
    const [bankDetails, setBankDetails] = useState({ cbu: '', alias: '', bankName: '' });

    const [internalAlert, setInternalAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

    const showAlert = (alertData) => {
        setInternalAlert({
            visible: true,
            title: alertData.title || '',
            message: alertData.message || '',
            buttons: alertData.buttons ? alertData.buttons.map(b => ({
                ...b,
                onPress: () => {
                    setInternalAlert(prev => ({ ...prev, visible: false }));
                    if (b.onPress) b.onPress();
                }
            })) : [{ text: 'OK', style: 'primary', onPress: () => setInternalAlert(prev => ({ ...prev, visible: false })) }]
        });
    };

    const fetchSettings = useCallback(async () => {
        if (!apiClient || !visible) return;
        setLoading(true);
        try {
            const [typesRes, settingsRes] = await Promise.all([
                apiClient.get('/tipos-clase'),
                apiClient.get('/settings')
            ]);
            
            setClassTypes(typesRes.data?.tiposClase || []);
            
            if (settingsRes.data) {
                setVisibilityDays((settingsRes.data.classVisibilityDays ?? 0).toString());

                if (settingsRes.data.bankDetails) {
                    setBankDetails({
                        cbu: settingsRes.data.bankDetails.cbu || '',
                        alias: settingsRes.data.bankDetails.alias || '',
                        bankName: settingsRes.data.bankDetails.bankName || ''
                    });
                }
                
                if (settingsRes.data.courtesyCredit) {
                    setCourtesyConfig({
                        isActive: !!settingsRes.data.courtesyCredit.isActive,
                        amount: (settingsRes.data.courtesyCredit.amount ?? 1).toString(),
                        tipoClase: settingsRes.data.courtesyCredit.tipoClase?._id || settingsRes.data.courtesyCredit.tipoClase || ''
                    });
                }
            }
        } catch (error) {
            console.error("Error cargando configuración:", error);
            showAlert({ title: 'Error', message: 'No se pudieron cargar las configuraciones generales.' });
        } finally {
            setLoading(false);
        }
    }, [apiClient, visible]);

    useEffect(() => {
        if (visible) {
            fetchSettings();
        }
    }, [visible, fetchSettings]);

    const handleSaveSettings = async () => {
        if (!apiClient) return;
        setSaving(true);
        try {
            const payload = { 
                classVisibilityDays: Number(visibilityDays) || 0,
                courtesyCredit: { 
                    isActive: courtesyConfig.isActive, 
                    amount: Number(courtesyConfig.amount) || 1, 
                    tipoClase: courtesyConfig.tipoClase 
                },
                bankDetails: bankDetails
            };
            await apiClient.put('/settings', payload);
            showAlert({ 
                title: 'Éxito', 
                message: 'Configuración general guardada correctamente.',
                buttons: [{ text: 'OK', style: 'primary', onPress: onClose }]
            });
        } catch (error) {
            console.error("Error guardando configuración:", error);
            showAlert({ title: 'Error', message: 'No se pudo guardar la configuración.' });
        } finally {
            setSaving(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlayWrapper}>
                <Pressable style={styles.modalBackdrop} onPress={onClose} />
                <View style={styles.modalContainer}>
                    <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerBannerTitle}>Configuración General</Text>
                            <Text style={styles.headerBannerSub}>Calendario, bienvenida y datos bancarios</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButtonBanner}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <CustomAlert
                        inline={true}
                        visible={internalAlert.visible}
                        title={internalAlert.title}
                        message={internalAlert.message}
                        buttons={internalAlert.buttons}
                        onClose={() => setInternalAlert(prev => ({ ...prev, visible: false }))}
                        gymColor={gymColor}
                    />

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={gymColor || Colors[colorScheme].tint} />
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.sectionTitle}>Calendario</Text>
                            <Text style={styles.cardDescription}>
                                Define cuántos días hacia el futuro podrán ver y reservar tus clientes.
                            </Text>
                            <Text style={styles.inputLabel}>Días visibles (0 = sin límite):</Text>
                            <TextInput style={styles.input} value={visibilityDays} onChangeText={setVisibilityDays} keyboardType="number-pad" placeholder="0" placeholderTextColor="#999"/>

                            <View style={{ paddingTop: 15, marginTop: 10 }}>
                                <Text style={styles.sectionTitle}>Crédito de Bienvenida</Text>
                                <View style={styles.switchContainer}>
                                    <Text style={styles.inputLabel}>¿Activar crédito de bienvenida?</Text>
                                    <Switch trackColor={{ true: gymColor }} onValueChange={(val) => setCourtesyConfig(prev => ({ ...prev, isActive: val }))} value={courtesyConfig.isActive} />
                                </View>

                                {courtesyConfig.isActive && (
                                    <>
                                        <Text style={styles.inputLabel}>¿Qué tipo de clase dar?</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                                            {classTypes.map(type => (
                                                <TouchableOpacity key={type._id} onPress={() => setCourtesyConfig(prev => ({ ...prev, tipoClase: type._id }))} style={[styles.dayChip, courtesyConfig.tipoClase === type._id && { backgroundColor: gymColor }]}>
                                                    <Text style={{ color: courtesyConfig.tipoClase === type._id ? '#fff' : Colors[colorScheme].text, fontWeight: '600' }}>{type.nombre}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>

                                        <Text style={styles.inputLabel}>Cantidad de créditos:</Text>
                                        <TextInput style={styles.input} value={courtesyConfig.amount} onChangeText={(text) => setCourtesyConfig(prev => ({ ...prev, amount: text }))} keyboardType="number-pad" placeholderTextColor="#999"/>
                                    </>
                                )}
                            </View>

                            <View style={{ paddingTop: 15, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors[colorScheme].border }}>
                                <Text style={styles.sectionTitle}>Datos Bancarios (Transferencias)</Text>
                                <Text style={styles.cardDescription}>
                                    Estos datos se mostrarán a los clientes cuando quieran informar un pago.
                                </Text>
                                
                                <Text style={styles.inputLabel}>CBU / CVU:</Text>
                                <TextInput style={styles.input} value={bankDetails.cbu} onChangeText={(t) => setBankDetails(prev => ({ ...prev, cbu: t }))} placeholder="Ej: 0000003100000000000000" placeholderTextColor="#999"/>

                                <Text style={styles.inputLabel}>Alias:</Text>
                                <TextInput style={styles.input} value={bankDetails.alias} onChangeText={(t) => setBankDetails(prev => ({ ...prev, alias: t }))} placeholder="Ej: GIMNASIO.FIT" placeholderTextColor="#999"/>

                                <Text style={styles.inputLabel}>Banco / Billetera (Opcional):</Text>
                                <TextInput style={styles.input} value={bankDetails.bankName} onChangeText={(t) => setBankDetails(prev => ({ ...prev, bankName: t }))} placeholder="Ej: MercadoPago" placeholderTextColor="#999"/>
                            </View>

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: gymColor || Colors[colorScheme].tint }]}
                                onPress={handleSaveSettings}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Guardar Configuración</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlayWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalContainer: { width: '92%', maxWidth: 500, maxHeight: '85%', backgroundColor: Colors[colorScheme].background, borderRadius: 24, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
    headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, justifyContent: 'space-between' },
    headerBannerTitle: { fontSize: 19, fontWeight: 'bold', color: '#fff' },
    headerBannerSub: { fontSize: 13, color: '#fff', opacity: 0.85, marginTop: 2 },
    closeButtonBanner: { padding: 4 },
    loadingContainer: { padding: 60, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 8 },
    cardDescription: { fontSize: 13, opacity: 0.7, color: Colors[colorScheme].text, marginBottom: 12 },
    inputLabel: { fontSize: 14, marginBottom: 8, opacity: 0.9, color: Colors[colorScheme].text, fontWeight: 'bold' },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, marginBottom: 18, backgroundColor: Colors[colorScheme].cardBackground, color: Colors[colorScheme].text, fontSize: 16 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingVertical: 5 },
    dayChip: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, marginRight: 8, backgroundColor: Colors[colorScheme].cardBackground, borderWidth: 1, borderColor: Colors[colorScheme].border },
    saveBtn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 15, marginBottom: 10 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});

export default GeneralSettingsModal;
