import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Pressable,
    FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ApiConfig } from '@/constants/ApiConfig';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';


type Node = {
    id: string;
    name: string;
};

const TIME_WINDOWS = [
    { label: ' 2 ore' , value: 'TW_2_HOURS'},
    { label: ' 4 ore' , value: 'TW_4_HOURS'},
    { label: ' 6 ore' , value: 'TW_6_HOURS'},
    { label: '12 ore', value: 'TW_12_HOURS' },
    { label: '24 ore', value: 'TW_24_HOURS' },
    { label: '48 ore', value: 'TW_48_HOURS' },
    { label: '5 giorni', value: 'TW_5_DAYS' },
    { label: '1 settimana', value: 'TW_1_WEEK' },
    { label: '2 settimane', value: 'TW_2_WEEKS' },
];

export default function CreateOrderScreen() {
    const router = useRouter();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [pickupId, setPickupId] = useState<string | null>(null);
    const [deliveryId, setDeliveryId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [timeWindow, setTimeWindow] = useState('TW_24_HOURS');
    const [isPickupModalVisible, setPickupModalVisible] = useState(false);
    const [isDeliveryModalVisible, setDeliveryModalVisible] = useState(false);
    const [selectedPickupNode, setSelectedPickupNode] = useState<Node | null>(null);
    const [selectedDeliveryNode, setSelectedDeliveryNode] = useState<Node | null>(null);

    type Node = {
        id: string;
        name: string;
        type: 'CLIENT' | 'DEPOT' | 'INTERMEDIATE';
    };


    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/nodes`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },

                });
                const json = await res.json();
                if (Array.isArray(json)) {
                    setNodes(json.filter((n: Node) => n.type === 'CLIENT'));
                } else if (Array.isArray(json.nodes)) {
                    setNodes(json.nodes.filter((n: Node) => n.type === 'CLIENT'));
                } else {
                    setNodes([]);
                }

            } catch (e: any) {
                Alert.alert('Errore', 'Impossibile caricare i nodi: ' + e.message);
            }
        };
        fetchNodes();
    }, []);

    const computeTimeWindowTimestamps = (timeWindow: string): { twOpen: number; twClose: number } => {
        const now = Math.floor(Date.now() / 1000); // timestamp in secondi
        let durationSeconds = 0;

        switch (timeWindow) {
            case 'TW_2_HOURS': durationSeconds = 2 * 3600; break;
            case 'TW_4_HOURS': durationSeconds = 4 * 3600; break;
            case 'TW_6_HOURS': durationSeconds = 6 * 3600; break;
            case 'TW_12_HOURS': durationSeconds = 12 * 3600; break;
            case 'TW_24_HOURS': durationSeconds = 24 * 3600; break;
            case 'TW_48_HOURS': durationSeconds = 48 * 3600; break;
            case 'TW_5_DAYS': durationSeconds = 5 * 86400; break;
            case 'TW_1_WEEK': durationSeconds = 7 * 86400; break;
            case 'TW_2_WEEKS': durationSeconds = 14 * 86400; break;
            default: durationSeconds = 24 * 3600;
        }

        return {
            twOpen: now,
            twClose: now + durationSeconds,
        };
    };

    const handleSubmit = async () => {
        if (!pickupId || !deliveryId || pickupId === deliveryId || Number(quantity) <= 0) {
            Alert.alert('Errore', 'Controlla i campi selezionati');
            return;
        }

        const { twOpen, twClose } = computeTimeWindowTimestamps(timeWindow);

        try {
            const token = await AsyncStorage.getItem('authToken');
            const body = {
                pickupNodeId: pickupId,
                deliveryNodeId: deliveryId,
                quantity: Number(quantity),
                timeWindow,
                twOpen,
                twClose,
                status: 'PENDING',
                assignedVehicleId: null,
            };

            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/orders`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const json = await res.json();

            if (res.ok) {
                Alert.alert('Successo', 'Ordine creato con successo');
                resetForm();
                router.replace('../(tabs-admin)/order-list');
            } else {
                Alert.alert('Errore', json.message ?? 'Errore durante la creazione');
            }
        } catch (e: any) {
            Alert.alert('Errore di rete', e.message);
        }
    };

    const resetForm = () => {
        setPickupId(null);
        setDeliveryId(null);
        setQuantity('1');
        setTimeWindow('TW_24_HOURS');
        setSelectedPickupNode(null);
        setSelectedDeliveryNode(null);
    };

    const renderPickupNodeItem = ({ item }: { item: Node }) => (
        <Pressable
            style={({ pressed }) => [
                styles.nodeItem,
                pressed && styles.pressedItem,
                pickupId === item.id && styles.selectedItem,
            ]}
            onPress={() => {
                setPickupId(item.id);
                setSelectedPickupNode(item);
                setPickupModalVisible(false);
            }}
        >
            <Text style={styles.nodeText}>{item.name}</Text>
        </Pressable>
    );

    const renderDeliveryNodeItem = ({ item }: { item: Node }) => (
        <Pressable
            style={({ pressed }) => [
                styles.nodeItem,
                pressed && styles.pressedItem,
                deliveryId === item.id && styles.selectedItem,
            ]}
            onPress={() => {
                setDeliveryId(item.id);
                setSelectedDeliveryNode(item);
                setDeliveryModalVisible(false);
            }}
        >
            <Text style={styles.nodeText}>{item.name}</Text>
        </Pressable>
    );

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="truck-fast-outline" size={120} color="#06631EFF" />
                </View>

                <Text style={styles.title}>Crea nuovo ordine</Text>

                <Text style={styles.label}>Punto di ritiro</Text>
                <Pressable
                    style={styles.selectionBox}
                    onPress={() => setPickupModalVisible(true)}
                >
                    <Text style={selectedPickupNode ? styles.selectedNodeText : styles.placeholderText}>
                        {selectedPickupNode ? selectedPickupNode.name : 'Seleziona un punto di ritiro...'}
                    </Text>
                </Pressable>


                <Text style={styles.label}>Punto di consegna</Text>
                <Pressable style={styles.selectionBox} onPress={() => setDeliveryModalVisible(true)}>
                    <Text style={selectedDeliveryNode ? styles.selectedNodeText : styles.placeholderText}>
                        {selectedDeliveryNode ? selectedDeliveryNode.name : 'Seleziona un punto di consegna...'}
                    </Text>
                </Pressable>

                <Text style={styles.label}>Quantità da trasportare</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={quantity}
                    onChangeText={setQuantity}
                />

                <View style={styles.section}>
                    <Text style={styles.label}>Tempo massimo di consegna</Text>
                    <FlatList
                        data={TIME_WINDOWS}
                        renderItem={({ item }) => (
                            <Pressable
                                style={[styles.timeWindowOption, timeWindow === item.value && styles.selectedTimeWindow]}
                                onPress={() => setTimeWindow(item.value)}
                            >
                                <Text style={timeWindow === item.value ? styles.selectedTimeWindowText : undefined}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        )}
                        horizontal
                        contentContainerStyle={styles.timeWindowContainer}
                        keyExtractor={(item) => item.value}
                    />
                </View>

                <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                    <Text style={styles.buttonText}>Crea ordine</Text>
                </TouchableOpacity>

                {/* Modale punto di ritiro */}
                <Modal
                    visible={isPickupModalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setPickupModalVisible(false)}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Seleziona punto di ritiro</Text>
                            <FlatList
                                data={nodes}
                                renderItem={renderPickupNodeItem}
                                keyExtractor={(item) => item.id}
                                style={styles.nodesList}
                            />
                            <Pressable style={styles.closeButton} onPress={() => setPickupModalVisible(false)}>
                                <Text style={styles.closeButtonText}>Chiudi</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                {/* Modale punto di consegna */}
                <Modal
                    visible={isDeliveryModalVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setDeliveryModalVisible(false)}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Seleziona punto di consegna</Text>
                            <FlatList
                                data={nodes}
                                renderItem={renderDeliveryNodeItem}
                                keyExtractor={(item) => item.id}
                                style={styles.nodesList}
                            />
                            <Pressable style={styles.closeButton} onPress={() => setDeliveryModalVisible(false)}>
                                <Text style={styles.closeButtonText}>Chiudi</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 100,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
        color: '#1f2937',
    },
    label: {
        marginTop: 16,
        fontWeight: '600',
        fontSize: 16,
        color: '#374151',
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 16,
    },
    section: {
        marginTop: 24,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    selectionBox: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        marginBottom: 16,
        backgroundColor: '#f9fafb',
    },
    placeholderText: {
        color: '#9ca3af',
    },
    selectedNodeText: {
        color: '#1f2937',
    },
    timeWindowContainer: {
        gap: 8,
        marginTop: 10,
        marginBottom: 10,
    },
    timeWindowOption: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#f9fafb',
    },
    selectedTimeWindow: {
        backgroundColor: '#06631EFF',
        borderColor: '#06631EFF',
    },
    selectedTimeWindowText: {
        color: '#fff',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        margin: 20,
        borderRadius: 8,
        padding: 16,
        maxHeight: '80%',
        minHeight: 400, // 👈 AGGIUNTO
    },

    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    nodesList: {
        flex: 1,
        marginBottom: 16,
    },
    nodeItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    nodeText: {
        fontSize: 16,
    },
    pressedItem: {
        backgroundColor: '#f3f4f6',
    },
    selectedItem: {
        backgroundColor: '#e6f7ed',
    },
    closeButton: {
        backgroundColor: '#06631EFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    button: {
        backgroundColor: '#06631EFF',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        marginTop: 30,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});