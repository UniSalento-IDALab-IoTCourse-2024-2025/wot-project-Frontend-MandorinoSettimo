import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ActivityIndicator, Alert, TextInput, Button, Keyboard, ScrollView } from 'react-native';
import MapView, { Marker, Callout, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import mqtt from 'mqtt';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '@/constants/ApiConfig';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

function getDistanceInMeters(coord1, coord2) {
    const R = 6371000; // raggio Terra in metri
    const toRad = deg => deg * Math.PI / 180;

    const dLat = toRad(coord2.latitude - coord1.latitude);
    const dLon = toRad(coord2.longitude - coord1.longitude);

    const lat1 = toRad(coord1.latitude);
    const lat2 = toRad(coord2.latitude);

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));



    return R * c;
}

export default function MapScreen() {
    const router = useRouter();
    const mapRef = useRef(null);

    const [realPath, setRealPath] = useState([]); // Lista di coordinate da visualizzare
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0); // Per mostrare una tappa alla volta
    const [currentPosition, setCurrentPosition] = useState(null);
    const [initialRegion, setInitialRegion] = useState(null);
    const [pois, setPois] = useState([]);
    const [activeRouteId, setActiveRouteId] = useState(null);
    const [vehicleId, setVehicleId] = useState(null);
    const [useRealPosition, setUseRealPosition] = useState(true);
    const [isReporting, setIsReporting] = useState(false);
    const [isOnRoute, setIsOnRoute] = useState(false);
    const mqttClientRef = useRef(null);
    const [mqttReady, setMqttReady] = useState(false);   // 👈 NEW

    const clearActiveRoute = async () => {
        const vid = vehicleId || await AsyncStorage.getItem('vehicleId');
        if (vid) await AsyncStorage.removeItem(`routeEvtTs:${vid}`); // evita che il prossimo evento venga scartato
        await AsyncStorage.multiRemove(['activeRouteId', 'currentSegmentIndex']);
        setActiveRouteId(null);
        setRealPath([]);
        setCurrentSegmentIndex(0);
        setIsOnRoute(false);
    };

    const bootstrapActiveRoute = React.useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const uid   = await AsyncStorage.getItem('userId');
            if (!token || !uid) return;

            // chiedi al backend la rotta attiva
            const rtRes = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/from/${uid}/active`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (rtRes.status === 200) {
                const a = await rtRes.json();
                // salva SIA in stato che in storage
                setActiveRouteId(a.id);
                setVehicleId(a.vehicleId);
                setIsOnRoute(true);
                setCurrentSegmentIndex(a.currentSegmentIndex ?? 0);

                await AsyncStorage.multiSet([
                    ['activeRouteId', a.id],
                    ['vehicleId', a.vehicleId],
                    ['currentSegmentIndex', String(a.currentSegmentIndex ?? 0)],
                    ['isOnRoute', 'true'],
                ]);
                await AsyncStorage.removeItem(`routeEvtTs:${a.vehicleId}`);

                console.log('✅ bootstrap active route:', a.id, a.vehicleId);
            } else if (rtRes.status === 404) {
                // nessuna rotta attiva: pulisci stato minimo
                setIsOnRoute(false);
                console.log('ℹ️ Nessuna tratta attiva');
            } else {
                console.warn('⚠️ Errore nel recupero active route:', rtRes.status);
            }
        } catch (e) {
            console.warn('⚠️ bootstrapActiveRoute error:', e);
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            bootstrapActiveRoute();
        }, [bootstrapActiveRoute])
    );

// opzionale: chiamalo anche al mount una volta
    useEffect(() => { bootstrapActiveRoute(); }, [bootstrapActiveRoute]);

    useEffect(() => {
        (async () => {
            try {
                const v = await AsyncStorage.getItem('vehicleId');
                const a = await AsyncStorage.getItem('activeRouteId');
                if (v) { setVehicleId(v); console.log('🔑 vehicleId from storage:', v); }
                if (a) { setActiveRouteId(a); console.log('🔑 activeRouteId from storage:', a); }
            } catch {}
        })();
    }, []);


    useEffect(() => {
        (async () => {
            if (!vehicleId && activeRouteId) {
                try {
                    const token = await AsyncStorage.getItem('authToken');
                    const resp = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${activeRouteId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (resp.ok) {
                        const meta = await resp.json();
                        const v = meta?.vehicleId ?? meta?.route?.vehicleId;
                        if (v) {
                            console.log('🚚 vehicleId fetched from route meta:', v);
                            setVehicleId(v);
                            await AsyncStorage.setItem('vehicleId', v);
                        }
                    }
                } catch {}
            }
        })();
    }, [activeRouteId, vehicleId]);

    useEffect(() => {
        (async () => {
            try {
                const uid = await AsyncStorage.getItem('userId');
                const token = await AsyncStorage.getItem('authToken');
                if (!uid || !token) { setIsOnRoute(false); return; }
                const r = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${uid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const j = await r.json().catch(() => null);
                const status = j?.user?.userStatus || j?.userStatus;
                setIsOnRoute(status === 'ON_ROUTE');
            } catch {
                setIsOnRoute(false);
            }
        })();
    }, []);



    useEffect(() => {
        const client = mqtt.connect(ApiConfig.MQTT_WS);
        mqttClientRef.current = client;

        client.on('connect', () => {
            setMqttReady(true);                      // 👈 NEW
            console.log('📡 MQTT connesso');
        });
        client.on('reconnect', () => console.log('↩️ MQTT reconnecting'));
        client.on('close', () => setMqttReady(false));     // 👈 NEW

        client.on('error', (err) => {
            console.log('❌ Errore MQTT:', err);
        });

        return () => {
            client.end(true, () => console.log('📴 MQTT disconnesso'));
            setMqttReady(false);
        };
    }, []);

    useEffect(() => {
        if (!currentPosition || !vehicleId || !activeRouteId || !mqttReady) return;

        const interval = setInterval(() => {
            const payload = {
                lat: currentPosition.latitude,
                lon: currentPosition.longitude,
                timestamp: new Date().toISOString()
            };
            const topic = `vehicle/${vehicleId}/position`;
            mqttClientRef.current?.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
                if (err) console.log('❌ MQTT publish error:', err);
                else console.log('📤 Posizione inviata via MQTT:', payload);
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [currentPosition, vehicleId, activeRouteId, mqttReady]);

    useEffect(() => {
        const client = mqttClientRef.current;
        if (!client || !mqttReady) return

        // ---- utils locali ----
        const refreshRealPath = async (routeId: string) => {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${routeId}/realpath`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) return;
            const rows = await res.json();
            const segments = await Promise.all(
                rows
                    .filter((p: any) => p.geometry && p.geometry.length > 1)
                    .map(async (path: any) => {
                        const isVirtual = (idx: string) =>
                            typeof idx === 'string' && (idx.startsWith('START_') || idx.startsWith('RESCUE_'));
                        const toName = isVirtual(path.toNodeIndex)
                            ? (path.toLabel || 'Virtual')
                            : await fetchNodeName(path.toNodeIndex);
                        return {
                            id: path.id,
                            geometry: path.geometry.map(([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon })),
                            fromLabel: path.fromLabel,
                            toLabel: path.toLabel,
                            toName,
                            fromNodeIndex: path.fromNodeIndex,
                            toNodeIndex: path.toNodeIndex,
                            orderIds: path.orderIds || [],
                            distanceM: path.distanceM,
                            timeS: path.timeS
                        };
                    })
            );
            setRealPath(segments);
        };

        let currentTopic: string | undefined;
        const subscribeSpecific = (vid: string) => {
            currentTopic = `vehicle/${vid}/route-started`;
            client.subscribe(currentTopic, { qos: 1 }, (err) => {
                if (err) console.log('❌ subscribe specific err:', err, currentTopic);
                else console.log('📥 Sottoscritto a topic specifico:', currentTopic);
            });
        };
        const subscribeWildcard = () => {
            currentTopic = `vehicle/+/route-started`;
            client.subscribe(currentTopic, { qos: 1 }, (err) => {
                if (err) console.log('❌ subscribe wildcard err:', err, currentTopic);
                else console.log('📥 Sottoscritto a topic wildcard:', currentTopic);
            });
        };

        const onMessage = async (t: string, msg: any, packet?: any) => {
            // accetta sia specifico che wildcard
            if (!t.startsWith('vehicle/') || !t.endsWith('/route-started')) return;

            let payload: any;
            try { payload = JSON.parse(msg.toString()); } catch { return; }
            const { routeId, kind, ts } = payload || {};
            if (!routeId) return;

            // se siamo su wildcard, filtra per utente e scopri il vehicleId corretto
            if (currentTopic === 'vehicle/+/route-started') {
                const token = await AsyncStorage.getItem('authToken');
                const uid = await AsyncStorage.getItem('userId');
                if (!(token && uid)) return;

                const metaRes = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${routeId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!metaRes.ok) return;
                const meta = await metaRes.json();
                const associated = meta?.associatedUserId ?? meta?.route?.associatedUserId;
                const vehicleOfRoute = meta?.vehicleId ?? meta?.route?.vehicleId;
                if (associated !== uid) return;

                // switch da wildcard a specifico
                if (vehicleOfRoute) {
                    setVehicleId(vehicleOfRoute);
                    await AsyncStorage.setItem('vehicleId', vehicleOfRoute);
                    try { client.unsubscribe('vehicle/+/route-started'); } catch {}
                    subscribeSpecific(vehicleOfRoute);
                }
            }

            // ---- guardie tue originali ----
            const retained = !!packet?.retain;
            const storedActive = await AsyncStorage.getItem('activeRouteId');

            if (retained && !storedActive) {
                try {
                    const uid = await AsyncStorage.getItem('userId');
                    const token = await AsyncStorage.getItem('authToken');
                    if (uid && token) {
                        const r = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${uid}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const j = await r.json().catch(() => null);
                        const status = j?.user?.userStatus || j?.userStatus;
                        if (status !== 'ON_ROUTE') {
                            console.log('ℹ️ Ignoro retained route-started perché utente non è ON_ROUTE');
                            return;
                        }
                    } else {
                        return;
                    }
                } catch {
                    return;
                }
            }

            const vid = await AsyncStorage.getItem('vehicleId');
            const tsKey = `routeEvtTs:${vid || ''}`;
            const lastTs = await AsyncStorage.getItem(tsKey);
            if (ts && lastTs && Date.parse(ts) <= Date.parse(lastTs)) return;
            if (ts) await AsyncStorage.setItem(tsKey, ts);

            const current = storedActive || activeRouteId;
            if (routeId === current) {
                await refreshRealPath(routeId);
                Alert.alert('Rotta aggiornata', kind === 'rescue'
                    ? 'Nuove tappe di soccorso aggiunte alla tua rotta.'
                    : 'La tua rotta è stata aggiornata.');
                return;
            }

            // nuova rotta
            await AsyncStorage.setItem('activeRouteId', routeId);
            setActiveRouteId(routeId);
            setIsOnRoute(true);
            await AsyncStorage.setItem('isOnRoute', 'true');

            // se ancora non conosci il vehicleId, prova a ricavarlo dalla rotta
            if (!vid) {
                const token = await AsyncStorage.getItem('authToken');
                const metaRes2 = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${routeId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (metaRes2.ok) {
                    const meta2 = await metaRes2.json();
                    if (meta2?.vehicleId) {
                        setVehicleId(meta2.vehicleId);
                        await AsyncStorage.setItem('vehicleId', meta2.vehicleId);
                    }
                }
            }

            // carica subito i segmenti
            await refreshRealPath(routeId);

            const savedIdx = await AsyncStorage.getItem('currentSegmentIndex');
            if (!savedIdx) setCurrentSegmentIndex(0);

            Alert.alert('Nuova rotta', kind === 'rescue'
                ? 'Ti è stata assegnata una rotta di soccorso.'
                : 'Tratta accettata: si parte!');
        };

        client.on('message', onMessage);
        if (vehicleId) subscribeSpecific(vehicleId); else subscribeWildcard();

        return () => {
            if (currentTopic) { try { client.unsubscribe(currentTopic); } catch {} }
            client.removeListener?.('message', onMessage);
        };
    }, [vehicleId, mqttReady]);


    useEffect(() => {
        const restoreSession = async () => {
            const routeId = await AsyncStorage.getItem('activeRouteId');
            const segmentIndex = await AsyncStorage.getItem('currentSegmentIndex');
            const vId = await AsyncStorage.getItem('vehicleId');
            const onRouteStr = await AsyncStorage.getItem('isOnRoute');
            const token = await AsyncStorage.getItem('authToken');
            const uid = await AsyncStorage.getItem('userId');

            setIsOnRoute(onRouteStr === 'true');

            // Se c'è un routeId, valido che:
            // 1) appartenga a questo utente
            // 2) non sia completata
            if (routeId && token && uid) {
                try {
                    const r = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${routeId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const j = await r.json().catch(() => null);

                    const associated = j?.associatedUserId ?? j?.route?.associatedUserId;
                    const completed = j?.completed === true || j?.route?.completed === true;

                    if (associated !== uid || completed) {
                        await AsyncStorage.multiRemove(['activeRouteId','currentSegmentIndex','vehicleId','isOnRoute']);
                        setActiveRouteId(null);
                        setCurrentSegmentIndex(0);
                        setVehicleId(null);
                        setIsOnRoute(false);
                        return;
                    }
                } catch {
                    // in dubbio? non ripristino niente
                    await AsyncStorage.multiRemove(['activeRouteId','currentSegmentIndex','vehicleId','isOnRoute']);
                    setActiveRouteId(null);
                    setCurrentSegmentIndex(0);
                    setVehicleId(null);
                    setIsOnRoute(false);
                    return;
                }
            }

            if (routeId) setActiveRouteId(routeId);
            if (segmentIndex && !isNaN(parseInt(segmentIndex))) setCurrentSegmentIndex(parseInt(segmentIndex));
            if (vId) setVehicleId(vId);

            try {
                if (routeId) {
                    const token = await AsyncStorage.getItem('authToken');
                    const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${routeId}/realpath`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const rows = await res.json();
                        // riusa la stessa mappatura lon/lat → {latitude,longitude} che hai già
                        const segments = await Promise.all(
                            rows
                                .filter((p: any) => p.geometry && p.geometry.length > 1)
                                .map(async (path: any) => ({
                                    id: path.id,
                                    geometry: path.geometry.map(([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon })),
                                    fromLabel: path.fromLabel,
                                    toLabel: path.toLabel,
                                    toName: await fetchNodeName(path.toNodeIndex),
                                    fromNodeIndex: path.fromNodeIndex,
                                    toNodeIndex: path.toNodeIndex,
                                    orderIds: path.orderIds || [],
                                    distanceM: path.distanceM,
                                    timeS: path.timeS
                                }))
                        );
                        setRealPath(segments);
                    }
                }
            } catch {}

        };
        restoreSession();
    }, []);



    useEffect(() => {
        if (!activeRouteId || !isOnRoute) return;

        const fetchRealPath = async () => {
            const token = await AsyncStorage.getItem('authToken');
            try {
                const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${activeRouteId}/realpath`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) {
                    console.warn("RealPath non disponibile: pulisco route attiva");
                    await clearActiveRoute();
                    return;
                }

                const data = await res.json();
                if (!Array.isArray(data) || data.length === 0) {
                    console.warn("RealPath vuoto: pulisco route attiva");
                    await clearActiveRoute();
                    return;
                }

                const segments = await Promise.all(
                    data
                        .filter(p => p.geometry && p.geometry.length > 1)
                        .map(async path => {
                            const isVirtual = (idx: string) => typeof idx === 'string' && (idx.startsWith('START_') || idx.startsWith('RESCUE_'));
                            const toName = isVirtual(path.toNodeIndex)
                                ? (path.toLabel || 'Virtual')
                                : await fetchNodeName(path.toNodeIndex);

                            return {
                                id: path.id,
                                geometry: path.geometry.map(([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon })),
                                fromLabel: path.fromLabel,
                                toLabel: path.toLabel,
                                toName,
                                fromNodeIndex: path.fromNodeIndex,
                                toNodeIndex: path.toNodeIndex,
                                orderIds: path.orderIds || [],
                                distanceM: path.distanceM,
                                timeS: path.timeS
                            };
                        })
                );

                setRealPath(segments);

                const savedIndex = await AsyncStorage.getItem('currentSegmentIndex');
                if (savedIndex && !isNaN(parseInt(savedIndex))) {
                    setCurrentSegmentIndex(parseInt(savedIndex));
                }
            } catch (err) {
                console.error("Errore nella fetch dei realpath", err);
                await clearActiveRoute();
            }

        };

        fetchRealPath();
    }, [activeRouteId, isOnRoute]);

    useEffect(() => {
        let subscription: Location.LocationSubscription;

        const setupLocation = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permesso posizione non concesso');
                return;
            }

            const loc = await Location.getCurrentPositionAsync({});
            if (loc.coords) {
                setInitialRegion((prev) => prev ?? {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                });

                if (useRealPosition) {
                    subscription = await Location.watchPositionAsync(
                        {
                            accuracy: Location.Accuracy.High,
                            timeInterval: 5000,
                            distanceInterval: 1,
                        },
                        (loc) => {
                            if (loc.coords) {
                                setCurrentPosition(loc.coords);
                            }
                        }
                    );
                } else {
                    setCurrentPosition(loc.coords);
                }
            }
        };

        setupLocation();

        return () => {
            if (subscription) subscription.remove();
        };
    }, [useRealPosition]);

    useEffect(() => {
        const loadVehicleId = async () => {
            const vId = await AsyncStorage.getItem('vehicleId');
            if (vId) {
                //console.log("✅ vehicleId caricato da AsyncStorage:", vId);
                setVehicleId(vId);
            } else {
                console.warn("⚠️ vehicleId non trovato");
            }
        };
        if (activeRouteId) {
            loadVehicleId();
        }
    }, [activeRouteId]);

    console.log("🧭 Distanza dalla tappa:", getDistanceInMeters(
        currentPosition ?? { latitude: 0, longitude: 0 },
        realPath[currentSegmentIndex]?.geometry?.at(-1) ?? { latitude: 0, longitude: 0 }
    ));

    const markOrderDelivered = async (orderId) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/orders/${orderId}/mark-delivered`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            });
            if (res.ok) {
                console.log("✅ Ordine consegnato");
            } else {
                console.warn("⚠️ Errore nella conferma di consegna");
            }
        } catch (error) {
            console.error("❌ Errore nella fetch di consegna:", error);
        }
    };

    const markOrderPickedUp = async (orderId: string) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(
                `${ApiConfig.DELIVERY_SERVICE}/orders/${orderId}/status?status=PICKED_UP`,
                {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                console.warn('⚠️ Errore nel set PICKED_UP:', res.status, txt);
                return false;
            }

            console.log(`✅ Ordine ${orderId} -> PICKED_UP`);
            return true;
        } catch (e) {
            console.error('❌ Errore rete set PICKED_UP:', e);
            return false;
        }
    };


    const reportIncident = async () => {
        if (!vehicleId || !currentPosition) {
            Alert.alert('Dati insufficienti', 'Mi servono vehicleId e posizione corrente.');
            return;
        }
        setIsReporting(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const userId = await AsyncStorage.getItem('userId');
            // NUOVO payload per il tuo ReportAnomalyRequestDTO
            const body = {
                userId,
                vehicleId,
                activeRouteId,
                anomalyLat: currentPosition.latitude,
                anomalyLon: currentPosition.longitude,
                timestamp: new Date().toISOString()
            };

            console.log(body);
            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/routes/report-anomaly`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const json = await res.json().catch(() => null);

            if (res.ok && json?.code === 200) {
                Alert.alert('Segnalazione inviata', json?.message || "L'admin sta riassegnando gli ordini.");
                const vid = vehicleId || await AsyncStorage.getItem('vehicleId');
                if (vid) {
                    await AsyncStorage.removeItem(`routeEvtTs:${vid}`);
                }

                await AsyncStorage.multiRemove(['activeRouteId','currentSegmentIndex','vehicleId']);
                await AsyncStorage.setItem('isOnRoute','false');

                setActiveRouteId(null);
                setRealPath([]);
                setCurrentSegmentIndex(0);
                setVehicleId(null);
                setIsOnRoute(false);
                console.log('GREEDY result:\n', json?.data);
            } else {
                console.warn('Errore segnalazione:', json?.message);
                Alert.alert('Errore', json?.message || 'Non è stato possibile inviare la segnalazione.');
            }
        } catch (e) {
            console.error('Errore di rete segnalazione:', e);
            Alert.alert('Errore di rete', 'Controlla la connessione e riprova.');
        } finally {
            setIsReporting(false);
        }
    };

    const fetchNodeName = async (nodeId) => {
        const token = await AsyncStorage.getItem('authToken');
        const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/nodes/${nodeId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            return data?.node?.name ?? nodeId;
        }
        return nodeId; // fallback
    };


    useEffect(() => {
        if (!currentPosition || realPath.length === 0 || !activeRouteId) return;

        const segment = realPath[currentSegmentIndex];
        const distanzaMinima = segment.geometry
            .map(p => getDistanceInMeters(p, currentPosition))
            .reduce((a, b) => Math.min(a, b), Infinity);

        const valTrigger = 50;

        if (distanzaMinima > valTrigger) {
            console.warn("⚠️ Veicolo fuori rotta di oltre " + valTrigger + "m!");

            const triggerRecalculation = async () => {
                try {
                    const token = await AsyncStorage.getItem('authToken');
                    if (!token) {
                        console.warn("❌ Token non trovato");
                        return;
                    }

                    const body = {
                        currentLat: currentPosition.latitude,
                        currentLon: currentPosition.longitude,
                        routeId: activeRouteId,
                        segmentId: segment.id
                    };

                    //console.log("📤 Ricalcolo: invio payload", body);

                    const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/routes/recalculate-route`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    });

                    const result = await res.json();
                    if (res.ok && result.code === 200) {
                        console.log("🔁 Tratta ricalcolata con successo");

                        setRealPath(prev => {
                            const updated = [...prev];
                            updated[currentSegmentIndex] = {
                                ...updated[currentSegmentIndex],
                                geometry: result.updatedSegment.geometry.map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
                                distanceM: result.updatedSegment.distanceM,
                                timeS: result.updatedSegment.timeS
                            };

                            return updated;
                        });
                    } else {
                        console.warn("❌ Errore nel ricalcolo:", result.message || "Errore ignoto");
                    }

                } catch (err) {
                    console.error("❌ Errore di rete nel ricalcolo:", err);
                }
            };

            triggerRecalculation();
        }
    }, [currentPosition, realPath, currentSegmentIndex]);

    useEffect(() => {
        if (currentSegmentIndex >= realPath.length) {
            const next = realPath.length > 0 ? realPath.length - 1 : 0;
            if (next !== currentSegmentIndex) {
                setCurrentSegmentIndex(next);
                AsyncStorage.setItem('currentSegmentIndex', String(next));
            }
        }
    }, [realPath.length]);


    // 🔘 Toggle tra posizione reale e simulata
    const togglePositionControl = (
        <View style={{
            position: 'absolute',
            bottom: 100,
            right: 20,
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 8,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            zIndex: 999
        }}>
            <TouchableOpacity onPress={() => {
                setUseRealPosition(prev => !prev);
                Alert.alert("Modalità cambiata", `Ora stai usando la posizione ${!useRealPosition ? 'reale' : 'simulata'}`);
            }}>
                <Ionicons name={useRealPosition ? 'location' : 'map-outline'} size={28} color="#2563eb" />
            </TouchableOpacity>
        </View>
    );

    const incidentButton = (
        <View style={{
            position: 'absolute',
            bottom: 100,
            left: 20,
            zIndex: 999,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 5
        }}>
            <TouchableOpacity
                disabled={isReporting}
                onPress={() => {
                    Alert.alert(
                        "Segnalare imprevisto all'admin?",
                        "Invierò la tua posizione e i dettagli del percorso.",
                        [
                            { text: 'Annulla', style: 'cancel' },
                            { text: 'Segnala', style: 'destructive', onPress: reportIncident }
                        ]
                    );
                }}
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#ef4444', // rosso
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {isReporting
                    ? <ActivityIndicator color="white" />
                    : <Ionicons name="warning" size={28} color="white" /> /* triangolo di avviso */}
            </TouchableOpacity>
        </View>
    );




    return (
        <View style={styles.container}>
            {togglePositionControl}
            {incidentButton}
            {initialRegion && (
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    initialRegion={initialRegion}
                    onPress={(e) => {
                        if (!useRealPosition) {
                            const coord = e.nativeEvent.coordinate;
                            setCurrentPosition(coord);
                            console.log("📍 Posizione simulata:", coord);
                        }
                    }}
                >
                    {currentPosition && (
                        <Marker
                            coordinate={currentPosition}
                            title="La tua posizione"
                            pinColor="red"
                        />
                    )}
                    {pois.map((poi) => (
                        <Marker
                            key={poi.id}
                            coordinate={{ latitude: poi.lat, longitude: poi.lon }}
                            pinColor="green"
                        />
                    ))}
                    {(() => {
                        const seg = realPath[currentSegmentIndex];
                        const hasGeom = !!(seg && Array.isArray(seg.geometry) && seg.geometry.length > 0);

                        return (
                            <>
                                {hasGeom && (
                                    <Polyline
                                        coordinates={seg.geometry}
                                        strokeColor="blue"
                                        strokeWidth={4}
                                    />
                                )}

                                {hasGeom && (
                                    <Marker
                                        coordinate={seg.geometry[seg.geometry.length - 1]} // ultimo punto
                                        title={`Tappa ${currentSegmentIndex + 1}`}
                                        pinColor="orange"
                                    />
                                )}
                            </>
                        );
                    })()}

                </MapView>
            )}
            {(() => {
                const isNearNextTappa =
                    currentPosition &&
                    realPath.length > currentSegmentIndex &&
                    getDistanceInMeters(
                        currentPosition,
                        realPath[currentSegmentIndex]?.geometry?.at(-1)
                    ) < 50;

                /*console.log("🧭 Distanza live:", getDistanceInMeters(
                    currentPosition ?? { latitude: 0, longitude: 0 },
                    realPath[currentSegmentIndex]?.geometry?.at(-1) ?? { latitude: 0, longitude: 0 }
                ));*/



                return isNearNextTappa ? (
                    <View style={{
                        position: 'absolute',
                        bottom: 90,
                        alignSelf: 'center',
                        backgroundColor: 'white',
                        padding: 7,
                        borderRadius: 15
                    }}>
                        <Button
                            title="Avanza alla prossima tappa"
                            onPress={() => {
                                const current = realPath[currentSegmentIndex];
                                const action = current.toLabel === "Pickup" ? "Carico" :
                                    current.toLabel === "Delivery" ? "Consegna" :
                                        "Depot";

                                Alert.alert(
                                    `${action}`,
                                    `Tappa ${currentSegmentIndex + 1}\n${current.toName}`,
                                    [
                                        {
                                            text: 'OK',
                                            onPress: async () => {

                                                if (current.toLabel === "Pickup" && current.orderIds?.length > 0) {
                                                    for (const orderId of current.orderIds) {
                                                        await markOrderPickedUp(orderId);
                                                    }
                                                }

                                                if (current.toLabel === "Delivery" && current.orderIds?.length > 0) {
                                                    // Filtra ordini il cui pickup è già stato fatto
                                                    const deliverableOrders = current.orderIds.filter(orderId => {
                                                        // Trova se esiste un segmento precedente di tipo Pickup per questo ordine
                                                        return realPath.some((seg, index) =>
                                                            index < currentSegmentIndex &&
                                                            seg.toLabel === "Pickup" &&
                                                            seg.orderIds?.includes(orderId)
                                                        );
                                                    });

                                                    for (const orderId of deliverableOrders) {
                                                        await markOrderDelivered(orderId);
                                                    }
                                                }

                                                if (currentSegmentIndex < realPath.length - 1) {
                                                    const nextIndex = currentSegmentIndex + 1;
                                                    setCurrentSegmentIndex(nextIndex);
                                                    // ✅ Aggiorna anche il backend
                                                    const token = await AsyncStorage.getItem('authToken');

                                                    await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/${activeRouteId}/update-progress`, {
                                                        method: 'PATCH',
                                                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ currentSegmentIndex: nextIndex })
                                                    });


                                                    await AsyncStorage.setItem('currentSegmentIndex', nextIndex.toString());
                                                } else {
                                                    // Percorso completato
                                                    const token = await AsyncStorage.getItem('authToken');
                                                    const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/routes/${activeRouteId}/complete`, {
                                                        method: 'POST',
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });

                                                    if (res.ok) {
                                                        const response = await res.json();
                                                        if (response.code === 200) {
                                                            Alert.alert("✅ Percorso completato");
                                                            const vid = vehicleId || await AsyncStorage.getItem('vehicleId');
                                                            if (vid) {
                                                                await AsyncStorage.removeItem(`routeEvtTs:${vid}`);
                                                            }

                                                            await AsyncStorage.multiRemove(['activeRouteId','currentSegmentIndex','vehicleId']);
                                                            await AsyncStorage.setItem('isOnRoute','false');

                                                            setRealPath([]);
                                                            setCurrentSegmentIndex(0);
                                                            setActiveRouteId(null);
                                                            setVehicleId(null);
                                                            setIsOnRoute(false);

                                                            router.replace('/orderscheck');
                                                        } else {
                                                            Alert.alert("⚠️ Errore", response.message || "Errore imprevisto");
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                );
                            }}
                        />

                    </View>
                ) : null;
            })()}
        </View>
    );
}

    const styles = StyleSheet.create({
    container: { flex: 1 },

});

