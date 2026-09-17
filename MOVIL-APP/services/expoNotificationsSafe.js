import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

/**
 * On Android Expo Go (SDK 53+), importing expo-notifications throws at module load
 * because remote push was removed. Guard the require so the rest of the app can boot.
 */
const isExpoGoAndroid = isRunningInExpoGo() && Platform.OS === 'android';

let Notifications = null;

if (!isExpoGoAndroid) {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.warn('[notifications] expo-notifications unavailable:', error?.message || error);
    Notifications = null;
  }
} else if (__DEV__) {
  console.warn(
    '[notifications] Push notifications are unavailable in Expo Go on Android. Use a development build for full support.'
  );
}

export function getNotifications() {
  return Notifications;
}

export function isPushNotificationsAvailable() {
  return Notifications != null;
}

export default Notifications;
