import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '@/constants/ApiConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {router} from "expo-router";
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';


export default function OrdersCheckScreen() {
    const [routes, setRoutes] = useState([]);
    const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
    const [locationCache, setLocationCache] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'ONGOING' | 'COMPLETED'>('ONGOING');

    const fetchAssignedRoutes = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const userId = await AsyncStorage.getItem('userId');

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/from/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await res.json();
            const routes = json.routes || [];

            for (const route of routes) {
                for (const point of route.route) {
                    const idx = point.nodeIndex || "";

                    // etichette per nodi virtuali
                    if (idx.startsWith("START_")) {
                        point.locationName = "Partenza veicolo";
                        continue;
                    }
                    if (idx.startsWith("RESCUE_")) {
                        const orderId = idx.substring("RESCUE_".length);
                        point.locationName = `Punto di soccorso • Ordine ${orderId}`;
                        continue;
                    }

                    // nodi reali: chiama il backend
                    if (!point.locationName && idx) {
                        const info = await fetchNodeInfo(idx);
                        point.locationName = `${info.name}${info.address ? " — " + info.address : ""}`;
                    }
                }
            }

            // ↪️ Recupera targhe veicoli
            const plates: Record<string, string> = {};
            await Promise.all(
                routes.map(async (r) => {
                    const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicles/${r.vehicleId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        plates[r.vehicleId] = data.plate;
                    }
                })
            );

            setVehicleMap(plates);
            const enrichedRoutes = routes.map(r => ({
                ...r,
                accepted: r.vehicleStatus === 'IN_TRANSIT',
                completed: r.completed
            }));
            setRoutes(enrichedRoutes);
        } catch (e) {
            Alert.alert('Errore', 'Errore durante il recupero degli ordini');
        } finally {
            setLoading(false);
        }
    };

    const fetchNodeInfo = async (nodeId: string): Promise<{ name: string, address: string }> => {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/nodes/${nodeId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
            const data = await res.json();
            return {
                name: data?.node?.name ?? "Nome non disponibile",
                address: data?.node?.address ?? "Indirizzo non disponibile"
            };
        }

        return { name: `Nodo ${nodeId}`, address: "" };  // 👈 fallback più esplicito
    };

    const acceptRoute = async (routeId: string) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const userId = await AsyncStorage.getItem('userId');

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/accept/${routeId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = await res.json().catch(() => null);
            if (!res.ok) {
                Alert.alert('Errore', json?.message || 'Errore generico');
                return;
            }

            // prendo la route appena accettata (dalla risposta se disponibile, altrimenti dal tuo array)
            const fromState = routes.find(r => r.id === routeId);
            const accepted = json?.route || fromState;
            const vehicleId = accepted?.vehicleId || fromState?.vehicleId;
            const currentIdx = accepted?.currentSegmentIndex ?? 0;

            if (!vehicleId) {
                Alert.alert("Errore", "Veicolo non trovato per questa tratta.");
                return;
            }

            // ✅ Persisti lo stato “attivo”
            await AsyncStorage.multiSet([
                ['activeRouteId', routeId],
                ['vehicleId', vehicleId],
                ['currentSegmentIndex', String(currentIdx)],
                ['isOnRoute', 'true'],
            ]);

            // 🔄 azzera l’anti-dup dei messaggi MQTT per questa route/veicolo
            await AsyncStorage.removeItem(`routeEvtTs:${vehicleId}`);

            // UI locale: marca come accettata e vai in mappa
            setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, accepted: true } : r));

            Alert.alert('Successo', 'Tratta accettata, si parte!');
            router.push('/map');

            // NB: lato backend l’endpoint /accept dovrebbe:
            // - settare vehicle.status=IN_TRANSIT e userStatus=ON_ROUTE
            // - pubblicare MQTT route-started (lo hai già messo)
            // Se per un attimo non arriva l’MQTT, la mappa parte comunque grazie allo stato locale
        } catch (err:any) {
            Alert.alert('Errore di rete', err.message);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchAssignedRoutes();
        }, [])
    );


    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    const ongoing = routes.filter(r => !r.completed);
    const completed = routes.filter(r => r.completed);

    return (
        <View style={styles.container}>
            <FlatList
                ListHeaderComponent={
                    <>
                        <View style={styles.header}>
                            <MaterialCommunityIcons name="truck-delivery-outline" size={42} color="#16a34a" />
                            <Text style={styles.title}>I tuoi ordini assegnati</Text>
                        </View>

                        <View style={styles.filterContainer}>
                            {['ALL', 'ONGOING', 'COMPLETED'].map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    style={[
                                        styles.filterButton,
                                        filter === f && styles.filterButtonActive
                                    ]}
                                    onPress={() => setFilter(f as any)}
                                >
                                    <Text style={[
                                        styles.filterText,
                                        filter === f && styles.filterTextActive
                                    ]}>
                                        {f === 'ALL' && '📋 Tutti'}
                                        {f === 'ONGOING' && '🟡 In corso'}
                                        {f === 'COMPLETED' && '✅ Completati'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                }
                contentContainerStyle={{ paddingBottom: 100 }}
                data={routes.filter(r => {
                    if (filter === 'ALL') return true;
                    if (filter === 'ONGOING') return !r.completed;
                    if (filter === 'COMPLETED') return r.completed;
                })}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.label}>Targa veicolo: {vehicleMap[item.vehicleId] || item.vehicleId}</Text>
                        <Text style={styles.label}>Fermate:</Text>
                        {item.route.map((p: any, i: number) => (
                            <Text key={i}>📍 {p.locationName || `${p.lat}, ${p.lon}`}</Text>
                        ))}
                        {item.completed ? (
                            <View style={styles.completedBadge}>
                                <Text style={styles.completedText}>Completato ✅</Text>
                            </View>
                        ) : item.accepted ? (
                            <View style={styles.inProgressBadge}>
                                <Text style={styles.inProgressText}>In corso 🚚</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.acceptButton}
                                onPress={() => acceptRoute(item.id)}
                            >
                                <Text style={styles.acceptText}>Accetta tratta</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                ListEmptyComponent={<Text>Nessun ordine disponibile</Text>}
            />
        </View>
    );


}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    card: {
        padding: 16,
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
        marginBottom: 16,
    },
    label: { fontWeight: '600', marginBottom: 4 },
    acceptButton: {
        marginTop: 10,
        backgroundColor: '#16a34a',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    acceptText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    inProgressBadge: {
        marginTop: 10,
        backgroundColor: '#facc15', // giallo chiaro
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },

    filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#f9fafb',
    },

    filterButtonActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },

    filterText: {
        fontWeight: '600',
        color: '#1f2937',
    },

    filterTextActive: {
        color: '#fff',
    },


    inProgressText: {
        color: '#92400e',
        fontWeight: 'bold',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 12,
        color: '#0f172a',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#0f172a',
    },

    completedBadge: {
        marginTop: 10,
        backgroundColor: '#bbf7d0',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        alignSelf: 'flex-start',
    },

    completedText: {
        color: '#166534',
        fontWeight: 'bold',
    },

});
