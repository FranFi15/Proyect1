import { Redirect } from 'expo-router';

// Este archivo redirige al usuario desde la raíz del grupo de pestañas del profesor
// hacia la primera pantalla que debe ver: 'my-classes'.
export default function ProfessorTabIndex() {
  return <Redirect href="/(profesor-tabs)/my-classes" />;
}