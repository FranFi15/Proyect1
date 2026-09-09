import { Redirect } from 'expo-router';

export default function MercadoPagoOAuthReturn() {
    return <Redirect href="/(admin-tabs)/profile" />;
}
