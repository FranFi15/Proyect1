import React, { useState, useCallback } from 'react';
import { 
    StyleSheet, 
    ScrollView, 
    Modal, 
    TouchableOpacity,
    useColorScheme,
    View,
    ActivityIndicator
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

// Importamos los nuevos componentes para los modales
import BalanceModal from '@/components/client/BalanceModal';
import PlansAndCreditsModal from '@/components/client/PlansAndCreditsModal';
import EditProfileModal from '@/components/client/EditProfileModal';

const ProfileScreen = () => {
    const { logout, user, gymColor, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState(user);
    const [loading, setLoading] = useState(false);

    // Estados para controlar la visibilidad de cada modal
    const [isBalanceModalVisible, setBalanceModalVisible] = useState(false);
    const [isPlansModalVisible, setPlansModalVisible] = useState(false);
    const [isEditModalVisible, setEditModalVisible] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    // useFocusEffect ahora solo se asegura de que el perfil base esté disponible
    useFocusEffect(
        useCallback(() => {
            setProfile(user);
        }, [user])
    );

    const handleLogout = () => {
        Alert.alert("Cerrar Sesión", "¿Estás seguro de que quieres salir?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Salir", style: "destructive", onPress: logout }
        ]);
    };

    if (authLoading || !profile) {
        return <ThemedView style={styles.centered}><ActivityIndicator size="large" color={gymColor} /></ThemedView>;
    }

    return (
        <ThemedView style={styles.container}>
            <ScrollView>
                <View style={styles.headerContainer}>
                    <ThemedText style={styles.headerTitle}>{profile.nombre} {profile.apellido}</ThemedText>
                    <ThemedText style={styles.headerSubtitle}>{profile.email}</ThemedText>
                </View>

                {/* Botones para abrir los modales */}
                <View style={styles.menuContainer}>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setBalanceModalVisible(true)}>
                        <Ionicons name="cash-outline" size={24} color={gymColor} />
                        <ThemedText style={styles.menuButtonText}>Mi Saldo y Movimientos</ThemedText>
                        <Ionicons name="chevron-forward" size={22} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuButton} onPress={() => setPlansModalVisible(true)}>
                        <Ionicons name="document-text-outline" size={24} color={gymColor} />
                        <ThemedText style={styles.menuButtonText}>Mis Planes y Créditos</ThemedText>
                        <Ionicons name="chevron-forward" size={22} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuButton} onPress={() => setEditModalVisible(true)}>
                        <Ionicons name="person-outline" size={24} color={gymColor} />
                        <ThemedText style={styles.menuButtonText}>Editar Mis Datos</ThemedText>
                        <Ionicons name="chevron-forward" size={22} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={24} color={Colors.light.error} />
                        <ThemedText style={[styles.menuButtonText, {color: Colors.light.error}]}>Cerrar Sesión</ThemedText>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Renderizado de los Modales */}
            <Modal visible={isBalanceModalVisible} transparent={true} animationType="slide" onRequestClose={() => setBalanceModalVisible(false)}>
                <BalanceModal onClose={() => setBalanceModalVisible(false)} />
            </Modal>

            <Modal visible={isPlansModalVisible} transparent={true} animationType="slide" onRequestClose={() => setPlansModalVisible(false)}>
                <PlansAndCreditsModal onClose={() => setPlansModalVisible(false)} />
            </Modal>

            <Modal visible={isEditModalVisible} transparent={true} animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
                <EditProfileModal userProfile={profile} onClose={() => setEditModalVisible(false)} />
            </Modal>

        </ThemedView>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerContainer: {
        backgroundColor: gymColor,
        padding: 30,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.9,
        marginTop: 4,
    },
    menuContainer: {
        marginTop: 20,
        paddingHorizontal: 10,
    },
    menuButton: {
        backgroundColor: Colors[colorScheme].cardBackground,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 15,
        borderRadius: 2,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    menuButtonText: {
        flex: 1,
        marginLeft: 15,
        fontSize: 16,
        fontWeight: '500',
    },
});

export default ProfileScreen;
