import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentResult() {
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes('admin');
    const isProfessor = user?.roles?.includes('profesor');

    if (isAdmin) return <Redirect href="/(admin-tabs)/profile" />;
    if (isProfessor) return <Redirect href="/(profesor-tabs)/profile" />;
    return <Redirect href="/(tabs)/profile" />;
}
