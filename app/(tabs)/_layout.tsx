// _layout.tsx (per il layout di tab principale)
import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { HapticTab } from '@/components/HapticTab';
import {Ionicons} from "@expo/vector-icons";

export default function TabLayout() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                setIsAuthenticated(!!token);
            } catch (error) {
                console.log('Errore nel recupero del token: ', error);
                setIsAuthenticated(false);
            }
        };

        checkAuthStatus();
    }, []);

    useEffect(() => {
        if (isAuthenticated === false) {
            router.replace('/login'); // Reindirizza alla pagina di login se non autenticato
        }
    }, [isAuthenticated, router]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#ffffff',
                tabBarInactiveTintColor: '#cbd5e1',

                tabBarButton: HapticTab,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: '#06631e', // blu di sfondo
                    borderTopWidth: 0,
                    elevation: 0,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: 'Mappa',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
                }}
            />

            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profilo',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
                }}
            />



            <Tabs.Screen
                name="orderscheck"
                options={{
                    title: 'Ordini',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="clipboard-outline" size={size ?? 28} color={color} />
                    ),
                }}
            />



        </Tabs>
    );
}
