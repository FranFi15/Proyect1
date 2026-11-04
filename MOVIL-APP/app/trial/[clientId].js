import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    useColorScheme,
    Platform,
    KeyboardAvoidingView,
    Image,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    SlideInRight,
    SlideOutRight,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import ClassCard, { ClassCardAction } from '@/components/ClassCard';
import FilterModal from '@/components/FilterModal';
import { useEntranceEpoch } from '@/hooks/useEntranceEpoch';
import config from '../../config';

const apiBase = String(config.gymAppBackend || '').replace(/\/$/, '');

LocaleConfig.locales.es = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
    today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

const paramValue = (value) => (Array.isArray(value) ? value[0] : value);

const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    return str
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(' De ', ' de ');
};

const DEFAULT_GYM = {
    name: 'Gimnasio',
    logoUrl: '',
    primaryColor: '#1a5276',
};

const TrialEnrollmentScreen = () => {
    const params = useLocalSearchParams();
    const clientId = paramValue(params.clientId);
    const token = paramValue(params.t) || paramValue(params.token);
    const colorScheme = useColorScheme() ?? 'light';

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [classes, setClasses] = useState([]);
    const [gym, setGym] = useState(DEFAULT_GYM);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedClassType, setSelectedClassType] = useState('all');
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [step, setStep] = useState('calendar'); // calendar | form | success
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState({
        nombre: '',
        apellido: '',
        dni: '',
        numeroTelefono: '',
        email: '',
    });

    const gymColor = gym.primaryColor || DEFAULT_GYM.primaryColor;
    const styles = useMemo(() => getStyles(colorScheme, gymColor), [colorScheme, gymColor]);
    const calendarTheme = useMemo(() => getCalendarTheme(colorScheme, gymColor), [colorScheme, gymColor]);
    const listEntranceEpoch = useEntranceEpoch('trial', selectedDate, selectedClassType, step);

    const loadPage = useCallback(async () => {
        if (!clientId || !token) {
            setError('Link incompleto. Pedile al gimnasio un link válido.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (token === 'preview') {
                const mockGym = {
                    name: 'Studio Demo',
                    logoUrl: '',
                    primaryColor: '#c0392b',
                };
                const mock = [
                    {
                        _id: '1',
                        nombre: 'Funcional',
                        tipoClase: { _id: 'tipo-funcional', nombre: 'Funcional' },
                        fecha: '2026-11-05',
                        horaInicio: '09:00',
                        horaFin: '10:00',
                        capacidad: 12,
                        usuariosInscritos: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
                        cupos: 4,
                        sucursal: { nombre: 'Centro' },
                        profesores: [{ nombre: 'Ana', apellido: 'López', ratingAverage: 4.8 }],
                        estado: 'activa',
                    },
                    {
                        _id: '2',
                        nombre: 'Cross',
                        tipoClase: { _id: 'tipo-cross', nombre: 'Cross' },
                        fecha: '2026-11-05',
                        horaInicio: '18:30',
                        horaFin: '19:30',
                        capacidad: 10,
                        usuariosInscritos: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
                        cupos: 2,
                        sucursal: { nombre: 'Norte' },
                        profesores: [{ nombre: 'Marcos', apellido: 'Ruiz' }],
                        estado: 'activa',
                    },
                    {
                        _id: '3',
                        nombre: 'Yoga',
                        tipoClase: { _id: 'tipo-yoga', nombre: 'Yoga' },
                        fecha: '2026-11-06',
                        horaInicio: '10:00',
                        horaFin: '11:00',
                        capacidad: 15,
                        usuariosInscritos: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
                        cupos: 8,
                        sucursal: null,
                        profesores: [{ nombre: 'Lucía', apellido: 'Díaz', ratingAverage: 5 }],
                        estado: 'activa',
                    },
                ];
                setGym(mockGym);
                setClasses(mock);
                setSelectedDate('2026-11-05');
                return;
            }

            const res = await fetch(`${apiBase}/public/trial/${encodeURIComponent(clientId)}?t=${encodeURIComponent(token)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo cargar la clase de prueba.');
            setGym({
                name: data.gym?.name || DEFAULT_GYM.name,
                logoUrl: data.gym?.logoUrl || '',
                primaryColor: data.gym?.primaryColor || DEFAULT_GYM.primaryColor,
            });
            setClasses(data.classes || []);
            const firstDate = (data.classes || [])[0]?.fecha;
            if (firstDate) setSelectedDate(String(firstDate).substring(0, 10));
        } catch (err) {
            setError(err.message || 'No se pudo cargar la clase de prueba.');
            setClasses([]);
        } finally {
            setLoading(false);
        }
    }, [clientId, token]);

    useEffect(() => {
        loadPage();
    }, [loadPage]);

    const classTypes = useMemo(() => {
        const map = new Map();
        classes.forEach((cls) => {
            const id = cls.tipoClase?._id || cls.tipoClase?.nombre;
            const nombre = cls.tipoClase?.nombre;
            if (id && nombre && !map.has(String(id))) {
                map.set(String(id), { _id: String(id), nombre });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }, [classes]);

    const matchesTypeFilter = useCallback((cls) => {
        if (selectedClassType === 'all') return true;
        const typeId = String(cls.tipoClase?._id || cls.tipoClase?.nombre || '');
        return typeId === String(selectedClassType);
    }, [selectedClassType]);

    const filteredClasses = useMemo(
        () => classes.filter(matchesTypeFilter),
        [classes, matchesTypeFilter]
    );

    const markedDates = useMemo(() => {
        const markers = {};
        filteredClasses.forEach((cls) => {
            if (!cls.fecha) return;
            const dateString = String(cls.fecha).substring(0, 10);
            if (!markers[dateString]) {
                markers[dateString] = {
                    marked: true,
                    dotColor: gymColor,
                    customStyles: {
                        container: {
                            backgroundColor: colorScheme === 'dark' ? '#333' : '#e9ecef',
                            borderRadius: 10,
                        },
                    },
                };
            }
        });
        if (selectedDate) {
            markers[selectedDate] = {
                ...(markers[selectedDate] || {}),
                selected: true,
                selectedColor: gymColor,
                marked: !!markers[selectedDate]?.marked,
                dotColor: '#fff',
            };
        }
        return markers;
    }, [filteredClasses, selectedDate, gymColor, colorScheme]);

    const dayClasses = useMemo(() => {
        if (!selectedDate) return [];
        return filteredClasses
            .filter((cls) => String(cls.fecha).substring(0, 10) === selectedDate)
            .map((cls) => ({
                ...cls,
                isFull: (cls.usuariosInscritos || []).length >= (cls.capacidad || 0) || cls.cupos === 0,
            }))
            .sort((a, b) => String(a.horaInicio || '').localeCompare(String(b.horaInicio || '')));
    }, [filteredClasses, selectedDate]);

    const selectedTypeLabel = selectedClassType === 'all'
        ? 'Turnos: Todos'
        : (classTypes.find((t) => t._id === selectedClassType)?.nombre || 'Filtrar');

    const formattedDateTitle = useMemo(() => {
        if (!selectedDate) return 'Elegí un día con turnos';
        try {
            const date = parseISO(selectedDate);
            if (!isValid(date)) return 'Turnos';
            return capitalize(format(date, "EEEE, d 'de' MMMM", { locale: es }));
        } catch (e) {
            return 'Turnos';
        }
    }, [selectedDate]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSelectClass = (cls) => {
        if (cls.isFull) return;
        setSelectedClass(cls);
        setStep('form');
        setError('');
        setSuccess('');
    };

    const handleBackToCalendar = () => {
        setStep('calendar');
        setSelectedClass(null);
        setError('');
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        if (!form.nombre.trim() || !form.apellido.trim() || !form.dni.trim() || !form.numeroTelefono.trim() || !form.email.trim()) {
            setError('Completá todos los campos.');
            return;
        }
        if (!selectedClass?._id) {
            setError('Elegí un turno.');
            return;
        }
        if (token === 'preview') {
            setSuccess(`Vista previa: quedarías anotado/a a ${selectedClass.nombre}.`);
            setStep('success');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/public/trial/${encodeURIComponent(clientId)}/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    ...form,
                    classId: selectedClass._id,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo completar la inscripción.');
            setSuccess(data.message || 'Inscripción realizada.');
            setForm({ nombre: '', apellido: '', dni: '', numeroTelefono: '', email: '' });
            setStep('success');
            await loadPage();
        } catch (err) {
            setError(err.message || 'No se pudo completar la inscripción.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={gymColor} />
                <Text style={styles.muted}>Cargando turnos...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.screen}>
                <Animated.View
                    entering={FadeInDown.duration(320)}
                    style={[styles.brandHeader, { backgroundColor: gymColor }]}
                >
                    {!!gym.logoUrl ? (
                        <Image source={{ uri: gym.logoUrl }} style={styles.logo} resizeMode="contain" />
                    ) : (
                        <View style={styles.logoFallback}>
                            <Ionicons name="barbell-outline" size={28} color="#fff" />
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.brandName} numberOfLines={1}>{gym.name}</Text>
                        <Text style={styles.brandSub}>Clase de prueba</Text>
                    </View>
                </Animated.View>

                {!!error && step !== 'form' && (
                    <Animated.View entering={FadeIn.duration(220)} style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={18} color="#a72828" />
                        <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                )}

                {step === 'calendar' && (
                    <Animated.View
                        key="step-calendar"
                        entering={FadeIn.duration(320)}
                        exiting={FadeOut.duration(180)}
                        style={{ flex: 1 }}
                    >
                        <FlatList
                            key={`day-${selectedDate || 'none'}-${selectedClassType}`}
                            data={dayClasses}
                            keyExtractor={(item) => String(item._id)}
                            ListHeaderComponent={
                                <Animated.View entering={FadeInUp.delay(80).duration(360)}>
                                    <Calendar
                                        onDayPress={(day) => setSelectedDate(day.dateString)}
                                        markedDates={markedDates}
                                        markingType="custom"
                                        theme={calendarTheme}
                                    />
                                    <Text style={styles.listHeader}>{formattedDateTitle}</Text>
                                    {classTypes.length > 1 && (
                                        <TouchableOpacity
                                            style={styles.filterButton}
                                            onPress={() => setFilterModalVisible(true)}
                                            activeOpacity={0.85}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                                                <Ionicons name="pricetag-outline" size={14} color={Colors[colorScheme].text} style={{ marginRight: 6 }} />
                                                <Text style={styles.filterButtonText} numberOfLines={1}>
                                                    {selectedTypeLabel}
                                                </Text>
                                            </View>
                                            <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                                        </TouchableOpacity>
                                    )}
                                    <Text style={styles.helper}>
                                        Tocá un día con punto para ver los turnos y anotarte una sola vez.
                                    </Text>
                                </Animated.View>
                            }
                            renderItem={({ item, index }) => (
                                <ClassCard
                                    item={item}
                                    gymColor={gymColor}
                                    muted={item.isFull}
                                    animationIndex={index}
                                    entranceEpoch={listEntranceEpoch}
                                    footer={
                                        item.isFull ? (
                                            <Text style={styles.fullLabel}>Sin cupos</Text>
                                        ) : (
                                            <ClassCardAction
                                                title="Probar esta clase"
                                                onPress={() => handleSelectClass(item)}
                                                iconName="calendar-check"
                                                color={gymColor}
                                            />
                                        )
                                    }
                                />
                            )}
                            ListEmptyComponent={
                                <Animated.View entering={FadeIn.delay(120).duration(280)}>
                                    <Text style={styles.emptyText}>
                                        {selectedDate
                                            ? (selectedClassType === 'all'
                                                ? 'No hay turnos para este día.'
                                                : 'No hay turnos de ese tipo para este día.')
                                            : 'Elegí un día en el calendario.'}
                                    </Text>
                                </Animated.View>
                            }
                            contentContainerStyle={{ paddingBottom: 40 }}
                        />
                    </Animated.View>
                )}

                <FilterModal
                    visible={isFilterModalVisible}
                    onClose={() => setFilterModalVisible(false)}
                    options={[{ _id: 'all', nombre: 'Todos los Turnos' }, ...classTypes]}
                    onSelect={(id) => {
                        setSelectedClassType(id);
                        setFilterModalVisible(false);
                    }}
                    selectedValue={selectedClassType}
                    title="Tipo de Turno"
                    gymColor={gymColor}
                    theme={{ colors: Colors[colorScheme], gymColor }}
                />

                {step === 'form' && (
                    <Animated.View
                        key="step-form"
                        entering={SlideInRight.duration(280)}
                        exiting={SlideOutRight.duration(200)}
                        style={{ flex: 1 }}
                    >
                        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
                            <TouchableOpacity style={styles.backRow} onPress={handleBackToCalendar}>
                                <Ionicons name="arrow-back" size={20} color={gymColor} />
                                <Text style={[styles.backText, { color: gymColor }]}>Volver al calendario</Text>
                            </TouchableOpacity>

                            {!!selectedClass && (
                                <ClassCard
                                    item={selectedClass}
                                    gymColor={gymColor}
                                    showTeachers={false}
                                    animationIndex={0}
                                    entranceEpoch={`${listEntranceEpoch}-form`}
                                />
                            )}

                            <Animated.View entering={FadeInUp.delay(80).duration(300)}>
                                <Text style={styles.formTitle}>Tus datos</Text>
                                <Text style={styles.helper}>
                                    Solo una inscripción por DNI o email. Si ya estás registrado en la app, anotate desde ahí.
                                </Text>
                            </Animated.View>

                            {!!error && (
                                <Animated.View entering={FadeIn.duration(220)} style={styles.errorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#a72828" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </Animated.View>
                            )}

                            {[
                                { key: 'nombre', label: 'Nombre', props: {} },
                                { key: 'apellido', label: 'Apellido', props: {} },
                                { key: 'dni', label: 'DNI', props: { keyboardType: 'number-pad' } },
                                { key: 'numeroTelefono', label: 'Teléfono', props: { keyboardType: 'phone-pad' } },
                                { key: 'email', label: 'Email', props: { keyboardType: 'email-address', autoCapitalize: 'none' } },
                            ].map((field, index) => (
                                <Animated.View
                                    key={field.key}
                                    entering={FadeInUp.delay(100 + index * 45).duration(280)}
                                    style={styles.field}
                                >
                                    <Text style={styles.label}>{field.label}</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={form[field.key]}
                                        onChangeText={(text) => setField(field.key, text)}
                                        placeholderTextColor="#999"
                                        {...field.props}
                                    />
                                </Animated.View>
                            ))}

                            <Animated.View entering={FadeInUp.delay(340).duration(300)}>
                                <TouchableOpacity
                                    style={[styles.submitBtn, { backgroundColor: gymColor }, submitting && { opacity: 0.6 }]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.submitText}>Anotarme a la clase de prueba</Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        </ScrollView>
                    </Animated.View>
                )}

                {step === 'success' && (
                    <Animated.View
                        key="step-success"
                        entering={ZoomIn.duration(280)}
                        exiting={ZoomOut.duration(180)}
                        style={styles.successWrap}
                    >
                        <Animated.View entering={ZoomIn.delay(80).duration(240)}>
                            <Ionicons name="checkmark-circle" size={56} color={gymColor} />
                        </Animated.View>
                        <Text style={styles.successTitle}>¡Listo!</Text>
                        <Text style={styles.successBody}>{success}</Text>
                        <TouchableOpacity
                            style={[styles.submitBtn, { backgroundColor: gymColor, marginTop: 20, alignSelf: 'stretch' }]}
                            onPress={() => {
                                setStep('calendar');
                                setSelectedClass(null);
                                setSuccess('');
                            }}
                        >
                            <Text style={styles.submitText}>Volver al calendario</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
};

const getCalendarTheme = (colorScheme, gymColor) => ({
    calendarBackground: Colors[colorScheme].background,
    textSectionTitleColor: Colors[colorScheme].text,
    selectedDayBackgroundColor: gymColor || Colors.light.tint,
    selectedDayTextColor: '#ffffff',
    todayTextColor: gymColor || Colors.light.tint,
    dayTextColor: Colors[colorScheme].text,
    textDisabledColor: Colors[colorScheme].icon,
    dotColor: gymColor || Colors.light.tint,
    selectedDotColor: '#ffffff',
    arrowColor: gymColor || Colors.light.tint,
    disabledArrowColor: Colors[colorScheme].icon,
    monthTextColor: Colors[colorScheme].text,
    textDayFontWeight: '400',
    textMonthFontWeight: 'bold',
    textDayHeaderFontWeight: '500',
    textDayFontSize: 16,
    textMonthFontSize: 20,
    textDayHeaderFontSize: 14,
});

const getStyles = (colorScheme, gymColor) => {
    const colors = Colors[colorScheme];
    return StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 10 },
        brandHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'web' ? 18 : 48,
            paddingBottom: 16,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
        },
        logo: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
        logoFallback: {
            width: 48,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
        },
        brandName: { color: '#fff', fontSize: 20, fontWeight: '800' },
        brandSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, fontWeight: '600' },
        listHeader: {
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 'bold',
            paddingTop: 14,
            paddingHorizontal: 16,
            color: colors.text,
        },
        helper: {
            textAlign: 'center',
            fontSize: 13,
            opacity: 0.7,
            color: colors.text,
            paddingHorizontal: 20,
            paddingBottom: 10,
            paddingTop: 6,
            lineHeight: 18,
        },
        filterButton: {
            height: 46,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginHorizontal: 16,
            marginTop: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: colors.cardBackground || colors.background,
            borderWidth: 1,
            borderColor: colors.border,
        },
        filterButtonText: { fontSize: 15, color: colors.text, fontWeight: '600', flexShrink: 1 },
        emptyText: { textAlign: 'center', marginTop: 24, color: colors.text, opacity: 0.65, paddingHorizontal: 20 },
        fullLabel: { textAlign: 'center', color: '#c0392b', fontWeight: '700', paddingVertical: 6 },
        formContainer: { paddingBottom: 48, paddingTop: 8 },
        backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
        backText: { fontWeight: '700', fontSize: 14 },
        formTitle: { fontSize: 22, fontWeight: '800', color: colors.text, paddingHorizontal: 16, marginTop: 8 },
        field: { marginHorizontal: 16, marginBottom: 12 },
        label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
        input: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            backgroundColor: colors.cardBackground || colors.background,
            color: colors.text,
            fontSize: 16,
        },
        submitBtn: {
            marginHorizontal: 16,
            marginTop: 10,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
        },
        submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
        muted: { color: colors.text, opacity: 0.65, fontSize: 14 },
        errorBox: {
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            backgroundColor: '#fdecea',
            borderRadius: 10,
            padding: 12,
            marginHorizontal: 16,
            marginTop: 10,
            marginBottom: 4,
        },
        errorText: { flex: 1, color: '#a72828', fontWeight: '600' },
        successWrap: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
            gap: 10,
        },
        successTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
        successBody: { textAlign: 'center', color: colors.text, opacity: 0.8, lineHeight: 22, fontSize: 15 },
    });
};

export default TrialEnrollmentScreen;
