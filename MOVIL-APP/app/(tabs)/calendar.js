import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    StyleSheet, ActivityIndicator, TouchableOpacity, Platform, useColorScheme,
    SectionList, FlatList, View, Text, RefreshControl, Linking, useWindowDimensions,
    Modal, KeyboardAvoidingView, TextInput, ScrollView, Pressable, Switch, Keyboard, TouchableWithoutFeedback, Image
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useCachedFocusEffect } from '@/hooks/useCachedFocusEffect';
import { TabView, TabBar } from 'react-native-tab-view';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Iconos y Componentes propios
import { FontAwesome5, Ionicons, Octicons, FontAwesome6 } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';
import FilterModal from '@/components/FilterModal';
import QrModal from '../../components/client/QrModal';
import QrScannerModal from '../../components/profesor/QrScannerModal';
import PresentismoOptionsModal from '../../components/client/PresentismoOptionsModal';
import ClassCard, { ClassCardAction } from '@/components/ClassCard';
import DesafiosModal from '@/components/client/DesafiosModal';

// Servicios y Contexto
import apiClient from '../../services/apiClient';
import classService from '../../services/classService';
import { useAuth } from '../../contexts/AuthContext';

// Configuración de Calendario
LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
    today: "Hoy"
};
LocaleConfig.defaultLocale = 'es';

const capitalize = (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    const formattedStr = str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return formattedStr.replace(' De ', ' de ');
};

