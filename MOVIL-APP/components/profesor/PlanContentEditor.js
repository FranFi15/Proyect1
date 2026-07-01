import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import RichTextEditor from '@/components/RichTextEditor';
import StructuredPlanBuilder from './StructuredPlanBuilder';

const PlanContentEditor = ({ initialContent, onChange, colorScheme, gymColor }) => {
    const parseStructured = (content) => {
        if (!content) return null;
        try {
            const parsed = JSON.parse(content);
            if (parsed && parsed.type === 'structured' && Array.isArray(parsed.days)) {
                return parsed.days;
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    const parsedDays = parseStructured(initialContent);
    const [mode, setMode] = useState(() => parsedDays || !initialContent ? 'structured' : 'html');

    const primaryColor = gymColor || '#007bff';
    const textColor = Colors[colorScheme || 'light'].text;

    return (
        <View style={styles.container}>
            {/* Toggle Mode */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleBtn, mode === 'structured' && { backgroundColor: primaryColor }]}
                    onPress={() => setMode('structured')}
                >
                    <MaterialCommunityIcons name="calendar-multiselect" size={16} color={mode === 'structured' ? '#fff' : textColor} />
                    <Text style={[styles.toggleText, mode === 'structured' ? { color: '#fff' } : { color: textColor }]}>
                        Rutina por Días
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.toggleBtn, mode === 'html' && { backgroundColor: primaryColor }]}
                    onPress={() => setMode('html')}
                >
                    <Ionicons name="document-text-outline" size={16} color={mode === 'html' ? '#fff' : textColor} />
                    <Text style={[styles.toggleText, mode === 'html' ? { color: '#fff' } : { color: textColor }]}>
                        Texto Libre / HTML
                    </Text>
                </TouchableOpacity>
            </View>

            {mode === 'structured' ? (
                <StructuredPlanBuilder
                    initialData={parsedDays}
                    onChange={onChange}
                    colorScheme={colorScheme}
                    gymColor={gymColor}
                />
            ) : (
                <RichTextEditor
                    initialContent={initialContent}
                    onChange={onChange}
                    colorScheme={colorScheme}
                    gymColor={gymColor}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 8,
        padding: 4,
        marginBottom: 10
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 6
    },
    toggleText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 6
    }
});

export default PlanContentEditor;
