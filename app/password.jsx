import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { ApiConfig } from '@/constants/ApiConfig';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';



export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasRequestedCode, setHasRequestedCode] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();


  const handleRequestCode = async () => {

    if (!email) {
      setError('Inserisci la tua email');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${ApiConfig.POSITION_SERVICE}/pwd/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });




      const text = await response.text();
      console.log('Response status:', response.status);
      console.log('Response body:', text);

      const data = text ? JSON.parse(text) : {};



      if (response.ok && data.code === 'CODE_SENT') {
        setHasRequestedCode(true);
        Alert.alert('Codice inviato', data.message || 'Controlla la tua email');
      } else {
        setHasRequestedCode(false); // ⬅️ blocca la transizione
        setError(data.message || 'Errore durante l’invio del codice');
      }


    } catch (e) {
      console.error('Errore di rete:', e);
      setError('Errore di rete: ' + e.message);
    } finally {
      setLoading(false);
    }

  };

  const handleResetPassword = async () => {
    if (!email || !code || !newPassword) {
      setError('Compila tutti i campi');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${ApiConfig.POSITION_SERVICE}/pwd/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert(
            'Successo',
            data.message || 'Password aggiornata con successo',
            [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      }

    } catch (e) {
      console.error('Errore di rete:', e);
      setError('Errore di rete: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Ionicons
              name="key-outline"
              size={80}
              color="#06631EFF"
              style={{alignSelf: 'center', marginBottom: 10}}
          />
          <Text style={styles.title}>Reset Password</Text>

          <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#999"
          />

          {hasRequestedCode && (
              <>
                <TextInput
                    style={styles.input}
                    placeholder="Codice ricevuto via email"
                    value={code}
                    onChangeText={setCode}
                    placeholderTextColor="#999"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Nuova password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholderTextColor="#999"
                />
              </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={hasRequestedCode ? handleResetPassword : handleRequestCode}
              disabled={loading}
          >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={styles.buttonText}>
                  {hasRequestedCode ? 'Conferma nuova password' : 'Invia codice'}
                </Text>
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
    paddingVertical: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
    color: '#1f2937',
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
    marginTop: 12,
  },
  buttonDisabled: { backgroundColor: '#219540' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: {
    color: '#dc2626',
    marginBottom: 8,
    fontSize: 14,
    textAlign: 'center',
  },
});
