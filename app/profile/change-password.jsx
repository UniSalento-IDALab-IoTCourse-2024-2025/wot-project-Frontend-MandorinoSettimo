import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ApiConfig } from '../../constants/ApiConfig';


import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    setError('');

    if (!email || !oldPassword || !newPassword) {
      setError('Compila tutti i campi');
      return;
    }

    setLoading(true);

    try {
      const payload = { email, oldPassword, newPassword };
      console.log("Invio richiesta PUT con:", payload);

      const response = await fetch(`${ApiConfig.POSITION_SERVICE}/pwd/change`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      console.log('Status:', response.status);
      console.log('Body:', text);

      const data = text ? JSON.parse(text) : {};

      if (response.ok) {
        Alert.alert(
          'Successo',
          data.message || 'Password cambiata con successo',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      } else {
        const errorMessage = data.message || 'Errore durante il cambio password';
        setError(errorMessage);
        Alert.alert('Errore', errorMessage);
      }
    } catch (e) {
      console.log('Errore di rete:', e);
      setError('Errore di rete: ' + e.message);
      Alert.alert('Errore di rete', e.message);
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Ionicons
            name="key-outline"
            size={80}
            color="#06631EFF"
            style={{alignSelf: 'center', marginBottom: 10}}
        />

        <Text style={styles.title}>Cambia Password</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="Vecchia password"
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
          editable={!loading}
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="Nuova password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          editable={!loading}
          placeholderTextColor="#999"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Cambia password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  scrollContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    borderRadius: 20,
    resizeMode: 'contain'
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1f2937'
  },
  input: {
    width: '100%',
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
    backgroundColor: '#06631e',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  buttonDisabled: { backgroundColor: '#93c5fd' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: {
    color: '#dc2626',
    marginBottom: 8,
    fontSize: 14,
    textAlign: 'center'
  },
  icon: {
  marginBottom: 10,
  }

});
