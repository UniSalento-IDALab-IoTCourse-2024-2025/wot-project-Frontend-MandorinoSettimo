import React, { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { ApiConfig } from '../../constants/ApiConfig';
import RatingStars from '../../components/RatingStars';



export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');

      if (!token || !userId) throw new Error('Token o userId mancanti');

      const userRes = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${userId}`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (!userRes.ok) throw new Error('Errore nel recupero utente');
      const userData = await userRes.json();
      setUser(userData);




    } catch (err) {
      console.error('❌ Errore nel caricamento:', err);
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userId');
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchProfile();
  }, []));

  const handleLogout = async () => {
    try {
      // prendo l’eventuale vehicleId per pulire il de-dup del broker
      const vehId = await AsyncStorage.getItem('vehicleId');

      await AsyncStorage.multiRemove([
        'authToken',
        'userId',
        'role',
        'activeRouteId',
        'currentSegmentIndex',
        'vehicleId',
        'isOnRoute',
      ]);

      if (vehId) {
        await AsyncStorage.removeItem(`routeEvtTs:${vehId}`);
      }
    } finally {
      router.replace('/login');
    }
  };



  if (loading) {
    return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb"/>
        </View>
    );
  }

  if (!user) {
    return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Utente non disponibile</Text>
          <TouchableOpacity style={styles.button} onPress={fetchProfile}>
            <Text style={styles.buttonText}>Riprova</Text>
          </TouchableOpacity>
        </View>
    );
  }

  return (
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
            ListHeaderComponent={
              <>
                <Ionicons
                    name="person-circle"
                    size={80}
                    color="#06631EFF"
                    style={{alignSelf: 'center', marginBottom: 10, marginTop: 20}}
                />
                <Text style={styles.title}>Profilo Utente</Text>

                <View style={styles.profileBox}>
                  <Text style={styles.profileText}>👤 {user.name} {user.surname}</Text>
                  <Text style={styles.profileText}>📧 {user.email}</Text>
                  <Text style={styles.profileText}>⚧ {user.genderType}</Text>
                  <Text style={styles.profileText}> 📞 {user.phoneNumber}</Text>
                </View>



                <TouchableOpacity style={styles.button} onPress={() => router.push('/profile/edit')}>
                  <Text style={styles.buttonText}>Modifica profilo</Text>
                </TouchableOpacity>




              </>
            }

            ListFooterComponent={
              <>

                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                  <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
              </>
            }

            contentContainerStyle={{padding: 20, paddingBottom: 100}}
        />

        {/* 🔽 Bottone Logout separato, sempre visibile */}
        <View style={styles.logoutWrapper}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
  );
}

  const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: '#f6f8fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f8fa' },
  title: { fontSize: 28, fontWeight: '700', color: '#1f2937', marginBottom: 20, textAlign: 'center' },
  profileBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  profileText: { fontSize: 16, color: '#111827', marginBottom: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginTop: 30, marginBottom: 10 },
  vehicleCard: { backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 },
  vehicleText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  vehicleDetail: { fontSize: 14, color: '#374151' },
    logoutWrapper: {
      position: 'absolute',
      bottom: 20,
      left: 0,
      right: 0,
      alignItems: 'center',
    },

    noVehicles: { fontStyle: 'italic', color: '#6b7280', textAlign: 'center', marginTop: 10 },
  button: { backgroundColor: '#06631e', padding: 14, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  secondaryButton: { backgroundColor: '#06631e', padding: 14, borderRadius: 10, marginTop: 12, alignItems: 'center' },
    feedbackButton: {
      backgroundColor: '#06631e', // verde elegante, per differenziarlo
      padding: 14,
      borderRadius: 10,
      marginTop: 12,
      alignItems: 'center',
    },

    buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    logoutButton: {
      marginTop: 20,
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#ef4444',
    },
    logoutText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },

    errorText: { fontSize: 16, color: '#dc2626', marginBottom: 10 },
  ratingBox: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },

});
