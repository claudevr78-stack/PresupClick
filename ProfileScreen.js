import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import i18n, { setLanguage } from './translations';
import * as ImagePicker from 'expo-image-picker';

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ro', label: 'Română', flag: '🇷🇴' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

export function ProfileScreen({ onShowPaywall }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [nextBilling, setNextBilling] = useState(null);
  const [currentLang, setCurrentLang] = useState('es');
  const [logoBase64, setLogoBase64] = useState(null);
  const [form, setForm] = useState({
    company_name: '',
    siret: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    tva_number: '',
  });

  useEffect(() => { loadProfile(); loadCurrentLang(); }, []);

  async function loadCurrentLang() {
    const lang = await AsyncStorage.getItem('appLanguage') || 'es';
    setCurrentLang(lang);
  }

  async function handleLanguageChange(lang) {
    await setLanguage(lang);
    setCurrentLang(lang);
    Alert.alert('✅', '¡Idioma cambiado! Reinicia la app para ver los cambios.');
  }

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (data) {
        setForm({
          company_name: data.company_name || '',
          siret: data.siret || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          city: data.city || '',
          tva_number: data.tva_number || '',
        });
        setIsPaid(data.is_paid || false);
        setNextBilling(data.next_billing_date || null);
        if (data.logo_base64) setLogoBase64(data.logo_base64);
      }
    } catch (e) { console.log('Sin perfil todavía'); }
    finally { setLoading(false); }
  }

  async function handleUploadLogo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });

    if (result.canceled) return;

    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const asset = result.assets[0];
      const base64 = `data:image/jpeg;base64,${asset.base64}`;
      const { error } = await supabase.from('profiles').update({
        logo_base64: base64,
      }).eq('user_id', user.id);
      if (error) throw error;
      setLogoBase64(base64);
      Alert.alert('✅ ¡Logo guardado!', 'Tu logo aparecerá en tus presupuestos PDF.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setUploadingLogo(false); }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: existing } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
      if (existing) {
        await supabase.from('profiles').update({
          company_name: form.company_name,
          siret: form.siret,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          tva_number: form.tva_number,
        }).eq('user_id', user.id);
      } else {
        await supabase.from('profiles').insert({
          user_id: user.id,
          company_name: form.company_name,
          siret: form.siret,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          tva_number: form.tva_number,
        });
      }
      Alert.alert('✅ ¡Guardado!', 'Tu perfil ha sido actualizado.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0a1628', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#4a80f0" />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Mi empresa</Text>
      <Text style={styles.sub}>Esta información aparecerá en tus presupuestos PDF</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Logo de la empresa</Text>
        {logoBase64 ? (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Image source={{ uri: logoBase64 }} style={{ width: 150, height: 80, resizeMode: 'contain', borderRadius: 8, backgroundColor: 'white', padding: 8 }} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', marginBottom: 12, padding: 20, borderWidth: 1, borderColor: '#1a3a6a', borderRadius: 8, borderStyle: 'dashed' }}>
            <Text style={{ color: '#7a9cc0', fontSize: 13 }}>Ningún logo subido</Text>
          </View>
        )}
        <TouchableOpacity style={[styles.button, { backgroundColor: '#1a3050', marginBottom: 0 }]} onPress={handleUploadLogo} disabled={uploadingLogo}>
          {uploadingLogo ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>📷 {logoBase64 ? 'Cambiar el logo' : 'Subir el logo'}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Identidad</Text>
        <TextInput style={styles.input} placeholder="Nombre de la empresa *" placeholderTextColor="#555" keyboardAppearance="dark" value={form.company_name} onChangeText={v => set('company_name', v)} />
        <TextInput style={styles.input} placeholder="NIF/CIF (España) o RFC (México)" placeholderTextColor="#555" keyboardAppearance="dark" value={form.siret} onChangeText={v => set('siret', v)} />
        <TextInput style={styles.input} placeholder="N° IVA intracomunitario (opcional)" placeholderTextColor="#555" keyboardAppearance="dark" value={form.tva_number} onChangeText={v => set('tva_number', v)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contacto</Text>
        <TextInput style={styles.input} placeholder="Teléfono" placeholderTextColor="#555" keyboardAppearance="dark" keyboardType="phone-pad" value={form.phone} onChangeText={v => set('phone', v)} />
        <TextInput style={styles.input} placeholder="Email profesional" placeholderTextColor="#555" keyboardAppearance="dark" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={v => set('email', v)} />
        <TextInput style={styles.input} placeholder="Dirección" placeholderTextColor="#555" keyboardAppearance="dark" value={form.address} onChangeText={v => set('address', v)} />
        <TextInput style={styles.input} placeholder="Ciudad" placeholderTextColor="#555" keyboardAppearance="dark" value={form.city} onChangeText={v => set('city', v)} />
      </View>

      <TouchableOpacity style={styles.button} onPress={saveProfile} disabled={saving}>
        {saving ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>💾 Guardar</Text>}
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{i18n.t('language')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              onPress={() => handleLanguageChange(lang.code)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                padding: 10,
                borderRadius: 10,
                backgroundColor: currentLang === lang.code ? '#4a80f0' : '#1a3050',
                borderWidth: currentLang === lang.code ? 0 : 1,
                borderColor: '#1a3a6a',
              }}
            >
              <Text style={{ fontSize: 18 }}>{lang.flag}</Text>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: currentLang === lang.code ? 'bold' : 'normal' }}>{lang.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Suscripción</Text>
        {isPaid ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>✅</Text>
              <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 16 }}>Premium activo</Text>
            </View>
            {nextBilling && (
              <Text style={{ color: '#7a9cc0', fontSize: 13 }}>
                Próximo vencimiento: {new Date(nextBilling).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981', marginTop: 0 }]} onPress={onShowPaywall}>
            <Text style={styles.buttonText}>🔥 Ver los planes</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#1a3050', marginBottom: 40 }]} onPress={handleLogout}>
        <Text style={[styles.buttonText, { color: '#ef4444' }]}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628', padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  sub: { fontSize: 13, color: '#7a9cc0', marginBottom: 24 },
  card: { backgroundColor: '#0f2040', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1a3a6a' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#7a9cc0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#1a3050', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 15, color: 'white' },
  button: { backgroundColor: '#1a56db', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});