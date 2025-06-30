import { Redirect } from 'expo-router';

// Este componente no renderiza nada.
// Su único propósito es redirigir al usuario.
export default function TabIndex() {
  return <Redirect href="/(tabs)/calendar" />;
}