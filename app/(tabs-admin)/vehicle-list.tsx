import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    RefreshControl,
    StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect, useRouter} from 'expo-router';
import { ApiConfig } from '@/constants/ApiConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Vehicle = {
    id: string;
    plate: string;
    capacity: number;
    cost: number;
    currentLat?: number | null;
    currentLon?: number | null;
    status?: string | null;
    assignedUserId?: string | null;
};

const STATI = [
    { label: 'TUTTO', value: 'ALL' },
    { label: 'DISPONIBILE', value: 'AVAILABLE' },
    { label: 'IN TRANSITO', value: 'IN_TRANSIT' },
    { label: 'OFFLINE', value: 'OFFLINE' },
    { label: 'ROTTO', value: 'BROKEN' },
    { label: 'ASSEGNATO', value: 'ASSIGNED' },
];


export default function VehicleListScreen() {
    const [filter, setFilter] = useState('ALL');
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();
    const intervalRef = useRef<NodeJS.Timer | null>(null);

    // Funzione fetch aggiornata per includere filter come dipendenza
    const fetchVehicles = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const role = await AsyncStorage.getItem('role');
            if (!token || role !== 'ADMIN') return;

            if (!token) throw new Error('Token mancante');

            // Se filter ALL, prendi tutti i veicoli
            // Altrimenti fai uppercase per backend e usa filtro
            const statusParam = filter === 'ALL' ? '' : filter.toUpperCase();

            const url =
                statusParam === ''
                    ? `${ApiConfig.DELIVERY_SERVICE}/vehicles`
                    : `${ApiConfig.DELIVERY_SERVICE}/vehicles/status/${statusParam}`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            });

            if (!res.ok) throw new Error(`Errore: ${res.status}`);

            const json = await res.json();
            setVehicles(json.vehicles || json.vehicleList || []);
        } catch (e: any) {
            Alert.alert('Errore nel caricamento dei veicoli', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const statusIcon = (status?: string | null) => {
        const s = status ?? 'AVAILABLE';
        switch (s) {
            case 'AVAILABLE':
                return { name: 'check-circle', color: '#10b981' };
            case 'IN_TRANSIT':
                return { name: 'truck-delivery', color: '#3b82f6' };
            case 'OFFLINE':
                return { name: 'close-circle', color: '#ef4444' };
            case 'BROKEN':
                return { name: 'alert-octagon', color: '#ef4444' };
            case 'ASSIGNED':
                return { name: 'account-circle', color: '#f59e0b' };
            default:
                return { name: 'help-circle', color: '#6b7280' };
        }
    };

    // Questo useEffect ora ascolta filter e rifà fetch quando cambia
    useEffect(() => {
        const checkAndFetch = async () => {
            const role = await AsyncStorage.getItem('role');
            if (role === 'ADMIN') {
                setLoading(true);
                fetchVehicles();
            } else {
                setVehicles([]);  // svuota in caso non sia admin
            }
        };

        checkAndFetch();

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(checkAndFetch, 10000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [filter]);


    useFocusEffect(
        useCallback(() => {
            // Rieffettua il fetch ogni volta che ritorni su questa schermata
            fetchVehicles();
        }, [filter])
    );


    const handleRefresh = () => {
        setRefreshing(true);
        fetchVehicles();
    };

    const safeJson = async (res: Response) => {
        const txt = await res.text();
        try { return JSON.parse(txt); } catch { return null; }
    };

    const handleDelete = (vehicleId: string, status?: string | null) => {
        const norm = (status ?? 'AVAILABLE').toUpperCase();
        if (norm === 'IN_TRANSIT') {
            Alert.alert(
                'Operazione non consentita',
                'Non puoi eliminare un veicolo mentre è in transito.'
            );
            return;
        }

        Alert.alert(
            'Conferma eliminazione',
            'Sei sicuro di voler eliminare questo veicolo?',
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

                            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicles/${vehicleId}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                            });

                            if (res.ok) {
                                setVehicles(prev => prev.filter(v => v.id !== vehicleId));
                                Alert.alert('Successo', 'Veicolo eliminato con successo');
                            } else {
                                const msg = await res.text().catch(() => '');
                                Alert.alert('Errore', 'Impossibile eliminare il veicolo: ' + msg);
                            }
                        } catch (e: any) {
                            Alert.alert('Errore di rete', e.message);
                        }
                    },
                },
            ]
        );
    };



    const renderItem = ({ item }: { item: Vehicle }) => {
        const normStatus = (item.status ?? 'AVAILABLE').toUpperCase();
        const isInTransit = normStatus === 'IN_TRANSIT';

        return (
            <View style={styles.item}>
                <View style={styles.itemHeader}>
                    <Text style={styles.plate}>{item.plate}</Text>
                    <View style={styles.statusContainer}>
                        <MaterialCommunityIcons
                            name={statusIcon(item.status).name}
                            size={20}
                            color={statusIcon(item.status).color}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.status, { color: statusIcon(item.status).color }]}>
                            {normStatus.replace('_', ' ')}
                        </Text>
                    </View>
                </View>

                <Text style={styles.info}>Capacità: {item.capacity}</Text>
                <Text style={styles.info}>
                    Posizione:{' '}
                    {item.currentLat != null && item.currentLon != null
                        ? `${item.currentLat.toFixed(5)}, ${item.currentLon.toFixed(5)}`
                        : 'Non disponibile'}
                </Text>

                {/* ✅ passa anche lo status, e disabilita se IN_TRANSIT */}
                <TouchableOpacity
                    onPress={() => handleDelete(item.id, item.status)}
                    disabled={isInTransit}
                    style={[
                        styles.deleteButton,
                        isInTransit && { backgroundColor: '#9ca3af' } // grigio se disabilitato
                    ]}
                >
                    <Text style={styles.deleteButtonText}>
                        {isInTransit ? 'Non eliminabile (in transito)' : 'Elimina veicolo'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: '#2563eb', marginTop: 10 }]}
                    onPress={() =>
                        router.push({
                            pathname: '../vehicles/update-status',
                            params: { id: item.id, currentStatus: item.status ?? 'AVAILABLE' },
                        })
                    }
                >
                    <Text style={styles.deleteButtonText}>Aggiorna stato</Text>
                </TouchableOpacity>
            </View>
        );
    };


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f8fa' }}>
            <View style={styles.container}>
                <Text style={styles.title}>Veicoli registrati</Text>

                <View style={styles.filterWrapContainer}>
                    {STATI.map(({ label, value }) => {
                        const isActive = filter === value;
                        return (
                            <TouchableOpacity
                                key={value}
                                onPress={() => setFilter(value)}
                                style={[
                                    styles.chip,
                                    isActive && styles.chipActive,
                                ]}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* CONTEGGIO VEICOLI */}
                <Text style={styles.countText}>Veicoli: {vehicles.length}</Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#333" />
                ) : (
                    <FlatList
                        data={vehicles}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                        contentContainerStyle={{ paddingBottom: 120 }}
                    />
                )}

                <TouchableOpacity
                    style={styles.fixedButton}
                    onPress={() => router.push('../vehicles/create-vehicle')}
                >
                    <Text style={styles.buttonText}>Aggiungi nuovo veicolo</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: '#1f2937' },
    filterContainer: { flexDirection: 'row', marginBottom: 8, justifyContent: 'center' },
    filterButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#e5e7eb',
        borderRadius: 20,
    },
    filterButtonActive: {
        backgroundColor: '#06631EFF',
    },
    filterText: {
        color: '#374151',
        fontWeight: '600',
    },
    filterWrapContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 0, // RN ancora non sempre supporta gap: usiamo margin sui chip
        justifyContent: 'center',
        marginBottom: 10,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: '#e5e7eb',
        borderRadius: 18,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    chipActive: {
        backgroundColor: '#06631E', // il tuo verde brand
        borderColor: '#06631E',
    },
    chipText: {
        color: '#374151',
        fontWeight: '600',
        fontSize: 14,
        letterSpacing: 0.2,
    },
    chipTextActive: {
        color: '#fff',
    },
    filterTextActive: {
        color: '#fff',
    },
    countText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    item: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderColor: '#d1d5db',
        borderWidth: 1,
    },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    plate: { fontSize: 18, fontWeight: '600', color: '#111827' },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    status: { fontSize: 14, fontWeight: '500', color: '#047857' },
    info: { fontSize: 14, color: '#6b7280', marginTop: 4 },
    deleteButton: {
        marginTop: 20,
        backgroundColor: '#dc2626',
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    deleteButtonText: { color: '#fff', fontWeight: '600' },
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
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
