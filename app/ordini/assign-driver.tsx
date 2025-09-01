import React, { useEffect, useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '@/constants/ApiConfig';

const shortenLocationName = (fullName: string): string => {
    return fullName;
};

type Route = {
    id: string;
    vehicleId: string;
    route: { lat: number; lon: number; locationName?: string }[];
};

type User = {
    id: string;
    name: string;
    surname: string;
    status: 'AVAILABLE' | 'UNAVAILABLE';
};

type Vehicle = {
    id: string;
    plate: string;
};

export default function AssignDriverScreen() {
    const router = useRouter();
    const [routes, setRoutes] = useState<Route[]>([]);
    const [drivers, setDrivers] = useState<User[]>([]);
    const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
    const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [currentVehicleId, setCurrentVehicleId] = useState<string | null>(null);
    const [locationCache, setLocationCache] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAllData();
    }, []);

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
        return { name: "Nome non disponibile", address: "Indirizzo non disponibile" };
    };

    const fetchAllData = async () => {
        setIsLoading(true);
        await fetchDrivers();
        const rawRoutes = await fetchRoutes();
        await fetchVehiclePlates(rawRoutes.map(r => r.vehicleId));
        setRoutes(rawRoutes);
        setIsLoading(false);
    };

    const fetchRoutes = async (): Promise<Route[]> => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/active`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            const rawRoutes = (json.routes || [])
                .filter((r: Route) => r.route.length > 2 && r.completed === false);

            const isVirtual = (idx: string) =>
                typeof idx === 'string' && (idx.startsWith('START_') || idx.startsWith('RESCUE_'));

            const labelForVirtual = (idx: string) =>
                idx.startsWith('START_')
                    ? 'Partenza veicolo'
                    : `Punto di soccorso • Ordine ${idx.substring('RESCUE_'.length)}`;

            for (const route of rawRoutes) {
                for (const point of route.route) {
                    const idx = point.nodeIndex || '';
                    if (!idx) continue;

                    // 1) nodi virtuali: niente fetch, mettiamo etichetta
                    if (isVirtual(idx)) {
                        point.locationName = labelForVirtual(idx);
                        continue;
                    }

                    // 2) nodi reali: arricchisci se manca il nome
                    if (!point.locationName) {
                        // opzionale: cache locale per non rifare fetch uguali
                        const cached = locationCache[idx];
                        if (cached) {
                            point.locationName = cached;
                        } else {
                            const info = await fetchNodeInfo(idx);
                            const label = `${info.name}${info.address ? ' — ' + info.address : ''}`;
                            point.locationName = label;
                            // aggiorna cache (opzionale)
                            setLocationCache(prev => ({ ...prev, [idx]: label }));
                        }
                    }
                }
            }

            return rawRoutes;
        } catch (e) {
            Alert.alert('Errore', 'Errore nel caricamento delle tratte');
            return [];
        }
    };

    const fetchDrivers = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${ApiConfig.POSITION_SERVICE}/users/status/AVAILABLE`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            setDrivers(json.userList || []);
        } catch (e) {
            Alert.alert('Errore', 'Errore nel caricamento camionisti');
        }
    };

    const fetchVehiclePlates = async (vehicleIds: string[]) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const results = await Promise.all(
                vehicleIds.map(async (vehicleId) => {
                    const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicles/${vehicleId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const json = await res.json();
                    return { id: vehicleId, plate: json.plate };
                })
            );
            const map = Object.fromEntries(results.map(v => [v.id, v.plate]));
            setVehicleMap(map);
        } catch (e) {
            Alert.alert('Errore', 'Errore nel recupero targhe veicoli');
        }
    };

    const handleSelectDriver = (vehicleId: string) => {
        setCurrentVehicleId(vehicleId);
        setModalVisible(true);
    };

    const getPushTokenOfUser = async (userId: string): Promise<string> => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${userId}/push-token`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                console.warn(`⚠️ Errore ${res.status} nel recupero pushToken per utente ${userId}`);
                return '';
            }

            const json = await res.json();

            if (json.code !== 200) {
                console.warn(`⚠️ Errore nel corpo della risposta: ${json.message}`);
                return '';
            }

            return json.pushToken || '';

        } catch (e) {
            console.error('Errore nel recupero push token:', e);
            return '';
        }
    };

    const assignDriver = async (vehicleId: string) => {
        const driverId = selectedDrivers[vehicleId];
        const routeObj = routes.find(r => r.vehicleId === vehicleId);
        if (!driverId || !routeObj) return;

        try {
            const token = await AsyncStorage.getItem('authToken');
            const body = {
                id: routeObj.id,
                vehicleId: vehicleId,
                route: routeObj.route
            };

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/assign-driver/${driverId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                Alert.alert('Successo', 'Camionista assegnato correttamente!');
                setRoutes(prev => prev.filter(r => r.vehicleId !== vehicleId));
                setSelectedDrivers(prev => {
                    const newMap = { ...prev };
                    delete newMap[vehicleId];
                    return newMap;
                });
                setDrivers(prev => prev.filter(d => d.id !== driverId)); // 👈 rimuove il camionista assegnato

                setRoutes(prev => prev.filter(r => r.vehicleId !== vehicleId));
                setSelectedDrivers(prev => {
                    const newMap = { ...prev };
                    delete newMap[vehicleId];
                    return newMap;
                });
                //  Chiamata al NOTIFICATION_SERVICE
                try {
                    const pushToken = await getPushTokenOfUser(driverId);
                    if (pushToken) {
                        const notificationRes = await fetch(`${ApiConfig.NOTIFICATION_SERVICE}/notify/send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: pushToken,
                                title: 'Nuova tratta assegnata',
                                body: 'Accettala e inizia la consegna!',
                                data: {
                                    userId: driverId  // 👈 qui dentro va bene!
                                }
                            }),
                        });

                        if (!notificationRes.ok) {
                            const text = await notificationRes.text();
                            console.warn('Notifica non inviata:', text);
                        }
                    } else {
                        console.warn('⚠️ Push token non trovato per utente:', driverId);
                    }
                } catch (err) {
                    console.warn('Errore durante invio notifica:', err);
                }
            } else {
                const errText = await res.text();
                Alert.alert('Errore', `Fallito: ${errText}`);
            }
        } catch (e) {
            Alert.alert('Errore di rete', e.message);
        }
    };

    const renderRouteItem = ({ item }: { item: Route }) => {
        const plate = vehicleMap[item.vehicleId] || item.vehicleId;
        if (!item.route || item.route.length <= 2) return null;

        return (
            <View style={styles.routeCard}>
                <Text style={styles.routeTitle}>Targa veicolo: {plate}</Text>

                <View style={styles.routeSteps}>
                    {item.route.map((step, index) => (
                        <Text key={index} style={styles.stepText} numberOfLines={2} ellipsizeMode="tail">
                            📍 {shortenLocationName(step.locationName || `${step.lat.toFixed(4)}, ${step.lon.toFixed(4)}`)}
                        </Text>
                    ))}
                </View>

                <Text style={styles.driverLabel}>Camionista selezionato:</Text>
                <Text style={{ marginBottom: 8 }}>
                    {selectedDrivers[item.vehicleId]
                        ? `${drivers.find((d) => d.id === selectedDrivers[item.vehicleId])?.name || ''} ${drivers.find((d) => d.id === selectedDrivers[item.vehicleId])?.surname || ''}`
                        : 'Nessun camionista selezionato'}
                </Text>

                <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => handleSelectDriver(item.vehicleId)}
                >
                    <Text style={styles.selectButtonText}>Scegli camionista</Text>
                </TouchableOpacity>

                {selectedDrivers[item.vehicleId] && (
                    <TouchableOpacity
                        style={styles.assignButton}
                        onPress={() => assignDriver(item.vehicleId)}
                    >
                        <Text style={styles.assignButtonText}>Assegna ordine</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={{ marginTop: 10 }}>Caricamento tratte e targhe...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Assegna camionisti ai percorsi</Text>
            <FlatList
                data={routes}
                renderItem={renderRouteItem}
                keyExtractor={(item) => item.vehicleId}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={<Text>Nessuna tratta da assegnare</Text>}
            />

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Seleziona camionista</Text>
                        <FlatList
                            data={drivers}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.driverOption}
                                    onPress={() => {
                                        if (currentVehicleId) {
                                            setSelectedDrivers((prev) => ({
                                                ...prev,
                                                [currentVehicleId]: item.id,
                                            }));
                                            setModalVisible(false);
                                        }
                                    }}
                                >
                                    <Text>{item.name} {item.surname}</Text>
                                </Pressable>
                            )}
                        />
                        <Pressable onPress={() => setModalVisible(false)} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>Annulla</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
            <TouchableOpacity
                style={[
                    styles.backButton,
                    routes.length > 0 && { backgroundColor: '#94a3b8' } // grigio se disabilitato
                ]}
                onPress={() => {
                    if (routes.length === 0) {
                        router.push('../(tabs-admin)/order-list');
                    } else {
                        Alert.alert('Attenzione', 'Assegna prima tutti i camionisti prima di tornare alla home.');
                    }
                }}
                disabled={routes.length > 0} // blocca pressione
            >
                <Text style={styles.backButtonText}>
                    Torna alla home
                </Text>
            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#0f172a' },
    routeCard: {
        backgroundColor: '#e2e8f0',
        padding: 16,
        borderRadius: 10,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    routeTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
    driverLabel: { fontWeight: '600', marginTop: 10 },
    routeSteps: { marginVertical: 10 },
    stepText: { fontSize: 14, color: '#1e293b' },
    selectButton: {
        backgroundColor: '#2563eb',
        padding: 10,
        borderRadius: 8,
        marginTop: 6,
    },
    backButton: {
        backgroundColor: '#334155',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    assignButton: {
        backgroundColor: '#16a34a',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    assignButtonText: {
        color: '#fff',
        fontWeight: '600',
        textAlign: 'center',
    },
    selectButtonText: {
        color: '#fff',
        fontWeight: '600',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '80%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    driverOption: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#ccc',
    },
    cancelButton: {
        marginTop: 10,
        alignSelf: 'center',
    },
    cancelButtonText: {
        color: '#ef4444',
        fontWeight: 'bold',
    },
});