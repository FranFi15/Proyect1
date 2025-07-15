import { Redirect } from 'expo-router';

// Redirige a la primera pestaña por defecto del admin.
export default function AdminTabIndex() {
  return <Redirect href="/(admin-tabs)/clients" />;
}