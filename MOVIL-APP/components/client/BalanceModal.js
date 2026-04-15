// components/BalanceModal.js
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, RefreshControl, Modal, Image } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import apiClient from '../../services/apiClient';
import CustomAlert from '@/components/CustomAlert';

const BalanceModal = ({ onClose }) => {
    const { user, gymColor } = useAuth();
    const [profile, setProfile] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // 🔥 NUEVO: Estado para el visor de imágenes
    const [imageViewerData, setImageViewerData] = useState(null); 
    
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });

    const fetchData = useCallback(async () => {
        if (!user?._id) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        try {
            const [profileResponse, transactionsResponse] = await Promise.all([
                apiClient.get('/users/me'),
                apiClient.get('/transactions/my-transactions')
            ]);
            setProfile(profileResponse.data);
            setTransactions(transactionsResponse.data);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo cargar tu información de saldo.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?._id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderTransaction = ({ item }) => (
        <View style={styles.transactionCard}>
            <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription}>{item.description}</Text>
                <Text style={styles.transactionDate}>{format(new Date(item.createdAt), "d MMM yyyy, HH:mm", { locale: es })}</Text>
                
                {/* 🔥 NUEVO: Botón para ver comprobante si existe */}
                {item.receiptUrl && (
                    <TouchableOpacity 
                        style={styles.viewReceiptBtn} 
                        onPress={() => setImageViewerData(item.receiptUrl)}
                    >
                        <Ionicons name="image-outline" size={14} color={Colors[colorScheme].text} />
                        <Text style={{ color: Colors[colorScheme].text, fontSize: 12, marginLeft: 4, fontWeight: 'bold' }}>Ver Comprobante</Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={[styles.transactionAmount, item.type === 'charge' ? styles.debtText : styles.okText]}>
                {item.type === 'charge' ? '-' : '+'} ${parseFloat(item.amount).toFixed(2)}
            </Text>
        </View>
    );

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color="#ccc" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Historial de Saldo</Text>
                
                {loading ? <ActivityIndicator color={gymColor} size="large" /> : (
                    <>
                        <View style={styles.summaryContainer}>
                            <Text style={styles.summaryLabel}>Saldo Actual:</Text>
                            <Text style={[styles.summaryBalance, (profile?.balance ?? 0) < 0 ? styles.debtText : styles.okText]}>
                                ${(profile?.balance ?? 0).toFixed(2)}
                            </Text>
                        </View>
                        <FlatList
                            data={transactions}
                            renderItem={renderTransaction}
                            keyExtractor={(item) => item._id}
                            ListEmptyComponent={<Text style={styles.emptyText}>No tienes movimientos recientes.</Text>}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={gymColor} />}
                        />
                    </>
                )}
            </View>

            {/* 🔥 NUEVO: Modal visor de imágenes a pantalla completa */}
            {imageViewerData && (
                <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setImageViewerData(null)}>
                    <View style={styles.imageViewerOverlay}>
                        <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerData(null)}>
                            <Ionicons name="close" size={40} color="#fff" />
                        </TouchableOpacity>
                        <Image source={{ uri: imageViewerData }} style={styles.imageViewerImage} resizeMode="contain" />
                    </View>
                </Modal>
            )}

            <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={alertInfo.buttons} onClose={() => setAlertInfo({ ...alertInfo, visible: false })} gymColor={gymColor} />
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { height: '85%', backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 5, borderTopRightRadius: 5, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 1 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: Colors[colorScheme].text },
    summaryContainer: { alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    summaryLabel: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.8 },
    summaryBalance: { fontSize: 30, fontWeight: 'bold' },
    transactionCard: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    transactionInfo: { flex: 1, marginRight: 10 },
    transactionDescription: { fontSize: 14, color: Colors[colorScheme].text },
    transactionDate: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.6, marginTop: 2 },
    transactionAmount: { fontSize: 16, fontWeight: 'bold' },
    debtText: { color: '#a72828ff'  },
    okText: { color: '#28a745' },
    emptyText: { textAlign: 'center', padding: 20, color: Colors[colorScheme].text, opacity: 0.7 },
    
    // Estilos del visor
    viewReceiptBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 6, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: gymColor + '15', borderRadius: 4 },
    imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    imageViewerClose: { position: 'absolute', top: 40, right: 20, zIndex: 20 },
    imageViewerImage: { width: '100%', height: '80%' },
});

export default BalanceModal;