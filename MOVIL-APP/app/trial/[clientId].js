import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    FlatList,
    StyleSheet,
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
import GymLogoSpinner from '@/components/GymLogoSpinner';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEntranceEpoch, useStaggerEnter } from '@/hooks/useEntranceEpoch';
import TrialTurnstile from '@/components/TrialTurnstile';
import config from '../../config';

const apiBase = String(config.gymAppBackend || '').replace(/\/$/, '');
const SESSION_KEY = (clientId) => `trialSession:${clientId}`;

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

const readStoredSession = (clientId) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(SESSION_KEY(clientId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const storeSession = (clientId, payload) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(SESSION_KEY(clientId), JSON.stringify(payload));
    } catch {
        /* ignore */
    }
};

const clearStoredSession = (clientId) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(SESSION_KEY(clientId));
    } catch {
        /* ignore */
    }
};

const TrialEnrollmentScreen = () => {
    const params = useLocalSearchParams();
    const clientId = paramValue(params.clientId);
    const token = paramValue(params.t) || paramValue(params.token);
    const colorScheme = useColorScheme() ?? 'light';
    const enter = useStaggerEnter();

    const [loading, setLoading] = useState(true);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [classes, setClasses] = useState([]);
    const [gym, setGym] = useState(DEFAULT_GYM);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedClassType, setSelectedClassType] = useState('all');
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    // form | verify | calendar | success
    const [step, setStep] = useState('form');
    const [sessionToken, setSessionToken] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [captcha, setCaptcha] = useState({ siteKey: '', required: false });
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaKey, setCaptchaKey] = useState(0);
    const [honeypot, setHoneypot] = useState('');
    const [form, setForm] = useState({
        nombre: '',
        apellido: '',
        dni: '',
        numeroTelefono: '',
        email: '',
    });

    const resetCaptcha = () => {
        setCaptchaToken('');
        setCaptchaKey((k) => k + 1);
    };

    const gymColor = gym.primaryColor || DEFAULT_GYM.primaryColor;
    const styles = useMemo(() => getStyles(colorScheme, gymColor), [colorScheme, gymColor]);
    const calendarTheme = useMemo(() => getCalendarTheme(colorScheme, gymColor), [colorScheme, gymColor]);
    const listEntranceEpoch = useEntranceEpoch('trial', selectedDate, selectedClassType, step);

    const loadBranding = useCallback(async () => {
        // Yield first so effect callers don't sync-setState in the effect body (React Compiler).
        await Promise.resolve();
        if (!clientId || !token) {
            setError('Link incompleto. Pedile al gimnasio un link válido.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (token === 'preview') {
                setGym({ name: 'Studio Demo', logoUrl: '', primaryColor: '#c0392b' });
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
            setCaptcha({
                siteKey: data.captcha?.siteKey || '',
                required: !!data.captcha?.required,
            });

            const stored = readStoredSession(clientId);
            if (stored?.sessionToken && stored?.email) {
                setSessionToken(stored.sessionToken);
                setForm((prev) => ({ ...prev, email: stored.email, nombre: stored.nombre || prev.nombre }));
                setStep('calendar');
            }
        } catch (err) {
            setError(err.message || 'No se pudo cargar la clase de prueba.');
        } finally {
            setLoading(false);
        }
    }, [clientId, token]);

    const loadClasses = useCallback(async (activeSession) => {
        await Promise.resolve();
        const session = activeSession || sessionToken;
        if (!clientId || !token || !session) return;
        if (token === 'preview') {
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
            ];
            setClasses(mock);
            setSelectedDate('2026-11-05');
            return;
        }

        setLoadingClasses(true);
        setError('');
        try {
            const qs = new URLSearchParams({ t: token, session });
            const res = await fetch(`${apiBase}/public/trial/${encodeURIComponent(clientId)}/classes?${qs}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 403) {
                    clearStoredSession(clientId);
                    setSessionToken('');
                    setStep('form');
                }
                throw new Error(data.message || 'No se pudieron cargar los turnos.');
            }
            setClasses(data.classes || []);
            const firstDate = (data.classes || [])[0]?.fecha;
            if (firstDate) setSelectedDate(String(firstDate).substring(0, 10));
        } catch (err) {
            setError(err.message || 'No se pudieron cargar los turnos.');
            setClasses([]);
        } finally {
            setLoadingClasses(false);
        }
    }, [clientId, token, sessionToken]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await loadBranding();
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
    }, [loadBranding]);

    useEffect(() => {
        if (step !== 'calendar' || !sessionToken) return undefined;
        let cancelled = false;
        (async () => {
            await loadClasses(sessionToken);
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
    }, [step, sessionToken, loadClasses]);

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

    const handleStart = async () => {
        setError('');
        if (!form.nombre.trim() || !form.apellido.trim() || !form.dni.trim() || !form.numeroTelefono.trim() || !form.email.trim()) {
            setError('Completá todos los campos.');
            return;
        }
        if (captcha.required && !captchaToken) {
            setError('Completá la verificación anti-bot.');
            return;
        }
        if (token === 'preview') {
            setStep('verify');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/public/trial/${encodeURIComponent(clientId)}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    ...form,
                    captchaToken,
                    website: honeypot,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo enviar el código.');
            resetCaptcha();
            setStep('verify');
        } catch (err) {
            resetCaptcha();
            setError(err.message || 'No se pudo enviar el código.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerify = async () => {
        setError('');
        if (String(verifyCode).replace(/\D/g, '').length !== 6) {
            setError('Ingresá el código de 6 dígitos.');
            return;
        }
        if (token === 'preview') {
            const fakeSession = 'preview-session';
            setSessionToken(fakeSession);
            storeSession(clientId, { sessionToken: fakeSession, email: form.email, nombre: form.nombre });
            setStep('calendar');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/public/trial/${encodeURIComponent(clientId)}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    email: form.email,
                    code: verifyCode,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo verificar el email.');
            setSessionToken(data.sessionToken);
            storeSession(clientId, {
                sessionToken: data.sessionToken,
                email: data.email || form.email,
                nombre: data.nombre || form.nombre,
            });
            setStep('calendar');
        } catch (err) {
            setError(err.message || 'No se pudo verificar el email.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        setError('');
        if (token === 'preview') return;
        if (captcha.required && !captchaToken) {
            setError('Completá la verificación anti-bot para reenviar.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${apiBase}/public/trial/${encodeURIComponent(clientId)}/resend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    email: form.email,
                    captchaToken,
                    website: honeypot,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo reenviar el código.');
            resetCaptcha();
            setSuccess(data.message || 'Código reenviado.');
            setTimeout(() => setSuccess(''), 3500);
        } catch (err) {
            resetCaptcha();
            setError(err.message || 'No se pudo reenviar el código.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelectClass = async (cls) => {
        if (cls.isFull) return;
        setSelectedClass(cls);
        setError('');
        setSuccess('');
        setSubmitting(true);
        try {
            if (token === 'preview') {
                setSuccess(`Vista previa: quedarías anotado/a a ${cls.nombre}.`);
                setStep('success');
                return;
            }
            const res = await fetch(`${apiBase}/public/trial/${encodeURIComponent(clientId)}/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    sessionToken,
                    classId: cls._id,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo completar la inscripción.');
            clearStoredSession(clientId);
            setSuccess(data.message || 'Inscripción realizada.');
            setStep('success');
        } catch (err) {
            setError(err.message || 'No se pudo completar la inscripción.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: gymColor }]}>
                <GymLogoSpinner
                    logoUrl={gym.logoUrl}
                    color="#fff"
                    size={96}
                    label="Cargando..."
                    labelStyle={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}
                />
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
                            <Ionicons name="barbell-outline" size={32} color="#fff" />
                        </View>
                    )}
                    <Text style={styles.brandSub}>Clase de prueba</Text>
                </Animated.View>

                {!!error && step !== 'form' && step !== 'verify' && (
                    <Animated.View entering={FadeIn.duration(220)} style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={18} color="#a72828" />
                        <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                )}

                {step === 'form' && (
                    <Animated.View key="step-form" entering={FadeIn.duration(280)} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
                            <Animated.View entering={enter(0)}>
                                <Text style={styles.formTitle}>Tus datos</Text>
                                <Text style={styles.helper}>
                                    Completá tus datos y verificá tu email para ver los turnos disponibles. Solo una clase de prueba por persona.
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
                                <Animated.View key={field.key} entering={enter(index + 1)} style={styles.field}>
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

                            {/* Honeypot — hidden from humans, bots often fill it */}
                            <TextInput
                                value={honeypot}
                                onChangeText={setHoneypot}
                                style={styles.honeypot}
                                accessibilityElementsHidden
                                importantForAccessibility="no-hide-descendants"
                                autoComplete="off"
                                tabIndex={-1}
                            />

                            {!!captcha.siteKey && (
                                <TrialTurnstile
                                    key={`start-${captchaKey}`}
                                    siteKey={captcha.siteKey}
                                    theme={colorScheme === 'dark' ? 'dark' : 'light'}
                                    onToken={setCaptchaToken}
                                    onExpire={() => setCaptchaToken('')}
                                />
                            )}

                            <Animated.View entering={enter(6)}>
                                <TouchableOpacity
                                    style={[styles.submitBtn, { backgroundColor: gymColor }, submitting && { opacity: 0.6 }]}
                                    onPress={handleStart}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <GymLogoSpinner logoUrl={gym.logoUrl} color="#fff" size={28} />
                                    ) : (
                                        <Text style={styles.submitText}>Enviar código al email</Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        </ScrollView>
                    </Animated.View>
                )}

                {step === 'verify' && (
                    <Animated.View
                        key="step-verify"
                        entering={SlideInRight.duration(280)}
                        exiting={SlideOutRight.duration(200)}
                        style={{ flex: 1 }}
                    >
                        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
                            <TouchableOpacity
                                style={styles.backRow}
                                onPress={() => {
                                    setStep('form');
                                    setVerifyCode('');
                                    setError('');
                                }}
                            >
                                <Ionicons name="arrow-back" size={20} color={gymColor} />
                                <Text style={[styles.backText, { color: gymColor }]}>Volver a mis datos</Text>
                            </TouchableOpacity>

                            <Text style={styles.formTitle}>Verificá tu email</Text>
                            <Text style={styles.helper}>
                                Te enviamos un código de 6 dígitos a{'\n'}
                                <Text style={{ fontWeight: '800' }}>{form.email}</Text>
                            </Text>

                            {!!error && (
                                <View style={styles.errorBox}>
                                    <Ionicons name="alert-circle" size={18} color="#a72828" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                            {!!success && (
                                <View style={[styles.errorBox, { backgroundColor: '#e8f8ef' }]}>
                                    <Ionicons name="mail-outline" size={18} color="#1e7a46" />
                                    <Text style={[styles.errorText, { color: '#1e7a46' }]}>{success}</Text>
                                </View>
                            )}

                            <View style={styles.field}>
                                <Text style={styles.label}>Código</Text>
                                <TextInput
                                    style={[styles.input, styles.codeInput]}
                                    value={verifyCode}
                                    onChangeText={(text) => setVerifyCode(text.replace(/\D/g, '').slice(0, 6))}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    placeholder="000000"
                                    placeholderTextColor="#999"
                                    textAlign="center"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: gymColor }, submitting && { opacity: 0.6 }]}
                                onPress={handleVerify}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <GymLogoSpinner logoUrl={gym.logoUrl} color="#fff" size={28} />
                                ) : (
                                    <Text style={styles.submitText}>Verificar y ver turnos</Text>
                                )}
                            </TouchableOpacity>

                            {!!captcha.siteKey && (
                                <TrialTurnstile
                                    key={`resend-${captchaKey}`}
                                    siteKey={captcha.siteKey}
                                    theme={colorScheme === 'dark' ? 'dark' : 'light'}
                                    onToken={setCaptchaToken}
                                    onExpire={() => setCaptchaToken('')}
                                />
                            )}

                            <TouchableOpacity style={styles.linkBtn} onPress={handleResend} disabled={submitting}>
                                <Text style={[styles.linkText, { color: gymColor }]}>Reenviar código</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </Animated.View>
                )}

                {step === 'calendar' && (
                    <Animated.View
                        key="step-calendar"
                        entering={FadeIn.duration(320)}
                        exiting={FadeOut.duration(180)}
                        style={{ flex: 1 }}
                    >
                        {loadingClasses ? (
                            <View style={styles.centered}>
                                <GymLogoSpinner
                                    logoUrl={gym.logoUrl}
                                    color={gymColor}
                                    size={88}
                                    label="Cargando turnos..."
                                    labelStyle={[styles.muted, { color: Colors[colorScheme].text }]}
                                />
                            </View>
                        ) : (
                            <FlatList
                                key={`day-${selectedDate || 'none'}-${selectedClassType}`}
                                data={dayClasses}
                                keyExtractor={(item) => String(item._id)}
                                ListHeaderComponent={
                                    <Animated.View entering={FadeInUp.delay(80).duration(360)}>
                                        <Text style={styles.helperTop}>
                                            Hola{form.nombre ? `, ${form.nombre}` : ''}. Elegí un turno para tu clase de prueba.
                                        </Text>
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
                                    </Animated.View>
                                }
                                renderItem={({ item, index }) => (
                                    <ClassCard
                                        item={item}
                                        gymColor={gymColor}
                                        muted={item.isFull || submitting}
                                        animationIndex={index}
                                        entranceEpoch={listEntranceEpoch}
                                        footer={
                                            item.isFull ? (
                                                <Text style={styles.fullLabel}>Sin cupos</Text>
                                            ) : (
                                                <ClassCardAction
                                                    title={submitting && selectedClass?._id === item._id ? 'Anotándote...' : 'Probar esta clase'}
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
                        )}
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
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'web' ? 14 : 40,
            paddingBottom: 12,
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
            gap: 6,
        },
        logo: {
            width: 88,
            height: 88,
        },
        logoFallback: {
            width: 88,
            height: 88,
            alignItems: 'center',
            justifyContent: 'center',
        },
        brandSub: {
            color: '#fff',
            fontSize: 15,
            fontWeight: '800',
            letterSpacing: 0.2,
            textAlign: 'center',
        },
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
        helperTop: {
            textAlign: 'center',
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 4,
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
        codeInput: {
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: 8,
            paddingVertical: 16,
        },
        submitBtn: {
            marginHorizontal: 16,
            marginTop: 10,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
        },
        submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
        linkBtn: { alignItems: 'center', paddingVertical: 16 },
        linkText: { fontWeight: '700', fontSize: 14 },
        honeypot: {
            position: 'absolute',
            opacity: 0,
            height: 0,
            width: 0,
            overflow: 'hidden',
        },
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
