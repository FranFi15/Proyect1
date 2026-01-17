// src/components/PlanContentViewer.js
import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Colors } from '@/constants/Colors'; 

const PlanContentViewer = ({ content, colorScheme }) => {
    const { width } = useWindowDimensions();
    const textColor = Colors[colorScheme].text;

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
                    strong: { fontWeight: 'bold', color: textColor }
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