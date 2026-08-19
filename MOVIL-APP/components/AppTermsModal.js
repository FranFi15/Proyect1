import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TERMS_KEY = 'app_terms_accepted';

const AppTermsModal = () => {
    const colorScheme = useColorScheme() ?? 'light';
    const [visible, setVisible] = useState(false);
    const [accepted, setAccepted] = useState(false);

    useEffect(() => {
        const checkTerms = async () => {
            try {
                const hasAccepted = await AsyncStorage.getItem(TERMS_KEY);
                if (hasAccepted !== 'true') {
                    setVisible(true);
                }
            } catch (e) {
                console.error("Error checking terms of service", e);
                setVisible(true);
            }
        };
        checkTerms();
    }, []);

    const handleAccept = async () => {
        if (!accepted) return;
        try {
            await AsyncStorage.setItem(TERMS_KEY, 'true');
            setVisible(false);
        } catch (e) {
            console.error("Error saving terms acceptance", e);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent={true} animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, { backgroundColor: Colors[colorScheme].background }]}>
                    <View style={styles.headerBanner}>
                        <Text style={styles.headerBannerTitle}>Términos y Condiciones</Text>
                        <Text style={styles.headerBannerSub}>Por favor lee y acepta para continuar</Text>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.termsText, { color: Colors[colorScheme].text }]}>
                            Bienvenido a la aplicación. Para utilizar nuestros servicios, debes aceptar los siguientes términos y condiciones:{"\n\n"}
                            
                            1. Uso de la Aplicación{"\n"}
                            Esta aplicación es una herramienta de gestión para reservas de clases, compra de paquetes y seguimiento de entrenamientos. El uso inadecuado de la plataforma, como la creación de cuentas falsas o el uso de métodos de pago fraudulentos, resultará en la suspensión inmediata de la cuenta.{"\n\n"}
                            
                            2. Responsabilidad Física{"\n"}
                            Al utilizar los servicios de entrenamiento y rutinas (RMs) provistos en esta plataforma, reconoces que cualquier actividad física conlleva riesgos. Es tu responsabilidad realizarte los chequeos médicos pertinentes y proveer una orden médica o certificado de aptitud física si el gimnasio así lo requiere.{"\n\n"}
                            
                            3. Política de Pagos y Cancelaciones{"\n"}
                            Los pagos por suscripciones o paquetes de créditos no son reembolsables salvo casos excepcionales determinados por la administración del gimnasio. Las cancelaciones de clases deben realizarse dentro del tiempo límite establecido por el centro deportivo; de lo contrario, el crédito podría no ser devuelto.{"\n\n"}
                            
                            4. Privacidad y Datos{"\n"}
                            Tus datos personales (nombre, correo, teléfono, DNI, datos de salud básicos proporcionados) son utilizados exclusivamente para la gestión de tu cuenta y asistencia médica de emergencia. No compartimos esta información con terceros no autorizados.{"\n\n"}
                            
                            5. Conducta del Usuario{"\n"}
                            Se espera un comportamiento respetuoso hacia los profesores, administradores y otros usuarios del gimnasio. Cualquier conducta abusiva, acoso, o lenguaje inapropiado a través de la aplicación resultará en la terminación inmediata de tu cuenta y prohibición de acceso a las instalaciones.{"\n\n"}
                            
                            6. Propiedad Intelectual{"\n"}
                            Todo el contenido, diseño, logotipos y software dentro de esta aplicación son propiedad exclusiva de la administración o de sus licenciantes. Queda estrictamente prohibida su reproducción, distribución o modificación sin autorización previa.{"\n\n"}

                            7. Notificaciones{"\n"}
                            Al aceptar estos términos, consientes recibir notificaciones push relacionadas a tus reservas, vencimientos de membresía y avisos importantes del gimnasio. Puedes administrar estas preferencias desde la sección de ajustes de tu dispositivo.{"\n\n"}
                            
                            8. Exclusión de Garantías y Soporte{"\n"}
                            La aplicación se proporciona "tal cual". Aunque nos esforzamos por mantenerla siempre operativa, no garantizamos que esté libre de interrupciones o errores. Para soporte técnico o consultas, puedes comunicarte con la administración del gimnasio.{"\n\n"}
                            
                            Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuado de la aplicación constituye tu aceptación de las versiones actualizadas.
                        </Text>
                        <View style={{ height: 20 }} />
                    </ScrollView>

                    <View style={[styles.footer, { borderColor: Colors[colorScheme].border }]}>
                        <View style={styles.checkboxContainer}>
                            <TouchableOpacity 
                                style={[styles.checkbox, accepted && styles.checkboxActive]} 
                                onPress={() => setAccepted(!accepted)}
                            >
                                {accepted && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </TouchableOpacity>
                            <Text style={[styles.checkboxLabel, { color: Colors[colorScheme].text }]}>
                                He leído y acepto los términos y condiciones.
                            </Text>
                        </View>
                        
                        <TouchableOpacity
                            style={[styles.acceptButton, !accepted && styles.acceptButtonDisabled]}
                            onPress={handleAccept}
                            disabled={!accepted}
                        >
                            <Text style={styles.acceptButtonText}>Aceptar y Continuar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        padding: 10,
    },
    modalContainer: {
        height: '85%',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    headerBanner: {
        backgroundColor: '#1a5276',
        paddingVertical: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    headerBannerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerBannerSub: {
        fontSize: 14,
        color: '#fff',
        opacity: 0.85,
        marginTop: 4,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    termsText: {
        fontSize: 15,
        lineHeight: 24,
        textAlign: 'justify',
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
        borderTopWidth: 1,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#1a5276',
        borderRadius: 4,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: '#1a5276',
    },
    checkboxLabel: {
        fontSize: 15,
        flex: 1,
    },
    acceptButton: {
        backgroundColor: '#1a5276',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    acceptButtonDisabled: {
        backgroundColor: '#999',
    },
    acceptButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default AppTermsModal;
