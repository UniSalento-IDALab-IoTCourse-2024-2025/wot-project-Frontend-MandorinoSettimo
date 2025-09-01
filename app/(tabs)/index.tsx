import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';


export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={require('@/assets/icons/app-icon.png')} style={styles.logo} />
      <Text style={styles.title}>Benvenuto su DeliveryGo!</Text>
      <Text style={styles.subtitle}>Cosa vuoi fare?</Text>



      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/map')}
      >
        <Text style={styles.buttonText}>Esplora la mappa</Text>
      </TouchableOpacity>




      <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/orderscheck')}
      >
        <Text style={styles.buttonText}> Gestisci i tuoi ordini</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/profile')}
      >
        <Text style={styles.buttonText}>Profilo</Text>
      </TouchableOpacity>
    </ScrollView>
  );


}





const styles = StyleSheet.create({
  container: {
  flexGrow: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 20,
  paddingVertical: 40,
  backgroundColor: '#f6f8fa',
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
    marginBottom: 8,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    color: '#4b5563',
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


export const options = {
  headerShown: false,
};