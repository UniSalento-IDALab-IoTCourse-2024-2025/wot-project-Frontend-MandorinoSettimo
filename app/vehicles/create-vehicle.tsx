import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ApiConfig } from '@/constants/ApiConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function CreateVehicleScreen() {
    const [plate, setPlate] = useState('');
    const [capacity, setCapacity] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        if (!plate.trim() || !capacity.trim()) {
            Alert.alert('Errore', 'Compila tutti i campi');
            return;
        }

        const body = {
            plate: plate.trim(),
            capacity: Number(capacity),
            status: 'AVAILABLE' // 👈 AGGIUNGI QUESTO
        };

        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                Alert.alert('Errore', 'Token mancante. Effettua di nuovo il login.');
                setSubmitting(false);
                return;
            }

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                Alert.alert('Successo', 'Veicolo creato con successo');
                router.back();
            } else {
                const json = await res.json();
                Alert.alert('Errore', json.message || 'Errore durante la creazione');
            }
        } catch (e: any) {
            Alert.alert('Errore di rete', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f8fa' }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.container}
            >
                <View style={styles.iconContainer}>
                    <MaterialCommunityIcons name="truck" size={48} color="#047857" />
                </View>
                <Text style={styles.title}>Crea nuovo veicolo</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Targa (es. XX111XX)"
                    value={plate}
                    onChangeText={setPlate}
                    autoCapitalize="characters"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Capacità (es. 100)"
                    value={capacity}
                    onChangeText={setCapacity}
                    keyboardType="number-pad" // 👈 Cambiato da "numeric"
                />


                <TouchableOpacity
                    style={[styles.button, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Crea Veicolo</Text>
                    )}
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 24,
        color: '#1f2937',
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#fff',
        borderColor: '#d1d5db',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        fontSize: 16,
        marginBottom: 16,
        color: '#111827',
    },
    button: {
        backgroundColor: '#06631e',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});
