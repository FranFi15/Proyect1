import { Text, View, StyleSheet, Button } from 'react-native';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { logout } = useAdminAuth();
  const router = useRouter();

  const handleLogout = async () => {
      await logout();
      router.replace('/gymIdentifier');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil del Admin</Text>
      <Button title="Cerrar Sesión" onPress={handleLogout} color="red" />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
});