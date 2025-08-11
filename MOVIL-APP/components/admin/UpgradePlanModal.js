import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

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
                    <FontAwesome5 name="rocket" size={40} color={gymColor} style={{ marginBottom: 15 }} />
                    <ThemedText style={styles.modalTitle}>¡Tu Gimnasio Está Creciendo!</ThemedText>
                    <ThemedText style={styles.modalText}>
                        Has alcanzado tu límite de {currentLimit} socios. Para seguir registrando, necesitas ampliar tu plan.
                    </ThemedText>
                    <View style={styles.planInfoBox}>
                        <ThemedText style={styles.planInfoTitle}>Próximo Nivel</ThemedText>
                        <ThemedText style={styles.planInfoText}>Nuevo Límite: {currentLimit + 50} socios</ThemedText>
                        <ThemedText style={styles.planInfoText}>Se añadirá el costo del bloque adicional a tu próxima factura.</ThemedText>
                    </View>
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onClose}>
                            <Text style={styles.modalButtonText}>Más Tarde</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: gymColor }]} onPress={onConfirm}>
                            <Text style={styles.modalButtonText}>Ampliar Plan Ahora</Text>
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
    modalText: { 
        fontSize: 16, 
        textAlign: 'center', 
        marginVertical: 10, 
        lineHeight: 22 
    },
    planInfoBox: { 
        width: '100%', 
        backgroundColor: Colors[colorScheme].cardBackground, 
        padding: 15, 
        borderRadius: 8, 
        marginVertical: 20 
    },
    planInfoTitle: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        textAlign: 'center', 
        marginBottom: 10 
    },
    planInfoText: { 
        fontSize: 14, 
        textAlign: 'center', 
        opacity: 0.8, 
        marginBottom: 5 
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
        fontSize: 16, 
        fontWeight: 'bold' 
    },
    cancelButton: { 
        backgroundColor: '#6c757d' 
    },
});

export default UpgradePlanModal;