import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, TextInput, Button, useColorScheme, ActivityIndicator, ScrollView } from 'react-native';
import { getUserTransactions, createTransaction } from '../../services/managementApi';
import apiClient from '../../services/apiClient'; // Importamos apiClient
import { Colors } from '@/constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';

const BillingModalContent = ({ client, onClose, onRefresh }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTransaction, setNewTransaction] = useState({ type: 'payment', amount: '', description: '' });
    const [currentClient, setCurrentClient] = useState(client);
    
    const { gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    const fetchData = async () => {
        if (!client?._id) return;
        setLoading(true);
        try {
            // Hacemos ambas llamadas en paralelo para obtener siempre los datos más frescos
            const [transactionsResponse, userResponse] = await Promise.all([
                getUserTransactions(client._id),
                apiClient.get(`/users/${client._id}`) // Obtenemos el perfil actualizado del usuario
            ]);
            setTransactions(transactionsResponse.data);
            setCurrentClient(userResponse.data); // Actualizamos el estado local con el cliente más reciente
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar la información del cliente.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [client]);
    
    const handleCreateTransaction = async (type) => {
        if (!newTransaction.amount || !newTransaction.description) {
            Alert.alert('Error', 'Por favor, completa el monto y la descripción.');
            return;
        }
        try {
            const response = await createTransaction({ 
                userId: client._id, 
                amount: newTransaction.amount,
                description: newTransaction.description,
                type: type 
            });
            
            // Actualizamos el estado local con la respuesta del backend
            setCurrentClient(prevClient => ({
                ...prevClient,
                balance: response.data.newUserBalance 
            }));
            setTransactions(prevTransactions => [response.data.transaction, ...prevTransactions]);
            setNewTransaction({ type: 'payment', amount: '', description: '' });
            
            onRefresh();
            Alert.alert('Éxito', 'Transacción registrada correctamente.');
            
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'No se pudo crear la transacción.');
        }
    };

    const renderTransaction = ({ item }) => (
        <View style={styles.transactionCard}>
            <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription}>{item.description}</Text>
                <Text style={styles.transactionDate}>{format(new Date(item.createdAt), "d MMM yyyy, HH:mm", { locale: es })}</Text>
            </View>
            {/* --- CORRECCIÓN DE LÓGICA DE SIGNOS --- */}
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
                        {/* --- CORRECCIÓN DE LÓGICA DE COLOR --- */}
                        <Text style={[styles.summaryBalance, (currentClient.balance ?? 0) > 0 ? styles.charge : styles.payment]}>
                            ${(currentClient.balance ?? 0).toFixed(2)}
                        </Text>
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.formTitle}>Registrar Movimiento</Text>
                        <TextInput style={styles.input} placeholder="Monto" keyboardType="numeric" value={newTransaction.amount} onChangeText={text => setNewTransaction(p => ({...p, amount: text}))} />
                        <TextInput style={styles.input} placeholder="Descripción (Ej: Pago cuota, Cargo inscripción)" value={newTransaction.description} onChangeText={text => setNewTransaction(p => ({...p, description: text}))} />
                        <View style={styles.buttonRow}>
                            <Button title="Registrar Pago" onPress={() => handleCreateTransaction('payment')} color={'#28a745'} />
                            <Button title="Añadir Cargo" onPress={() => handleCreateTransaction('charge')} color={Colors.light.error} />
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
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: {  maxHeight: '80%', backgroundColor: Colors[colorScheme].background, borderRadius: 2, padding: 20, elevation: 5 },
    closeButton: { position: 'absolute', top: 10, right: 10, zIndex: 1},
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: Colors[colorScheme].text },
    summaryContainer: { alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    summaryLabel: { fontSize: 16, color: Colors[colorScheme].text, opacity: 0.8 },
    summaryBalance: { fontSize: 28, fontWeight: 'bold' },
    formContainer: { borderBottomWidth: 1, borderColor: Colors[colorScheme].border, paddingBottom: 20, marginBottom: 15 },
    formTitle: { fontSize: 16, fontWeight: '600', color: Colors[colorScheme].text, marginBottom: 10 },
    input: { height: 50, borderColor: Colors[colorScheme].border, borderWidth: 1, borderRadius: 2, paddingHorizontal: 15, marginBottom: 10, color: Colors[colorScheme].text },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 5 },
    historyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: Colors[colorScheme].text },
    transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors[colorScheme].border },
    transactionInfo: { flex: 1, marginRight: 10, fontWeight: 'bold' },
    transactionDescription: { fontSize: 16, color: Colors[colorScheme].text },
    transactionDate: { fontSize: 12, color: Colors[colorScheme].text, opacity: 0.6, marginTop: 2 },
    transactionAmount: { fontSize: 16, fontWeight: 'bold' },
    charge: { color: '#a72828ff' },
    payment: { color: '#28a745' },
    emptyText: { textAlign: 'center', padding: 20, color: Colors[colorScheme].text, opacity: 0.7 },
});

export default BillingModalContent;
