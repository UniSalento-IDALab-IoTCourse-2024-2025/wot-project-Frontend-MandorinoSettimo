import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ApiConfig } from '@/constants/ApiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';


type Node = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    type: string;
    address?: string;
};

export default function LocationListScreen() {
    const [depots, setDepots] = useState<Node[]>([]);
    const [clients, setClients] = useState<Node[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    const fetchNodes = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) throw new Error('Token mancante');

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/nodes`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });


            const text = await res.text();
            // console.log('Risposta grezza:', text);

            if (!res.ok) throw new Error(`Errore: ${res.status}`);

            const json = JSON.parse(text);
            const allNodes: Node[] = json.nodes || [];
            setDepots(allNodes.filter(n => n.type === 'DEPOT'));
            setClients(allNodes.filter(n => n.type === 'CLIENT').sort((a, b) => a.name.localeCompare(b.name)));

            //console.log("Nodi ricevuti:", json.nodes);

        } catch (e) {
            console.error('Errore nel caricamento dei clienti:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    useFocusEffect(useCallback(() => {
        fetchNodes();
    }, []));

    const handleRefresh = () => {
        setRefreshing(true);
        fetchNodes();
    };

    const handleDelete = async (nodeId: string) => {
        Alert.alert(
            'Conferma eliminazione',
            'Sei sicuro di voler eliminare questo cliente?',
            [
                { text: 'Annulla', style: 'cancel' },
                {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('authToken');
                            if (!token) {
                                Alert.alert('Errore', 'Token mancante');
                                return;
                            }

                            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/nodes/${nodeId}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                            });

                            if (!res.ok) {
                                const msg = await res.text().catch(() => '');
                                console.warn('Errore delete:', msg);
                                Alert.alert('Errore', 'Impossibile eliminare il cliente');
                                return;
                            }else{
                                Alert.alert('Successo', 'Cliente eliminato correttamente');
                            }

                            // ✅ Aggiorna lo stato corretto
                            setClients(prev => prev.filter(n => n.id !== nodeId));
                            // opzionale: se un giorno abiliti la delete del deposito
                            setDepots(prev => prev.filter(n => n.id !== nodeId));

                            // in alternativa, per essere sicuro di essere in sync col backend:
                            // await fetchNodes();
                        } catch (err) {
                            const message = err instanceof Error ? err.message : String(err);
                            Alert.alert('Errore di rete', message);
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: Node }) => (
        <View style={styles.item}>
            <View style={styles.itemHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.type}>{item.type}</Text>
            </View>
            <Text
                style={styles.sub}
                numberOfLines={2}
                ellipsizeMode="tail"
            >
                {item.address?.trim() || 'Indirizzo non disponibile'}
            </Text>

            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Elimina cliente</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f8fa' }}>
            <View style={styles.container}>
                <Text style={styles.title}>Deposito Azienda</Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#333" />
                ) : (
                    <FlatList
                        ListHeaderComponent={
                            <>
                                {depots.map((item) => (
                                    <View key={item.id} style={styles.depotItem}>
                                        <View style={styles.itemHeader}>
                                            <Text style={styles.name}>{item.name}</Text>
                                            <Text style={styles.depotTag}>Deposito</Text>
                                        </View>
                                        <Text style={styles.sub}>
                                            {item.address?.trim() || 'Indirizzo non disponibile'}
                                        </Text>
                                    </View>
                                ))}

                                <Text style={styles.subTitle}>Clienti registrati</Text>
                            </>
                        }
                        data={clients}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                        contentContainerStyle={{ paddingBottom: 120 }}
                    />

                )}

                <TouchableOpacity
                    style={styles.fixedButton}
                    onPress={() => router.push('../location/create-location')}
                >
                    <Text style={styles.buttonText}>Aggiungi nuovo cliente</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
        color: '#1f2937',
    },
    item: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderColor: '#d1d5db',
        borderWidth: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    depotItem: {
        backgroundColor: '#ecfdf5', // verde chiaro
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderColor: '#34d399',
        borderWidth: 1,
    },
    depotTag: {
        fontSize: 14,
        fontWeight: '500',
        color: '#059669', // verde scuro
    },
    subTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 10,
        marginBottom: 8,
        color: '#1f2937',
    },

    deleteButton: {
        marginTop: 20,
        backgroundColor: '#dc2626',
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    name: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    sub: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    type: {
        fontSize: 14,
        fontWeight: '500',
        color: '#047857',
    },
    fixedButton: {
        position: 'absolute',
        bottom: 60,
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