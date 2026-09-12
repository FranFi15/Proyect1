import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export const formatClassTeachers = (clase) => {
    if (!clase) return 'Sin profesor';
    if (Array.isArray(clase.profesores) && clase.profesores.length > 0) {
        const names = clase.profesores
            .map((p) => (p ? `${p.nombre || ''} ${p.apellido || ''}`.trim() : ''))
            .filter(Boolean);
        if (names.length) return names.join(', ');
    }
    if (clase.profesor?.nombre) {
        return `${clase.profesor.nombre} ${clase.profesor.apellido || ''}`.trim();
    }
    return 'Sin profesor';
};

export const getOccupancyTone = (clase) => {
    if (clase?.estado === 'cancelada') return 'cancelled';
    const capacity = Number(clase?.capacidad) || 0;
    const enrolled = (clase?.usuariosInscritos || []).length;
    if (capacity <= 0) return 'neutral';
    const fill = enrolled / capacity;
    if (fill >= 1) return 'full';
    if (fill >= 0.8) return 'hot';
    if (fill >= 0.4) return 'warm';
    return 'open';
};

const TONE_COLOR = {
    cancelled: '#8e8e93',
    full: '#F44336',
    hot: '#ff7707',
    warm: '#FFC107',
    open: '#2ecc71',
    neutral: '#8e8e93',
};

export const ClassCardAction = ({ title, onPress, color, iconName, iconColor = '#fff' }) => (
    <TouchableOpacity
        style={[stylesAction.btn, { backgroundColor: color }]}
        onPress={onPress}
        activeOpacity={0.85}
    >
        {!!iconName && <FontAwesome5 name={iconName} size={14} color={iconColor} />}
        <Text style={[stylesAction.text, { color: iconColor }]}>{title}</Text>
    </TouchableOpacity>
);

const stylesAction = StyleSheet.create({
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    text: {
        fontWeight: '800',
        fontSize: 13,
    },
});

/**
 * Shared class/turno card used by client, admin and profesor screens.
 */
const ClassCard = ({
    item,
    gymColor,
    muted = false,
    badges = null,
    footer = null,
    onPress = null,
    rightAccessory = null,
    showCapacity = true,
    showTeachers = true,
    showLocation = true,
    showTime = true,
    extraMeta = null,
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];
    const accent = gymColor || '#1a5276';
    const tone = getOccupancyTone(item);
    const toneColor = TONE_COLOR[tone] || accent;
    const styles = getStyles(colorScheme, accent, toneColor, muted);

    const title = item?.nombre || 'Turno';
    const typeName = item?.tipoClase?.nombre || '';
    const enrolled = (item?.usuariosInscritos || []).length;
    const capacity = item?.capacidad ?? 0;
    const teachers = formatClassTeachers(item);
    const rating = item?.profesores?.[0]?.ratingAverage;
    const timeLabel = item?.horaInicio && item?.horaFin
        ? `${item.horaInicio} – ${item.horaFin}`
        : (item?.horaInicio || '');

    const Header = (
        <>
            <View style={styles.topRow}>
                {showTime && !!timeLabel && (
                    <View style={styles.timePill}>
                        <Ionicons name="time-outline" size={14} color={accent} />
                        <Text style={styles.timeText}>{timeLabel}</Text>
                    </View>
                )}
                <View style={styles.badgeRow}>
                    {!!typeName && (
                        <View style={styles.typePill}>
                            <Text style={styles.typeText} numberOfLines={1}>{typeName}</Text>
                        </View>
                    )}
                    {badges}
                </View>
                {rightAccessory}
            </View>

            <Text style={styles.title} numberOfLines={2}>{title}</Text>

            <View style={styles.metaBlock}>
                {showLocation && !!item?.sucursal?.nombre && (
                    <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={14} color={colors.text} style={styles.metaIcon} />
                        <Text style={styles.metaText} numberOfLines={1}>{item.sucursal.nombre}</Text>
                    </View>
                )}
                {showTeachers && (
                    <View style={styles.metaRow}>
                        <Ionicons name="person-outline" size={14} color={colors.text} style={styles.metaIcon} />
                        <Text style={styles.metaText} numberOfLines={1}>{teachers}</Text>
                        {Number(rating) > 0 && (
                            <View style={styles.ratingWrap}>
                                <Ionicons name="star" size={12} color="#FFD700" />
                                <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
                            </View>
                        )}
                    </View>
                )}
                {showCapacity && (
                    <View style={styles.metaRow}>
                        <Ionicons name="people-outline" size={14} color={colors.text} style={styles.metaIcon} />
                        <Text style={styles.metaText}>
                            {enrolled}/{capacity} inscritos
                        </Text>
                        <View style={[styles.dot, { backgroundColor: toneColor }]} />
                        <Text style={[styles.toneLabel, { color: toneColor }]}>
                            {tone === 'cancelled' ? 'Cancelada'
                                : tone === 'full' ? 'Completo'
                                    : tone === 'hot' ? 'Casi lleno'
                                        : tone === 'open' ? 'Disponible'
                                            : 'Cupos'}
                        </Text>
                    </View>
                )}
                {extraMeta}
            </View>
        </>
    );

    return (
        <View style={styles.card}>
            <View style={styles.accentBar} />
            <View style={styles.content}>
                {onPress ? (
                    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
                        {Header}
                    </TouchableOpacity>
                ) : (
                    Header
                )}
                {!!footer && <View style={styles.footer}>{footer}</View>}
            </View>
        </View>
    );
};

const getStyles = (colorScheme, accent, toneColor, muted) => {
    const colors = Colors[colorScheme];
    const soft = colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7';
    return StyleSheet.create({
        card: {
            flexDirection: 'row',
            marginHorizontal: 16,
            marginVertical: 7,
            borderRadius: 16,
            backgroundColor: soft,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            opacity: muted ? 0.62 : 1,
        },
        accentBar: {
            width: 5,
            backgroundColor: toneColor,
        },
        content: {
            flex: 1,
            paddingVertical: 14,
            paddingHorizontal: 14,
        },
        topRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            flexWrap: 'wrap',
        },
        timePill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: accent + '18',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
        },
        timeText: {
            fontSize: 12,
            fontWeight: '800',
            color: accent,
        },
        badgeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            flexWrap: 'wrap',
        },
        typePill: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
            maxWidth: '70%',
        },
        typeText: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.text,
            opacity: 0.75,
        },
        title: {
            fontSize: 17,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 8,
        },
        metaBlock: {
            gap: 5,
        },
        metaRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        metaIcon: {
            opacity: 0.55,
            marginRight: 6,
        },
        metaText: {
            flexShrink: 1,
            fontSize: 13,
            color: colors.text,
            opacity: 0.72,
            fontWeight: '500',
        },
        ratingWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 8,
            gap: 3,
        },
        ratingText: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.text,
        },
        dot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            marginLeft: 8,
            marginRight: 5,
        },
        toneLabel: {
            fontSize: 11,
            fontWeight: '800',
        },
        footer: {
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
    });
};

export default ClassCard;
