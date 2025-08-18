import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome6 } from '@expo/vector-icons';

const UpgradePlanModal = ({ visible, onClose, onConfirm, currentCount, currentLimit, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.upgradeModalView}>
                    <FontAwesome6 name="arrow-trend-up" size={40} color={gymColor} style={{ marginBottom: 15 }} />
                    <ThemedText style={styles.modalTitle}>¡Sigue Creciendo!</ThemedText>
                    <ThemedText style={styles.planInfoText}>
                        Tu límite es de {currentLimit} clientes. Para registrar más clientes, necesitas ampliarlo.
                    </ThemedText>
                    <View style={styles.planInfoBox}>
                        <ThemedText style={styles.modalTitle}>Próximo Límite: {currentLimit + 50} clientes</ThemedText>
                        <ThemedText style={styles.planInfoText}>Se añadirá el costo a tu próxima factura.</ThemedText>
                    </View>
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
                            <Text style={styles.modalButtonText}>Más Tarde</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: gymColor }]} onPress={onConfirm}>
                            <Text style={styles.modalButtonText}>Ampliar Limite</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'rgba(0,0,0,0.6)' 
    },
    upgradeModalView: { 
        width: '90%', 
        maxWidth: 400, 
        backgroundColor: Colors[colorScheme].background, 
        borderRadius: 12, 
        padding: 25, 
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    planInfoBox: { 
        width: '100%',    
        borderRadius: 8, 
        marginVertical: 20 
    },
    planInfoText: { 
        fontSize: 14, 
        textAlign: 'center', 
        opacity: 0.8, 
        marginBottom: 5,
        marginTop: 5 
    },
    modalActions: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%', 
        marginTop: 10 
    },
    modalButton: { 
        flex: 1, 
        paddingVertical: 12, 
        borderRadius: 8, 
        alignItems: 'center', 
        marginHorizontal: 5 
    },
    modalButtonText: { 
        color: '#fff', 
        fontSize: 14, 
        fontWeight: 'bold' 
    },
    cancelButton: { 
        backgroundColor: '#6c757d' 
    },
});

export default UpgradePlanModal;