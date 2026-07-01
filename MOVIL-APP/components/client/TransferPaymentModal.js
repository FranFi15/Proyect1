// components/TransferPaymentModal.js
import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, Image, 
    TextInput, ActivityIndicator, ScrollView, useColorScheme, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard'; // 🔥 NUEVO: Importamos el portapapeles
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import apiClient from '../../services/apiClient'; 
import { useAuth } from '../../contexts/AuthContext';
import CustomAlert from '../CustomAlert'; 

const TransferPaymentModal = ({ onClose }) => {
    const { gymColor, user } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [packages, setPackages] = useState([]);
    const [classTypes, setClassTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState('all'); 
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [image, setImage] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '' });
    const [gymBankDetails, setGymBankDetails] = useState(null);
    
    // 🔥 NUEVO: Estado para ocultar/mostrar los datos bancarios
    const [showBankDetails, setShowBankDetails] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                try {
                    const typesResponse = await apiClient.get('/tipos-clase');
                    setClassTypes(typesResponse.data.tiposClase || []);
                } catch (e) { console.log("Error cargando tipos de clase:", e.message); }

                try {
                    const settingsResponse = await apiClient.get('/settings');
                    if (settingsResponse.data && settingsResponse.data.bankDetails) {
                        setGymBankDetails(settingsResponse.data.bankDetails);
                    }
                } catch (e) { console.log("Error cargando settings:", e.message); }

                try {
                    const pkgResponse = await apiClient.get('/payments/packages');
                    setPackages(pkgResponse.data);
                } catch (e) { console.log("Error cargando paquetes:", e.message); }

            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleCategoryChange = (categoryId) => {
        setSelectedCategory(categoryId);
        setSelectedPackage(null);
        setCustomAmount('');
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlertInfo({ visible: true, title: 'Permiso denegado', message: 'Necesitamos acceso a tu galería para subir el comprobante.' });
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.5, 
        });

        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    // 🔥 NUEVA FUNCIÓN: Para copiar al portapapeles
    const handleCopy = async (text, fieldName) => {
        await Clipboard.setStringAsync(text);
        
    };

    const handleSubmit = async () => {
        let amountToPay = 0;
        if (selectedPackage) {
            amountToPay = Number(selectedPackage.price);
        } else {
            amountToPay = Number(customAmount);
        }

        if (!amountToPay || isNaN(amountToPay) || amountToPay <= 0) {
            return setAlertInfo({ visible: true, title: 'Error', message: 'Por favor, ingresa o selecciona un monto válido.' });
        }
        if (!image) {
            return setAlertInfo({ visible: true, title: 'Error', message: 'Debes adjuntar el comprobante de transferencia.' });
        }

        setSubmitting(true);

        try {
            const formData = new FormData();
            
            if (selectedPackage) {
                formData.append('packageId', String(selectedPackage._id));
            }
            formData.append('amountTransferred', String(amountToPay));
            
            let filename = image.fileName || 'comprobante.png';

            if (Platform.OS === 'web') {
                const response = await fetch(image.uri);
                const blob = await response.blob();
                formData.append('receipt', blob, filename);
            } else {
                const localUri = image.uri;
                if (!filename.includes('.')) filename = 'comprobante.jpg';

                let mimeType = image.mimeType;
                if (!mimeType) {
                    const match = /\.(\w+)$/.exec(filename);
                    mimeType = match ? `image/${match[1]}` : `image/jpeg`;
                }
                if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

                formData.append('receipt', {
                    uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
                    name: filename,
                    type: mimeType
                });
            }

            const headers = { 'Accept': 'application/json' };
            if (Platform.OS !== 'web') {
                headers['Content-Type'] = 'multipart/form-data';
            }

            await apiClient.post('/payments/ticket', formData, { headers });

            setAlertInfo({ 
                visible: true, 
                title: '¡Enviado!', 
                message: 'Tu comprobante fue enviado con éxito. Un administrador lo revisará pronto.',
                buttons: [{ 
                    text: 'Genial', 
                    style: 'primary', 
                    onPress: () => {
                        setAlertInfo(prev => ({ ...prev, visible: false }));
                        setTimeout(() => {
                            if (onClose) onClose();
                        }, 300);
                    } 
                }]
            });

        } catch (error) {
            console.error("Error en submit:", error.response?.data || error.message);
            setAlertInfo({ 
                visible: true, 
                title: 'Error', 
                message: error.response?.data?.message || 'Hubo un problema al enviar el comprobante.' 
            });
        } finally {
            setSubmitting(false);
        }
    };

    const owesMoney = user?.balance < 0;
    const debtAmount = owesMoney ? Math.abs(user.balance) : 0;

    return (
        <View style={styles.modalOverlay}>
            <View style={[styles.modalView, { padding: 0, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                <View style={[styles.headerBanner, { backgroundColor: gymColor || '#1a5276' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerBannerTitle}>Informar Pago</Text>
                        <Text style={styles.headerBannerSub}>Envía tu comprobante de transferencia</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButtonBanner}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                
                {gymBankDetails && (gymBankDetails.cbu || gymBankDetails.alias) ? (
                    <View style={styles.bankSection}>
                        <TouchableOpacity 
                            style={styles.toggleBankBtn} 
                            onPress={() => setShowBankDetails(!showBankDetails)}
                        >
                            <Ionicons name={showBankDetails ? "eye-off-outline" : "eye-outline"} size={20} color={gymColor} />
                            <Text style={[styles.toggleBankText, {color: gymColor}]}>
                                {showBankDetails ? 'Ocultar datos bancarios' : 'Ver datos para transferencia'}
                            </Text>
                        </TouchableOpacity>

                        {showBankDetails && (
                            <View style={styles.bankInfoCard}>
                                {gymBankDetails.cbu ? (
                                    <View style={styles.copyRow}>
                                        <Text style={styles.bankInfoText}>CBU/CVU: {gymBankDetails.cbu}</Text>
                                        <TouchableOpacity 
                                            style={styles.copyIcon} 
                                            onPress={async () => {
                                                await Clipboard.setStringAsync(gymBankDetails.cbu);
                                                setAlertInfo({visible: true, title: 'Copiado', message: 'CBU copiado al portapapeles.'});
                                            }}
                                        >
                                            <Ionicons name="copy-outline" size={20} color={gymColor} />
                                        </TouchableOpacity>
                                    </View>
                                ) : null}

                                {gymBankDetails.alias ? (
                                    <View style={styles.copyRow}>
                                        <Text style={styles.bankInfoText}>Alias: {gymBankDetails.alias}</Text>
                                        <TouchableOpacity 
                                            style={styles.copyIcon} 
                                            onPress={async () => {
                                                await Clipboard.setStringAsync(gymBankDetails.alias);
                                                setAlertInfo({visible: true, title: 'Copiado', message: 'Alias copiado al portapapeles.'});
                                            }}
                                        >
                                            <Ionicons name="copy-outline" size={20} color={gymColor} />
                                        </TouchableOpacity>
                                    </View>
                                ) : null}

                                {gymBankDetails.bankName ? (
                                    <Text style={{fontSize: 14, color: Colors[colorScheme].text, opacity: 0.8, marginTop: 4}}>
                                        Entidad: {gymBankDetails.bankName}
                                    </Text>
                                ) : null}
                            </View>
                        )}
                    </View>
                ) : null}

                {owesMoney && (
                    <View style={styles.debtAlert}>
                        <Ionicons name="warning" size={24} color="#c0392b" />
                        <Text style={styles.debtText}>Tienes un saldo pendiente de ${debtAmount}.</Text>
                    </View>
                )}

                <Text style={styles.sectionTitle}>1. ¿Qué estás pagando?</Text>
                
                <View style={{ marginBottom: 12 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                selectedCategory === 'all' && { backgroundColor: gymColor, borderColor: gymColor }
                            ]}
                            onPress={() => setSelectedCategory('all')}
                        >
                            <Text style={[
                                { fontSize: 13, fontWeight: '600' },
                                selectedCategory === 'all' ? { color: '#fff' } : { color: Colors[colorScheme].text }
                            ]}>
                                Todos ({packages.length})
                            </Text>
                        </TouchableOpacity>

                        {classTypes.map(ct => {
                            const count = packages.filter(pkg => 
                                pkg.isPaseLibre || 
                                (!pkg.tipoClase && ct.nombre.toLowerCase().includes('musculacion')) ||
                                (pkg.tipoClase && pkg.tipoClase === ct._id) ||
                                (pkg.tipoClase && pkg.tipoClase._id === ct._id)
                            ).length;

                            if (count === 0) return null;

                            const isSelected = selectedCategory === ct._id;
                            return (
                                <TouchableOpacity
                                    key={ct._id}
                                    style={[
                                        styles.filterChip,
                                        isSelected && { backgroundColor: gymColor, borderColor: gymColor }
                                    ]}
                                    onPress={() => setSelectedCategory(ct._id)}
                                >
                                    <Text style={[
                                        { fontSize: 13, fontWeight: '600' },
                                        isSelected ? { color: '#fff' } : { color: Colors[colorScheme].text }
                                    ]}>
                                        {ct.nombre} ({count})
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {loading ? <ActivityIndicator color={gymColor} /> : (
                    <View style={styles.packagesContainer}>
                        {packages
                            .filter(pkg => {
                                if (selectedCategory === 'all') return true;
                                if (pkg.isPaseLibre) return true;
                                const selectedTypeObj = classTypes.find(t => t._id === selectedCategory);
                                const isMusculacionFilter = selectedTypeObj && selectedTypeObj.nombre.toLowerCase().includes('musculacion');
                                if (!pkg.tipoClase && isMusculacionFilter) return true;
                                const pkgTypeId = pkg.tipoClase && (pkg.tipoClase._id || pkg.tipoClase);
                                return pkgTypeId === selectedCategory;
                            })
                            .map(pkg => (
                                <TouchableOpacity
                                    key={pkg._id}
                                    style={[styles.packageCard, selectedPackage?._id === pkg._id && styles.selectedPackage]}
                                    onPress={() => {
                                        if (selectedPackage?._id === pkg._id) {
                                            setSelectedPackage(null);
                                            setCustomAmount('');
                                        } else {
                                            setSelectedPackage(pkg);
                                            setCustomAmount(pkg.price?.toString() || '');
                                        }
                                    }}
                                >
                                    <Text style={selectedPackage?._id === pkg._id ? styles.selectedText : styles.normalText}>{pkg.name}</Text>
                                    <Text style={selectedPackage?._id === pkg._id ? styles.selectedText : styles.normalText}>${pkg.price}</Text>
                                </TouchableOpacity>
                            ))
                        }
                    </View>
                )}

                <Text style={styles.sectionTitle}>2. Monto Transferido</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ej: 15000"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                />

                <Text style={styles.sectionTitle}>3. Comprobante (Captura)</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                    <Ionicons name="camera" size={24} color={gymColor} style={{ marginRight: 10 }} />
                    <Text style={[styles.imagePickerText, { color: gymColor }]}>
                        {image ? 'Cambiar Imagen' : 'Seleccionar Comprobante'}
                    </Text>
                </TouchableOpacity>

                {image && <Image source={{ uri: image }} style={styles.previewImage} />}

                <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Enviar Comprobante</Text>}
                </TouchableOpacity>
                </ScrollView>

                <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={[{ text: 'OK', onPress: () => setAlertInfo({ ...alertInfo, visible: false }) }]} gymColor={gymColor} />
            </View>
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { 
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 9999, elevation: 9999
    },
    modalView: { backgroundColor: Colors[colorScheme].background, height: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 5 },
    bankSection: { marginBottom: 20 },
    toggleBankBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: gymColor + '15', borderRadius: 8, borderWidth: 1, borderColor: gymColor + '30' },
    toggleBankText: { fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
    bankInfoCard: { padding: 15, marginTop: 10, borderRadius: 8, backgroundColor: Colors[colorScheme].cardBackground, borderWidth: 1, borderColor: Colors[colorScheme].border },
    copyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    bankInfoText: { fontSize: 15, color: Colors[colorScheme].text, flex: 1, fontWeight: '600' },
    copyIcon: { padding: 5 },
    debtAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf2f2', padding: 10, borderRadius: 8, borderColor: '#e74c3c', borderWidth: 1, marginBottom: 15 },
    debtText: { color: '#c0392b', fontWeight: 'bold', marginLeft: 8 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text, marginTop: 10, marginBottom: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].cardBackground, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
    packagesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    packageCard: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].cardBackground, width: '47%', alignItems: 'center' },
    selectedPackage: { backgroundColor: gymColor, borderColor: gymColor },
    normalText: { color: Colors[colorScheme].text },
    selectedText: { color: '#fff', fontWeight: 'bold' },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, color: Colors[colorScheme].text, marginBottom: 15, backgroundColor: Colors[colorScheme].cardBackground },
    imagePickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: gymColor, marginBottom: 15 },
    imagePickerText: { fontWeight: 'bold', fontSize: 16 },
    previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 20, resizeMode: 'contain' },
    submitBtn: { backgroundColor: gymColor, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 30 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    headerBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, justifyContent: 'space-between' },
    headerBannerTitle: { fontSize: 19, fontWeight: 'bold', color: '#fff' },
    headerBannerSub: { fontSize: 13, color: '#fff', opacity: 0.85, marginTop: 2 },
    closeButtonBanner: { padding: 4 }
});

export default TransferPaymentModal;