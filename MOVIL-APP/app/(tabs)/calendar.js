    import React, { useState, useCallback, useMemo, useEffect } from 'react';
    import {
        StyleSheet, ActivityIndicator, TouchableOpacity, Platform, useColorScheme,
        SectionList, FlatList, View, Text, RefreshControl, Linking, useWindowDimensions,
        Modal, KeyboardAvoidingView, TextInput, ScrollView, Pressable, Switch, Keyboard, TouchableWithoutFeedback
    } from 'react-native';
    import { Calendar, LocaleConfig } from 'react-native-calendars';
    import { useFocusEffect } from 'expo-router';
    import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
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

    const formatTeachers = (clase) => {
        if (clase.profesores && Array.isArray(clase.profesores) && clase.profesores.length > 0) {
            return clase.profesores.map(p => p ? `${p.nombre} ${p.apellido || ''}`.trim() : '').filter(n => n !== '').join(', ');
        }
        if (clase.profesor && clase.profesor.nombre) {
            return `${clase.profesor.nombre} ${clase.profesor.apellido || ''}`.trim();
        }
        return 'Sin profesor asignado';
    };

    // --- COMPONENTE CLIENT SCOREBOARD MODAL (Estilo RM) ---
    const ClientScoreboardModal = ({ visible, onClose, gymColor, colorScheme }) => {
        const styles = getStyles(colorScheme, gymColor);
        const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
        const [activeScoreboards, setActiveScoreboards] = useState([]);
        const [selectedScoreboard, setSelectedScoreboard] = useState(null);
        const [leaderboardData, setLeaderboardData] = useState(null);
        const [loading, setLoading] = useState(false);
        const [submitLoading, setSubmitLoading] = useState(false);

        const [scores, setScores] = useState({ peso: '', tiempo: '', distancia: '', repeticiones: '', calorias: '', nota: '', rx: true });

        useEffect(() => {
            if (visible) {
                fetchActiveScoreboards();
                setViewMode('list');
            }
        }, [visible]);

        const fetchActiveScoreboards = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get('/scoreboards/active');
                setActiveScoreboards(res.data || []);
            } catch (e) { console.error(e); } 
            finally { setLoading(false); }
        };

        const handleSelectScoreboard = async (scoreboard) => {
            setSelectedScoreboard(scoreboard);
            setScores({ peso: '', tiempo: '', distancia: '', repeticiones: '', calorias: '', nota: '', rx: true });
            setViewMode('detail');
            fetchLeaderboard(scoreboard._id);
        };

        const fetchLeaderboard = async (id) => {
            setLoading(true);
            try {
                const res = await apiClient.get(`/scoreboards/${id}/leaderboard`);
                setLeaderboardData(res.data);
                
                if (!res.data.locked && res.data.userEntry) {
                    const e = res.data.userEntry;
                    setScores({
                        peso: e.peso?.toString() || '',
                        tiempo: e.tiempo || '',
                        distancia: e.distancia?.toString() || '',
                        repeticiones: e.repeticiones?.toString() || '',
                        nota: e.nota || '',
                        rx: e.rx
                    });
                }
            } catch (e) { console.error(e); } 
            finally { setLoading(false); }
        };

        const handleSubmitScore = async () => {
            setSubmitLoading(true);
            try {
                const payload = {
                    scoreboardId: selectedScoreboard._id,
                    rx: scores.rx,
                    ...(scores.peso && { peso: Number(scores.peso) }),
                    ...(scores.distancia && { distancia: Number(scores.distancia) }),
                    ...(scores.repeticiones && { repeticiones: Number(scores.repeticiones) }),
                    ...(scores.tiempo && { tiempo: scores.tiempo }),
                    ...(scores.nota && { nota: scores.nota }),
                };

                await apiClient.post('/scoreboards/submit', payload);
                fetchLeaderboard(selectedScoreboard._id);
            } catch (e) {
                alert('Error al guardar resultado');
            } finally {
                setSubmitLoading(false);
            }
        };

        const renderMetricInput = (metric) => {
            const labels = { peso: 'Peso (kg)', tiempo: 'Tiempo', distancia: 'Distancia (mts)', repeticiones: 'Repeticiones', calorias: 'Calorías' };
            const placeholders = { peso: 'Ej: 80.5', tiempo: 'Ej: 12:30', distancia: 'Ej: 5000', repeticiones: 'Ej: 50' };
            
            return (
                <View key={metric} style={{ marginBottom: 15 }}>
                    <ThemedText style={styles.inputLabel}>{labels[metric] || metric}</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder={placeholders[metric]}
                        placeholderTextColor="#999"
                        keyboardType={metric === 'tiempo' ? 'default' : 'numeric'}
                        value={scores[metric]}
                        onChangeText={t => setScores(prev => ({ ...prev, [metric]: t }))}
                    />
                </View>
            );
        };

        const renderContent = () => {
            if (viewMode === 'list') {
                if (loading) return <ActivityIndicator color={gymColor} style={{marginTop: 50}} />;
                return (
                    <FlatList
                        data={activeScoreboards}
                        keyExtractor={item => item._id}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No hay desafíos activos.</Text>}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.scoreboardItem} onPress={() => handleSelectScoreboard(item)}>
                                <View style={{flex: 1}}>
                                    <ThemedText style={styles.scoreboardTitle}>{item.nombre}</ThemedText>
                                    <Text style={styles.scoreboardSubtitle}>
                                        {item.isLimitedTime 
                                            ? `Vence: ${format(parseISO(item.fechaLimite), 'dd/MM')}` 
                                            : 'Desafío Permanente'}
                                    </Text>
                                </View>
                                <View style={[styles.statusBadge, item.completedByUser ? {backgroundColor: '#2ecc71'} : {backgroundColor: Colors[colorScheme].icon}]}>
                                    <Text style={styles.statusBadgeText}>{item.completedByUser ? 'Ver Ranking' : 'Participar'}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                );
            }

            if (!selectedScoreboard || !leaderboardData) return <ActivityIndicator color={gymColor} style={{marginTop: 50}} />;

            const isEditing = !!leaderboardData.userEntry;

            return (
                <ScrollView showsVerticalScrollIndicator={false}>
                    <ThemedText style={styles.detailTitle}>{selectedScoreboard.nombre}</ThemedText>
                    {selectedScoreboard.descripcion ? (
                        <Text style={styles.detailDesc}>{selectedScoreboard.descripcion}</Text>
                    ) : null}

                    <View style={styles.divider} />

                    {leaderboardData.locked ? (
                        <View style={styles.lockedContainer}>
                            <FontAwesome5 
                            name={isEditing ? "edit" : "lock"} 
                            size={30} 
                            color={gymColor} 
                            style={{alignSelf:'center', marginBottom: 10}} 
                        />
                        <ThemedText style={styles.lockedText}>
                            {isEditing ? "Actualiza tu Resultado" : "Participa para desbloquear el Ranking."}
                        </ThemedText>
                            
                            <View style={styles.formContainer}>
                                {selectedScoreboard.metrics.map(m => renderMetricInput(m))}

                                <TouchableOpacity 
                                    style={[styles.mainButton, {backgroundColor: gymColor}]} 
                                    onPress={handleSubmitScore}
                                    disabled={submitLoading}
                                >
                                    {submitLoading ? <ActivityIndicator color="#fff"/> : <Text style={styles.mainButtonText}>Guardar Resultado</Text>}
                                </TouchableOpacity>
                            </View>
                     
                        </View>
                        
                    ) : (
                        <View>
                            {/* TARJETA DE MI RESULTADO */}
                            {(() => {
                                const e = leaderboardData.userEntry;
                                let myResultString = 'Sin datos';
                                if (e) {
                                    const parts = [];
                                    if(e.peso) parts.push(`${e.peso}kg`);
                                    if(e.tiempo) parts.push(e.tiempo);
                                    if(e.repeticiones) parts.push(`${e.repeticiones} reps`);
                                    if(e.distancia) parts.push(`${e.distancia}m`);
                                    if(parts.length > 0) myResultString = parts.join(' - ');
                                }

                                const myIndex = leaderboardData.entries.findIndex(entry => entry.user._id === leaderboardData.userEntry.user);
                            const position = myIndex + 1;

                                return (
                                    <View style={styles.myScoreContainer}>
                                        
                                            <ThemedText style={{fontWeight:'bold', marginBottom: 2}}>Tu Resultado:</ThemedText>
                                            <ThemedText style={{fontSize: 20, fontWeight: '600'}}>{myResultString}</ThemedText>
                                            <View style={{width: 40, alignItems:'center', justifyContent:'center'}}>
                                            {position === 1 ? (
                                                <FontAwesome5 name="medal" size={20} color="#FFD700" /> // Oro
                                            ) : position === 2 ? (
                                                <FontAwesome5 name="medal" size={20} color="#C0C0C0" /> // Plata
                                            ) : position === 3 ? (
                                                <FontAwesome5 name="medal" size={20} color="#CD7F32" /> // Bronce
                                            ) : (
                                                <ThemedText style={{fontSize: 24, fontWeight: 'bold', color: gymColor}}>#{position}</ThemedText>
                                            )}
                                        </View>
                                        
                                        <TouchableOpacity onPress={() => setLeaderboardData(prev => ({...prev, locked: true}))} style={{padding: 5}}>
                                            <FontAwesome6 name="edit" size={18} color={Colors[colorScheme].text} />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })()}

                            <View style={styles.rankingHeader}>
                                <Text style={[styles.rankingHeadText, {flex: 1}]}>    #    Atletas</Text>
                                <Text style={[styles.rankingHeadText, {width: 100, textAlign:'right'}]}>Resultados</Text>
                            </View>

                            {leaderboardData.entries.map((entry, index) => {
                                const isMe = entry.user._id === leaderboardData.userEntry?.user;
                                const resultParts = [];
                                if(entry.peso) resultParts.push(`${entry.peso}kg`);
                                if(entry.tiempo) resultParts.push(entry.tiempo);
                                if(entry.repeticiones) resultParts.push(`${entry.repeticiones} reps`);
                                if(entry.distancia) resultParts.push(`${entry.distancia}m`);
                                const resultString = resultParts.join(' - ');

                                return (
                                    <View key={entry._id} style={[styles.rankingRow, isMe]}>
                                        <View style={{width: 40, alignItems:'center'}}>
                                        {index === 0 ? <FontAwesome5 name="medal" size={14} color="#FFD700" /> : 
                                         index === 1 ? <FontAwesome5 name="medal" size={14} color="#C0C0C0" /> :
                                         index === 2 ? <FontAwesome5 name="medal" size={14} color="#CD7F32" /> :
                                         <Text style={[styles.rankingText, {fontWeight: 'bold'}]}>{index + 1}</Text>
                                        }
                                    </View>
                                        <View style={{flex: 1}}>
                                            <Text style={[styles.rankingText, {fontWeight: 'bold'}]}>
                                                {entry.user.nombre} {entry.user.apellido}
                                            </Text>
                                        </View>
                                        <Text style={[styles.rankingText, {width: 80, textAlign:'right', fontSize: 13}]}>
                                            {resultString}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            );
        };

        return (
            <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            {/* HEADER DEL MODAL (Estilo RM) */}
                            <View style={styles.header}>
                                {viewMode === 'detail' && (
                                    <TouchableOpacity onPress={() => setViewMode('list')} style={{padding: 10}}>
                                        <Ionicons name="arrow-back" size={24} color={Colors[colorScheme].text} />
                                    </TouchableOpacity>
                                )}
                                <View style={{flex: 1, paddingLeft: 15}}>
                                    <ThemedText style={{fontSize: 20, fontWeight: 'bold'}}>
                                        {viewMode === 'list' ? 'Desafíos' :  ''}
                                    </ThemedText>
                                </View>
                                
                                
                                
                                <TouchableOpacity onPress={onClose} style={{padding: 10, marginRight: 5}}>
                                    <Ionicons name="close-circle" size={28} color={Colors[colorScheme].icon} />
                                </TouchableOpacity>
                            </View>

                            <View style={{flex: 1, padding: 20}}>
                                {renderContent()}
                            </View>
                        </View>
                    </View>
            </Modal>
        );
    };

    // --- FIN MODAL SCOREBOARD ---

    const ActionButton = ({ onPress, iconName, title, color, iconColor = '#fff', styles }) => (
        <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: color }]}
            onPress={onPress}
        >
            <FontAwesome5 name={iconName} size={16} color={iconColor} />
            <Text style={styles.actionButtonText}>{title}</Text>
        </TouchableOpacity>
    );

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
        const { user, refreshUser , gymColor } = useAuth();
        const colorScheme = useColorScheme() ?? 'light';
        const styles = getStyles(colorScheme, gymColor);
        const calendarTheme = getCalendarTheme(colorScheme, gymColor);
        const [classTypes, setClassTypes] = useState([]);
        const [selectedClassType, setSelectedClassType] = useState('all');
        const [isRefreshing, setIsRefreshing] = useState(false); 
        const [adminPhoneNumber, setAdminPhoneNumber] = useState(null);
        const [alertInfo, setAlertInfo] = useState({ visible: false, title: '', message: '', buttons: [] });
        const [isFilterModalVisible, setFilterModalVisible] = useState(false);
        const [isQrModalVisible, setQrModalVisible] = useState(false);
        
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
                await refreshUser();
                
                const [classesResponse, typesResponse, scoreboardsResponse] = await Promise.all([
                    apiClient.get('/classes'),
                    apiClient.get('/tipos-clase?forCreation=true'),
                    apiClient.get('/scoreboards/active') 
                ]);
                
                setAllClasses(classesResponse.data);
                const filteredTypes = (typesResponse.data.tiposClase || []).filter(type => !type.esUniversal);
                setClassTypes(filteredTypes);

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
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }, [user, colorScheme, gymColor, refreshUser]);

        useFocusEffect(useCallback(() => {
            const loadInitialData = async () => {
                setIsLoading(true);
                await fetchData();
                setIsLoading(false);
            };
            loadInitialData();
        }, [fetchData]));

        const onRefresh = useCallback(async () => {
            setIsRefreshing(true);
            await fetchData();
            setIsRefreshing(false);
        }, [fetchData]);

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
                .map(cls => ({
                    ...cls,
                    isEnrolled: (cls.usuariosInscritos || []).includes(user?._id),
                    isWaiting: (cls.waitlist || []).includes(user?._id),
                    isFull: (cls.usuariosInscritos || []).length >= cls.capacidad,
                    isCancelled: cls.estado === 'cancelada',
                    isFinished: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaFin}:00`).getTime() < nowTime,
                    dateTime: parseISO(`${cls.fecha.substring(0, 10)}T${cls.horaInicio}:00`),
                }))
                .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
        }, [allClasses, selectedDate, selectedClassType, index, user]); 

        // HANDLERS (Enroll, etc)
        const handleEnroll = useCallback(async (classId) => {
            setAlertInfo({
                visible: true, title: "Confirmar Inscripción", message: "¿Estás seguro de que quieres inscribirte en este turno?",
                buttons: [
                    { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                    { text: "Sí, Inscribirme", style: 'primary', onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            await apiClient.post(`/classes/${classId}/enroll`);
                            await refreshUser(); fetchData();
                            setAlertInfo({ visible: true, title: '¡Éxito!', message: 'Te has inscrito en el turno.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo procesar la inscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }}
                ]
            });
        }, [refreshUser, fetchData]);

        const handleUnenroll = useCallback(async (classId) => {
            setAlertInfo({
                visible: true, title: "Confirmar Anulación", message: "¿Estás seguro de que quieres anular tu inscripción?",
                buttons: [
                    { text: "Cancelar", style: "cancel", onPress: () => setAlertInfo({ visible: false }) },
                    { text: "Sí, Anular", style: 'destructive', onPress: async () => {
                        setAlertInfo({ visible: false });
                        try {
                            const response = await apiClient.post(`/classes/${classId}/unenroll`);
                            await refreshUser(); fetchData();
                            setAlertInfo({ visible: true, title: 'Anulación Procesada', message: response.data.message, buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        } catch (error) {
                            setAlertInfo({ visible: true, title: 'Error', message: error.response?.data?.message || 'No se pudo anular la inscripción.', buttons: [{ text: 'OK', style: 'primary', onPress: () => setAlertInfo({ visible: false }) }] });
                        }
                    }}
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
            const { isEnrolled, isFull, isWaiting, isCancelled, isFinished } = item;
            const dynamicStyle = getClassStyle(item, styles, colorScheme);
            return (
                <ThemedView style={[styles.classItem, dynamicStyle, isFinished && styles.finishedClass]}>
                    <ThemedText style={[styles.className, (isCancelled || isFinished) && styles.disabledText]}>{item.nombre || 'Turno'} - {item.tipoClase?.nombre || ''}</ThemedText>
                    <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Horario: {item.horaInicio}hs - {item.horaFin}hs</ThemedText>
                    <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>A cargo de: {formatTeachers(item)}</ThemedText>
                    <ThemedText style={[styles.classInfoText, (isCancelled || isFinished) && styles.disabledText]}>Cupos: {(item.usuariosInscritos || []).length}/{item.capacidad}</ThemedText>
                    <View style={styles.buttonContainer}>
                        {isCancelled ? <Text style={styles.badgeCancelled}>CANCELADO</Text> : isFinished ? <Text style={styles.badgeFinished}>FINALIZADO</Text> : isEnrolled ? <ActionButton title="Anular Inscripción" onPress={() => handleUnenroll(item._id)} iconName="calendar-times" color="#e74c3c" styles={styles} /> : isFull ? (isWaiting ? <ActionButton title="En lista de espera" onPress={() => handleUnsubscribe(item._id)} iconName="user-clock" color="#f0ad4e" styles={styles} /> : <ActionButton title="Notificarme Disponibilidad" onPress={() => handleSubscribe(item._id)} iconName="bell" color="#1a5276" styles={styles} />) : <ActionButton title="Inscribirme" onPress={() => handleEnroll(item._id)} iconName="calendar-check" color="#2ecc71" styles={styles} />}
                    </View>
                </ThemedView>
            );
        };

        const CalendarScene = () => (
            <ThemedView style={{ flex: 1 }}>
                <Calendar onDayPress={handleDayPress} markedDates={markedDates} markingType={'custom'} theme={calendarTheme} />
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.qrButton} onPress={() => setQrModalVisible(true)}>
                        <Ionicons name="qr-code" size={24} color={Colors[colorScheme].icon} />
                        <ThemedText style={styles.qrButtonText}>Mi Credencial</ThemedText>
                    </TouchableOpacity>
                </View>
            </ThemedView>
        );

        const ListScene = () => (
            <ThemedView style={{ flex: 1 }}>
                <ThemedText style={styles.listHeader}>{formattedDateTitle}</ThemedText>
                <TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
                    <ThemedText style={styles.filterButtonText}>Filtrar Turnos</ThemedText>
                    <FontAwesome5 name="chevron-down" size={12} color={Colors[colorScheme].text} />
                </TouchableOpacity>
                {visibleClasses.length === 0 && !isLoading ? <ThemedText style={styles.emptyText}>No hay turnos para los filtros seleccionados.</ThemedText> : (selectedDate ? <FlatList data={visibleClasses} keyExtractor={item => item._id} renderItem={renderClassItem} ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay turnos para este día.</ThemedText>} contentContainerStyle={{ paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />} /> : <SectionList sections={sectionedClasses} keyExtractor={(item, index) => item._id + index} renderItem={renderClassItem} renderSectionHeader={({ section: { title } }) => <ThemedText style={styles.sectionHeader}>{title}</ThemedText>} ListEmptyComponent={<ThemedText style={styles.emptyText}>No hay próximos turnos.</ThemedText>} contentContainerStyle={{ paddingBottom: 20 }} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={gymColor} />} />)}
            </ThemedView>
        );

        const renderScene = SceneMap({ calendar: CalendarScene, list: ListScene });

        if (isLoading) return <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={Colors[colorScheme].tint} /><ThemedText style={styles.loadingText}>Cargando clases...</ThemedText></ThemedView>;
        
        return (
            <View style={{ flex: 1 }}>
                <TabView navigationState={{ index, routes }} renderScene={renderScene} onIndexChange={handleIndexChange} initialLayout={{ width: layout.width }} renderTabBar={props => <TabBar {...props} style={{ backgroundColor: gymColor, paddingTop: Platform.OS === 'android' ? 10 : 0 }} indicatorStyle={{ backgroundColor: '#ffffff', height: 3 }} labelStyle={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold', textTransform:'none' }} />} />
                
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

                {/* MODAL SCOREBOARD INTEGRADO CON ESTILO RM */}
                <ClientScoreboardModal 
                    visible={isScoreboardVisible} 
                    onClose={() => setScoreboardVisible(false)} 
                    gymColor={gymColor} 
                    colorScheme={colorScheme} 
                />

                <FilterModal visible={isFilterModalVisible} onClose={() => setFilterModalVisible(false)} options={[{ _id: 'all', nombre: 'Todos los Turnos' }, ...classTypes]} onSelect={handleSelectClassType} selectedValue={selectedClassType} title="Tipo de Turno" theme={{ colors: Colors[colorScheme], gymColor }} />
                <CustomAlert visible={alertInfo.visible} title={alertInfo.title} message={alertInfo.message} buttons={alertInfo.buttons} onClose={() => setAlertInfo({ ...alertInfo, visible: false })} gymColor={gymColor} />
                <QrModal visible={isQrModalVisible} onClose={() => setQrModalVisible(false)} user={user} gymColor={gymColor} />
            </View>
        );
    };

    // HELPERS
    const getClassStyle = (clase, styles, colorScheme) => {
        if (clase.estado === 'cancelada') return styles.cancelledClass;
        const fillRatio = clase.capacidad > 0 ? (clase.usuariosInscritos || []).length / clase.capacidad : 0;
        if (fillRatio === 1) return styles.fullClass;
        if (fillRatio >= 0.8) return styles.almostFullClass;
        if (fillRatio < 0.4) return styles.emptyClass;
        if (fillRatio < 0.7) return styles.almostEmptyClass;
        return {}; 
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

    const getStyles = (colorScheme, gymColor) => StyleSheet.create({
        container: { flex: 1 },
        actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 5 },
        actionButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, fontSize: 14 },
        listHeader: { textAlign: 'center', fontSize: 20, fontWeight: 'bold', padding: 15, color: Colors[colorScheme].text, backgroundColor: Colors[colorScheme].background },
        sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: Colors[colorScheme].background, opacity: 0.9, color: Colors[colorScheme].text },
        
        classItem: { padding: 20, marginHorizontal: 16, marginVertical: 8, borderRadius: 5, elevation: 2, backgroundColor: Colors[colorScheme].background, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, borderWidth: 1, borderColor: Colors[colorScheme].border },
        className: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: Colors[colorScheme].text },
        classInfoText: { fontSize: 14, opacity: 0.8, marginBottom: 4, color: Colors[colorScheme].text },
        buttonContainer: { marginTop: 12, alignSelf: 'flex-start' },
        emptyText: { textAlign: 'center', marginTop: 30, fontSize: 16, opacity: 0.7, color: Colors[colorScheme].text },
        
        // --- ESTILOS DE CLASES ---
        cancelledClass: { backgroundColor: colorScheme === 'dark' ? '#333' : '#f5f5f5', borderColor: '#555', borderWidth: 1, borderLeftWidth: 0 },
        finishedClass: { opacity: 0.6 },
        disabledText: { color: Colors[colorScheme].icon },
        badgeCancelled: { color: Colors.light.error, fontStyle: 'italic', fontWeight: 'bold' },
        badgeFinished: { color: Colors[colorScheme].icon, fontStyle: 'italic', fontWeight: 'bold' },
        emptyClass: { borderLeftWidth: 15, borderColor: '#006400', backgroundColor: colorScheme === 'dark' ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9' },
        almostEmptyClass: { borderLeftWidth: 15, borderColor: '#FFC107', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 193, 7, 0.2)' : '#fffde7' },
        almostFullClass: { borderLeftWidth: 15, borderColor: '#ff7707', backgroundColor: colorScheme === 'dark' ? 'rgba(255, 119, 7, 0.2)' : '#fff3e0' },
        fullClass: { borderLeftWidth: 15, borderColor: '#F44336', backgroundColor: colorScheme === 'dark' ? 'rgba(244, 67, 54, 0.2)' : '#ffebee' },

        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        loadingText: { marginTop: 10, fontSize: 16, color: Colors[colorScheme].text },
        filterButton: { height: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 15, marginVertical: 10, paddingHorizontal: 15, borderRadius: 5, backgroundColor: Colors[colorScheme].background },
        filterButtonText: { fontSize: 16, color: Colors[colorScheme].text },
        headerActions: { backgroundColor: Colors[colorScheme].background, paddingHorizontal: 15, paddingVertical: 10 },
        qrButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors[colorScheme].cardBackground, paddingVertical: 18, paddingHorizontal: 15, borderRadius: 5, elevation: 2, marginTop: 10,  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, borderWidth: 1, borderColor: Colors[colorScheme].border },
        qrButtonText: { marginLeft: 15, fontSize: 16, fontWeight: '500', color: Colors[colorScheme].text },
        
        // FABs
        fabWhatsApp: { position: 'absolute', width: 50, height: 50, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: '#25D366', borderRadius: 30, elevation: 8, zIndex: 999 },
        fabScoreboard: { position: 'absolute', width: 50, height: 50, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 80, backgroundColor: gymColor, borderRadius: 30, elevation: 8, zIndex: 999 },

        // --- ESTILOS DEL MODAL (Tipo RM) ---
        modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
        modalContainer: { backgroundColor: Colors[colorScheme].background, borderTopLeftRadius: 5, borderTopRightRadius: 5, height: '85%',overflow: 'hidden' },
        header: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 10 },
        
        // Scoreboard Items
        scoreboardItem: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: gymColor, width: '100%', paddingBottom: 10 , marginBottom: 20},
        scoreboardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors[colorScheme].text },
        scoreboardSubtitle: { fontSize: 12, color: Colors[colorScheme].icon, marginTop: 2 },
        statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 10 },
        statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

        // Detail
        detailTitle: { fontSize: 25, fontWeight: 'bold', textAlign: 'center', color: Colors[colorScheme].text, marginBottom: 5 },
        detailDesc: { fontSize: 12, textAlign: 'center', color: Colors[colorScheme].text, opacity: 0.8, marginBottom: 15 },
        lockedContainer: { alignItems: 'center', padding: 20 },
        lockedText: { fontSize: 16, textAlign: 'center', color: Colors[colorScheme].text, marginBottom: 20 },
        formContainer: { width: '100%' },
        inputLabel: { fontSize: 14, color: Colors[colorScheme].text, marginBottom: 5, fontWeight: '600' },
        input: { backgroundColor: Colors[colorScheme].background, borderRadius: 5, padding: 12, borderWidth: 1, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text },
        mainButton: { padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 10 },
        mainButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

        // My Score & Ranking
        myScoreContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, padding: 15, backgroundColor: Colors[colorScheme].cardBackground, borderRadius: 5, alignItems: 'center',  elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, borderWidth: 1, borderColor: Colors[colorScheme].border },
        rankingHeader: { flexDirection: 'row', width: '100%',paddingVertical: 10, },
        rankingHeadText: { fontSize: 15, fontWeight: 'bold', color: Colors[colorScheme].text },
        rankingRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: gymColor},
        rankingText: { fontSize: 14, color: Colors[colorScheme].text },

    });

    export default CalendarScreen;