import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ApiConfig } from '../../constants/ApiConfig';

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function EditProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();


  
  const fetchUser = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');

      const res = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      const data = JSON.parse(text);
      setUser(data);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile caricare i dati');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const userId = await AsyncStorage.getItem('userId');

    const response = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      await AsyncStorage.clear();
      Alert.alert('Account eliminato', 'Il tuo account è stato eliminato correttamente.');
      router.replace('/login'); // o '/' se il login è lì
    } else {
      const text = await response.text();
      console.error('Errore eliminazione:', text);
      Alert.alert('Errore', 'Impossibile eliminare l’account');
    }
  } catch (error) {
    Alert.alert('Errore', 'Si è verificato un problema');
    console.error(error);
  }
};


  const saveChanges = async () => {
    if (!user.name?.trim()) {
      Alert.alert('Errore', 'Il nome non può essere vuoto');
      return;
    }

    if (!user.surname?.trim()) {
      Alert.alert('Errore', 'Il cognome non può essere vuoto');
      return;
    }

    if (!user.phoneNumber?.trim()) {
      Alert.alert('Errore', 'Il numero di telefono non può essere vuoto');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');

      console.log('📤 Invio profilo aggiornato:', user);

      const res = await fetch(`${ApiConfig.POSITION_SERVICE}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(user),
      });

      const resultText = await res.text();
      console.log('📥 Risposta server:', resultText);

      if (!res.ok) {
        throw new Error('Errore salvataggio');
      }

      Alert.alert('Successo', 'Profilo aggiornato!');
      router.back();
    } catch (e) {
      Alert.alert('Errore', 'Modifica fallita');
    } finally {
      setSaving(false);
    }
  };


  useEffect(() => {
    fetchUser();
  }, []);

  if (loading || !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

 return (
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={styles.container}
  >
    <View>

    
    <Ionicons name="person-circle" size={80} color="#06631EFF" style={{ alignSelf: 'center', marginBottom: 10 }} />
    <Text style={styles.title}>Modifica Profilo</Text>

    <Text style={styles.label}>Nome</Text>
    <TextInput
      style={styles.input}
      placeholder="Nome"
      value={user.name}
      onChangeText={(text) => setUser({ ...user, name: text })}
      placeholderTextColor="#999"
    />
    </View>

    <Text style={styles.label}>Cognome</Text>
    <TextInput
      style={styles.input}
      placeholder="Cognome"
      value={user.surname}
      onChangeText={(text) => setUser({ ...user, surname: text })}
      placeholderTextColor="#999"
    />


    {/* Numero di telefono con tastiera */}
    <Text style={styles.label}>Numero di telefono</Text>
    <TextInput
        style={styles.input}
        placeholder="Numero di telefono"
        value={user.phoneNumber}
        onChangeText={(text) => setUser({ ...user, phoneNumber: text })}
        keyboardType="phone-pad"
        placeholderTextColor="#999"
    />


    <Text style={styles.label}>Email</Text>
    <TextInput
  style={[styles.input, { backgroundColor: '#e5e7eb', color: '#6b7280' }]} 
  placeholder="Email"
  keyboardType="email-address"
  autoCapitalize="none"
  value={user.email}
  editable={false}
  placeholderTextColor="#999"
  
/>

    <Text style={styles.label}>Genere</Text>
    <View style={styles.genderContainer}>
      <TouchableOpacity
        style={[styles.genderButton, user.genderType === 'MALE' && styles.genderSelected]}
        onPress={() => setUser({ ...user, genderType: 'MALE' })}
      >
        <Text style={styles.genderText}>Maschio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.genderButton, user.genderType === 'FEMALE' && styles.genderSelected]}
        onPress={() => setUser({ ...user, genderType: 'FEMALE' })}
      >
        <Text style={styles.genderText}>Femmina</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.genderButton, user.genderType === 'OTHER' && styles.genderSelected]}
        onPress={() => setUser({ ...user, genderType: 'OTHER' })}
      >
        <Text style={styles.genderText}>Altro</Text>
      </TouchableOpacity>
    </View>

    <TouchableOpacity
      style={styles.secondaryButton}
      onPress={() => router.push('/profile/change-password')}
    >
      <Text style={styles.buttonText}>Cambia password</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.button}
      onPress={saveChanges}
      disabled={saving}
    >
      {saving ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>Salva modifiche</Text>
      )}
    </TouchableOpacity>

    <View style={styles.spacer} />

    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => {
        Alert.alert(
          'Conferma eliminazione',
          'Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile.',
          [
            { text: 'Annulla', style: 'cancel' },
            {
              text: 'Elimina',
              style: 'destructive',
              onPress: handleDeleteAccount,
            },
          ]
        );
      }}
    >
      <Text style={styles.deleteButtonText}>Elimina account</Text>
    </TouchableOpacity>
  </KeyboardAvoidingView>
);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    padding: 20,
    paddingTop: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
  height: 48,
  backgroundColor: '#fff',
  borderColor: '#d1d5db',
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 12,
  fontSize: 16,
  marginBottom: 5,  
  color: '#111827',
},
label: {
  fontSize: 16,
  color: '#1f2937',
  marginBottom: 3,
  marginTop: 6,     
},

  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  genderButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  genderSelected: {
    backgroundColor: '#2ba54a',
  },
  genderText: {
    color: '#111827',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#31a14d',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  secondaryButton: {
    backgroundColor: '#000b03',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteAccount: {
    
    color: '#fff',
    fontWeight: '400',
    fontSize: 16,
  },

  deleteButton: {
  backgroundColor: '#dc2626',
  paddingVertical: 10, 
  padding: 6,
  borderRadius: 10,
  alignItems: 'center',
  marginTop: 40,
},
deleteButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},

});
