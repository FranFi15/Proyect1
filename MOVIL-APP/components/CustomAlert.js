import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, useColorScheme, Image } from 'react-native';
import { Colors } from '@/constants/Colors'; 
import { useAuth } from '@/contexts/AuthContext';

/**
 * Componente de Alerta Personalizado y Reutilizable.
 * @param {object} props
 * @param {boolean} props.visible - Controla si la alerta es visible.
 * @param {string} props.title - El título de la alerta.
 * @param {string} props.message - El mensaje principal de la alerta.
 * @param {function} props.onClose - Función para cerrar el modal.
 * @param {Array<object>} [props.buttons=[]] - Un array de objetos para los botones. Cada objeto debe tener: text, onPress, y style ('primary', 'destructive', o 'cancel').
 * @param {string} [props.gymColor] - El color principal del gimnasio para el botón primario y el borde de la imagen. (Si no se pasa, usa el global de useAuth)
 * @param {string} [props.gymLogo] - URL del logo del gimnasio. Si no se provee, usa el global de useAuth, si tampoco hay usa el logo de la app.
 * @param {boolean} [props.inline=false] - Si es true renderiza un view absoluto en lugar de Modal.
 */
const CustomAlert = ({ visible, title, message, onClose, buttons = [], gymColor, gymLogo, inline = false }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const auth = useAuth(); // Usamos opcionalmente el contexto por si no está en Provider en algún lado oscuro
    
    const finalGymColor = gymColor || auth?.gymColor;
    const finalGymLogo = gymLogo || auth?.gymLogo;

    const styles = getStyles(colorScheme, finalGymColor);

    if (!visible) return null;

    const logoSource = finalGymLogo 
        ? { uri: finalGymLogo } 
        : (colorScheme === 'dark' ? require('@/assets/images/modo-oscuro-logo.png') : require('@/assets/images/modo-claro-logo.png'));

    const primaryColor = finalGymColor || '#007bff';

    const content = (
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                
                {/* Logo superpuesto */}
                <View style={[styles.iconContainer, { borderColor: Colors[colorScheme].background }]}>
                    <View style={[styles.iconInnerContainer, { backgroundColor: primaryColor }]}>
                        <Image source={logoSource} style={styles.logoImage} resizeMode="cover" />
                    </View>
                </View>

                {/* Contenido */}
                <View style={styles.contentContainer}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                </View>
                
                {/* Botones */}
                <View style={styles.buttonsContainer}>
                    {((buttons && buttons.length > 0) ? buttons : [{ text: 'Aceptar', onPress: onClose }]).map((button, index) => {
                        const isCancel = button.style === 'cancel';
                        const isDestructive = button.style === 'destructive';
                        
                        const buttonStyle = [
                            styles.button,
                            isDestructive ? styles.destructiveButton : 
                            isCancel ? styles.cancelButton : styles.primaryButton
                        ];
                        const textStyle = [
                            styles.buttonText,
                            isCancel ? styles.cancelButtonText : styles.primaryButtonText
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
    );

    if (inline) {
        return (
            <View style={[StyleSheet.absoluteFillObject, { zIndex: 99999, elevation: 20 }]}>
                {content}
            </View>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            {content}
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        width: '85%',
        maxWidth: 350,
        backgroundColor: Colors[colorScheme].cardBackground || '#fff',
        borderRadius: 16,
        padding: 24,
        paddingTop: 50, // Espacio para el icono superpuesto
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        marginTop: 50, // Margen superior para que el logo no se corte
    },
    iconContainer: {
        position: 'absolute',
        top: -40,
        alignSelf: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors[colorScheme].cardBackground || '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    iconInnerContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    contentContainer: {
        alignItems: 'center',
        marginBottom: 24,
        width: '100%',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: Colors[colorScheme].text,
        opacity: 0.7,
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonsContainer: {
        width: '100%',
        gap: 12, // Espacio vertical entre botones
    },
    button: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: gymColor || '#007bff', 
    },
    destructiveButton: {
        backgroundColor: '#dc3545', 
    },
    cancelButton: {
        backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f5', // Fondo gris claro como en la imagen
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
