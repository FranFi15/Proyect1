// components/FilterModal.js

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Pressable // Usamos Pressable para el fondo
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';

const FilterModal = ({
    visible,
    onClose,
    options,
    onSelect,
    selectedValue,
    title,
    theme,
}) => {
    const styles = getStyles(theme);

    // Si no es visible, no renderizamos nada.
    if (!visible) {
        return null;
    }

    return (
        // 1. Reemplazamos el <Modal> con un <Pressable> que actúa como fondo.
        <Pressable style={styles.modalOverlay} onPress={onClose}>
            {/* 2. Evitamos que el toque se propague desde el contenido hacia el fondo */}
            <Pressable style={styles.modalContent}>
                <ThemedText style={styles.modalTitle}>{title}</ThemedText>
                <FlatList
                    data={options}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.optionItem}
                            onPress={() => onSelect(item._id)}
                        >
                            <Text style={styles.optionText}>{item.nombre}</Text>
                            {selectedValue === item._id && (
                                <FontAwesome5 name="check" size={16} color={theme.gymColor} />
                            )}
                        </TouchableOpacity>
                    )}
                />
            </Pressable>
        </Pressable>
    );
};

const getStyles = (theme) => StyleSheet.create({
    // 3. El overlay ahora usa posicionamiento absoluto para cubrir la pantalla
    modalOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000, 
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '85%',
        maxHeight: '100%',
        backgroundColor: theme.colors.background,
        borderRadius: 12,
        padding: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: theme.colors.text,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
    
    },
    optionText: {
        fontSize: 18,
        color: theme.colors.text,
    },
});

export default FilterModal;