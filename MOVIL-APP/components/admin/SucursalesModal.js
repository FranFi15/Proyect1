import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import CustomAlert from '@/components/CustomAlert';

const SucursalesModal = ({ visible, onClose, gymColor, apiClient, setAlertInfo }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const dynamicStyles = getStyles(colorScheme, gymColor);

    const [internalAlert, setInternalAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

    const showAlert = (alertData) => {
        setInternalAlert({
            visible: true,
            title: alertData.title || '',
            message: alertData.message || '',
            buttons: alertData.buttons ? alertData.buttons.map(b => ({
                ...b,
                onPress: () => {
                    setInternalAlert(prev => ({ ...prev, visible: false }));
                    if (b.onPress) b.onPress();
                }
            })) : [{ text: 'OK', style: 'primary', onPress: () => setInternalAlert(prev => ({ ...prev, visible: false })) }]
        });
    };

    const [sucursales, setSucursales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editingSucursal, setEditingSucursal] = useState(null);
    const [nombre, setNombre] = useState('');
    const [direccion, setDireccion] = useState('');

    useEffect(() => {
        if (visible && apiClient) {
            fetchSucursales();
        }
    }, [visible]);

    const fetchSucursales = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/sucursales');
            setSucursales(res.data || []);
        } catch (error) {
            console.error("Error cargando sucursales:", error);
            showAlert({
                title: 'Error',
                message: 'No se pudieron cargar las sucursales.',
                buttons: [{ text: 'OK', style: 'primary' }]
            });
        } finally {
            setLoading(false);
        }
    };

    const handleStartEdit = (sucursal) => {
        setEditingSucursal(sucursal);
        setNombre(sucursal.nombre || '');
        setDireccion(sucursal.direccion || '');
    };

    const handleCancelEdit = () => {
        setEditingSucursal(null);
        setNombre('');
        setDireccion('');
    };

    const handleSave = async () => {
        if (!nombre || !nombre.trim()) {
            showAlert({
                title: 'Atención',
                message: 'El nombre de la sucursal es obligatorio.',
                buttons: [{ text: 'OK', style: 'primary' }]
            });
            return;
        }

        setSaving(true);
        try {
            if (editingSucursal) {
                await apiClient.put(`/sucursales/${editingSucursal._id}`, {
                    nombre: nombre.trim(),
                    direccion: direccion.trim()
                });
                showAlert({
                    title: 'Éxito',
                    message: 'Sucursal actualizada correctamente.',
                    buttons: [{ text: 'OK', style: 'primary' }]
                });
            } else {
                await apiClient.post('/sucursales', {
                    nombre: nombre.trim(),
                    direccion: direccion.trim()
                });
                showAlert({
                    title: 'Éxito',
                    message: 'Sucursal creada correctamente.',
                    buttons: [{ text: 'OK', style: 'primary' }]
                });
            }
            handleCancelEdit();
            fetchSucursales();
        } catch (error) {
            console.error("Error guardando sucursal:", error);
            showAlert({
                title: 'Error',
                message: error.response?.data?.message || 'No se pudo guardar la sucursal.',
                buttons: [{ text: 'OK', style: 'primary' }]
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (sucursal) => {
        showAlert({
            title: 'Eliminar Sucursal',
            message: `¿Estás seguro de que deseas eliminar "${sucursal.nombre}"? Los turnos asignados a esta sucursal serán reasignados o desvinculados.`,
            buttons: [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiClient.delete(`/sucursales/${sucursal._id}`);
                            showAlert({
                                title: 'Éxito',
                                message: 'Sucursal eliminada correctamente.',
                                buttons: [{ text: 'OK', style: 'primary' }]
                            });
                            fetchSucursales();
                        } catch (error) {
                            showAlert({
                                title: 'Error',
                                message: error.response?.data?.message || 'No se pudo eliminar la sucursal.',
                                buttons: [{ text: 'OK', style: 'primary' }]
                            });
                        }
                    }
                }
            ]
        });
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={dynamicStyles.modalOverlay}>
                <View style={dynamicStyles.modalContainer}>
                    {/* Header */}
                    <View style={dynamicStyles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <FontAwesome5 name="store" size={20} color={gymColor || Colors[colorScheme].tint} style={{ marginRight: 10 }} />
                            <ThemedText style={dynamicStyles.modalTitle}>Gestión de Sucursales</ThemedText>
                        </View>
                        <TouchableOpacity onPress={onClose} style={dynamicStyles.closeButton}>
                            <Ionicons name="close" size={24} color={Colors[colorScheme].text} />
                        </TouchableOpacity>
                    </View>

                    <CustomAlert
                        inline={true}
                        visible={internalAlert.visible}
                        title={internalAlert.title}
                        message={internalAlert.message}
                        buttons={internalAlert.buttons}
                        onClose={() => setInternalAlert({ ...internalAlert, visible: false })}
                        gymColor={gymColor}
                    />

                    <ScrollView style={dynamicStyles.modalBody} contentContainerStyle={{ paddingBottom: 30 }}>
                        {/* Formulario Crear/Editar */}
                        <View style={dynamicStyles.formBox}>
                            <Text style={dynamicStyles.formTitle}>
                                {editingSucursal ? `Editar: ${editingSucursal.nombre}` : 'Añadir Nueva Sucursal'}
                            </Text>
                            
                            <Text style={dynamicStyles.label}>Nombre de la Sucursal *</Text>
                            <TextInput
                                style={dynamicStyles.input}
                                placeholder="Ej. Sucursal Centro"
                                placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                                value={nombre}
                                onChangeText={setNombre}
                            />

                            <Text style={dynamicStyles.label}>Dirección (Opcional)</Text>
                            <TextInput
                                style={dynamicStyles.input}
                                placeholder="Ej. Av. Corrientes 1234"
                                placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                                value={direccion}
                                onChangeText={setDireccion}
                            />

                            <View style={dynamicStyles.formActions}>
                                {editingSucursal && (
                                    <TouchableOpacity style={dynamicStyles.cancelEditBtn} onPress={handleCancelEdit}>
                                        <Text style={dynamicStyles.cancelEditBtnText}>Cancelar</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[dynamicStyles.saveBtn, { backgroundColor: gymColor || Colors[colorScheme].tint }]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <Text style={dynamicStyles.saveBtnText}>
                                            {editingSucursal ? 'Actualizar Sucursal' : 'Crear Sucursal'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Lista de Sucursales */}
                        <Text style={dynamicStyles.listSectionTitle}>Sucursales Existentes</Text>

                        {loading ? (
                            <ActivityIndicator size="large" color={gymColor || Colors[colorScheme].tint} style={{ marginVertical: 30 }} />
                        ) : sucursales.length === 0 ? (
                            <Text style={dynamicStyles.emptyText}>No hay sucursales registradas.</Text>
                        ) : (
                            sucursales.map((item) => (
                                <View key={item._id} style={dynamicStyles.sucursalCard}>
                                    <View style={dynamicStyles.sucursalInfo}>
                                        <Text style={dynamicStyles.sucursalNombre}>{item.nombre}</Text>
                                        {item.direccion ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                <Ionicons name="location-outline" size={14} color={theme.colors.text} style={{ opacity: 0.7, marginRight: 4 }} />
                                                <Text style={[dynamicStyles.sucursalDireccion, { marginTop: 0 }]}>{item.direccion}</Text>
                                            </View>
                                        ) : (
                                            <Text style={dynamicStyles.sucursalDireccionSin}>Sin dirección especificada</Text>
                                        )}
                                    </View>
                                    <View style={dynamicStyles.sucursalCardActions}>
                                        <TouchableOpacity
                                            style={dynamicStyles.iconBtn}
                                            onPress={() => handleStartEdit(item)}
                                        >
                                            <FontAwesome5 name="pen" size={16} color={gymColor || Colors[colorScheme].tint} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={dynamicStyles.iconBtn}
                                            onPress={() => handleDelete(item)}
                                        >
                                            <FontAwesome5 name="trash" size={16} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: Colors[colorScheme].background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        width: '100%',
        paddingTop: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: colorScheme === 'dark' ? '#2c2c2e' : '#e5e5ea',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        paddingHorizontal: 20,
        paddingTop: 15,
    },
    formBox: {
        backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f2f2f7',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colorScheme === 'dark' ? '#2c2c2e' : '#e5e5ea',
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors[colorScheme].text,
        marginBottom: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: colorScheme === 'dark' ? '#aaa' : '#555',
        marginBottom: 6,
    },
    input: {
        backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#ffffff',
        color: Colors[colorScheme].text,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colorScheme === 'dark' ? '#3a3a3c' : '#d1d1d6',
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    cancelEditBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginRight: 10,
        backgroundColor: colorScheme === 'dark' ? '#3a3a3c' : '#e5e5ea',
    },
    cancelEditBtnText: {
        color: Colors[colorScheme].text,
        fontWeight: '600',
        fontSize: 14,
    },
    saveBtn: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    listSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors[colorScheme].text,
        marginBottom: 12,
    },
    sucursalCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#ffffff',
        borderRadius: 14,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colorScheme === 'dark' ? '#2c2c2e' : '#e5e5ea',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    sucursalInfo: {
        flex: 1,
        marginRight: 12,
    },
    sucursalNombre: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors[colorScheme].text,
        marginBottom: 4,
    },
    sucursalDireccion: {
        fontSize: 13,
        color: colorScheme === 'dark' ? '#aaa' : '#666',
    },
    sucursalDireccionSin: {
        fontSize: 12,
        fontStyle: 'italic',
        color: colorScheme === 'dark' ? '#666' : '#999',
    },
    sucursalCardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        padding: 8,
        marginLeft: 6,
        borderRadius: 8,
        backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f2f2f7',
    },
    emptyText: {
        textAlign: 'center',
        color: colorScheme === 'dark' ? '#888' : '#777',
        fontSize: 14,
        marginVertical: 20,
    }
});

export default SucursalesModal;
