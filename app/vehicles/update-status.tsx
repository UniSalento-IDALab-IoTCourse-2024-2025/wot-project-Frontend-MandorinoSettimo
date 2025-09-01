// app/vehicles/update-status.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '@/constants/ApiConfig';
import {MaterialCommunityIcons} from "@expo/vector-icons";

const STATI = [
    { label: 'DISPONIBILE', value: 'AVAILABLE', icon: 'check-circle', color: '#10b981' },
    { label: 'OFFLINE', value: 'OFFLINE', icon: 'close-circle', color: '#ef4444' },
];


export default function UpdateStatusScreen() {
    const router = useRouter();
    const { id, currentStatus } = useLocalSearchParams<{ id: string; currentStatus: string }>();
    const [selectedStatus, setSelectedStatus] = useState(currentStatus);

    const handleUpdate = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicles/${id}/status?status=${selectedStatus}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                Alert.alert('Successo', 'Stato aggiornato correttamente');
                router.back(); // Torna alla lista
            } else {
                const msg = await res.text();
                Alert.alert('Errore', msg);
            }
        } catch (e: any) {
            Alert.alert('Errore di rete', e.message);
        }
    };

    return (
        <View style={styles.container}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <MaterialCommunityIcons name="truck-cargo-container" size={54} color="#06631EFF" />
            </View>

            <Text style={styles.title}>Seleziona nuovo stato</Text>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialCommunityIcons
                                name={stato.icon}
                                size={20}
                                color={selected ? '#fff' : stato.color}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                style={[
                                    styles.statusText,
                                    selected && { color: '#fff' },
                                ]}
                            >
                                {stato.label}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}

            <TouchableOpacity style={styles.confirmButton} onPress={handleUpdate}>
                <Text style={styles.confirmText}>Conferma</Text>
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
    selectedStatusButton: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },

    selectedStatusText: { color: '#fff' },
    confirmButton: {
        marginTop: 30,
        backgroundColor: '#059669',
        padding: 14,
        borderRadius: 10,
    },
    confirmText: {
        textAlign: 'center',
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    statusText: {
        textAlign: 'center',
        fontWeight: '600',
        color: '#1f2937',
    },

});
