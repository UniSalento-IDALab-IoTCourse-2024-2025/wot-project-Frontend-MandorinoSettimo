import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';


export default function AdminHomeScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Ionicons name="person-circle" size={100} color="#06631EFF" style={styles.icon} />
            <Text style={styles.title}>Benvenuto Admin!</Text>
            <Text style={styles.subtitle}>Gestisci il sistema DeliveryGo</Text>



            {/* Vedi clienti */}
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('/(tabs-admin)/location-list')}
            >
                <Text style={styles.buttonText}>Visualizza clienti</Text>
            </TouchableOpacity>

            {/* Vedi veicoli */}
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('/(tabs-admin)/vehicle-list')}
            >
                <Text style={styles.buttonText}>Visualizza veicoli</Text>
            </TouchableOpacity>

            {/* Vedi ordini */}
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('/(tabs-admin)/order-list')}
            >
                <Text style={styles.buttonText}>Visualizza ordini</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('../users/user-list')}
            >
                <Text style={styles.buttonText}>Visualizza camionisti</Text>
            </TouchableOpacity>

            {/* Vedi ordini già assegnati */}
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('../ordini/assign-driver')}
            >
                <Text style={styles.buttonText}>Assegna utenti</Text>
            </TouchableOpacity>



            {/* Vedi mappa complessiva */}
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('../(tabs-admin)/admin-map')}
            >
                <Text style={styles.buttonText}>Mappa</Text>
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
                style={[styles.button, styles.logoutButton]}
                onPress={handleLogout}
            >
                <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>

        </View>
    );
}


const handleLogout = async () => {
    try {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('userId');
        router.replace('/login');
    } catch (e) {
        console.log('Errore logout:', e);
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f6f8fa',
        justifyContent: 'center',
    },
    icon: {
        alignSelf: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 20,
        color: '#1f2937',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 20,
        color: '#4b5563',
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#06631e',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 12,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    logoutButton: {
        backgroundColor: '#dc2626',
    },
});
