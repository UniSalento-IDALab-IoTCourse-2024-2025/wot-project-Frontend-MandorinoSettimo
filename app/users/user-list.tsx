import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, StyleSheet, Pressable, Alert, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '@/constants/ApiConfig';
import { useRouter } from 'expo-router'; // 👈 aggiunto
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';


type User = {
    id: string;
    name: string;
    surname: string;
    email: string;
    phoneNumber: string;
    userStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'ASSIGNED' | 'ON_ROUTE';
};

export default function ViewUsersScreen() {
    const [users, setUsers] = useState<User[]>([]);
    const [filter, setFilter] =
        useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE' | 'ASSIGNED' | 'ON_ROUTE'>('ALL');

    const router = useRouter(); // 👈 aggiunto

    const STATI = [
        { label: 'Tutti', value: 'ALL' },
        { label: 'Disponibile', value: 'AVAILABLE' },
        { label: 'Non disp.', value: 'UNAVAILABLE' },
        { label: 'Per strada', value: 'ON_ROUTE' },
        { label: 'Assegnato', value: 'ASSIGNED' },
    ];

    const fetchUsers = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const url =
                filter === 'ALL'
                    ? `${ApiConfig.POSITION_SERVICE}/users/`
                    : `${ApiConfig.POSITION_SERVICE}/users/status/${filter}`;

            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            if (Array.isArray(json.userList)) setUsers(json.userList);
        } catch (e: any) {
            Alert.alert('Errore', 'Impossibile caricare gli utenti: ' + e.message);
        }
    }, [filter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // 2) quando torni su questa pagina
    useFocusEffect(
        useCallback(() => {
            fetchUsers();
            // opzionale: return () => {} per cleanup
        }, [fetchUsers])
    );

    const renderUserItem = ({ item }: { item: User }) => {
        let statusColorStyle = styles.statusRed;
        let containerStyle = styles.unavailableUser;
        let statusLabel = 'Non disponibile';

        if (item.userStatus === 'AVAILABLE') {
            statusColorStyle = styles.statusGreen;
            containerStyle = styles.availableUser;
            statusLabel = 'Disponibile';
        } else if (item.userStatus === 'ASSIGNED') {
            statusColorStyle = styles.statusYellow;
            containerStyle = styles.assignedUser;
            statusLabel = 'Assegnato';
        } else if (item.userStatus === 'ON_ROUTE') {
            statusColorStyle = styles.statusBlue;
            containerStyle = styles.onRouteUser;
            statusLabel = 'Per strada';
        } else if (item.userStatus === 'UNAVAILABLE') {
            statusColorStyle = styles.statusRed;
            containerStyle = styles.unavailableUser;
            statusLabel = 'Non disponibile';
        }

        return (
            <View style={[styles.userItem, containerStyle]}>
                <Text style={styles.name}>{item.name} {item.surname}</Text>
                <Text style={styles.email}>📧 {item.email}</Text>
                <Text style={styles.phone}>📞 {item.phoneNumber}</Text>
                <Text style={[styles.status, statusColorStyle]}>
                    Stato: {statusLabel}
                </Text>

                {/* Pulsante Aggiorna stato */}
                <TouchableOpacity
                    style={styles.updateButton}
                    onPress={() =>
                        router.push({
                            pathname: '/users/update-status',        // 👈 crea/usa questa screen
                            params: { id: item.id, currentStatus: item.userStatus },
                        })
                    }
                >
                    <Text style={styles.updateButtonText}>Aggiorna stato</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Camionisti registrati</Text>

            <View style={styles.filterContainer}>
                {STATI.map(({ label, value }) => (
                    <Pressable
                        key={value}
                        style={[
                            styles.filterButton,
                            filter === value && styles.filterButtonActive,
                        ]}
                        onPress={() => setFilter(value)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                filter === value && styles.filterTextActive,
                            ]}
                        >
                            {label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Contatore utenti (opzionale) */}
            <Text style={{ textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>
                Utenti: {users.length}
            </Text>

            <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', marginTop: 40 }}>
                        Nessun utente disponibile.
                    </Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: '700', marginBottom: 20, textAlign: 'center' },

    userItem: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 20 },
    availableUser: { borderColor: '#4ade80', backgroundColor: '#ecfdf5' },
    unavailableUser: { borderColor: '#f87171', backgroundColor: '#fee2e2' },
    assignedUser: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
    onRouteUser: { borderColor: '#60a5fa', backgroundColor: '#dbeafe' },

    name: { fontWeight: '700', fontSize: 16 },
    email: { marginTop: 4, color: '#374151' },
    phone: { color: '#374151' },
    status: { marginTop: 6, fontWeight: '600' },
    statusGreen: { color: '#059669' },
    statusRed: { color: '#dc2626' },
    statusBlue: { color: '#2563eb' },
    statusYellow: { color: '#f59e0b' },

    filterContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 10,
        gap: 6,
    },
    filterButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#e5e7eb',
        borderRadius: 20,
    },
    filterButtonActive: { backgroundColor: '#06631EFF' },
    filterText: { fontSize: 14, color: '#111827' },
    filterTextActive: { color: '#fff', fontWeight: '600' },

    // 👇 stile del pulsante "Aggiorna stato"
    updateButton: {
        marginTop: 12,
        backgroundColor: '#2563eb',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    updateButtonText: { color: '#fff', fontWeight: '700' },
});
