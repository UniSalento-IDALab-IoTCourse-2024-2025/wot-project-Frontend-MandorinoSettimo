import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform, Image, ScrollView, Modal, Pressable, Keyboard,
  Alert,
  TouchableWithoutFeedback
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {ApiConfig} from "@/constants/ApiConfig";

export default function RegisterScreen() {
  const router = useRouter();
  const registerUrl = `${ApiConfig.POSITION_SERVICE}/registration`;

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [genderType, setGenderType] = useState('UNSPECIFIED');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  // Funzione per aggiungere automaticamente il prefisso +39 e limitare a 10 cifre
  const handlePhoneNumberChange = (text) => {
    // Rimuovere tutti i caratteri non numerici
    const numericText = text.replace(/\D/g, '');

    // Se l'utente inizia a digitare, aggiungi automaticamente +39 se non è presente
    if (!numericText || numericText.startsWith('39')) {
      if (numericText.length <= 10) {
        setPhoneNumber('+39' + numericText);
      } else {
        Alert.alert('Errore', 'Il numero di telefono non può superare le 10 cifre.');
      }
    } else {
      if (numericText.length <= 10) {
        setPhoneNumber(numericText);
      } else {
        Alert.alert('Errore', 'Il numero di telefono non può superare le 10 cifre.');
      }
    }
  };


  const handleRegister = async () => {
    setError('');

    if (!name || !surname || !email || !password || !phoneNumber) {
      setError('Compila tutti i campi obbligatori');
      return;
    }



    const userDto = {
      name,
      surname,
      email,
      password,
      phoneNumber,
      genderType
    };

    setIsLoading(true);

    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userDto)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Errore durante la registrazione');
      } else {
        Alert.alert('Registrazione riuscita', 'Ora puoi effettuare il login.');
router.replace('/'); // oppure '/login' se la tua schermata login è lì


      }
    } catch (e) {
      setError('Errore di rete o server non disponibile');
    }

    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Image source={require('../assets/icons/app-icon.png')} style={styles.logo} />
        <Text style={styles.title}>Crea un account</Text>

        <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} placeholderTextColor="#999" />
        <TextInput style={styles.input} placeholder="Cognome" value={surname} onChangeText={setSurname} placeholderTextColor="#999" />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#999" />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor="#999" />
        {/* Numero di telefono con tastiera */}
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <TextInput
              style={styles.input}
              placeholder="Numero di telefono"
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              keyboardType="phone-pad"
              placeholderTextColor="#999"
          />
        </TouchableWithoutFeedback>



        <TouchableOpacity
          style={styles.pickerWrapper}
          activeOpacity={0.7}
          onPress={() => {
            Keyboard.dismiss(); // chiude la tastiera prima di aprire il modal
            setModalVisible(true);
          }}
        >
          <Text style={styles.pickerLabel}>
  Genere: {
    genderType === 'UNSPECIFIED' ? 'Non specificato'
    : genderType === 'MALE' ? 'Maschio'
    : genderType === 'FEMALE' ? 'Femmina'
    : genderType === 'OTHER' ? 'Altro'
    : genderType
  }
</Text>

          
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrati</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.linkText}>Hai già un account? Accedi</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal POSIZIONATO FUORI da ScrollView */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {['UNSPECIFIED', 'MALE', 'FEMALE', 'OTHER'].map((option) => (
              <Pressable
                key={option}
                style={styles.modalOption}
                onPress={() => {
                  setGenderType(option);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>
  {
    option === 'UNSPECIFIED' ? 'Non specificato'
    : option === 'MALE' ? 'Maschio'
    : option === 'FEMALE' ? 'Femmina'
    : option === 'OTHER' ? 'Altro'
    : option
  }
</Text>

              </Pressable>
            ))}
            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={{ color: 'red', marginTop: 10 }}>Annulla</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },
  scrollContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  logo: { width: 100, height: 100, marginBottom: 20, borderRadius: 20, resizeMode: 'contain' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 16, color: '#1f2937' },
  input: { width: '100%', height: 48, backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 16, marginBottom: 12, color: '#111827' },
  pickerWrapper: { width: '100%', height: 48, backgroundColor: '#fff', borderColor: '#d1d5db', borderWidth: 1, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, marginBottom: 12 },
  pickerLabel: { fontSize: 16, color: '#111827' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '80%', alignItems: 'center' },
  modalOption: { paddingVertical: 10 },
  modalOptionText: { fontSize: 16 },
  button: { width: '100%', height: 48, backgroundColor: '#12752b', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonDisabled: { backgroundColor: '#bbf7d0' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 8, fontSize: 14, textAlign: 'center' },
  linkText: { marginTop: 16, fontSize: 14, color: '#06631e', textDecorationLine: 'underline' },
  
});
