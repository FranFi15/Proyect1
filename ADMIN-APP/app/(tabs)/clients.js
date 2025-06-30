import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, StyleSheet, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import apiClient from '../../services/api';


export default function ClientsScreen() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchClients = async () => {
    try {
      const response = await apiClient.get('/users');
      // Filtramos para mostrar solo a los clientes, no a otros admins si existieran
      setClients(response.data.users.filter(u => u.role === 'client'));
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchClients();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClients().then(() => setRefreshing(false));
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={clientStyles.itemContainer} onPress={() => router.push(`/clients/${item._id}`)}>
      <View>
        <Text style={clientStyles.itemTitle}>{item.name} {item.lastName}</Text>
        <Text style={clientStyles.itemSubtitle}>{item.email}</Text>
      </View>
       <Text style={clientStyles.credits}>Créditos: {item.credits}</Text>
    </TouchableOpacity>
  );
  
  if (loading) {
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;
  }

  return (
    <FlatList
      data={clients}
      renderItem={renderItem}
      keyExtractor={(item) => item._id}
      style={clientStyles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
}

const clientStyles = StyleSheet.create({
  list: {
    backgroundColor: '#f0f0f0',
  },
  itemContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2, // for Android shadow
    shadowColor: '#000', // for iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemSubtitle: {
    fontSize: 14,
    color: 'gray',
  },
  credits: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#28a745'
  }
});