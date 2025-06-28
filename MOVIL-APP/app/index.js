// Archivo: MOVIL-APP/app/index.js
import { Redirect } from 'expo-router';

// El layout principal se encargará de decidir a dónde ir.
// Este archivo solo sirve como punto de entrada inicial.
export default function StartPage() {
    return <Redirect href="/calendar" />;
}