// app/users/update-status.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '@/constants/ApiConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type UserStatus = 'AVAILABLE' | 'UNAVAILABLE';

const STATI: { label: string; value: UserStatus; icon: any; color: string }[] = [
    { label: 'DISPONIBILE',     value: 'AVAILABLE',   icon: 'account-check',  color: '#10b981' },
    { label: 'NON DISPONIBILE', value: 'UNAVAILABLE', icon: 'account-cancel', color: '#ef4444' },
];

export default function UpdateUserStatusScreen() {
    const router = useRouter();
    const { id, currentStatus } = useLocalSearchParams<{ id: string; currentStatus: UserStatus }>();
    const [selectedStatus, setSelectedStatus] = useState<UserStatus>(
        (currentStatus as UserStatus) ?? 'AVAILABLE'
    );
    const [saving, setSaving] = useState(false);

    const handleUpdate = async () => {
        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                Alert.alert('Errore', 'Token mancante');
                return;
            }
            const res = await fetch(`${ApiConfig.POSITION_SERVICE}/users/updateStatus/${id}?status=${selectedStatus}`,
                {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (res.ok) {
                Alert.alert('Successo', 'Stato utente aggiornato correttamente');
                router.back();
            } else {
                const msg = await res.text();
                Alert.alert('Errore', msg || 'Impossibile aggiornare lo stato utente');
            }
        } catch (e: any) {
            Alert.alert('Errore di rete', e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <MaterialCommunityIcons name="account-circle" size={54} color="#06631EFF" />
            </View>

            <Text style={styles.title}>Seleziona nuovo stato utente</Text>

            {STATI.map((stato) => {
                const selected = selectedStatus === stato.value;
                return (
                    <TouchableOpacity
                        key={stato.value}
                        style={[
                            styles.statusButton,
                            selected && { backgroundColor: stato.color, borderColor: stato.color },
                        ]}
                        onPress={() => setSelectedStatus(stato.value)}
                    >
                        <View style={styles.rowCenter}>
                            <MaterialCommunityIcons
                                name={stato.icon}
                                size={20}
                                color={selected ? '#fff' : stato.color}
                                style={{ marginRight: 8 }}
                            />
                            <Text style={[styles.statusText, selected && { color: '#fff' }]}>
                                {stato.label}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}

            <TouchableOpacity
                style={[styles.confirmButton, saving && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.confirmText}>Conferma</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f9fafb' },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
    statusButton: {
        padding: 12,
        marginVertical: 6,
        borderRadius: 8,
        borderColor: '#d1d5db',
        borderWidth: 1,
        backgroundColor: '#fff',
    },
    rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    statusText: { textAlign: 'center', fontWeight: '600', color: '#1f2937' },
    confirmButton: {
        marginTop: 30,
        backgroundColor: '#059669',
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    confirmText: { textAlign: 'center', color: '#fff', fontWeight: '700', fontSize: 16 },
});
