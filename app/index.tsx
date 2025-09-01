// app/index.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { jwtDecode } from 'jwt-decode';

// Tipizzazione facoltativa per chiarezza
interface JwtPayload {
    role?: string;
    exp?: number;
}

export default function IndexScreen() {
    useEffect(() => {
        const redirectByRole = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');

                if (!token) {
                    router.replace('/login');
                    return;
                }

                const decoded: JwtPayload = jwtDecode(token);

                if (decoded?.role === 'ADMIN') {
                    router.replace('/(tabs-admin)');
                } else {
                    router.replace('/(tabs)');
                }

            } catch (error) {
                console.error('Errore durante il redirect iniziale:', error);
                router.replace('/login');
            }
        };

        redirectByRole();
    }, []);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#2563eb" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
});
