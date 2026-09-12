import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    useColorScheme,
    Linking,
    ScrollView,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const OrdenMedicaAdminModal = ({ visible, onClose, client, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);

    if (!client) return null;

    const imageUrl = client.ordenMedicaUrl;
    const fullName = `${client.nombre || ''} ${client.apellido || ''}`.trim() || 'Socio';
    const hasOrder = !!imageUrl;

    const handleOpenInBrowser = () => {
        if (imageUrl) Linking.openURL(imageUrl);
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={[styles.header, { backgroundColor: accent }]}>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.headerKicker}>Orden médica</Text>
                            <Text style={styles.headerTitle} numberOfLines={1}>{fullName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.statusStrip, hasOrder ? styles.statusOk : styles.statusMissing]}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.statusLabel}>Estado del documento</Text>
                            <Text style={[styles.statusValue, { color: hasOrder ? '#1e7e34' : '#a72828' }]}>
                                {hasOrder ? 'Cargada' : 'Sin cargar'}
                            </Text>
                        </View>
                        <View style={[styles.statusChip, hasOrder ? styles.statusChipOk : styles.statusChipMissing]}>
                            <Ionicons
                                name={hasOrder ? 'checkmark-circle' : 'alert-circle'}
                                size={14}
                                color={hasOrder ? '#1e7e34' : '#a72828'}
                            />
                            <Text style={[styles.statusChipText, { color: hasOrder ? '#1e7e34' : '#a72828' }]}>
                                {hasOrder ? 'Disponible' : 'Pendiente'}
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scroll}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.card}>
                            {hasOrder ? (
                                <>
                                    <Text style={styles.cardTitle}>Documento</Text>
                                    <Text style={styles.cardSub}>Vista previa de la orden médica cargada.</Text>
                                    <View style={styles.imageWrap}>
                                        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.primaryBtn, { backgroundColor: accent }]}
                                        onPress={handleOpenInBrowser}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="open-outline" size={18} color="#fff" />
                                        <Text style={styles.primaryBtnText}>Abrir imagen completa</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <View style={styles.emptyWrap}>
                                    <View style={styles.emptyIcon}>
                                        <Ionicons name="document-text-outline" size={36} color="#a72828" />
                                    </View>
                                    <Text style={styles.cardTitle}>Sin orden médica</Text>
                                    <Text style={styles.emptyText}>
                                        Este socio aún no ha cargado una imagen de su orden médica.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    const softCard = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';

    return StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        sheet: {
            width: '100%',
            height: '88%',
            maxHeight: '88%',
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 18,
            paddingHorizontal: 18,
        },
        headerTextWrap: { flex: 1, paddingRight: 10 },
        headerKicker: {
            color: '#fff',
            opacity: 0.8,
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 4,
        },
        headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
        closeBtn: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        statusStrip: {
            marginHorizontal: 14,
            marginTop: 14,
            marginBottom: 4,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
        },
        statusOk: {
            backgroundColor: colorScheme === 'dark' ? '#13251a' : '#eefaf1',
            borderColor: colorScheme === 'dark' ? '#1e7e3466' : '#b7e4c7',
        },
        statusMissing: {
            backgroundColor: colorScheme === 'dark' ? '#2a1515' : '#fdeeee',
            borderColor: colorScheme === 'dark' ? '#a7282866' : '#f1c0c0',
        },
        statusLabel: { fontSize: 12, color: colors.text, opacity: 0.65, fontWeight: '600' },
        statusValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
        statusChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
        },
        statusChipOk: {},
        statusChipMissing: {},
        statusChipText: { fontSize: 12, fontWeight: '700' },
        scroll: { padding: 14, paddingBottom: 36 },
        card: {
            backgroundColor: softCard,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        cardSub: { fontSize: 13, color: colors.text, opacity: 0.6, marginTop: 4, marginBottom: 14 },
        imageWrap: {
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 14,
        },
        image: { width: '100%', height: 320 },
        primaryBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 13,
            borderRadius: 12,
        },
        primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
        emptyWrap: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 8 },
        emptyIcon: {
            width: 68,
            height: 68,
            borderRadius: 34,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colorScheme === 'dark' ? '#2a1515' : '#fdeeee',
            marginBottom: 14,
        },
        emptyText: {
            textAlign: 'center',
            marginTop: 8,
            fontSize: 14,
            lineHeight: 20,
            color: colors.text,
            opacity: 0.65,
        },
    });
};

export default OrdenMedicaAdminModal;
