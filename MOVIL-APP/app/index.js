import { View, ActivityIndicator } from 'react-native';


export default function StartPage() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" />
        </View>
    );
}