const CalendarScreen = () => {
    const layout = useWindowDimensions();
    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'calendar', title: 'Calendario' },
        { key: 'list', title: 'Turnos' },
    ]);

    const [allClasses, setAllClasses] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [markedDates, setMarkedDates] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { user, refreshUser, gymColor } = useAuth();
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);
    const calendarTheme = getCalendarTheme(colorScheme, gymColor);
    const [classTypes, setClassTypes] = useState([]);
    const [selectedClassType, setSelectedClassType] = useState('all');
    const [sucursales, setSucursales] = useState([]);
    const [selectedSucursal, setSelectedSucursal] = useState('all');
    const [isSucursalFilterVisible, setSucursalFilterVisible] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [adminPhoneNumber, setAdminPhoneNumber] = useState(null);
    const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [isFilterModalVisible, setFilterModalVisible] = useState(false);
    const [isQrModalVisible, setQrModalVisible] = useState(false);
    const [isScannerVisible, setScannerVisible] = useState(false);
    const [isQrImageModalVisible, setQrImageModalVisible] = useState(false);
    const [presentismoModal, setPresentismoModal] = useState({
        visible: false,
        options: [],
        message: '',
        qrData: null,
    });

    let isProcessingScan = false;
    
    const confirmCheckIn = async (type, id, qrData) => {
        setAlertInfo(prev => ({ ...prev, visible: false }));
        try {
            const response = await apiClient.post('/check-in/client-scan-confirm', { type, id, qrData });
            setPresentismoModal(prev => ({ ...prev, visible: false }));
            setTimeout(() => {
                setAlertInfo({ 
                    visible: true, 
                    title: '¡Presentismo Exitoso!', 
                    message: response.data.message || 'Asistencia registrada correctamente.',
                    buttons: [{ text: 'Aceptar', onPress: () => setAlertInfo({ visible: false }) }]
                });
                refreshUser();
                fetchData();
            }, 350);
        } catch (error) {
            setPresentismoModal(prev => ({ ...prev, visible: false }));
            setTimeout(() => {
                setAlertInfo({ 
                    visible: true, 
                    title: 'Error', 
                    message: error.response?.data?.message || 'No se pudo confirmar la asistencia.',
                    buttons: [{ text: 'Aceptar', onPress: () => setAlertInfo({ visible: false }) }]
                });
            }, 350);
            throw error;
        }
    };

    const handleClientReceptionScan = async ({ data }) => {
        if (isProcessingScan) return;
        isProcessingScan = true;
        
        setScannerVisible(false);
        try {
            const response = await apiClient.post('/check-in/client-scan-options', { qrData: data });
            
            if (response.data.options && response.data.options.length > 0) {
                // Delay so the scanner Modal fully closes on iOS before opening options
                setTimeout(() => {
                    setPresentismoModal({
                        visible: true,
                        options: response.data.options,
                        message: response.data.message || '¿Qué querés registrar?',
                        qrData: data,
                    });
                }, 350);
            } else {
                setAlertInfo({ 
                    visible: true, 
                    title: 'Atención', 
                    message: response.data.message || 'No hay clases disponibles.',
                    buttons: [{ text: 'Aceptar', onPress: () => setAlertInfo({ visible: false }) }]
                });
            }
        } catch (error) {
            setAlertInfo({ 
                visible: true, 
                title: 'Atención', 
                message: error.response?.data?.message || 'No se pudo leer tus opciones de presentismo.',
                buttons: [{ text: 'Aceptar', onPress: () => setAlertInfo({ visible: false }) }]
            });
        } finally {
            setTimeout(() => { isProcessingScan = false; }, 2000);
        }
    };

    // SCOREBOARD STATES
    const [isScoreboardVisible, setScoreboardVisible] = useState(false);
    const [hasActiveScoreboards, setHasActiveScoreboards] = useState(false);

    useEffect(() => {
        if (user && user.adminPhoneNumber) {
            setAdminPhoneNumber(user.adminPhoneNumber);
        }
    }, [user]);

    const handleWhatsAppPress = (phoneNumber) => {
        if (phoneNumber) {
            const message = 'Hola, tengo una consulta sobre los turnos.';
            const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            Linking.openURL(url).catch(() => {
                setAlertInfo({ visible: true, title: 'Error', message: 'Asegúrate de tener WhatsApp instalado.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
            });
        }
    };

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const [classesResponse, typesResponse, scoreboardsResponse, sucursalesResponse] = await Promise.all([
                apiClient.get('/classes'),
                apiClient.get('/tipos-clase?forCreation=true'),
                apiClient.get('/scoreboards/active'),
                apiClient.get('/sucursales').catch(() => ({ data: [] }))
            ]);

            setAllClasses(classesResponse.data);
            const filteredTypes = (typesResponse.data.tiposClase || []).filter(type => !type.esUniversal);
            setClassTypes(filteredTypes);
            setSucursales(sucursalesResponse?.data || []);

            setHasActiveScoreboards(scoreboardsResponse.data && scoreboardsResponse.data.length > 0);

            const markers = {};
            classesResponse.data.forEach(cls => {
                if (cls.estado !== 'cancelada') {
                    const dateString = cls.fecha.substring(0, 10);
                    if (!markers[dateString]) {
                        markers[dateString] = { customStyles: { container: { backgroundColor: colorScheme === 'dark' ? '#333' : '#e9ecef', borderRadius: 10 } } };
                    }
                    if (user && (cls.usuariosInscritos || []).includes(user._id)) {
                        markers[dateString].marked = true;
                        markers[dateString].dotColor = gymColor;
                    }
                }
            });
            setMarkedDates(markers);
        } catch (error) {
            console.error(error);
            setAlertInfo({ visible: true, title: 'Error', message: 'No se pudieron cargar algunos datos.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
        } finally {
            setIsRefreshing(false);
        }
    }, [user, colorScheme, gymColor]);

    const { refresh } = useCachedFocusEffect(
        async ({ isInitial }) => {
            if (isInitial) setIsLoading(true);
            try {
                await fetchData();
            } finally {
                if (isInitial) setIsLoading(false);
            }
        },
        { ttlMs: 45_000 }
    );

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refresh();
        setIsRefreshing(false);
    }, [refresh]);

    const visibleClasses = useMemo(() => {
        const now = new Date();
        const nowTime = now.getTime();

        return allClasses
            .filter(cls => {
                if (!cls.fecha || !isValid(parseISO(cls.fecha))) return false;

                if (index === 1 && selectedDate) {
                    return cls.fecha.substring(0, 10) === selectedDate;
                }
                const classDate = parseISO(cls.fecha);
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                return classDate.getMonth() === currentMonth && classDate.getFullYear() === currentYear;
            })
            .filter(cls => selectedClassType === 'all' || cls.tipoClase?._id === selectedClassType)
            .filter(cls => selectedSucursal === 'all' || cls.sucursal?._id === selectedSucursal || cls.sucursal === selectedSucursal)
            .map(cls => ({
                ...cls,
                isEnrolled: (cls.usuariosInscritos || []).includes(user?._id),
                isWaiting: (cls.waitlist || []).includes(user?._id),
                isFull: (cls.usuariosInscritos || []).length >= cls.capacidad,
                isCancelled: cls.estado === 'cancelada',
                isFinished: cls.endUTC ? new Date(cls.endUTC).getTime() < nowTime : parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaFin}:00`).getTime() < nowTime,
                didAttend: (cls.asistencias || []).some(id => id?.toString() === user?._id?.toString()) || user?.historialAsistencias?.some(h => (h.claseId === cls._id || h.claseId?._id === cls._id || h.claseId?.toString() === cls._id?.toString())),
                dateTime: cls.startUTC ? new Date(cls.startUTC) : parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`),
            }))
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
    }, [allClasses, selectedDate, selectedClassType, selectedSucursal, index, user]);

    // HANDLERS (Enroll, etc)
    const handleEnroll = useCallback(async (classId) => {
        setAlertInfo({
            visible: true, title: "Confirmar Inscripción", message: "¿Estás seguro de que quieres inscribirte en este turno?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Sí, Inscribirme", style: 'primary', onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.post(`/classes/${classId}/enroll`);
                            await refreshUser(); fetchData();
                            setAlertInfo({ visible: true, title: '¡Éxito!', message: 'Te has inscrito en el turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo procesar la inscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    }, [refreshUser, fetchData]);

    const handleUnenroll = useCallback(async (classId) => {
        setAlertInfo({
            visible: true, title: "Confirmar Anulación", message: "¿Estás seguro de que quieres anular tu inscripción?",
            buttons: [
                { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                {
                    text: "Sí, Anular", style: 'destructive', onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            const response = await apiClient.post(`/classes/${classId}/unenroll`);
                            await refreshUser(); fetchData();
                            setAlertInfo({ visible: true, title: 'Anulación Procesada', message: response.data.message, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo anular la inscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }
                }
            ]
        });
    }, [refreshUser, fetchData]);

    const handleSubscribe = useCallback(async (classId) => {
        try { const response = await classService.subscribeToWaitlist(classId); fetchData(); setAlertInfo({ visible: true, title: '¡Listo!', message: response.data.message, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } catch (err) { setAlertInfo({ visible: true, title: 'Error', message: err.response?.data?.message || 'No se pudo procesar la solicitud.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); }
    }, [fetchData]);

    const handleUnsubscribe = useCallback(async (classId) => {
        try { const response = await classService.unsubscribeFromWaitlist(classId); fetchData(); setAlertInfo({ visible: true, title: 'Hecho', message: response.data.message, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); } catch (err) { setAlertInfo({ visible: true, title: 'Error', message: err.response?.data?.message || 'No se pudo procesar la solicitud.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] }); }
    }, [fetchData]);

    const handleDayPress = (day) => { setSelectedDate(day.dateString); setIndex(1); };
    const handleIndexChange = (newIndex) => { if (newIndex === 0) setSelectedDate(null); setIndex(newIndex); };

    const formattedDateTitle = useMemo(() => {
        if (!selectedDate) { const currentMonthName = format(new Date(), 'MMMM', { locale: es }); return `Turnos de ${capitalize(currentMonthName)}`; }
        try { const date = parseISO(selectedDate); return capitalize(format(date, "EEEE, d 'de' MMMM", { locale: es })); } catch (e) { return 'Clases'; }
    }, [selectedDate]);

    const handleSelectClassType = (typeId) => { setSelectedClassType(typeId); setFilterModalVisible(false); };

    const sectionedClasses = useMemo(() => {
        if (selectedDate) return [];
        const grouped = visibleClasses.reduce((acc, clase) => {
            const dateKey = clase.fecha.substring(0, 10);
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(clase);
            return acc;
        }, {});
        return Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b)).map(dateKey => ({ title: capitalize(format(parseISO(dateKey), "EEEE, d 'de' MMMM", { locale: es })), data: grouped[dateKey] }));
    }, [visibleClasses, selectedDate]);

    const renderClassItem = ({ item }) => {
        const { isEnrolled, isFull, isWaiting, isCancelled, isFinished, didAttend } = item;
        const statusBadge = didAttend ? (
            <View style={styles.statusPillPresent}>
                <Ionicons name="checkmark-circle" size={12} color="#28a745" />
                <Text style={styles.statusPillPresentText}>PRESENTE</Text>
            </View>
        ) : isCancelled ? (
            <View style={styles.statusPillMuted}>
                <Text style={[styles.statusPillMutedText, { color: Colors.light.error }]}>CANCELADA</Text>
            </View>
        ) : isFinished ? (
            <View style={styles.statusPillMuted}>
                <Text style={styles.statusPillMutedText}>FINALIZADO</Text>
            </View>
        ) : null;

        let footer = null;
        if (isCancelled) {
            footer = <Text style={styles.badgeCancelled}>Turno cancelado</Text>;
        } else if (didAttend) {
            footer = (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                    <Text style={{ color: '#28a745', fontWeight: '800', marginLeft: 6, fontSize: 13 }}>Presentismo registrado</Text>
                </View>
            );
        } else if (isFinished) {
            footer = <Text style={styles.badgeFinished}>Finalizado</Text>;
        } else if (isEnrolled) {
            footer = <ClassCardAction title="Anular Inscripción" onPress={() => handleUnenroll(item._id)} iconName="calendar-times" color="#e74c3c" />;
        } else if (isFull) {
            footer = isWaiting
                ? <ClassCardAction title="En lista de espera" onPress={() => handleUnsubscribe(item._id)} iconName="user-clock" color="#f0ad4e" />
                : <ClassCardAction title="Notificarme Disponibilidad" onPress={() => handleSubscribe(item._id)} iconName="bell" color="#1a5276" />;
        } else {
            footer = <ClassCardAction title="Inscribirme" onPress={() => handleEnroll(item._id)} iconName="calendar-check" color="#2ecc71" />;
        }

        return (
            <ClassCard
                item={item}
                gymColor={gymColor}
                muted={isFinished && !didAttend}
                badges={statusBadge}
                footer={footer}
            />
        );
    };

    // Avoid SceneMap + inline scene components: recreating scene types each render
    // breaks hooks when nested inside swipeable Material Top Tabs.
    const renderScene = ({ route }) => {
        switch (route.key) {
            case 'calendar':
                return (
                    <ThemedView style={{ flex: 1 }}>
                        <Calendar onDayPress={handleDayPress} markedDates={markedDates} markingType={'custom'} theme={calendarTheme} />
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.qrButton} onPress={() => setScannerVisible(true)}>
                                <Ionicons name="qr-code-outline" size={24} color={Colors[colorScheme].icon} />
                                <ThemedText style={styles.qrButtonText}>Dar Presentismo</ThemedText>
                            </TouchableOpacity>
                            {user?.qrIngresoUrl && (
                                <TouchableOpacity style={[styles.qrButton, { marginTop: 10, backgroundColor: Colors[colorScheme].cardBackground }]} onPress={() => setQrImageModalVisible(true)}>
                                    <Ionicons name="qr-code" size={24} color={gymColor || Colors.light.tint} />
                                    <ThemedText style={[styles.qrButtonText, { color: gymColor || Colors.light.tint }]}>QR Ingreso</ThemedText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ThemedView>
                );
            case 'list':
                return (
                    <ThemedView style={{ flex: 1 }}>
                        <ThemedText style={[styles.listHeader, { paddingBottom: 10 }]}>{formattedDateTitle}</ThemedText>

                        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 15, marginBottom: 12 }}>
                            {sucursales.length > 1 && (
                                <TouchableOpacity style={[styles.filterButton, { flex: 1, marginHorizontal: 0, marginVertical: 0 }]} onPress={() => setSucursalFilterVisible(true)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                                        <Ionicons name="location-outline" size={14} color={Colors[colorScheme].text} style={{ marginRight: 6 }} />
                                        <ThemedText style={styles.filterButtonText} numberOfLines={1}>
                                            {selectedSucursal === 'all' ? 'Todas' : (sucursales.find(s => s._id === selectedSucursal)?.nombre || 'Sucursal')}
                                        </ThemedText>
                                    </View>
                                    <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.filterButton, { flex: 1, marginHorizontal: 0, marginVertical: 0 }]} onPress={() => setFilterModalVisible(true)}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                                    <Ionicons name="pricetag-outline" size={14} color={Colors[colorScheme].text} style={{ marginRight: 6 }} />
                                    <ThemedText style={styles.filterButtonText} numberOfLines={1}>
                                        {selectedClassType === 'all' ? 'Turnos: Todos' : (classTypes.find(t => t._id === selectedClassType)?.nombre || 'Filtrar')}
                                    </ThemedText>
                                </View>
                                <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                        </View>
                        {visibleClasses.length === 0 && !isLoading ? (
                            <ThemedText style={styles.emptyText}>No hay turnos para los filtros seleccionados.</ThemedText>
                        ) : (
                            selectedDate ? (
                                <FlatList
                                    data={visibleClasses}
                                    keyExtractor={item => item._id}
                                    renderItem={renderClassItem}
                                    ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay turnos para este día.</ThemedText>}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />}
                                />
                            ) : (
                                <SectionList
                                    sections={sectionedClasses}
                                    keyExtractor={(item, index) => item._id + index}
                                    renderItem={renderClassItem}
                                    renderSectionHeader={({ section: { title } }) => <ThemedText style={styles.sectionHeader}>{title}</ThemedText>}
                                    ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay próximos turnos.</ThemedText>}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                    refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />}
                                />
                            )
                        )}
                    </ThemedView>
                );
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
                <ThemedText style={styles.loadingText}>Cargando clases...</ThemedText>
            </ThemedView>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <TabView navigationState={{ index, routes }} renderScene={renderScene} onIndexChange={handleIndexChange} initialLayout={{ width: layout.width }} renderTabBar={props => <TabBar {...props} style={{ backgroundColor: gymColor, paddingTop: Platform.OS === 'android' ? 10 : 0, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, marginBottom: 8 }} indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }} labelStyle={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', textTransform: 'none' }} />} />

            {hasActiveScoreboards && (
                <TouchableOpacity style={styles.fabScoreboard} onPress={() => setScoreboardVisible(true)}>
                    <FontAwesome5 name="trophy" size={22} color="#fff" />
                </TouchableOpacity>
            )}

            {adminPhoneNumber && (
                <TouchableOpacity style={styles.fabWhatsApp} onPress={() => handleWhatsAppPress(adminPhoneNumber)}>
                    <FontAwesome5 name="whatsapp" size={30} color="#fff" />
                </TouchableOpacity>
            )}

            <DesafiosModal
                visible={isScoreboardVisible}
                onClose={() => setScoreboardVisible(false)}
                gymColor={gymColor}
            />

            <FilterModal visible={isFilterModalVisible} onClose={() => setFilterModalVisible(false)} options={[{ _id: 'all', nombre: 'Todos los Turnos' }, ...classTypes]} onSelect={(id) => { setSelectedClassType(id); setFilterModalVisible(false); }} selectedValue={selectedClassType} title="Tipo de Turno" theme={{ colors: Colors[colorScheme], gymColor }} />
            <FilterModal visible={isSucursalFilterVisible} onClose={() => setSucursalFilterVisible(false)} options={[{ _id: 'all', nombre: 'Todas las Sucursales' }, ...sucursales]} onSelect={(id) => { setSelectedSucursal(id); setSucursalFilterVisible(false); }} selectedValue={selectedSucursal} title="Sucursal" theme={{ colors: Colors[colorScheme], gymColor }} />
            <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={alertInfo.buttons} onClose={() => setAlertInfo({ ...alertInfo, visible: false })} gymColor={gymColor} inline={true} />
            <QrModal visible={isQrModalVisible} onClose={() => setQrModalVisible(false)} user={user} gymColor={gymColor} />
            <QrScannerModal visible={isScannerVisible} onClose={() => setScannerVisible(false)} onBarcodeScanned={handleClientReceptionScan} />
            <PresentismoOptionsModal
                visible={presentismoModal.visible}
                options={presentismoModal.options}
                message={presentismoModal.message}
                gymColor={gymColor}
                onClose={() => setPresentismoModal(prev => ({ ...prev, visible: false }))}
                onSelect={async (opt) => {
                    await confirmCheckIn(opt.type, opt.id, presentismoModal.qrData);
                }}
            />
            
            <Modal
                visible={isQrImageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setQrImageModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { height: '80%', padding: 20, justifyContent: 'center', alignItems: 'center' }]}>
                        <TouchableOpacity style={{ position: 'absolute', top: 15, right: 15, zIndex: 1 }} onPress={() => setQrImageModalVisible(false)}>
                            <Ionicons name="close" size={30} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                        <ThemedText style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>Tu QR de Ingreso</ThemedText>
                        {user?.qrIngresoUrl && (
                            <Image 
                                source={{ uri: user.qrIngresoUrl }} 
                                style={{ width: '100%', height: 400, resizeMode: 'contain' }} 
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// HELPERS
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

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    listHeader: { textAlign: 'center', fontSize: 20, fontWeight: 'bold', padding: 15, color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].background },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: Colors[colorScheme].background, opacity: 0.9, color: Colors[colorScheme].text },

    badgeCancelled: { color: Colors.light.error, fontStyle: 'italic', fontWeight: 'bold' },
    badgeFinished: { color: Colors[colorScheme].icon, fontStyle: 'italic', fontWeight: 'bold' },
    statusPillPresent: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f7ee', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, gap: 4 },
    statusPillPresentText: { color: '#28a745', fontWeight: '800', fontSize: 10 },
    statusPillMuted: { backgroundColor: Colors[colorScheme].background, borderWidth: 1, borderColor: Colors[colorScheme].border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    statusPillMutedText: { color: Colors[colorScheme].icon, fontWeight: '800', fontSize: 10 },
    emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 16, color: Colors[colorScheme].text },
    filterButton: { height: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 15, marginVertical: 10, paddingHorizontal: 15, borderRadius: 10, backgroundColor: Colors[colorScheme].background },
    filterButtonText: { fontSize: 16, color: Colors[colorScheme].text },
    headerActions: { backgroundColor: Colors[colorScheme].background, paddingHorizontal: 15, paddingVertical: 10 },
    qrButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors[colorScheme].cardBackground, paddingVertical: 18, paddingHorizontal: 15, borderRadius: 14, elevation: 2, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, borderWidth: 1, borderColor: Colors[colorScheme].border },
    qrButtonText: { marginLeft: 15, fontSize: 16, fontWeight: '500', color: Colors[colorScheme].text },

    // FABs
    fabWhatsApp: { position: 'absolute', width: 50, height: 50, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: '#25D366', borderRadius: 30, elevation: 8, zIndex: 999 },
    fabScoreboard: { position: 'absolute', width: 50, height: 50, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 80, backgroundColor: gymColor, borderRadius: 30, elevation: 8, zIndex: 999 },
});

export default CalendarScreen;