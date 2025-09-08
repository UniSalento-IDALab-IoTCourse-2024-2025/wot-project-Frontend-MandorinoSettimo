// AdminLiveMap.jsx (versione DTO-accurate)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, FlatList, Alert, Platform, Switch } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { ApiConfig } from '@/constants/ApiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function AdminLiveMap() {
    const mapRef = useRef(null);
    const [vehicles, setVehicles] = useState([]);
    const [selected, setSelected] = useState(null);      // {type:'VEHICLE'|'DEPOT', data:{}}
    const [context, setContext] = useState(null);        // VehicleContextDTO
    const [loadingCtx, setLoadingCtx] = useState(false);
    const [loading, setLoading] = useState(false);

    const [showRoute, setShowRoute] = useState(false);
    const [recalcCooldownUntil, setRecalcCooldownUntil] = useState(0);
    const insets = useSafeAreaInsets();

    // ---- CONFIG ----
    const TRIGGER_M = 50;      // soglia fuori rotta
    const COOLDOWN_MS = 8000;  // antirimbalzo ricalcolo
    const RECALC_URL = `${ApiConfig.DELIVERY_SERVICE}/routes/recalculate-route`;
    const markerRefs = useRef(new Map());

    useEffect(() => {
        // se attivo "Mostra percorso", chiudo il callout del veicolo selezionato (se aperto)
        if (showRoute && selected?.type === 'VEHICLE') {
            const ref = markerRefs.current.get(selected.data.vehicleId);
            ref?.hideCallout?.();
        }
    }, [showRoute, selected]);


    const depot = useMemo(() => ({ name: 'Depot Centrale', lat: 40.3362389, lon: 18.1111071 }), []);

    const getToken = async () => { try { return (await AsyncStorage.getItem('authToken')) || undefined; } catch { return undefined; } };

    const fetchLive = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/admin/vehicles/live`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            setVehicles(Array.isArray(data) ? data : []);
        } catch (e) {
            //console.log('❌ live fetch error', e?.message);
        } finally { setLoading(false); }
    };

    // polling ogni 3s
    useEffect(() => {
        let t;
        const tick = async () => {
            const token = await getToken();
            if (token) {
                await fetchLive();
                t = setTimeout(tick, 3000);
            }
        };
        tick();
        return () => clearTimeout(t);
    }, []);

    // ---- Helpers ----
    const toLatLngArray = (poly) => (poly || []).map(p => ({ latitude: p.lat, longitude: p.lon }));
    const toContextPoly = (pairsLonLat) => (pairsLonLat || []).map(([lon, lat]) => ({ lat, lon }));
    const getDistanceInMeters = (a, b) => {
        const R = 6371000, toRad = d => d * Math.PI / 180;
        const dLat = toRad(b.latitude - a.latitude), dLon = toRad(b.longitude - a.longitude);
        const lat1 = toRad(a.latitude), lat2 = toRad(b.latitude);
        const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
        return 2 * R * Math.asin(Math.sqrt(h));
    };

    // ---- Apertura pannelli ----
    const openVehicleContext = async (v) => {
        if (v.status !== 'IN_TRANSIT') { openDepotPanel(); return; }
        setSelected({ type: 'VEHICLE', data: v });
        setShowRoute(false);
        setLoadingCtx(true);
        setContext(null);
        try {
            const token = await getToken();
            const res = await fetch(`${ApiConfig.DELIVERY_SERVICE}/admin/vehicles/${v.vehicleId}/context`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (!res.ok) { Alert.alert('Info', 'Nessun contesto disponibile.'); return; }
            const ctx = await res.json(); // VehicleContextDTO { vehicleId, routeId, currentSegmentIndex, currentSegmentPolyline, ... }
            setContext(ctx);
            if (mapRef.current) mapRef.current.animateCamera({ center: { latitude: v.lat, longitude: v.lon }, zoom: 14 });
        } catch (e) {
            console.log('❌ context fetch error', e?.message);
        } finally { setLoadingCtx(false); }
    };

    const openDepotPanel = () => {
        setSelected({ type: 'DEPOT', data: { ...depot } });
        setShowRoute(false);
        setContext(null);
        if (mapRef.current) mapRef.current.animateCamera({ center: { latitude: depot.lat, longitude: depot.lon }, zoom: 13 });
    };

    const closeSheet = () => { setSelected(null); setShowRoute(false); setContext(null); };

    // ---- Ricalcolo live (usa routeId + currentSegmentIndex dei tuoi DTO) ----
    useEffect(() => {
        if (!showRoute || selected?.type !== 'VEHICLE' || !context) return;

        const routeId = context?.routeId;
        const segmentIndex = typeof context?.currentSegmentIndex === 'number' ? context.currentSegmentIndex : null;
        const hasPolyline = Array.isArray(context?.currentSegmentPolyline) && context.currentSegmentPolyline.length > 1;
        if (!hasPolyline) return;                 // possiamo mostrare la linea solo se c'è geometria
        if (!routeId || segmentIndex === null) return;  // senza questi NON ricalcoliamo (ma la linea resta)

        // posizione corrente del veicolo selezionato, dal polling
        const live = (vehicles || []).find(v => v.vehicleId === selected.data.vehicleId);
        if (!live?.lat || !live?.lon) return;

        const currentPos = { latitude: live.lat, longitude: live.lon };
        const segmentLatLng = toLatLngArray(context.currentSegmentPolyline);

        const minDist = segmentLatLng
            .map(p => getDistanceInMeters(p, currentPos))
            .reduce((a, b) => Math.min(a, b), Infinity);

        const now = Date.now();
        if (minDist <= TRIGGER_M || now < recalcCooldownUntil) return;

        setRecalcCooldownUntil(now + COOLDOWN_MS);

        (async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                if (!token) return;

                // ⬇️ inviamo anche segmentId: null per retrocompatibilità; il BE userà segmentIndex se presente
                const body = {
                    vehicleId: selected.data.vehicleId,
                    routeId: context.routeId,
                    currentLat: currentPos.latitude,
                    currentLon: currentPos.longitude,
                    segmentId: null,                         // lasciamo null
                    segmentIndex: context.currentSegmentIndex // ⇐ usa questo
                };

                const res = await fetch(RECALC_URL, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const text = await res.text();
                const result = text ? JSON.parse(text) : null;

                if (res.ok && result?.code === 200 && result?.updatedSegment?.geometry?.length) {
                    setContext(prev => ({
                        ...prev,
                        currentSegmentPolyline: result.updatedSegment.geometry.map(([lon, lat]) => ({ lat, lon }))
                    }));
                    mapRef.current?.animateCamera({ center: currentPos, zoom: 14 });
                } else {
                    console.warn("❌ Errore nel ricalcolo:", result?.message || `HTTP ${res.status}`);
                }
            } catch (err) { console.error('❌ Recalc network error:', err); }
        })();
    }, [showRoute, vehicles, selected, context, recalcCooldownUntil]);

    // ---- Icone & marker ----
    const TruckMarkerIcon = ({ size = 28, color = '#2563eb' }) => (<View style={styles.iconWrap}><MaterialCommunityIcons name="truck" size={size} color={color} /></View>);
    const DepotMarkerIcon = ({ size = 30, color = '#7c3aed' }) => (<View style={styles.iconWrap}><MaterialCommunityIcons name="warehouse" size={size} color={color} /></View>);

    const renderTransitMarker = (v) => {
        const isSelected = selected?.type === 'VEHICLE' && selected.data.vehicleId === v.vehicleId;
        const hideCallout = showRoute && isSelected; // ← quando ON e veicolo selezionato, niente callout

        return (
            <Marker
                key={v.vehicleId}
                coordinate={{ latitude: v.lat, longitude: v.lon }}
                onPress={() => openVehicleContext(v)}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                calloutAnchor={{ x: 0.5, y: 0 }}
                ref={(ref) => {
                    if (ref) markerRefs.current.set(v.vehicleId, ref);
                    else markerRefs.current.delete(v.vehicleId);
                }}
            >
                <TruckMarkerIcon color={v.isStale ? '#6b7280' : '#2563eb'} />
                {!hideCallout && (
                    <Callout tooltip>
                        <View style={styles.calloutBox}>
                            <Text style={styles.calloutTitle}>
                                {v.plate}{' '}<Text style={styles.badge}>{(v.status || '').replace('_', ' ')}</Text>
                            </Text>
                            <Text style={styles.calloutLine}>Driver: {v.driverName || '—'}</Text>
                            <Text style={styles.calloutLine}>Last: {v.lastUpdate ? new Date(v.lastUpdate).toLocaleTimeString() : '—'}</Text>
                            {typeof v.speedKmh === 'number' && (
                                <Text style={styles.calloutLine}>Speed: {v.speedKmh.toFixed(1)} km/h</Text>
                            )}
                        </View>
                    </Callout>
                )}
            </Marker>
        );
    };

    const availableAtDepot = useMemo(() => (vehicles || []).filter(v => v.status === 'AVAILABLE'), [vehicles]);
    const hasPolyline = !!(context?.currentSegmentPolyline?.length);

    return (
        <View style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                style={StyleSheet.absoluteFillObject}
                initialRegion={{ latitude: depot.lat, longitude: depot.lon, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
            >
                {/* DEPOT */}
                <Marker coordinate={{ latitude: depot.lat, longitude: depot.lon }} onPress={openDepotPanel} anchor={{ x: 0.5, y: 0.5 }} calloutAnchor={{ x: 0.5, y: 0 }}>
                    <DepotMarkerIcon />
                    <Callout tooltip>
                        <View style={styles.calloutBox}>
                            <Text style={styles.calloutTitle}>{depot.name}</Text>
                            <Text style={styles.calloutLine}>Veicoli disponibili: {availableAtDepot.length}</Text>
                        </View>
                    </Callout>
                </Marker>

                {/* Veicoli IN_TRANSIT */}
                {(vehicles || []).filter(v => v.status === 'IN_TRANSIT').map(renderTransitMarker)}

                {/* Polyline dinamica (visibile anche senza ID; ricalcolo solo con routeId+segmentIndex) */}
                {showRoute && selected?.type === 'VEHICLE' && hasPolyline && (
                    <Polyline coordinates={toLatLngArray(context.currentSegmentPolyline)} strokeWidth={5} strokeColor="blue" />
                )}
            </MapView>

            {loading && <View style={styles.loadingOverlay}><ActivityIndicator /></View>}

            {/* Bottom sheet */}
            {!!selected && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <View style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]} pointerEvents="auto">
                        {/* Header con grabber + X */}
                        <View style={styles.sheetHeader}>
                            <View style={styles.grabber} />
                            <TouchableOpacity onPress={closeSheet} style={styles.closeIcon} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                                <MaterialCommunityIcons name="close" size={22} />
                            </TouchableOpacity>
                        </View>

                        {/* VEICOLO */}
                        {selected?.type === 'VEHICLE' && (
                            <>
                                <Text style={styles.title}>
                                    {selected.data.plate} — {selected.data.status}{selected.data.isStale ? ' (offline)' : ''}
                                </Text>
                                <Text style={styles.sub}>
                                    {selected.data.driverName ?? '—'} · last seen {selected.data.lastUpdate ? new Date(selected.data.lastUpdate).toLocaleTimeString() : '—'}
                                </Text>

                                <View style={styles.rowBetween}>
                                    <Text style={styles.h}>Mostra percorso</Text>
                                    <Switch value={showRoute} onValueChange={setShowRoute} disabled={!hasPolyline} />
                                </View>

                                {!hasPolyline && <Text style={{ color: '#777', marginTop: -2 }}>Percorso non disponibile (manca geometria dal contesto).</Text>}
                                {hasPolyline && (!context?.routeId || typeof context?.currentSegmentIndex !== 'number') && (
                                    <Text style={{ color: '#777', marginTop: 2 }}>Mostro la linea; per il ricalcolo servono routeId + currentSegmentIndex.</Text>
                                )}
                                {hasPolyline && !!context?.routeId && typeof context?.currentSegmentIndex === 'number' && showRoute && (
                                    <Text style={{ color: '#777' }}>Ricalcolo attivo: parte se fuori rotta &gt; {TRIGGER_M} m.</Text>
                                )}

                                {loadingCtx && <ActivityIndicator style={{ marginTop: 8 }} />}

                                {context && (
                                    <>
                                        <Text style={styles.h}>Prossima fermata</Text>
                                        <Text style={styles.p}>
                                            {context.nextStop?.name ?? '—'}
                                            {typeof context.nextStop?.etaMinutes === 'number' ? ` · ETA ${context.nextStop.etaMinutes}′` : ''}
                                        </Text>

                                        <Text style={styles.h}>Prossime tappe</Text>
                                        <FlatList
                                            data={context.upcomingStops ?? []}
                                            keyExtractor={(it, i) => String(it?.name ?? i)}
                                            renderItem={({ item }) => <Text style={styles.li}>• {item.name}</Text>}
                                            style={{ maxHeight: 140 }}
                                        />

                                        <Text style={styles.h}>Ordini in corso</Text>
                                        <FlatList
                                            data={context.ordersInProgress ?? []}
                                            keyExtractor={(item, i) => String(item?.orderId ?? i)}
                                            renderItem={({ item }) => (
                                                <Text style={styles.li}>
                                                    • {item.orderId}
                                                    {item?.type ? ` (${item.type})` : ''}
                                                    {item?.pickupFrom ? ` · da ${item.pickupFrom}` : ''}
                                                    {item?.deliveryTo ? ` → ${item.deliveryTo}` : ''}
                                                </Text>
                                            )}
                                            style={{ maxHeight: 160 }}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {/* DEPOT */}
                        {selected?.type === 'DEPOT' && (
                            <>
                                <Text style={styles.title}>{depot.name}</Text>
                                <Text style={styles.sub}>Veicoli disponibili in deposito: {availableAtDepot.length}</Text>
                                <FlatList
                                    style={{ marginTop: 8, maxHeight: 220 }}
                                    data={availableAtDepot}
                                    keyExtractor={(v) => String(v.vehicleId)}
                                    renderItem={({ item }) => (
                                        <View style={styles.cardRow}>
                                            <MaterialCommunityIcons name="truck-outline" size={22} />
                                            <View style={{ marginLeft: 8, flex: 1 }}>
                                                <Text style={{ fontWeight: '600' }}>{item.plate} — AVAILABLE</Text>
                                                <Text style={{ color: '#555' }}>Driver: {item.driverName || '—'}</Text>
                                            </View>
                                        </View>
                                    )}
                                    ListEmptyComponent={<Text style={{ color: '#444' }}>Nessun veicolo disponibile.</Text>}
                                />
                            </>
                        )}

                        {/* Bottone chiudi fuori dalle liste */}
                        <TouchableOpacity style={styles.close} onPress={closeSheet}>
                            <Text style={{ color: 'white', fontWeight: '600' }}>Chiudi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

        </View>
    );
}

const styles = StyleSheet.create({

    title: { fontSize: 18, fontWeight: '700' },
    sub: { color: '#555' },
    h: { marginTop: 10, fontWeight: '700' },
    p: { color: '#222' },
    li: { color: '#222', marginVertical: 2 },
    close: { marginTop: 14, alignSelf: 'flex-end', backgroundColor: '#0ea5e9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
    loadingOverlay: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    iconWrap: { backgroundColor: 'white', borderRadius: 9999, padding: 4, elevation: 2 },
    cardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    calloutBox: { width: 230, backgroundColor: 'white', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    calloutTitle: { fontWeight: '700', marginBottom: 2 },
    calloutLine: { color: '#222' },
    badge: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
    sheetHeader: { alignItems: 'center', paddingTop: 6, paddingBottom: 8 },
    grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb' },
    closeIcon: { position: 'absolute', right: 8, top: 6, padding: 6 },
    sheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'white', padding: 16,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        gap: 6, elevation: 10, zIndex: 20,
    },

});
