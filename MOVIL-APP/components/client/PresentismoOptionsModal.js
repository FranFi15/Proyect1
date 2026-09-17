import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
    ActivityIndicator,
    useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import FilterModal from '@/components/FilterModal';

/**
 * Modal to pick presentismo action:
 * - Registrar entrada (pase libre / membresía)
 * - Presentismo on already enrolled class
 * - Enroll with credit/pase + auto presentismo
 */
const PresentismoOptionsModal = ({
    visible,
    onClose,
    options = [],
    message,
    onSelect,
    gymColor,
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const { gymColor: authColor } = useAuth();
    const accent = gymColor || authColor || '#007bff';
    const styles = getStyles(colorScheme, accent);
    const [submittingId, setSubmittingId] = useState(null);
    const [selectedTypeId, setSelectedTypeId] = useState('all');
    const [selectedSucursalId, setSelectedSucursalId] = useState('all');
    const [activeFilter, setActiveFilter] = useState(null); // 'type' | 'sede' | null

    useEffect(() => {
        if (!visible) {
            setSelectedTypeId('all');
            setSelectedSucursalId('all');
            setActiveFilter(null);
            setSubmittingId(null);
        }
    }, [visible]);

    const classOptions = useMemo(
        () => options.filter((opt) => opt.type === 'clase' || opt.type === 'enroll_clase'),
        [options]
    );

    const otherOptions = useMemo(
        () => options.filter((opt) => opt.type !== 'clase' && opt.type !== 'enroll_clase'),
        [options]
    );

    const typeFilterOptions = useMemo(() => {
        const map = new Map();
        classOptions.forEach((opt) => {
            const id = opt.tipoClaseId || opt.tipoClaseNombre || 'unknown';
            if (!map.has(id)) {
                map.set(id, {
                    _id: id,
                    nombre: opt.tipoClaseNombre || opt.nombre || 'Turno',
                });
            }
        });
        return [{ _id: 'all', nombre: 'Todos los tipos' }, ...Array.from(map.values())];
    }, [classOptions]);

    const sedeFilterOptions = useMemo(() => {
        const map = new Map();
        classOptions.forEach((opt) => {
            const id = opt.sucursalId || 'none';
            if (!map.has(id)) {
                map.set(id, {
                    _id: id,
                    nombre: opt.sucursalNombre || 'Sin sede',
                });
            }
        });
        return [{ _id: 'all', nombre: 'Todas las sedes' }, ...Array.from(map.values())];
    }, [classOptions]);

    const filteredClassOptions = useMemo(() => {
        return classOptions.filter((opt) => {
            const typeId = opt.tipoClaseId || opt.tipoClaseNombre || 'unknown';
            const sedeId = opt.sucursalId || 'none';
            const typeOk = selectedTypeId === 'all' || typeId === selectedTypeId;
            const sedeOk = selectedSucursalId === 'all' || sedeId === selectedSucursalId;
            return typeOk && sedeOk;
        });
    }, [classOptions, selectedTypeId, selectedSucursalId]);

    const visibleOptions = useMemo(
        () => [...otherOptions, ...filteredClassOptions],
        [otherOptions, filteredClassOptions]
    );

    const showFilters = classOptions.length > 1;
    const selectedTypeLabel =
        typeFilterOptions.find((o) => o._id === selectedTypeId)?.nombre || 'Todos los tipos';
    const selectedSedeLabel =
        sedeFilterOptions.find((o) => o._id === selectedSucursalId)?.nombre || 'Todas las sedes';

    const handleSelect = async (option) => {
        if (submittingId) return;
        setSubmittingId(option.id);
        try {
            await onSelect(option);
        } finally {
            setSubmittingId(null);
        }
    };

    const iconForType = (type) => {
        if (type === 'membresia') return 'enter-outline';
        if (type === 'enroll_clase') return 'add-circle-outline';
        return 'checkmark-circle-outline';
    };

    const activeFilterConfig =
        activeFilter === 'type'
            ? {
                  title: 'Tipo de turno',
                  options: typeFilterOptions,
                  selectedValue: selectedTypeId,
                  onSelect: (id) => {
                      setSelectedTypeId(id);
                      setActiveFilter(null);
                  },
              }
            : activeFilter === 'sede'
              ? {
                    title: 'Sede',
                    options: sedeFilterOptions,
                    selectedValue: selectedSucursalId,
                    onSelect: (id) => {
                        setSelectedSucursalId(id);
                        setActiveFilter(null);
                    },
                }
              : null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Presentismo</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={10} disabled={!!submittingId}>
                            <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.message}>
                        {message || 'Elegí cómo querés registrar tu ingreso.'}
                    </Text>

                    {showFilters && (
                        <View style={styles.filtersRow}>
                            <TouchableOpacity
                                style={styles.filterChip}
                                onPress={() => setActiveFilter('type')}
                                disabled={!!submittingId}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="pricetag-outline" size={14} color={accent} />
                                <Text style={styles.filterChipText} numberOfLines={1}>
                                    {selectedTypeLabel}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color={Colors[colorScheme].icon} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.filterChip}
                                onPress={() => setActiveFilter('sede')}
                                disabled={!!submittingId}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="location-outline" size={14} color={accent} />
                                <Text style={styles.filterChipText} numberOfLines={1}>
                                    {selectedSedeLabel}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color={Colors[colorScheme].icon} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <ScrollView
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {visibleOptions.length === 0 ? (
                            <View style={styles.emptyWrap}>
                                <Ionicons name="search-outline" size={28} color={Colors[colorScheme].icon} />
                                <Text style={styles.emptyText}>
                                    No hay turnos con ese filtro. Probá otro tipo o sede.
                                </Text>
                            </View>
                        ) : (
                            visibleOptions.map((opt) => {
                                const busy = submittingId === opt.id;
                                return (
                                    <TouchableOpacity
                                        key={`${opt.type}-${opt.id}`}
                                        style={[
                                            styles.option,
                                            opt.type === 'membresia' && styles.optionAccent,
                                            opt.type === 'enroll_clase' && styles.optionEnroll,
                                        ]}
                                        onPress={() => handleSelect(opt)}
                                        disabled={!!submittingId}
                                        activeOpacity={0.85}
                                    >
                                        <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
                                            {busy ? (
                                                <ActivityIndicator size="small" color={accent} />
                                            ) : (
                                                <Ionicons
                                                    name={iconForType(opt.type)}
                                                    size={22}
                                                    color={accent}
                                                />
                                            )}
                                        </View>
                                        <View style={styles.optionTextWrap}>
                                            <Text style={styles.optionTitle} numberOfLines={2}>
                                                {opt.nombre}
                                            </Text>
                                            <Text style={styles.optionMeta}>{opt.horario}</Text>
                                            {(opt.tipoClaseNombre || opt.sucursalNombre) && (
                                                <Text style={styles.optionSub} numberOfLines={1}>
                                                    {[opt.tipoClaseNombre, opt.sucursalNombre]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </Text>
                                            )}
                                            {!!opt.subtitle && (
                                                <Text style={styles.optionSub}>{opt.subtitle}</Text>
                                            )}
                                            {opt.cupos != null && (
                                                <Text style={styles.optionSub}>Cupos: {opt.cupos}</Text>
                                            )}
                                        </View>
                                        <Text style={[styles.actionHint, { color: accent }]}>
                                            {opt.actionLabel || 'Elegir'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={onClose}
                        disabled={!!submittingId}
                    >
                        <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>

                {activeFilterConfig && (
                    <FilterModal
                        embedded
                        visible
                        onClose={() => setActiveFilter(null)}
                        onSelect={activeFilterConfig.onSelect}
                        title={activeFilterConfig.title}
                        options={activeFilterConfig.options}
                        selectedValue={activeFilterConfig.selectedValue}
                        theme={{ colors: Colors[colorScheme], gymColor: accent }}
                    />
                )}
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, accent) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    card: {
        width: '100%',
        maxWidth: 440,
        maxHeight: '85%',
        backgroundColor: Colors[colorScheme].cardBackground || Colors[colorScheme].background,
        borderRadius: 16,
        padding: 18,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
    },
    message: {
        fontSize: 14,
        color: Colors[colorScheme].text,
        opacity: 0.75,
        marginBottom: 12,
        lineHeight: 20,
    },
    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    filterChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors[colorScheme].border,
        backgroundColor: colorScheme === 'dark' ? '#1c1f20' : '#f4f6f7',
    },
    filterChipText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        color: Colors[colorScheme].text,
    },
    list: {
        maxHeight: 360,
    },
    listContent: {
        gap: 10,
        paddingBottom: 8,
    },
    emptyWrap: {
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 12,
        gap: 8,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 18,
        color: Colors[colorScheme].text,
        opacity: 0.65,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f2f5',
        gap: 10,
    },
    optionAccent: {
        borderWidth: 1.5,
        borderColor: accent,
    },
    optionEnroll: {
        borderWidth: 1.5,
        borderColor: accent + '99',
        backgroundColor: colorScheme === 'dark' ? '#1c2a33' : '#eef6fb',
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors[colorScheme].text,
    },
    optionMeta: {
        fontSize: 13,
        color: Colors[colorScheme].text,
        opacity: 0.8,
        marginTop: 2,
    },
    optionSub: {
        fontSize: 12,
        color: Colors[colorScheme].text,
        opacity: 0.6,
        marginTop: 2,
    },
    actionHint: {
        fontSize: 11,
        fontWeight: '700',
        maxWidth: 72,
        textAlign: 'right',
    },
    cancelBtn: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: colorScheme === 'dark' ? '#3a3a3c' : '#e8e8ed',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors[colorScheme].text,
    },
});

export default PresentismoOptionsModal;
