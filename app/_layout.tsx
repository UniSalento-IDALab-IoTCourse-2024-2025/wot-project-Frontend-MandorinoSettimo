import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, {useEffect, useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ApiConfig } from '@/constants/ApiConfig';
import { registerForPushNotificationsAsync } from '@/app/services/notification';
import {addPendingNotification} from "@/app/services/pendingNotifications";

// Evita che la splash screen scompaia prima del caricamento dei font
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    // Mostra la splash screen solo finché i font non sono caricati
    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    const notificheInAttesaRef = useRef<Notifications.Notification[]>([]);

    // Ascolta le notifiche ricevute mentre l'app è in foreground
    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
            const currentUserId = await AsyncStorage.getItem('userId');
            const targetUserId = notification.request.content.data?.userId;

            if (targetUserId === currentUserId) {
                // Mostra subito l’alert se l’utente è giusto
                Alert.alert(notification.request.content.title ?? 'Notifica', notification.request.content.body ?? '');
            } else {
                // Salva notifica "non per me" per possibile lettura futura
                console.log('🔕 Notifica salvata per dopo:', notification);
                addPendingNotification(notification);
            }
        });

        return () => subscription.remove();
    }, []);

    useEffect(() => {
        const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
            const notification = response.notification;
            const currentUserId = await AsyncStorage.getItem('userId');
            const targetUserId = notification.request.content.data?.userId;

            if (targetUserId === currentUserId) {
                Alert.alert(notification.request.content.title ?? 'Notifica', notification.request.content.body ?? '');
            } else {
                console.log('🔕 Notifica (da tap) salvata per dopo:', notification);
                addPendingNotification(notification);
            }
        });

        return () => {
            responseListener.remove();
        };
    }, []);


    if (!loaded) return null;

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs-admin)" options={{ headerShown: false }} />

                <Stack.Screen
                    name="login"
                    options={{
                        headerBackVisible: false,
                        title: 'Accedi a DeliveryGo',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="register"
                    options={{
                        title: 'Registrati su DeliveryGo',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerBackTitle: 'Indietro',
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="profile/edit"
                    options={{
                        title: 'Profilo',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerBackTitle: 'Indietro',
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="profile/change-password"
                    options={{

                        title: 'Cambio password',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="location/create-location"
                    options={{
                        title: 'Crea cliente',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerBackTitle: 'Indietro',
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="vehicles/create-vehicle"
                    options={{
                        title: 'Crea veicolo',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerBackTitle: 'Indietro',
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="vehicles/update-status"
                    options={{
                        title: 'Aggiorna stato veicolo',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="users/user-list"
                    options={{
                        title: 'I tuoi dipendenti',
                        headerBackTitle: 'Indietro',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />


                <Stack.Screen
                    name="users/update-status"
                    options={{
                        title: 'Aggiorna stato utente',
                        headerBackTitle: 'Indietro',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="ordini/assign-driver"
                    options={{
                        title: 'Assegna camionista',

                        headerBackVisible: false,
                        headerStyle: { backgroundColor: '#06631e' },
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen
                    name="ordini/order"
                    options={{
                        title: 'Crea ordine',
                        headerBackTitle: 'Indietro',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },

                    }}
                />
                <Stack.Screen
                    name="password"
                    options={{
                        title: 'Cambia Password',
                        headerStyle: { backgroundColor: '#06631e' },
                        headerBackTitle: 'Indietro',
                        headerTintColor: '#ffffff',
                        headerTitleStyle: { fontWeight: 'bold', fontSize: 15 },
                    }}
                />
                <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
