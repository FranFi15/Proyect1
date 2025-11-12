import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors'; // Asegúrate de que esta ruta sea correcta para tu proyecto
import { Ionicons } from '@expo/vector-icons';

/**
 * Componente de Alerta Personalizado y Reutilizable.
 * @param {object} props
 * @param {boolean} props.visible - Controla si la alerta es visible.
 * @param {string} props.title - El título de la alerta.
 * @param {string} props.message - El mensaje principal de la alerta.
 * @param {function} props.onClose - Función para cerrar el modal (se llama al presionar la 'X' o fuera del modal).
 * @param {Array<object>} [props.buttons=[]] - Un array de objetos para los botones. Cada objeto debe tener: text, onPress, y style ('primary', 'destructive', o 'cancel').
 * @param {string} [props.gymColor] - El color principal del gimnasio para el botón primario.
 */
const CustomAlert = ({ visible, title, message, onClose, buttons = [], gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    // Pasamos gymColor a la función de estilos para que el botón primario lo use
    const styles = getStyles(colorScheme, gymColor);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close-circle" size={28} color={Colors[colorScheme].icon} />
                        </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.message}>{message}</Text>
                    
                    <View style={styles.buttonsContainer}>
                        {/* Se asegura de que buttons sea un array antes de mapear */}
                        {(buttons || []).map((button, index) => {
                            // Determina el estilo del botón basado en la prop 'style'
                            const buttonStyle = [
                                styles.button,
                                button.style === 'destructive' ? styles.destructiveButton : 
                                button.style === 'cancel' ? styles.cancelButton : styles.primaryButton
                            ];
                            // Determina el estilo del texto del botón
                            const textStyle = [
                                styles.buttonText,
                                button.style === 'cancel' ? styles.cancelButtonText : styles.primaryButtonText
                            ];

                            return (
                                <TouchableOpacity key={index} style={buttonStyle} onPress={button.onPress}>
                                    <Text style={textStyle}>{button.text}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 5,
        padding: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
        flex: 1, 
    },
    closeButton: {
        padding: 5,
    },
    message: {
        fontSize: 16,
        color: Colors[colorScheme].text,
        opacity: 0.8,
        marginBottom: 25,
        lineHeight: 22,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10, 
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        minWidth: 80,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: gymColor || '#1a5276', // Usa gymColor o un color por defecto
    },
    destructiveButton: {
        backgroundColor: '#dc3545', // Un color para acciones destructivas (ej. Eliminar)
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    primaryButtonText: {
        color: '#FFFFFF',
    },
    cancelButtonText: {
        color: Colors[colorScheme].text,
    },
});

export default CustomAlert;
