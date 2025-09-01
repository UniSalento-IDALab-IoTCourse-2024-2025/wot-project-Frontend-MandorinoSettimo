import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ApiConfig } from "@/constants/ApiConfig";
import { jwtDecode } from 'jwt-decode';
import {registerForPushNotificationsAsync} from "@/app/services/notification";
import {getAndClearPendingNotifications} from "@/app/services/pendingNotifications";

export const options = {
  title: 'Accedi a DeliveryGo',
};

type JwtPayload = {
  userId: string;
  role: string;
  // altri claims se servono
};

export default function LoginScreen() {
  const router = useRouter();
  const invokeUrl = `${ApiConfig.POSITION_SERVICE}/users/authenticate`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Verifica se l'utente è già autenticato al caricamento della schermata
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const authToken = await AsyncStorage.getItem('authToken');
        if (authToken) {
          const decoded: JwtPayload = jwtDecode(authToken);
          if (decoded) {
            // Se il token è valido, reindirizza all'area appropriata
            if (decoded.role === 'ADMIN') {
              router.replace('/(tabs-admin)'); // Reindirizza direttamente agli admin
            } else {
              router.replace('/(tabs)'); // Reindirizza agli utenti normali
            }
          }
        }
      } catch (error) {
        console.error('Errore durante il controllo dello stato di autenticazione:', error);
      }
    };

    checkAuthStatus();
  }, [router]); // Esegui il controllo solo all'inizio

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('Inserisci email e password');
      return;
    }

    setIsLoading(true);
    const userDto = { email, password };

    try {
      const response = await fetch(invokeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userDto),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('HTTP status:', response.status);
        console.log('Errore server:', errorText);
        setError('Credenziali errate');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const { jwt, userId } = data;

      if (jwt && userId) {
        const decoded: JwtPayload = jwtDecode(jwt);
        const role = decoded.role;

        await AsyncStorage.setItem('authToken', jwt);
        await AsyncStorage.setItem('userId', userId);
        await AsyncStorage.setItem('role', role);

        // Subito dopo aver salvato jwt/userId/role
        await AsyncStorage.multiRemove(['activeRouteId', 'currentSegmentIndex', 'vehicleId', 'isOnRoute']);
        await AsyncStorage.setItem('isOnRoute', 'false');

        // leggi lo stato utente
        const userRes = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${userId}`, {
          headers: { Authorization: `Bearer ${jwt}` }
        });
        const userJson = await userRes.json().catch(() => null);
        const status = userJson?.user?.userStatus || userJson?.userStatus;

        if (status === 'ON_ROUTE') {
          const rtRes = await fetch(`${ApiConfig.DELIVERY_SERVICE}/vehicle-routes/from/${userId}/active`, {
            headers: { Authorization: `Bearer ${jwt}` }
          });
          console.log("utente ON_ROUTE, verifico se ha tratta attiva...");
          if (rtRes.status === 200) {
            const activeRoute = await rtRes.json();
            await AsyncStorage.setItem('activeRouteId', activeRoute.id);
            await AsyncStorage.setItem('currentSegmentIndex', String(activeRoute.currentSegmentIndex ?? 0));
            await AsyncStorage.setItem('vehicleId', activeRoute.vehicleId);
            await AsyncStorage.setItem('isOnRoute', 'true');
            await AsyncStorage.removeItem(`routeEvtTs:${activeRoute.vehicleId}`);
            console.log(activeRoute.vehicleId);
            console.log("Tratta attiva ripristinata:", activeRoute.id);
          } else if (rtRes.status === 404) {
            console.log("ℹ️ Nessuna tratta attiva trovata");
          } else {
            console.warn("⚠️ Errore imprevisto nel recupero della tratta attiva");
          }
        }

        // **Registra il token push**
        await registerForPushNotificationsAsync();  // **Chiamata qui!**

        const pending = getAndClearPendingNotifications();
        pending.forEach(n => {
          const targetUserId = n.request.content.data?.userId;

          const isTargeted = targetUserId && targetUserId === userId;
          const isBroadcastToAdmins = !targetUserId && role === 'ADMIN';

          if (isTargeted || isBroadcastToAdmins) {
            Alert.alert(n.request.content.title ?? 'Notifica', n.request.content.body ?? '');
          }
        });

        router.replace('/'); // Redirige dopo login completato
      } else {
        setError('Token o userId mancante nella risposta');
      }
    } catch (e) {
      console.error('Errore fetch:', e);
      setError('Errore di rete o server non disponibile');
    }

    setIsLoading(false);
  };

  // Funzione di test per navigare alla mappa
  const handleTestButton = () => {
    router.push('/map'); // Naviga alla schermata della mappa
  };

  return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <Image
            source={require('../assets/icons/app-icon.png')}
            style={styles.logo}
        />

        <Text style={styles.title}>Benvenuto su DeliveryGo</Text>
        <Text style={styles.subtitle}>Accedi al tuo account</Text>

        <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#999"
        />
        <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor="#999"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
        >
          {isLoading ? (
              <ActivityIndicator color="#fff" />
          ) : (
              <Text style={styles.buttonText}>Accedi</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/register')}
        >
          <Text style={styles.buttonText}>Registrati</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/password')}>
          <Text style={styles.linkText}>Hai dimenticato la password?</Text>
        </TouchableOpacity>





      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    borderRadius: 20,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#4b5563',
  },
  input: {
    width: '99%',
    height: 48,
    backgroundColor: '#fff',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 12,
    color: '#111827',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#08551b',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#06631e',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#06631e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    marginBottom: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  linkText: {
    marginTop: 12,
    fontSize: 14,
    color: '#06631e',
    textDecorationLine: 'underline',
  },
  testButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#ff4500',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
});
