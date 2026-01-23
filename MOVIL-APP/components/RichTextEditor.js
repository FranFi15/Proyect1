// src/components/RichTextEditor.js
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Modal, Text, TextInput, TouchableOpacity } from 'react-native';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const RichTextEditor = ({ 
    initialContent, 
    onChange, 
    colorScheme, 
    gymColor, 
    placeholder = "Escribe aquí..." 
}) => {
    const richText = useRef();

    // Estados para el Modal de Link
    const [isLinkModalVisible, setLinkModalVisible] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkText, setLinkText] = useState('');

    // Función para abrir el modal (Intercepta el botón de la toolbar)
    const handleOpenLinkModal = () => {
        setLinkUrl('');
        setLinkText('');
        setLinkModalVisible(true);
    };

    // Función para guardar e insertar el link
    const handleInsertLink = () => {
        if (linkUrl) {
            richText.current?.insertLink(linkText || linkUrl, linkUrl);
        }
        setLinkModalVisible(false);
    };

    const styles = getStyles(colorScheme, gymColor);

    return (
        <View style={styles.container}>
            <RichToolbar
                editor={richText}
                onPressAddLink={handleOpenLinkModal} 
                // ------------------------------------
                actions={[ 
                    actions.setBold, 
                    actions.setItalic, 
                    actions.setUnderline, 
                    actions.insertBulletsList, 
                    actions.insertOrderedList,
                    actions.insertLink
                ]}
                iconTint={Colors[colorScheme].text}
                selectedIconTint={gymColor}
                disabledIconTint={Colors[colorScheme].icon}
                style={styles.toolbar}
            />
            
            <View style={styles.editorContainer}>
                <RichEditor
                    ref={richText}
                    initialContentHTML={initialContent}
                    onChange={onChange}
                    placeholder={placeholder}
                    editorStyle={{
                        backgroundColor: Colors[colorScheme].background,
                        color: Colors[colorScheme].text,
                        placeholderColor: Colors[colorScheme].icon,
                        contentCSSText: 'font-size: 16px; line-height: 24px; min-height: 200px;' 
                    }}
                    style={{ flex: 1, minHeight: 150 }}
                    useContainer={true}
                />
            </View>

            {/* --- MODAL PERSONALIZADO PARA LINKS --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isLinkModalVisible}
                onRequestClose={() => setLinkModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Insertar Enlace</Text>
                        
                        <Text style={styles.label}>Texto (Opcional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Ver Video"
                            placeholderTextColor={Colors[colorScheme].icon}
                            value={linkText}
                            onChangeText={setLinkText}
                        />

                        <Text style={styles.label}>URL</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://..."
                            placeholderTextColor={Colors[colorScheme].icon}
                            value={linkUrl}
                            onChangeText={setLinkUrl}
                            autoCapitalize="none"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={[styles.button, styles.cancelButton]} 
                                onPress={() => setLinkModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.button, styles.saveButton]} 
                                onPress={handleInsertLink}
                            >
                                <Text style={styles.saveButtonText}>Insertar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: {
        flex: 1,
        marginBottom: 15,
    },
    toolbar: {
        backgroundColor: Colors[colorScheme].cardBackground, 
        borderTopLeftRadius: 5, 
        borderTopRightRadius: 5,
        borderBottomWidth: 1,
        borderBottomColor: Colors[colorScheme].cardBackground,
        alignItems: 'flex-start', // Corregido de 'start' a 'flex-start' para evitar warnings
    },
    editorContainer: {
        borderWidth: 1,
        borderTopWidth: 0, 
        borderColor: Colors[colorScheme].cardBackground, 
        backgroundColor: Colors[colorScheme].inputBackground,
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 5,
        minHeight: 250,
        overflow: 'hidden',
    },
    // Estilos del Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: Colors[colorScheme].cardBackground,
        borderRadius: 10,
        padding: 20,
        width: '100%',
        maxWidth: 400,
        
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
        marginBottom: 15,
        textAlign: 'center'
    },
    label: {
        fontSize: 14,
        color: Colors[colorScheme].text,
        marginBottom: 5,
        fontWeight: '600'
    },
    input: {
        backgroundColor: Colors[colorScheme].inputBackground,
        color: Colors[colorScheme].text,
        borderRadius: 5,
        padding: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 10
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 5,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors[colorScheme].border
    },
    saveButton: {
        backgroundColor: gymColor,
    },
    cancelButtonText: {
        color: Colors[colorScheme].text,
        fontWeight: '600'
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: 'bold'
    }
});

export default RichTextEditor;