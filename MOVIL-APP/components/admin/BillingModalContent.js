import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, useColorScheme, ActivityIndicator, ScrollView } from 'react-native';
import { getUserTransactions, createTransaction } from '../../services/managementApi';
import apiClient from '../../services/apiClient';
import { Colors } from '@/constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import CustomAlert from '@/components/CustomAlert'; // Importamos el componente de alerta personalizado

const BillingModalContent = ({ client, onClose, onRefresh }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTransaction, setNewTransaction] = useState({ type: 'payment', amount: '', description: '' });
    const [currentClient, setCurrentClient] = useState(client);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // Estado para manejar la alerta personalizada
    const [alertInfo, setAlertInfo] = useState({ 
        visible: false, 
        title: '', 
        message: '', 
        buttons: [] 
    });

    const fetchData = async () => {
        if (!client?._id) return;
        setLoading(true);
        try {
            const [transactionsResponse, userResponse] = await Promise.all([
                getUserTransactions(client._id),
                apiClient.get(`/users/${client._id}`)
            ]);
            setTransactions(transactionsResponse.data);
            setCurrentClient(userResponse.data);
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudo cargar la información del cliente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [client]);
    
    const handleCreateTransaction = async (type) => {
        if (!newTransaction.amount || !newTransaction.description) {
            setAlertInfo({ visible: true, title: 'Error', message: 'Por favor, completa el monto y la descripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            return;
        }
        try {
            const response = await createTransaction({ 
                userId: client._id, 
                amount: newTransaction.amount,
                description: newTransaction.description,
                type: type 
            });
            
            setCurrentClient(prevClient => ({
                ...prevClient,
                balance: response.data.newUserBalance 
            }));
            setTransactions(prevTransactions => [response.data.transaction, ...prevTransactions]);
            setNewTransaction({ type: 'payment', amount: '', description: '' });
            
            onRefresh();
            setAlertInfo({ visible: true, title: 'Éxito', message: 'Transacción registrada correctamente.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            
        } catch (error) {
            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo crear la transacción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        }
    };

    const renderTransaction = ({ item }) => (
        <View style={styles.transactionCard}>
            <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription}>{item.description}</Text>
                <Text style={styles.transactionDate}>{format(new Date(item.createdAt), "d MMM yyyy, HH:mm", { locale: es })}</Text>
            </View>
            <Text style={[styles.transactionAmount, item.type === 'charge' ? styles.charge : styles.payment]}>
                {item.type === 'charge' ? '-' : '+'} ${parseFloat(item.amount).toFixed(2)}
            </Text>
        </View>
    );

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalView}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close-circle" size={30} color="#888" />
                </TouchableOpacity>
                <ScrollView>
                    <Text style={styles.modalTitle}>Balance de {currentClient.nombre}</Text>
                    
                    <View style={styles.summaryContainer}>
                        <Text style={styles.summaryLabel}>Saldo Actual:</Text>
                        <Text style={[styles.summaryBalance, (currentClient.balance ?? 0) < 0 ? styles.charge : styles.payment]}>
                            ${(currentClient.balance ?? 0).toFixed(2)}
                        </Text>
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.formTitle}>Registrar Movimiento</Text>
                        <TextInput style={styles.input} placeholderTextColor={Colors[colorScheme].text} placeholder="Monto" keyboardType="numeric" value={newTransaction.amount} onChangeText={text => setNewTransaction(p => ({...p, amount: text}))} />
                        <TextInput style={styles.input} placeholderTextColor={Colors[colorScheme].text} placeholder="Descripción (Ej: Pago cuota, Cargo inscripción)" value={newTransaction.description} onChangeText={text => setNewTransaction(p => ({...p, description: text}))} />
                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={[styles.styledButton, styles.paymentButton]} onPress={() => handleCreateTransaction('payment')}>
                                <Text style={styles.styledButtonText}>Registrar Pago</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.styledButton, styles.chargeButton]} onPress={() => handleCreateTransaction('charge')}>
                                <Text style={styles.styledButtonText}>Añadir Cargo</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <Text style={styles.historyTitle}>Historial de Movimientos</Text>
                    {loading ? <ActivityIndicator color={gymColor} /> : (
                        <FlatList
                            data={transactions}
                            renderItem={renderTransaction}
                            keyExtractor={(item) => item._id}
                            ListEmptyComponent={<Text style={styles.emptyText}>Este socio no tiene movimientos.</Text>}
                            scrollEnabled={false}
                        />
                    )}
                </ScrollView>
            </View>
            <CustomAlert
                visible={alertInfo.visible}
                title={alertInfo.title}
                message={alertInfo.message}
                buttons={alertInfo.buttons}
                onClose={() => setAlertInfo({ ...alertInfo, visible: false })}
                gymColor={gymColor} 
            />
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center',},
    modalView: {  width: '100%',height: '90%', backgroundColor: Colors[colorScheme].background, borderRadius: 5, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 10, right: 10, zIndex: 1},
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: Colors[colorScheme].text },
    summaryContainer: { alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    summaryLabel: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.8 },
    summaryBalance: { fontSize: 28, fontWeight: 'bold' },
    formContainer: { borderBottomWidth: 1, borderColor: Colors[colorScheme].border, paddingBottom: 20, marginBottom: 15 },
    formTitle: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text, marginBottom: 10 },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 5, paddingHorizontal: 15, marginBottom: 10, color: Colors[colorScheme].text },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 5, gap: 10 },
    styledButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentButton: {
        backgroundColor: '#28a745',
    },
    chargeButton: {
        backgroundColor: '#a72828ff',
    },
    styledButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    historyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: Colors[colorScheme].text },
    transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    transactionInfo: { flex: 1, marginRight: 10, fontWeight: 'bold' },
    transactionDescription: { fontSize: 16, color: Colors[colorScheme].text },
    transactionDate: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.6, marginTop: 2 },
    transactionAmount: { fontSize: 16, fontWeight: 'bold' },
    charge: { color: '#a72828ff'  },
    payment: { color: '#28a745' },
    emptyText: { textAlign: 'center', padding: 20, color: Colors[colorScheme].text, opacity: 0.7 },
});

export default BillingModalContent;
