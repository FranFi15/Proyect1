import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';

const RichTextEditor = ({ 
    initialContent, 
    onChange, 
    colorScheme, 
    placeholder = "Escribe aquí..." 
}) => {
    const [QuillComponent, setQuillComponent] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            
            // 1. Inyectar CSS (El CDN sigue siendo válido y seguro)
            const linkId = 'quill-snow-css';
            if (!document.getElementById(linkId)) {
                const link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
                document.head.appendChild(link);
            }

            // 2. IMPORTACIÓN DINÁMICA DE LA NUEVA LIBRERÍA
            // Cambiamos 'react-quill' por 'react-quill-new'
            import('react-quill-new').then((mod) => {
                setQuillComponent(() => mod.default);
            }).catch((err) => console.error("Error cargando el editor", err));
        }
    }, []);

    const modules = {
        toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{'link': 'link'}]
        ],
    };

    const isDark = colorScheme === 'dark';

    if (!QuillComponent) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', height: 300 }]}>
                <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={{ height: 300, display: 'flex', flexDirection: 'column' }}>
                <style type="text/css">
                    {`
                        .ql-container {
                            border-bottom-left-radius: 5px;
                            border-bottom-right-radius: 5px;
                            background-color: ${Colors[colorScheme].inputBackground};
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            font-size: 16px;
                        }
                        .ql-toolbar {
                            border-top-left-radius: 5px;
                            border-top-right-radius: 5px;
                            background-color: ${Colors[colorScheme].cardBackground};
                            border-color: ${Colors[colorScheme].border} !important;
                        }
                        .ql-container.ql-snow {
                            border-color: ${Colors[colorScheme].border} !important;
                        }
                        .ql-editor {
                            color: ${Colors[colorScheme].text};
                            min-height: 200px;
                        }
                        .ql-editor.ql-blank::before {
                            color: ${Colors[colorScheme].icon};
                            font-style: normal;
                        }
                        ${isDark ? `
                            .ql-snow .ql-stroke { stroke: #ccc; }
                            .ql-snow .ql-fill { fill: #ccc; }
                            .ql-picker { color: #ccc; }
                        ` : ''}
                    `}
                </style>
                
                <QuillComponent 
                    theme="snow"
                    value={initialContent}
                    onChange={onChange}
                    modules={modules}
                    placeholder={placeholder}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 15,
        minHeight: 300, 
    },
});

export default RichTextEditor;