import React from 'react';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { StyleSheet } from 'react-native';

export default function ManageClientsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Gestión de Clases</ThemedText>
      <ThemedText>Aquí se mostrará la lista de socios y las herramientas para administrarlos.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,    
  },
});
