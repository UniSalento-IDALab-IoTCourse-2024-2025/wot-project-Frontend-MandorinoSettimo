import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '@/constants/ApiConfig';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Device.isDevice) {
        alert('Le notifiche funzionano solo su un dispositivo fisico');
        return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        alert('Permesso per le notifiche negato!');
        return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    // 👉 Salva il token nel backend
    try {
        const userId = await AsyncStorage.getItem('userId');
        console.log('📦 userId per token push:', userId);
        const authToken = await AsyncStorage.getItem('authToken');

        if (userId && authToken) {
            await fetch(`${ApiConfig.POSITION_SERVICE}/users/${userId}/push-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ pushToken: token }),
            });
        }
    } catch (e) {
        console.error('Errore durante il salvataggio del push token:', e);
    }

    return token;
}
