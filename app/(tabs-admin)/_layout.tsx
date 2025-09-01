// _layout.tsx (per il layout dei tab di admin)
import { Tabs } from 'expo-router';
import React from 'react';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { HapticTab } from '@/components/HapticTab';
import {Ionicons, MaterialCommunityIcons, MaterialIcons} from '@expo/vector-icons';

export default function AdminTabLayout() {
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
                    backgroundColor: '#06631e',
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
                name="location-list"
                options={{
                    title: 'Clienti',
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="person-pin" size={30} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="vehicle-list"
                options={{
                    title: 'Veicoli',
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="truck" size={30} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="order-list"
                options={{
                    title: 'Ordini',
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="truck-fast-outline" size={30} color={color} />

                    ),
                }}
            />




        </Tabs>
    );
}
