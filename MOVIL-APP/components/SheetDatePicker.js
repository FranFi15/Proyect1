import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    Modal,
    useColorScheme,
    Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { isValid } from 'date-fns';
import { Colors } from '@/constants/Colors';

/**
 * Native-looking date picker in its OWN Modal.
 * Must not be nested inside another Modal on iOS (that freezes the app).
 * Parent screens should hide their Modal while this one is visible.
 */
export default function SheetDatePicker({
    visible,
    value,
    onConfirm,
    onClose,
    title = 'Seleccionar Fecha',
    gymColor,
}) {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];
    const styles = getStyles(colorScheme, gymColor, colors);

    const seed = value instanceof Date && isValid(value) ? value : new Date();
    const [current, setCurrent] = useState(seed);

    useEffect(() => {
        if (!visible) return;
        const next = value instanceof Date && isValid(value) ? value : new Date();
        setCurrent(next);
    }, [visible, value]);

    const handleValueChange = (_event, selectedDate) => {
        if (!(selectedDate instanceof Date) || Number.isNaN(selectedDate.getTime())) return;
        if (Platform.OS === 'android') {
            onConfirm?.(selectedDate);
            onClose?.();
            return;
        }
        setCurrent((prev) => (prev?.getTime() === selectedDate.getTime() ? prev : selectedDate));
    };

    const handleConfirm = () => {
        onConfirm?.(current);
        onClose?.();
    };

    if (Platform.OS === 'android') {
        if (!visible) return null;
        return (
            <DateTimePicker
                value={current}
                mode="date"
                display="default"
                onValueChange={handleValueChange}
                onDismiss={onClose}
            />
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={styles.root}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <Text style={styles.headerAction}>Cancelar</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{title}</Text>
                        <TouchableOpacity onPress={handleConfirm} hitSlop={12}>
                            <Text style={[styles.headerAction, styles.confirm]}>{'Confirmar'}</Text>
                        </TouchableOpacity>
                    </View>
                    <DateTimePicker
                        value={current}
                        mode="date"
                        display="inline"
                        onValueChange={handleValueChange}
                        themeVariant={colorScheme}
                        style={styles.picker}
                    />
                </View>
            </View>
        </Modal>
    );
}

const getStyles = (colorScheme, gymColor, colors) => StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 24,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    headerAction: {
        fontSize: 15,
        color: colors.text,
        minWidth: 78,
    },
    confirm: {
        color: gymColor || '#007bff',
        fontWeight: '700',
        textAlign: 'right',
    },
    // Fixed height avoids the known iOS freeze with DateTimePicker inside Modal
    picker: {
        height: 370,
        alignSelf: 'center',
        width: '100%',
        backgroundColor: colors.background,
    },
});
