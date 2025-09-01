import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Pressable, ActivityIndicator,
    Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ApiConfig } from '@/constants/ApiConfig';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { InteractionManager } from 'react-native';




import { Ionicons } from '@expo/vector-icons';

type Order = {
    id: string;
    pickupNodeName: string;
    deliveryNodeName: string;
    quantity: number;
    timeWindow: string; // Es. "TW_2_HOURS"
    status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'ASSIGNED' | 'IN_PROGRESS' | 'PICKED_UP';
    twOpen: number; // timestamp in secondi (es: 1752158117)
    twClose: number; // timestamp in secondi
    assignedVehicleId?: string | null; // può essere null o undefined
};

export default function ViewOrdersScreen() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
    const [nodes, setNodes] = useState<Node[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'FAILED' | 'ASSIGNED' | 'IN_PROGRESS'>('ALL');
    const [isNavigating, setIsNavigating] = useState(false);
    const [pendingNavigationData, setPendingNavigationData] = useState<any | null>(null);
    const [isRouting, setIsRouting] = useState(false);
    const [showSpinnerModal, setShowSpinnerModal] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    const STATI = [
        { label: 'Tutti', value: 'ALL' },
        { label: 'In attesa', value: 'PENDING' },
        { label: 'Consegnato', value: 'DELIVERED' },
        { label: 'Fallito', value: 'FAILED' },
        { label: 'Assegnato', value: 'ASSIGNED'},
        { label: 'In corso', value: 'IN_PROGRESS' },
        { label: 'Ritirato', value: 'PICKED_UP' },
    ];

    useFocusEffect(

        React.useCallback(() => {
            setShowSpinnerModal(false);

            setSelectedOrders(new Set()); // 👈 reset selezione a ogni focus
        }, [])
    );



    useFocusEffect(
        React.useCallback(() => {
            const fetchData = async () => {
                const token = await AsyncStorage.getItem('authToken');

                // Ordini (con filtro)
                const url = filter === 'ALL'
                    ? `${ApiConfig.DELIVERY_SERVICE}/orders`
                    : `${ApiConfig.DELIVERY_SERVICE}/orders/status/${filter}`;

                const resOrders = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const ordersJson = await resOrders.json();

                // Nodi
                const resNodes = await fetch(`${ApiConfig.DELIVERY_SERVICE}/nodes`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const nodesJson = await resNodes.json();

                const nodeList = Array.isArray(nodesJson.nodes) ? nodesJson.nodes : nodesJson;
                setNodes(nodeList);

                const enrichedOrders = ordersJson.orders.map((order: any) => {
                    const pickup = nodeList.find((n: any) => n.id === order.pickupNodeId);
                    const delivery = nodeList.find((n: any) => n.id === order.deliveryNodeId);
                    return {
                        ...order,
                        pickupNodeName: pickup?.name || '—',
                        deliveryNodeName: delivery?.name || '—',
                    };
                });

                setOrders(enrichedOrders);
            };

            fetchData();
        }, [filter]) // 👈 aggiungi `filter` come dipendenza
    );



    const handleDeleteOrder = async (orderId: string) => {
        Alert.alert(
            'Conferma eliminazione',
            'Sei sicuro di voler eliminare questo ordine?',
            [
                { text: 'Annulla', style: 'cancel' },
                {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('authToken');
                            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/orders/${orderId}`, {
                                method: 'DELETE',
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                },
                            });

                            if (res.ok) {
                                setOrders((prev) => prev.filter((o) => o.id !== orderId));
                            } else {
                                Alert.alert('Errore', 'Impossibile eliminare l\'ordine');
                            }
                        } catch (e: any) {
                            Alert.alert('Errore di rete', e.message);
                        }
                    },
                },
            ]
        );
    };


    const toggleSelection = (orderId: string) => {
        setSelectedOrders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const handleCreateRoute = async () => {
        setShowSpinnerModal(true);

        if (selectedOrders.size === 0) {
            setShowSpinnerModal(false); // 🔁 chiudi subito se fallisce
            Alert.alert('Seleziona almeno un ordine');
            return;
        }

        try {
            const token = await AsyncStorage.getItem('authToken');
            const selectedOrderObjects = orders.filter(order => selectedOrders.has(order.id));

            const body = {
                orders: selectedOrderObjects.map(o => ({
                    id: o.id,
                    pickupNodeId: nodes.find(n => n.name === o.pickupNodeName)?.id,
                    deliveryNodeId: nodes.find(n => n.name === o.deliveryNodeName)?.id,
                    quantity: o.quantity,
                    timeWindow: o.timeWindow,
                    status: o.status,
                    twOpen: o.twOpen,
                    twClose: o.twClose,
                    assignedVehicleId: o.assignedVehicleId ?? null,
                })),
            };

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/routes/optimize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            const json = await res.json();
            console.log('Risposta ottimizzazione:', json);

            if (!res.ok) {
                throw new Error(json.message || 'Ottimizzazione fallita');
            }

            Alert.alert(
                'Ottimizzazione completata ✅',
                'Visualizza il percorso e assegna un camionista disponibile',
                [
                    {
                        text: 'Assegna camionista',
                        onPress: () => {
                            setTimeout(() => {
                                setShowSpinnerModal(false); // 👈 chiudi lo spinner
                                router.push({
                                    pathname: '../ordini/assign-driver',
                                    params: {
                                        result: JSON.stringify(json.data),
                                    },
                                });
                            }, 200);
                        }

                    },
                ]
            );

        } catch (e: any) {
            Alert.alert('Errore', e.message || 'Errore di rete');
            setShowSpinnerModal(false); // errore => chiudi
        }
    };

    const renderOrderItem = ({ item, index }: { item: Order; index: number }) => {
        const isSelected = selectedOrders.has(item.id);
        const isDelivered = item.status === 'DELIVERED';
        const isFailed = item.status === 'FAILED';

        const isSelectable = item.status === 'PENDING';


        const containerStyle = [
            styles.orderItem,
            isSelected && isSelectable && styles.selectedOrderItem,
            isDelivered && styles.deliveredOrderItem,
            isFailed && styles.failedOrderItem,
        ];

        if (isRouting) {
            return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={{ marginTop: 10 }}>Caricamento percorso...</Text>
                </View>
            );
        }


        return (
            <Pressable
                disabled={!isSelectable}
                onPress={() => toggleSelection(item.id)}
                style={containerStyle}
            >
                <Text style={styles.orderTitle}>Ordine #{item.id.slice(-5)}</Text>
                <Text style={styles.orderText}>📦 {item.quantity} unità</Text>
                <Text style={styles.orderText}>🚚 Da {item.pickupNodeName || '—'}</Text>
                <Text style={styles.orderText}>🏁 A {item.deliveryNodeName || '—'}</Text>
                <Text style={styles.orderText}>
                    ⏰ TW: {(item.timeWindow ?? '').replace('TW_', '').replace('_', ' ').toLowerCase()}
                </Text>
                <Text style={[styles.orderStatus, styles[`status_${item.status}`]]}>
                    📌 Stato: {(() => {
                    switch (item.status) {
                        case 'PENDING': return 'In attesa';
                        case 'DELIVERED': return 'Consegnato';
                        case 'FAILED': return 'Fallito';
                        case 'ASSIGNED': return 'Assegnato';
                        case 'IN_PROGRESS': return 'In corso';
                        case 'PICKED_UP': return 'Ritirato';


                        default: return item.status;
                    }
                })()}
                </Text>

                <TouchableOpacity
                    onPress={() => handleDeleteOrder(item.id)}
                    style={styles.deleteButton}
                >
                    <Text style={styles.deleteButtonText}>Elimina ordine</Text>
                </TouchableOpacity>
            </Pressable>
        );
    };


    return (
        <View style={styles.container}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="file-tray-full-outline" size={60} color="#06631EFF" />
            </View>
            <Text style={styles.title}>Visualizza ordini</Text>
            <View style={styles.filterContainer}>
                {STATI.map(({ label, value }) => (
                    <TouchableOpacity
                        key={value}
                        style={[styles.filterButton, filter === value && styles.filterButtonActive]}
                        onPress={() => setFilter(value)}
                    >
                        <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                            {label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>


            <FlatList
                data={orders}
                renderItem={renderOrderItem}
                keyExtractor={(item) => item.id}


            contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', marginTop: 40 }}>
                        Nessun ordine disponibile.
                    </Text>
                }
            />

            {/* PULSANTI IN FONDO */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => router.push('../ordini/order')}
                >
                    <Text style={styles.buttonText}>Crea ordine</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleCreateRoute}
                >
                    <Text style={styles.buttonText}>Crea rotta</Text>
                </TouchableOpacity>
            </View>
            {showSpinnerModal && (
                <Modal
                    transparent
                    animationType="none"
                    visible={showSpinnerModal}
                    onRequestClose={() => {}}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalSpinnerBox}>
                            <ActivityIndicator size="large" color="#2563eb" />
                            <Text style={{ marginTop: 10, color: '#0f172a' }}>Caricamento percorso...</Text>
                        </View>
                    </View>
                </Modal>
            )}




        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        paddingBottom: 100,
        backgroundColor: '#fff',
    },
    loadingBox: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    modalSpinnerBox: {
        backgroundColor: 'white',
        padding: 30,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    status_ASSIGNED: {
        color: '#2563eb', // blu
    },
    status_IN_PROGRESS: {
        color: '#f59e0b', // giallo/arancio
    },


    filterContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 10,
        gap: 8,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    loadingText: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#06631EFF',
    },

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
        fontSize: 14,
        color: '#111827',
    },
    filterTextActive: {
        color: '#fff',
        fontWeight: '600',
    },

    footer: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    secondaryButton: {
        backgroundColor: '#0063eb',
        flex: 1,
    },
    orderStatus: {
        fontWeight: '600',
        marginTop: 6,
    },
    status_PENDING: {
        color: '#d97706', // arancio
    },
    status_DELIVERED: {
        color: '#059669', // verde
    },
    status_FAILED: {
        color: '#dc2626', // rosso
    },
    status_PICKED_UP: {
        color: '#8b5cf6', // viola
    },

    button: {
        backgroundColor: '#06631EFF',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        elevation: 5,
        flex: 1,
    },
    deleteButton: {
        marginTop: 14,
        backgroundColor: '#dc2626',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    deliveredOrderItem: {
        backgroundColor: '#dbeafe', // celeste chiaro
        borderColor: '#60a5fa',
    },

    failedOrderItem: {
        backgroundColor: '#fee2e2', // rosso chiaro
        borderColor: '#f87171',
    },

    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
        color: '#1f2937',
    },
    listContainer: {
        paddingBottom: 100,
    },
    orderItem: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        padding: 14,
        marginBottom: 12,
        backgroundColor: '#f9fafb',
    },
    selectedOrderItem: {
        backgroundColor: '#4fa866',
        borderColor: '#06631EFF',
    },
    orderTitle: {
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 4,
        color: '#06631e',
    },
    orderText: {
        color: '#374151',
    },
});

