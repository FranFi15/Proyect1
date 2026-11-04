import { View } from 'react-native';
import GymLogoSpinner from '@/components/GymLogoSpinner';


export default function StartPage() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <GymLogoSpinner size="large" />
        </View>
    );
}