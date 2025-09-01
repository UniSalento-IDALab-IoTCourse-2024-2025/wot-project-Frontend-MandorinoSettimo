import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Keyboard,
    FlatList,
    SafeAreaView,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ApiConfig } from '@/constants/ApiConfig';
import { useRouter } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function CreateLocationScreen() {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();
    const addressInputRef = useRef<TextInput>(null);
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
    const [hasSelected, setHasSelected] = useState(false);



    const GOOGLE_API_KEY = 'AIzaSyAU7zPLbfzv_gmQUM8AWlYgTJz3FnMMZfQ';

    useEffect(() => {
        if (address.length < 3 || coords || hasSelected) {
            setSuggestions([]);
            return;
        }

        const fetchSuggestions = async () => {
            setLoadingSuggestions(true);
            try {
                const res = await fetch(
                    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
                        address
                    )}&key=${GOOGLE_API_KEY}&language=it&components=country:it`
                );
                const json = await res.json();
                if (json.predictions) {
                    setSuggestions(json.predictions);
                }
            } catch (error) {
                console.error('Errore autocomplete:', error);
            } finally {
                setLoadingSuggestions(false);
            }
        };

        const delay = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(delay);
    }, [address, coords, hasSelected]);



    const handleSelectSuggestion = async (placeId: string, description: string) => {
        try {
            setAddress(description);
            setSuggestions([]);
            setHasSelected(true); // ✅ la selezione è avvenuta
            Keyboard.dismiss();
            addressInputRef.current?.blur();

            const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${GOOGLE_API_KEY}`
            );
            const json = await res.json();
            const location = json?.result?.geometry?.location;
            const formattedAddress = json?.result?.formatted_address;

            if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
                throw new Error('Coordinate non disponibili');
            }

            setCoords({ lat: location.lat, lon: location.lng });
            setSelectedAddress(formattedAddress);

        } catch (error) {
            console.error(error);
            Alert.alert('Errore', 'Coordinate non disponibili');
        }
    };


    const handleSubmit = async () => {
        if (!name.trim() || !coords) {
            Alert.alert('Errore', 'Inserisci nome e seleziona un indirizzo valido');
            return;
        }

        const body = {
            name,
            lat: coords.lat,
            lon: coords.lon,
            type: 'CLIENT',
            address: selectedAddress || address, // <-- usa il formatted_address se disponibile
        };




        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                Alert.alert('Errore', 'Token mancante. Effettua di nuovo il login.');
                return;
            }

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/nodes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            let responseBody: any = null;
            try {
                responseBody = await res.json();
            } catch (e) {
                console.warn("Risposta non JSON o vuota", e);
            }

            if (res.ok) {
                Alert.alert('Successo', 'Cliente creato con successo');
                setName('');
                setAddress('');
                setCoords(null);
                setSelectedAddress(null);
                setHasSelected(false);
                router.back();
            }
            else {
                const message = responseBody?.message || JSON.stringify(responseBody) || 'Errore durante la creazione';
                console.warn('Errore:', message);
                Alert.alert('Errore', message);
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
                style={{ flex: 1 }}
            >
                <FlatList
                    data={suggestions}
                    ListHeaderComponent={
                        <View style={styles.header}>
                            <MaterialIcons name="person-pin" size={40} color="#06631e" style={styles.icon} />
                            <Text style={styles.title}>Crea Nuovo Cliente</Text>

                            <TextInput
                                placeholder="Nome cliente (es. Settiflex)"
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholderTextColor="#999"
                            />

                            <TextInput
                                ref={addressInputRef}
                                placeholder="Indirizzo (es. Via Achille Palma 12...)"
                                style={styles.input}
                                value={address}
                                onChangeText={(text) => {
                                    setCoords(null);
                                    setHasSelected(false); // resetta
                                    setAddress(text);
                                }}

                                placeholderTextColor="#999"
                            />

                            {loadingSuggestions && (
                                <ActivityIndicator size="small" color="#333" style={{ marginBottom: 10 }} />
                            )}
                        </View>
                    }
                    keyExtractor={(item) => item.place_id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.suggestionItem}
                            onPress={() => handleSelectSuggestion(item.place_id, item.description)}
                        >
                            <Text>{item.description}</Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
                    keyboardShouldPersistTaps="handled"
                />

                <TouchableOpacity
                    style={styles.fixedButton}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Crea Cliente</Text>
                    )}
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingBottom: 10,
    },
    icon: {
        textAlign: 'center',
        marginTop: 40,
        marginBottom: 6,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
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
        marginBottom: 12,
        color: '#111827',
    },
    suggestionItem: {
        padding: 12,
        backgroundColor: '#fff',
        borderBottomColor: '#e5e7eb',
        borderBottomWidth: 1,
    },
    fixedButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#06631e',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});
