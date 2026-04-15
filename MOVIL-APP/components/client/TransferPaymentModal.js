// components/TransferPaymentModal.js
import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, Image, 
    TextInput, ActivityIndicator, ScrollView, useColorScheme, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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

    // 🔥 MEJORA: Peticiones independientes para que un error no rompa todo el modal
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Cargar Tipos de Clase
                try {
                    const typesResponse = await apiClient.get('/tipos-clase');
                    setClassTypes(typesResponse.data.tiposClase || []);
                } catch (e) { console.log("Error cargando tipos de clase:", e.message); }

                // 2. Cargar Datos Bancarios
                try {
                    const settingsResponse = await apiClient.get('/settings');
                    if (settingsResponse.data && settingsResponse.data.bankDetails) {
                        setGymBankDetails(settingsResponse.data.bankDetails);
                    }
                } catch (e) { console.log("Error cargando settings:", e.message); }

                // 3. Cargar Paquetes de Pago
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
            
            // 🔥 PREPARAMOS LA IMAGEN SEGÚN LA PLATAFORMA 🔥
            let filename = image.fileName || 'comprobante.png';

            if (Platform.OS === 'web') {
                // EN LA WEB: Convertimos la URI en un Blob real
                const response = await fetch(image.uri);
                const blob = await response.blob();
                formData.append('receipt', blob, filename);
                console.log("Armando imagen para WEB...");
            } else {
                // EN CELULARES: Estructura nativa de React Native
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
                console.log("Armando imagen para CELULAR...");
            }

            // 🔥 CONFIGURAMOS LOS HEADERS INTELIGENTEMENTE 🔥
            const headers = { 'Accept': 'application/json' };
            // En la Web NO debemos forzar el Content-Type para que el navegador ponga el boundary automático.
            // En Celulares SÍ debemos ponerlo.
            if (Platform.OS !== 'web') {
                headers['Content-Type'] = 'multipart/form-data';
            }

            // Volvemos a usar tu apiClient para que inyecte los Tokens automáticamente
            await apiClient.post('/payments/ticket', formData, { headers });

            setAlertInfo({ 
                visible: true, 
                title: '¡Enviado!', 
                message: 'Tu comprobante fue enviado con éxito. Un administrador lo revisará pronto.',
                buttons: [{ 
                    text: 'Genial', 
                    style: 'primary', 
                    onPress: () => {
                        // 1. Ocultamos la alerta primero para evitar el freeze
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
    const hasPasesLibres = packages.some(pkg => pkg.isPaseLibre);

    return (
        <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                </TouchableOpacity>

                <Text style={styles.title}>Informar Pago</Text>
                
                {gymBankDetails && (gymBankDetails.cbu || gymBankDetails.alias) ? (
                    <View style={styles.bankInfoCard}>
                        {gymBankDetails.cbu ? <Text style={styles.bankInfoText}>CBU/CVU: {gymBankDetails.cbu}</Text> : null}
                        {gymBankDetails.alias ? <Text style={styles.bankInfoText}>Alias: {gymBankDetails.alias}</Text> : null}
                        {gymBankDetails.bankName ? <Text style={styles.bankInfoText}>Banco: {gymBankDetails.bankName}</Text> : null}
                    </View>
                ) : (
                    <View style={styles.bankInfoCard}>
                        <Text style={styles.bankInfoText}>El administrador aún no ha configurado sus datos para transferencias.</Text>
                    </View>
                )}

                {loading ? <ActivityIndicator size="large" color={gymColor} /> : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        
                        {owesMoney && (
                            <View style={styles.debtAlert}>
                                <Ionicons name="alert-circle" size={20} color="#c0392b" />
                                <Text style={styles.debtText}>Deuda pendiente: ${debtAmount.toFixed(2)}</Text>
                            </View>
                        )}

                        <Text style={styles.sectionTitle}>1. ¿Qué estás pagando?</Text>
                        
                        <View style={{ marginBottom: 15 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <TouchableOpacity 
                                    style={[styles.filterChip, selectedCategory === 'all' && {backgroundColor: gymColor, borderColor: gymColor}]} 
                                    onPress={() => handleCategoryChange('all')}
                                >
                                    <Text style={{fontWeight: 'bold', color: selectedCategory === 'all' ? '#fff' : Colors[colorScheme].text}}>Todos</Text>
                                </TouchableOpacity>

                                {hasPasesLibres && (
                                    <TouchableOpacity 
                                        style={[styles.filterChip, selectedCategory === 'pase_libre' && {backgroundColor: gymColor, borderColor: gymColor}]} 
                                        onPress={() => handleCategoryChange('pase_libre')}
                                    >
                                        <Text style={{fontWeight: 'bold', color: selectedCategory === 'pase_libre' ? '#fff' : Colors[colorScheme].text}}>Pases Libres</Text>
                                    </TouchableOpacity>
                                )}
                                
                                {classTypes.map(type => (
                                    <TouchableOpacity 
                                        key={type._id} 
                                        style={[styles.filterChip, selectedCategory === type._id && {backgroundColor: gymColor, borderColor: gymColor}]} 
                                        onPress={() => handleCategoryChange(type._id)}
                                    >
                                        <Text style={{fontWeight: 'bold', color: selectedCategory === type._id ? '#fff' : Colors[colorScheme].text}}>{type.nombre}</Text>
                                    </TouchableOpacity>
                                ))}

                                <TouchableOpacity 
                                    style={[styles.filterChip, selectedCategory === 'libre' && {backgroundColor: gymColor, borderColor: gymColor}]} 
                                    onPress={() => handleCategoryChange('libre')}
                                >
                                    <Text style={{fontWeight: 'bold', color: selectedCategory === 'libre' ? '#fff' : Colors[colorScheme].text}}>
                                        {owesMoney ? 'Saldar Deuda' : 'Monto Libre'}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>

                        <View style={styles.packagesContainer}>
                            {(selectedCategory === 'all' || selectedCategory === 'libre') && (
                                <TouchableOpacity 
                                    style={[styles.packageCard, (!selectedPackage && customAmount !== '') && styles.selectedPackage]} 
                                    onPress={() => {
                                        setSelectedPackage(null);
                                        setCustomAmount(owesMoney ? debtAmount.toString() : '0'); 
                                    }}
                                >
                                    <Text style={(!selectedPackage && customAmount !== '') ? styles.selectedText : styles.normalText}>
                                        {owesMoney ? 'Saldar Deuda / Otro monto' : 'Monto Libre'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* 🔥 MEJORA: Filtro más robusto a prueba de errores de base de datos */}
                            {packages
                                .filter(pkg => {
                                    if (selectedCategory === 'all') return true;
                                    if (selectedCategory === 'libre') return false; 
                                    if (selectedCategory === 'pase_libre') return pkg.isPaseLibre;
                                    
                                    const classTypeId = typeof pkg.tipoClase === 'object' && pkg.tipoClase !== null ? pkg.tipoClase._id : pkg.tipoClase;
                                    return classTypeId === selectedCategory;
                                })
                                .map(pkg => (
                                <TouchableOpacity 
                                    key={pkg._id} 
                                    style={[styles.packageCard, selectedPackage?._id === pkg._id && styles.selectedPackage]} 
                                    onPress={() => {
                                        setSelectedPackage(pkg);
                                        setCustomAmount('');
                                    }}
                                >
                                    <Text style={selectedPackage?._id === pkg._id ? styles.selectedText : styles.normalText}>
                                        {pkg.name} - ${pkg.price}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {(!selectedPackage && customAmount !== '') && (
                            <TextInput
                                style={styles.input}
                                placeholder="Ingresa el monto a transferir"
                                placeholderTextColor={Colors[colorScheme].icon}
                                keyboardType="numeric"
                                value={customAmount}
                                onChangeText={setCustomAmount}
                            />
                        )}

                        <Text style={styles.sectionTitle}>2. Adjunta el Comprobante</Text>
                        
                        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                            <Ionicons name="cloud-upload-outline" size={24} color={gymColor} style={{marginRight: 8}}/>
                            <Text style={[styles.imagePickerText, {color: gymColor}]}>
                                {image ? 'Cambiar Imagen' : 'Subir Captura'}
                            </Text>
                        </TouchableOpacity>

                        {image && (
                            <Image source={{ uri: image.uri }} style={styles.previewImage} />
                        )}

                        <TouchableOpacity 
                            style={[styles.submitBtn, submitting && {opacity: 0.7}]} 
                            onPress={handleSubmit} 
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitBtnText}>Enviar Comprobante</Text>
                            )}
                        </TouchableOpacity>

                    </ScrollView>
                )}
            </View>

            <CustomAlert 
                visible={alertInfo.visible} 
                title={alertInfo.title} 
                message={alertInfo.message} 
                buttons={alertInfo.buttons || [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({...alertInfo, visible: false}) }]} 
                gymColor={gymColor} 
            />
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { 
        position: 'absolute', 
        top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'flex-end',
        zIndex: 9999, 
        elevation: 9999
    },
    modalView: { backgroundColor: Colors[colorScheme].background, height: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    title: { fontSize: 22, fontWeight: 'bold', color: Colors[colorScheme].text, marginBottom: 15, textAlign: 'center' },
    
    bankInfoCard: { backgroundColor: '#eef2f3', padding: 15, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#d0d8dc' },
    bankInfoText: { fontSize: 14, color: '#2c3e50', marginBottom: 5, fontWeight: '600' },
    
    debtAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf2f2', padding: 10, borderRadius: 8, borderColor: '#e74c3c', borderWidth: 1, marginBottom: 15 },
    debtText: { color: '#c0392b', fontWeight: 'bold', marginLeft: 8 },

    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors[colorScheme].text, marginTop: 10, marginBottom: 10 },
    
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        backgroundColor: Colors[colorScheme].cardBackground,
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },

    packagesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    packageCard: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].cardBackground, flexGrow: 1, alignItems: 'center' },
    selectedPackage: { backgroundColor: gymColor, borderColor: gymColor },
    normalText: { color: Colors[colorScheme].text },
    selectedText: { color: '#fff', fontWeight: 'bold' },

    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, color: Colors[colorScheme].text, marginBottom: 15, backgroundColor: Colors[colorScheme].cardBackground },
    
    imagePickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: gymColor, marginBottom: 15 },
    imagePickerText: { fontWeight: 'bold', fontSize: 16 },
    previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 20, resizeMode: 'contain' },

    submitBtn: { backgroundColor: gymColor, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 30 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default TransferPaymentModal;