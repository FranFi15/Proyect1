// app/(tabs)/calendar.js
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import apiClient from '../../services/apiClient';

const CalendarScreen = () => {
    const [markedDates, setMarkedDates] = useState({});
    const router = useRouter(); // Hook para manejar la navegación

    // Esta función ahora solo necesita marcar los días con clases
    const fetchMarkedDates = async () => {
        try {
            const classesResponse = await apiClient.get('/classes');
            const markers = {};
            classesResponse.data.forEach(cls => {
                const dateString = cls.fecha.substring(0, 10);
                if (cls.estado !== 'cancelada') {
                    markers[dateString] = { marked: true, dotColor: '#6f5c94' };
                }
            });
            setMarkedDates(markers);
        } catch (error) {
            console.error("Error al marcar las fechas:", error);
        }
    };

    // Refresca las fechas marcadas cada vez que se enfoca la pantalla
    useFocusEffect(
        useCallback(() => {
            fetchMarkedDates();
        }, [])
    );

    // Al presionar un día, navegamos a la nueva pantalla de lista de clases
    const handleDayPress = (day) => {
        router.push({
            pathname: '/class-list', // La ruta a nuestro nuevo archivo
            params: { date: day.dateString } // Le pasamos la fecha seleccionada como parámetro
        });
    };

    return (
        <View style={styles.container}>
            <Calendar
                onDayPress={handleDayPress}
                markedDates={markedDates}
                theme={{
                    selectedDayBackgroundColor: '#6f5c94',
                    todayTextColor: '#6f5c94',
                    arrowColor: '#6f5c94',
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
});

export default CalendarScreen;