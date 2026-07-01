import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Colors } from '@/constants/Colors';
import StructuredPlanViewer from './StructuredPlanViewer';

const PlanContentViewer = ({ content, colorScheme }) => {
    const { width } = useWindowDimensions();
    const textColor = Colors[colorScheme || 'light'].text;

    const parseStructured = (text) => {
        if (!text) return null;
        try {
            const parsed = JSON.parse(text);
            if (parsed && parsed.type === 'structured' && Array.isArray(parsed.days)) {
                return parsed;
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    const structuredPlan = parseStructured(content);
    if (structuredPlan) {
        return (
            <StructuredPlanViewer
                days={structuredPlan.days}
                colorScheme={colorScheme}
            />
        );
    }

    // Detectar si es HTML
    const isHtml = (text) => {
        if (!text) return false;
        const trimmed = text.trim();
        return trimmed.startsWith('<') || trimmed.includes('</') || trimmed.includes('<div');
    };

    if (isHtml(content)) {
        return (
            <RenderHtml
                contentWidth={width - 40}
                source={{ html: content }}
                tagsStyles={{
                    body: { color: textColor, fontSize: 16, lineHeight: 24 },
                    p: { marginBottom: 10 },
                    ul: { marginBottom: 10, marginLeft: 20 },
                    li: { marginBottom: 5 },
                    b: { fontWeight: 'bold', color: textColor },
                    strong: { fontWeight: 'bold', color: textColor },
                    a: {
                        color: '#007AFF',
                        textDecorationLine: 'underline',
                        fontWeight: '600'
                    }
                }}
            />
        );
    } else {
        return (
            <Text style={{ color: textColor, fontSize: 16, lineHeight: 24 }}>
                {content}
            </Text>
        );
    }
};

export default PlanContentViewer;