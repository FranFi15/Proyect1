import React, { useCallback, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Platform, Keyboard, useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isValid, startOfMonth, subDays } from 'date-fns';
import { Colors } from '@/constants/Colors';
import SheetDatePicker from '@/components/SheetDatePicker';
import WebDatePicker from '@/components/WebDatePicker';

export const RANGE_PRESETS = [
    { id: 'today', label: 'Hoy' },
    { id: 'week', label: '7 días' },
    { id: 'month', label: 'Mes' },
    { id: 'custom', label: 'Personalizado' },
];

const toYmd = (d) => format(d, 'yyyy-MM-dd');

export function useStatsPeriod() {
    const [rangePreset, setRangePreset] = useState('month');
    const [fromDate, setFromDate] = useState(() => toYmd(startOfMonth(new Date())));
    const [toDate, setToDate] = useState(() => toYmd(new Date()));
    const [datePicker, setDatePicker] = useState({
        visible: false,
        field: null,
        currentValue: new Date(),
    });
    const callbackRef = useRef(null);

    const closeDatePicker = useCallback(() => {
        setDatePicker((prev) => ({ ...prev, visible: false }));
        callbackRef.current = null;
    }, []);

    const showDatePickerFor = useCallback((field, initialDateString, onChangeCallback) => {
        Keyboard.dismiss();
        let initialDate = new Date();
        if (initialDateString) {
            const parsed = parseISO(initialDateString);
            if (isValid(parsed)) initialDate = parsed;
        }
        callbackRef.current = onChangeCallback;
        setDatePicker({ visible: true, field, currentValue: initialDate });
    }, []);

    const confirmSheetDate = useCallback((date) => {
        const cb = callbackRef.current;
        closeDatePicker();
        if (date instanceof Date && isValid(date)) {
            cb?.(format(date, 'yyyy-MM-dd'));
        }
    }, [closeDatePicker]);

    const applyRangePreset = (presetId) => {
        setRangePreset(presetId);
        const today = new Date();
        if (presetId === 'today') {
            setFromDate(toYmd(today));
            setToDate(toYmd(today));
        } else if (presetId === 'week') {
            setFromDate(toYmd(subDays(today, 6)));
            setToDate(toYmd(today));
        } else if (presetId === 'month') {
            setFromDate(toYmd(startOfMonth(today)));
            setToDate(toYmd(today));
        }
    };

    const setCustomFrom = (value) => {
        setFromDate(value);
        setRangePreset('custom');
    };

    const setCustomTo = (value) => {
        setToDate(value);
        setRangePreset('custom');
    };

    return {
        rangePreset,
        fromDate,
        toDate,
        datePicker,
        applyRangePreset,
        setCustomFrom,
        setCustomTo,
        showDatePickerFor,
        confirmSheetDate,
        closeDatePicker,
    };
}

export function statsModalVisible(visible, period) {
    return !!visible && !(period.datePicker.visible && Platform.OS !== 'web');
}

export function StatsPeriodPicker({ period, gymColor }) {
    return (
        <SheetDatePicker
            visible={period.datePicker.visible && Platform.OS !== 'web'}
            value={period.datePicker.currentValue}
            title={period.datePicker.field ? `Seleccionar ${period.datePicker.field}` : 'Seleccionar fecha'}
            gymColor={gymColor}
            onConfirm={period.confirmSheetDate}
            onClose={period.closeDatePicker}
        />
    );
}

export default function StatsPeriodBar({ period, gymColor }) {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];
    const styles = getStyles(colorScheme);
    const accent = gymColor || '#1a5276';

    const renderDateField = (label, value, onChange) => {
        let displayValue = label;
        if (value) {
            const parsed = parseISO(value);
            displayValue = isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : value;
        }
        if (Platform.OS === 'web') {
            return (
                <View style={[styles.dateFieldContainer, { flex: 1 }]}>
                    <Text style={styles.dateFieldLabel}>{label}</Text>
                    <WebDatePicker
                        selected={value && isValid(parseISO(value)) ? parseISO(value) : null}
                        onChange={(date) => {
                            if (date instanceof Date && isValid(date)) {
                                onChange(format(date, 'yyyy-MM-dd'));
                            }
                        }}
                        dateFormat="dd/MM/yyyy"
                        popperPlacement="top-start"
                        customInput={
                            <TouchableOpacity style={styles.dateInputTouchable}>
                                <Text style={styles.dateInputText}>{displayValue}</Text>
                            </TouchableOpacity>
                        }
                    />
                </View>
            );
        }
        return (
            <View style={[styles.dateFieldContainer, { flex: 1 }]}>
                <Text style={styles.dateFieldLabel}>{label}</Text>
                <TouchableOpacity
                    onPress={() => period.showDatePickerFor(label, value, onChange)}
                    style={styles.dateInputTouchable}
                >
                    <View style={styles.dateInputRow}>
                        <Text style={styles.dateInputText}>{displayValue}</Text>
                        <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const fromParsed = parseISO(period.fromDate);
    const toParsed = parseISO(period.toDate);
    const fromLabel = isValid(fromParsed) ? format(fromParsed, 'dd/MM/yyyy') : period.fromDate;
    const toLabel = isValid(toParsed) ? format(toParsed, 'dd/MM/yyyy') : period.toDate;

    return (
        <View style={styles.wrap}>
            <Text style={styles.sectionTitle}>Período</Text>
            <View style={styles.rowWrap}>
                {RANGE_PRESETS.map((preset) => (
                    <TouchableOpacity
                        key={preset.id}
                        style={[styles.filterPill, period.rangePreset === preset.id && { backgroundColor: accent, borderColor: accent }]}
                        onPress={() => period.applyRangePreset(preset.id)}
                    >
                        <Text style={[styles.filterPillText, period.rangePreset === preset.id && { color: '#fff' }]}>
                            {preset.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            {period.rangePreset === 'custom' && (
                <View style={styles.dateRow}>
                    {renderDateField('Desde', period.fromDate, period.setCustomFrom)}
                    {renderDateField('Hasta', period.toDate, period.setCustomTo)}
                </View>
            )}
            <Text style={styles.rangeHint}>{fromLabel} → {toLabel}</Text>
        </View>
    );
}

const getStyles = (colorScheme) => {
    const colors = Colors[colorScheme];
    return StyleSheet.create({
        wrap: { marginBottom: 14 },
        sectionTitle: {
            fontSize: 13,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 8,
        },
        rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
        filterPill: {
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            backgroundColor: colors.cardBackground || colors.background,
            marginRight: 6,
            marginBottom: 6,
        },
        filterPillText: { fontWeight: '700', fontSize: 12, color: colors.text },
        dateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
        dateFieldContainer: { marginBottom: 2 },
        dateFieldLabel: { fontSize: 12, fontWeight: '600', color: colors.icon, marginBottom: 6 },
        dateInputTouchable: {
            borderWidth: 1,
            borderColor: colors.border || '#ddd',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            backgroundColor: colors.cardBackground || colors.background,
            minHeight: 46,
            justifyContent: 'center',
        },
        dateInputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
        dateInputText: { fontSize: 15, color: colors.text, fontWeight: '600' },
        rangeHint: { fontSize: 12, color: colors.icon, marginTop: 2 },
    });
};
