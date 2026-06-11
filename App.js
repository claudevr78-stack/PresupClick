import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { supabase, saveQuote, getQuotes, saveInvoice } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import { analyzeChantier } from './openai';
import { ProfileScreen } from './ProfileScreen';
import { generateAndSharePDF, generateAndShareInvoicePDF, generatePDFUri } from './PDFGenerator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import * as StoreReview from 'expo-store-review';
import i18n, { loadLanguage } from './translations';
import { Svg, Path } from 'react-native-svg';

const PRICE_MONTHLY_ES = 'price_1Th8PGQxYPNEtUDqJBq5O4FB';
const PRICE_LIFETIME_ES = 'price_1Th8QpQxYPNEtUDqfroddHhf';
const PRICE_MONTHLY_MX = 'price_1Th8TNQxYPNEtUDqDJsceEb3';
const PRICE_LIFETIME_MX = 'price_1Th8XzQxYPNEtUDqhVKKGAmw';

const FEATURES = [
  '✅ Presupuestos ilimitados',
  '✅ Análisis IA de fotos',
  '✅ PDF profesional',
  '✅ Copia de seguridad en la nube',
  '✅ Todas las actualizaciones',
  '✅ Soporte prioritario',
];

const TVA_OPTIONS = [
  { label: '21% — IVA general (España)', value: 21 },
  { label: '10% — IVA reducido (España)', value: 10 },
  { label: '16% — IVA general (México)', value: 16 },
  { label: '8% — IVA reducido (México)', value: 8 },
  { label: '0% — Exento de IVA', value: 0 },
];

const AI_LOADING_MESSAGES = [
  "🔍 Analizando las fotos...",
  "🧠 La IA examina la obra...",
  "📐 Calculando cantidades...",
  "💰 Estimando precios del mercado...",
  "📋 Generando líneas del presupuesto...",
  "✨ Finalizando el presupuesto...",
];

function TrialBanner({ daysLeft, onUpgrade }) {
  if (!daysLeft || daysLeft <= 0) return null;
  return (
    <TouchableOpacity onPress={onUpgrade} style={{ backgroundColor: '#0f2040', borderTopWidth: 1, borderTopColor: '#4a80f0', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: '#ccc', fontSize: 13 }}>🔥 {i18n.t('trialBanner')} — <Text style={{ color: '#4a80f0', fontWeight: 'bold' }}>{daysLeft} {i18n.t('quotesLeft')}{daysLeft > 1 ? 's' : ''}</Text></Text>
      <Text style={{ color: '#4a80f0', fontWeight: 'bold', fontSize: 13 }}>{i18n.t('goPremiun')}</Text>
    </TouchableOpacity>
  );
}

function SignatureScreen({ onSign, onCancel }) {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);

  function onTouchStart(e) {
    const { locationX, locationY } = e.nativeEvent;
    setCurrentPath([`M${locationX},${locationY}`]);
  }

  function onTouchMove(e) {
    const { locationX, locationY } = e.nativeEvent;
    setCurrentPath(prev => [...prev, `L${locationX},${locationY}`]);
  }

  function onTouchEnd() {
    if (currentPath.length > 0) {
      setPaths(prev => [...prev, currentPath.join(' ')]);
      setCurrentPath([]);
    }
  }

  function clearSignature() {
    setPaths([]);
    setCurrentPath([]);
  }

  function validateSignature() {
    if (paths.length === 0) {
      Alert.alert('Error', 'Por favor firme antes de validar');
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    paths.forEach(path => {
      const points = path.split(' ');
      points.forEach(p => {
        const coords = p.replace('M', '').replace('L', '').split(',');
        if (coords.length === 2) {
          const x = parseFloat(coords[0]);
          const y = parseFloat(coords[1]);
          if (!isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      });
    });
    const width = Math.max(maxX + 20, 300);
    const height = Math.max(maxY + 20, 150);
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:white">${paths.map(d => `<path d="${d}" stroke="#000000" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
    const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
    onSign(svgBase64);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, paddingTop: 60, alignItems: 'center' }}>
        <TouchableOpacity onPress={onCancel} style={{ backgroundColor: '#ef4444', borderRadius: 10, padding: 10, paddingHorizontal: 16 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>✕ Cancelar</Text>
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>{i18n.t('signatureTitle')}</Text>
        <TouchableOpacity onPress={validateSignature} style={{ backgroundColor: '#10b981', borderRadius: 10, padding: 10, paddingHorizontal: 16 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>✅ Validar</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: '#7a9cc0', textAlign: 'center', marginBottom: 8, fontSize: 13 }}>{i18n.t('signatureHint')}</Text>
      <View
        style={{ flex: 1, margin: 16, borderRadius: 12, borderWidth: 2, borderColor: '#4a80f0', backgroundColor: 'white', overflow: 'hidden' }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderStart={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderEnd={onTouchEnd}
      >
        <Svg style={{ flex: 1 }}>
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#000000" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath.length > 0 && (
            <Path d={currentPath.join(' ')} stroke="#000000" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </View>
      <TouchableOpacity onPress={clearSignature} style={{ margin: 16, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: '#1a3050', alignItems: 'center' }}>
        <Text style={{ color: '#ccc', fontWeight: 'bold' }}>{i18n.t('clearSignature')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { Alert.alert('Error', 'Email o contraseña incorrectos'); } else { onLogin(); }
  }

  async function handleRegister() {
    if (!email || !password) { Alert.alert('Error', 'Rellena email y contraseña'); return; }
    setLoading(true);
    const deviceId = Application.androidId || await Application.getIosIdForVendorAsync() || 'unknown';
    const { data: existingDevice } = await supabase.from('profiles').select('id').eq('device_id', deviceId).single();
    if (existingDevice) {
      setLoading(false);
      Alert.alert('Prueba ya utilizada', 'Este dispositivo ya ha usado la prueba gratuita. Por favor suscríbete.');
      return;
    }
    const { error, data } = await supabase.auth.signUp({ email, password });
    if (!error && data.user) {
      await supabase.from('profiles').upsert({ user_id: data.user.id, device_id: deviceId });
    }
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); } else { Alert.alert('¡Cuenta creada!', 'Ya puedes iniciar sesión.'); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.logo}>🏠 PresupClick</Text>
        <Text style={styles.tagline}>Presupuestos profesionales en 2 minutos</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.title}>{isRegister ? i18n.t('register') : i18n.t('login')}</Text>
        <TextInput style={styles.input} placeholder={i18n.t('email')} placeholderTextColor="#555" keyboardType="email-address" autoCapitalize="none" keyboardAppearance="dark" autoCorrect={false} value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder={i18n.t('password')} placeholderTextColor="#555" secureTextEntry={true} keyboardAppearance="dark" autoCorrect={false} value={password} onChangeText={setPassword} />
        {isRegister ? (
          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? '...' : i18n.t('subscribe')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? '...' : i18n.t('connect')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={styles.link}>{isRegister ? i18n.t('alreadyAccount') : i18n.t('noAccount')}</Text>
        </TouchableOpacity>
        {!isRegister && (
          <TouchableOpacity onPress={async () => {
            if (!email) { Alert.alert('Error', 'Introduce tu email primero'); return; }
            await supabase.auth.resetPasswordForEmail(email);
            Alert.alert('¡Email enviado!', 'Revisa tu bandeja de entrada para restablecer tu contraseña.');
          }}>
            <Text style={styles.link}>{i18n.t('forgotPassword')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function BottomNav({ active, onNavigate, isPaid }) {
  const tabs = [
    { key: 'dashboard', emoji: '🏠', label: 'Inicio' },
    { key: 'newquote', emoji: '➕', label: i18n.t('newQuote') },
    ...(!isPaid ? [{ key: 'paywall', emoji: '💎', label: 'Planes' }] : []),
    { key: 'profile', emoji: '⚙️', label: 'Perfil' },
  ];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#0f2040', borderTopWidth: 1, borderTopColor: '#1a3050', paddingBottom: 20, paddingTop: 10 }}>
      {tabs.map(tab => (
        <TouchableOpacity key={tab.key} style={{ flex: 1, alignItems: 'center', gap: 4 }} onPress={() => onNavigate(tab.key)}>
          <Text style={{ fontSize: 22 }}>{tab.emoji}</Text>
          <Text style={{ fontSize: 11, color: active === tab.key ? '#4a80f0' : '#555', fontWeight: active === tab.key ? 'bold' : 'normal' }}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PaywallScreen({ daysLeft }) {
  const isExpired = daysLeft <= 0;
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [isMexico, setIsMexico] = useState(false);

  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://presupclick-backend.vercel.app/api/country');
        const data = await response.json();
        setIsMexico(data.country === 'MX');
      } catch (e) {
        setIsMexico(false);
      }
    };
    detectCountry();
  }, []);

  const PRICE_MONTHLY = isMexico ? PRICE_MONTHLY_MX : PRICE_MONTHLY_ES;
  const PRICE_LIFETIME = isMexico ? PRICE_LIFETIME_MX : PRICE_LIFETIME_ES;
  const monthlyPrice = isMexico ? '149 MXN' : '12,99€';
  const lifetimePrice = isMexico ? '549 MXN' : '49€';

  async function handleSubscribe(plan) {
    setLoadingPlan(plan);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || '';
      const baseUrl = isMexico 
        ? 'https://presupclick-backend.vercel.app/subscribe-mx'
        : 'https://presupclick-backend.vercel.app/subscribe';
      const url = `${baseUrl}?plan=${plan}&email=${encodeURIComponent(email)}`;
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0a1628' }} contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      <StatusBar style="light" />
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🏠</Text>
        {isExpired ? (
          <>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>Has usado tus 3 presupuestos gratuitos</Text>
            <Text style={{ fontSize: 15, color: '#7a9cc0', textAlign: 'center', marginTop: 8, lineHeight: 22 }}>Continúa generando presupuestos profesionales en minutos</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>Solo {daysLeft} {i18n.t('quotesLeft')}{daysLeft > 1 ? 's' : ''}</Text>
            <Text style={{ fontSize: 15, color: '#7a9cc0', textAlign: 'center', marginTop: 8, lineHeight: 22 }}>Elige tu plan para continuar</Text>
          </>
        )}
      </View>
      <View style={{ backgroundColor: '#0f2040', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>🚀 ¿Por qué PresupClick?</Text>
        {[
          { emoji: '⏱️', title: '2 minutos por presupuesto', desc: 'En lugar de 1 hora — ahorra 58 minutos en cada presupuesto' },
          { emoji: '📈', title: '+30% de presupuestos enviados', desc: 'Más presupuestos = más obras = más ingresos' },
          { emoji: '🎯', title: 'Rentabilizado en 1 obra', desc: 'Una sola obra aceptada cubre el coste de la suscripción' },
          { emoji: '🏅', title: 'Presupuesto pro = cliente tranquilo', desc: 'Un PDF profesional aumenta tu tasa de aceptación' },
        ].map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
            <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>{item.title}</Text>
              <Text style={{ color: '#7a9cc0', fontSize: 13, marginTop: 2 }}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: '#0f2040', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Mensual</Text>
          <View style={{ backgroundColor: '#1a3050', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: '#7a9cc0', fontSize: 12 }}>Sin compromiso</Text>
          </View>
        </View>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {FEATURES.map((f, i) => <Text key={i} style={{ color: '#ccc', fontSize: 14 }}>{f}</Text>)}
        </View>
        <Text style={{ color: '#4a80f0', fontSize: 36, fontWeight: 'bold', marginBottom: 16 }}>{monthlyPrice}<Text style={{ fontSize: 16, color: '#7a9cc0' }}>/mes</Text></Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: loadingPlan === 'monthly' ? '#555' : '#4a80f0', marginTop: 0 }]} onPress={() => handleSubscribe('monthly')} disabled={loadingPlan !== null}>
          {loadingPlan === 'monthly' ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Elegir mensual →</Text>}
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: '#0f2040', borderRadius: 20, padding: 20, borderWidth: 2, borderColor: '#10b981', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>De por vida 🔥</Text>
          <View style={{ backgroundColor: '#10b98133', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold' }}>Mejor opción</Text>
          </View>
        </View>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {FEATURES.map((f, i) => <Text key={i} style={{ color: '#ccc', fontSize: 14 }}>{f}</Text>)}
        </View>
        <Text style={{ color: '#10b981', fontSize: 36, fontWeight: 'bold', marginBottom: 4 }}>{lifetimePrice}<Text style={{ fontSize: 16, color: '#7a9cc0' }}> una sola vez</Text></Text>
        <Text style={{ color: '#7a9cc0', fontSize: 13, marginBottom: 16 }}>Equivale a 4 meses — rentabilizado desde la primera obra</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: loadingPlan === 'lifetime' ? '#555' : '#10b981', marginTop: 0 }]} onPress={() => handleSubscribe('lifetime')} disabled={loadingPlan !== null}>
          {loadingPlan === 'lifetime' ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Comprar de por vida — {lifetimePrice} →</Text>}
        </TouchableOpacity>
      </View>
      <Text style={{ color: '#444', fontSize: 12, textAlign: 'center', marginBottom: 40 }}>
        Pago seguro por Stripe • Cancela cuando quieras
      </Text>
    </ScrollView>
  );
}

function DashboardScreen({ onQuoteDetail, trialDaysLeft, onUpgrade }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const data = await getQuotes();
      setQuotes(data);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profileData } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      setProfile(profileData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  const totalTTC = quotes.reduce((sum, q) => sum + (q.total_ttc || 0), 0);
  const accepted = quotes.filter(q => q.status === 'accepted').length;
  const acceptanceRate = quotes.length > 0 ? Math.round((accepted / quotes.length) * 100) : 0;

  const statusColor = (status) => {
    if (status === 'accepted') return '#10b981';
    if (status === 'sent') return '#4a80f0';
    if (status === 'refused') return '#ef4444';
    return '#666';
  };

  const statusLabel = (status) => {
    if (status === 'accepted') return i18n.t('accepted');
    if (status === 'sent') return i18n.t('sent');
    if (status === 'refused') return i18n.t('refused');
    return i18n.t('draft');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
      <ScrollView style={styles.dashContainer}>
        <Text style={styles.dashTitle}>{i18n.t('welcome')} {profile?.company_name || ''} 👋</Text>
        <Text style={styles.dashSub}>{i18n.t('activity')}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{quotes.length}</Text>
            <Text style={styles.statLabel}>{i18n.t('totalQuotes')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{acceptanceRate}%</Text>
            <Text style={styles.statLabel}>{i18n.t('acceptanceRate')}</Text>
          </View>
        </View>
        <View style={[styles.statCard, { marginBottom: 12 }]}>
          <Text style={styles.statNumber}>{totalTTC.toFixed(0)}€</Text>
          <Text style={styles.statLabel}>{i18n.t('caTotal')}</Text>
        </View>
        <Text style={styles.sectionTitle}>{i18n.t('recentQuotes')}</Text>
        {loading ? (
          <ActivityIndicator color="#4a80f0" style={{ marginTop: 20 }} />
        ) : quotes.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 30 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
            <Text style={{ color: '#7a9cc0', fontSize: 14, fontWeight: 'bold' }}>{i18n.t('noQuotesYet')}</Text>
            <Text style={{ color: '#7a9cc0', fontSize: 12, marginTop: 4, textAlign: 'center' }}>{i18n.t('noQuotesHint')}</Text>
          </View>
        ) : (
          quotes.map((q) => (
            <TouchableOpacity key={q.id} style={styles.quoteRow} onPress={() => onQuoteDetail(q)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.quoteNum}>{q.quote_number || '#' + q.id}</Text>
                <Text style={styles.quoteClient}>{q.client_name}</Text>
                <Text style={{ color: '#7a9cc0', fontSize: 11, marginTop: 2 }}>{q.trade_type}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.quoteMontant}>{q.total_ttc?.toFixed(0)}€</Text>
                <Text style={[styles.quoteBadge, { color: statusColor(q.status) }]}>{statusLabel(q.status)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <TrialBanner daysLeft={trialDaysLeft} onUpgrade={onUpgrade} />
    </View>
  );
}

function QuoteDetailScreen({ quote, onBack }) {
  const [status, setStatus] = useState(quote.status);
  const [updating, setUpdating] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const statuses = [
    { key: 'draft', label: i18n.t('draft'), color: '#7a9cc0', emoji: '📝' },
    { key: 'sent', label: i18n.t('sent'), color: '#4a80f0', emoji: '📧' },
    { key: 'accepted', label: i18n.t('accepted'), color: '#10b981', emoji: '✅' },
    { key: 'refused', label: i18n.t('refused'), color: '#ef4444', emoji: '❌' },
  ];

  async function updateStatus(newStatus) {
    setUpdating(true);
    try {
      await supabase.from('quotes').update({ status: newStatus }).eq('id', quote.id);
      setStatus(newStatus);
      Alert.alert('✅ Estado actualizado', `El presupuesto ahora está "${statuses.find(s => s.key === newStatus)?.label}"`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally { setUpdating(false); }
  }

  async function handlePDF() {
    setGeneratingPDF(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      await generateAndSharePDF({ clientName: quote.client_name, tradeType: quote.trade_type, aiSummary: quote.ai_summary, lignes: quote.lignes || [], quoteNumber: quote.quote_number || '#' + quote.id }, profile);
    } catch (e) {
      Alert.alert('Error PDF', e.message);
    } finally { setGeneratingPDF(false); }
  }

  async function handleCreateInvoice() {
    Alert.alert('🧾 Crear factura', `¿Quieres crear una factura a partir de este presupuesto para ${quote.client_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Crear factura',
        onPress: async () => {
          setGeneratingInvoice(true);
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
            const invoice = await saveInvoice({
              quoteId: quote.id,
              clientName: quote.client_name,
              clientEmail: quote.client_email || null,
              clientPhone: quote.client_phone || null,
              clientAddress: quote.client_address || null,
              tradeType: quote.trade_type,
              totalHT: quote.total_ht,
              totalTTC: quote.total_ttc,
              lignes: quote.lignes || [],
            });
            await generateAndShareInvoicePDF({
              clientName: invoice.client_name,
              clientEmail: invoice.client_email,
              clientPhone: invoice.client_phone,
              clientAddress: invoice.client_address,
              tradeType: invoice.trade_type,
              aiSummary: '',
              lignes: invoice.lignes || [],
              quoteNumber: invoice.invoice_number,
            }, profile);
            Alert.alert('✅ ¡Factura creada!', `Factura ${invoice.invoice_number} generada con éxito.`);
          } catch (e) {
            Alert.alert('Error', e.message);
          } finally { setGeneratingInvoice(false); }
        }
      }
    ]);
  }

  return (
    <ScrollView style={styles.dashContainer}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>
      <Text style={styles.dashTitle}>{quote.quote_number || 'Presupuesto #' + quote.id}</Text>
      <Text style={styles.dashSub}>{quote.trade_type}</Text>
      <View style={styles.stepCard}>
        <Text style={styles.stepTitle}>Cliente</Text>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{quote.client_name}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <Text style={{ color: '#7a9cc0' }}>Total</Text>
          <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 18 }}>{quote.total_ttc?.toFixed(0)}€</Text>
        </View>
      </View>
      {quote.ai_summary && (
        <View style={[styles.stepCard, { borderLeftWidth: 3, borderLeftColor: '#4a80f0' }]}>
          <Text style={styles.stepTitle}>{i18n.t('analyse')}</Text>
          <Text style={{ color: '#ccc', lineHeight: 22 }}>{quote.ai_summary}</Text>
        </View>
      )}
      <View style={styles.stepCard}>
        <Text style={styles.stepTitle}>Cambiar estado</Text>
        <View style={{ gap: 10 }}>
          {statuses.map((s) => (
            <TouchableOpacity key={s.key} onPress={() => updateStatus(s.key)} disabled={updating} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: status === s.key ? s.color + '22' : '#1a3050', borderWidth: status === s.key ? 1.5 : 0, borderColor: status === s.key ? s.color : 'transparent' }}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{s.emoji}</Text>
              <Text style={{ color: status === s.key ? s.color : '#ccc', fontWeight: status === s.key ? 'bold' : 'normal', fontSize: 15 }}>{s.label}</Text>
              {status === s.key && <Text style={{ color: s.color, marginLeft: 'auto' }}>← Estado actual</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{ gap: 12, marginBottom: 40 }}>
        <TouchableOpacity style={[styles.button, { backgroundColor: generatingPDF ? '#555' : '#10b981' }]} onPress={handlePDF} disabled={generatingPDF}>
          {generatingPDF ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color="white" /><Text style={styles.buttonText}>Generando...</Text></View> : <Text style={styles.buttonText}>📄 Generar PDF</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: generatingInvoice ? '#555' : '#f59e0b' }]} onPress={handleCreateInvoice} disabled={generatingInvoice}>
          {generatingInvoice ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>🧾 Convertir en factura</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      emoji: '🏠',
      title: 'Bienvenido a PresupClick',
      desc: "Genera presupuestos profesionales en menos de 2 minutos con IA.",
      color: '#4a80f0',
      badge: 'Gratis — 3 presupuestos de regalo'
    },
    {
      emoji: '📷',
      title: 'Fotografía la obra',
      desc: "Toma fotos de la obra y describe los trabajos. Más fotos = estimación más precisa.",
      color: '#10b981',
      badge: 'Fotos ilimitadas'
    },
    {
      emoji: '✨',
      title: "La IA lo analiza todo",
      desc: "GPT-4o Vision analiza tus fotos y genera una estimación precisa con todas las líneas del presupuesto y los precios del mercado 2026.",
      color: '#f59e0b',
      badge: 'Powered by GPT-4o'
    },
    {
      emoji: '📄',
      title: 'PDF profesional',
      desc: "Genera y comparte un presupuesto PDF profesional con tu logo en un solo toque. Tu cliente firma directamente en la pantalla.",
      color: '#10b981',
      badge: 'Firma electrónica incluida'
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 120, height: 120, borderRadius: 30, backgroundColor: steps[step].color + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 2, borderColor: steps[step].color + '44' }}>
          <Text style={{ fontSize: 60 }}>{steps[step].emoji}</Text>
        </View>
        <View style={{ backgroundColor: steps[step].color + '22', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16 }}>
          <Text style={{ color: steps[step].color, fontSize: 12, fontWeight: 'bold' }}>{steps[step].badge}</Text>
        </View>
        <Text style={{ fontSize: 26, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 16 }}>{steps[step].title}</Text>
        <Text style={{ fontSize: 16, color: '#7a9cc0', textAlign: 'center', lineHeight: 26 }}>{steps[step].desc}</Text>
      </View>
      <View style={{ padding: 32, paddingTop: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {steps.map((s, i) => (
            <View key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? steps[step].color : '#333' }} />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: steps[step].color, borderRadius: 16, padding: 18 }]}
          onPress={() => step < steps.length - 1 ? setStep(step + 1) : onDone()}
        >
          <Text style={styles.buttonText}>{step < steps.length - 1 ? 'Siguiente →' : 'Empezar gratis 🚀'}</Text>
        </TouchableOpacity>
        {step > 0 && (
          <TouchableOpacity onPress={() => setStep(step - 1)} style={{ alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: '#555', fontSize: 14 }}>← Atrás</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function NewQuoteScreen({ onBack, onQuoteGenerated, onUseQuota }) {
  const [photos, setPhotos] = useState([]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [description, setDescription] = useState('');
  const [tradeType, setTradeType] = useState('Pintura');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  async function pickPhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', "Necesitamos acceder a tus fotos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7, base64: true });
    if (!result.canceled) {
      setPhotos([...photos, ...result.assets.map(a => ({ uri: a.uri, base64: `data:image/jpeg;base64,${a.base64}` }))]);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado', "Necesitamos acceder a tu cámara."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!result.canceled) {
      setPhotos([...photos, { uri: result.assets[0].uri, base64: `data:image/jpeg;base64,${result.assets[0].base64}` }]);
    }
  }

  async function handleAnalyze() {
    if (!description) { Alert.alert('Falta información', "Describe los trabajos antes de analizar."); return; }
    setLoading(true);

    let msgIndex = 0;
    setLoadingMessage(AI_LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % AI_LOADING_MESSAGES.length;
      setLoadingMessage(AI_LOADING_MESSAGES[msgIndex]);
    }, 1500);

    try {
      await onUseQuota();
      const result = await analyzeChantier(photos.map(p => p.base64), description, tradeType);
      clearInterval(interval);
      onQuoteGenerated(result, clientName, clientEmail, clientPhone, clientAddress, description, tradeType);
    } catch (e) {
      clearInterval(interval);
      if (e.message === 'QUOTA_EXCEEDED') return;
      Alert.alert('Error IA', "No se pudo analizar. Comprueba tu conexión.");
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.dashContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}><Text style={styles.backText}>← Volver</Text></TouchableOpacity>
        <Text style={styles.dashTitle}>{i18n.t('newQuote')}</Text>
        <Text style={styles.dashSub}>{i18n.t('generatedByAI')}</Text>
        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>{i18n.t('step1')}</Text>
          <TextInput style={styles.input} placeholder={i18n.t('clientName')} placeholderTextColor="#555" keyboardAppearance="dark" autoCorrect={true} value={clientName} onChangeText={setClientName} />
          <TextInput style={styles.input} placeholder={i18n.t('email')} placeholderTextColor="#555" keyboardType="email-address" autoCapitalize="none" keyboardAppearance="dark" autoCorrect={false} value={clientEmail} onChangeText={setClientEmail} />
          <TextInput style={styles.input} placeholder="Teléfono" placeholderTextColor="#555" keyboardType="phone-pad" keyboardAppearance="dark" value={clientPhone} onChangeText={setClientPhone} />
          <TextInput style={styles.input} placeholder="Dirección de la obra" placeholderTextColor="#555" keyboardAppearance="dark" autoCorrect={true} value={clientAddress} onChangeText={setClientAddress} />
        </View>
        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>{i18n.t('step2')}</Text>
          <TextInput style={styles.input} placeholder={i18n.t('workType')} placeholderTextColor="#555" keyboardAppearance="dark" autoCorrect={true} value={tradeType} onChangeText={setTradeType} />
          <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} placeholder={i18n.t('describeWork')} placeholderTextColor="#555" multiline={true} keyboardAppearance="dark" autoCorrect={true} value={description} onChangeText={setDescription} />
        </View>
        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>{i18n.t('step3')}</Text>
          <Text style={{ color: '#7a9cc0', fontSize: 12, marginBottom: 10 }}>Cuantas más fotos añadas, más precisa será la estimación</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={takePhoto}><Text style={styles.buttonText}>{i18n.t('camera')}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#1a3050' }]} onPress={pickPhotos}><Text style={styles.buttonText}>{i18n.t('gallery')}</Text></TouchableOpacity>
          </View>
          {photos.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {photos.map((p, i) => <Image key={i} source={{ uri: p.uri }} style={{ width: 90, height: 90, borderRadius: 8 }} />)}
            </View>
          )}
          {photos.length > 0 && <Text style={{ color: '#7a9cc0', fontSize: 12, marginTop: 8 }}>{photos.length} foto(s) seleccionada(s)</Text>}
        </View>
        <TouchableOpacity style={[styles.button, { backgroundColor: loading ? '#1a3050' : '#10b981', marginTop: 4, marginBottom: 40, minHeight: 70, justifyContent: 'center' }]} onPress={handleAnalyze} disabled={loading}>
          {loading ? (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#4a80f0" size="large" />
              <Text style={{ color: '#4a80f0', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>{loadingMessage}</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>{i18n.t('analyzeWithAI')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

async function askForReview() {
  try {
    const reviewAsked = await AsyncStorage.getItem('reviewAsked');
    if (reviewAsked) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    if (count >= 3) {
      await AsyncStorage.setItem('reviewAsked', 'true');
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) await StoreReview.requestReview();
    }
  } catch (e) { console.log('Review error:', e); }
}

function QuoteResultScreen({ result, clientName, clientEmail, clientPhone, clientAddress, description, tradeType, onBack, onSave, trialDaysLeft, onUpgrade }) {
  const [lignes, setLignes] = useState(result.lignes);
  const [analyse, setAnalyse] = useState(result.resume);
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureUri, setSignatureUri] = useState(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [tauxTVA, setTauxTVA] = useState(() => {
  const locale = i18n.locale || 'es';
  return locale.includes('MX') || locale === 'es-MX' ? 16 : 21;
});
  const [showTVASelector, setShowTVASelector] = useState(false);
  const [newLine, setNewLine] = useState({ label: '', quantite: '1', unite: 'ud', prixUnitaire: '0' });
  const total = lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0);
  const tva = total * (tauxTVA / 100);

  async function handleSave() {
    setSaving(true);
    try {
      await saveQuote({ clientName: clientName || 'Cliente desconocido', clientEmail, clientPhone, clientAddress, description, tradeType, totalHT: total, totalTTC: total + tva, aiSummary: analyse, lignes });
      Alert.alert('✅ ¡Guardado!', 'El presupuesto ha sido guardado.');
      await askForReview();
      onSave();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar: ' + e.message);
    } finally { setSaving(false); }
  }

  async function handlePDF() {
    setGeneratingPDF(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      await generateAndSharePDF({ clientName: clientName || 'Cliente desconocido', clientEmail, clientPhone, clientAddress, tradeType, aiSummary: analyse, lignes, quoteNumber: '', signatureUri, tauxTVA }, profile);
    } catch (e) {
      Alert.alert('Error PDF', e.message);
    } finally { setGeneratingPDF(false); }
  }

  async function handleEmail() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      const { uri } = await generatePDFUri({ clientName: clientName || 'Cliente desconocido', clientEmail, clientPhone, clientAddress, tradeType, aiSummary: analyse, lignes, quoteNumber: '', signatureUri, tauxTVA }, profile);
      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) { Alert.alert('Email no disponible', 'No hay cliente de email configurado en este dispositivo.'); return; }
      await MailComposer.composeAsync({
        subject: `Presupuesto ${tradeType} - ${clientName}`,
        body: `Hola,\n\nAdjunto encontrará su presupuesto para los trabajos de ${tradeType}.\n\nSaludos,\n${profile?.company_name || ''}`,
        attachments: [uri],
      });
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function handleWhatsApp() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      const message = `Hola ${clientName},\n\nAquí está su presupuesto para los trabajos de ${tradeType}.\n\n📋 Resumen:\n${lignes.map(l => `• ${l.label} : ${(l.quantite * l.prixUnitaire).toFixed(0)}€`).join('\n')}\n\n💰 Base imponible: ${total.toFixed(0)}€\n💰 IVA ${tauxTVA}%: ${tva.toFixed(0)}€\n💰 Total: ${(total + tva).toFixed(0)}€\n\nSaludos,\n${profile?.company_name || ''}`;
      const phone = clientPhone ? clientPhone.replace(/\s/g, '').replace('+', '') : '';
      const url = phone
        ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
        : `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp no disponible', "WhatsApp no está instalado en este dispositivo.");
      }
    } catch (e) { Alert.alert('Error', e.message); }
  }

  function addLine() {
    if (!newLine.label) { Alert.alert('Error', 'Introduce un nombre para la línea'); return; }
    setLignes([...lignes, { label: newLine.label, detail: '', quantite: parseFloat(newLine.quantite) || 1, unite: newLine.unite, prixUnitaire: parseFloat(newLine.prixUnitaire) || 0 }]);
    setNewLine({ label: '', quantite: '1', unite: 'ud', prixUnitaire: '0' });
    setShowAddLine(false);
  }

  if (showSignature) {
    return (
      <SignatureScreen
        onSign={(sig) => { setSignatureUri(sig); setShowSignature(false); Alert.alert('✅ ¡Firmado!', "La firma ha sido guardada. Genera el PDF para incluirla."); }}
        onCancel={() => setShowSignature(false)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
      <ScrollView style={styles.dashContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}><Text style={styles.backText}>← Modificar</Text></TouchableOpacity>
        <Text style={styles.dashTitle}>{i18n.t('aiResult')}</Text>
        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>{i18n.t('analyse')}</Text>
          <TextInput
            style={{ color: '#ccc', lineHeight: 22, backgroundColor: '#1a3050', borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: 'top' }}
            multiline={true}
            value={analyse}
            onChangeText={setAnalyse}
            keyboardAppearance="dark"
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#0f2040', borderRadius: 10, padding: 10 }}>
              <Text style={{ color: '#7a9cc0', fontSize: 11 }}>Dificultad</Text>
              <Text style={{ color: 'white', fontWeight: 'bold', marginTop: 4 }}>{result.difficulte}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#0f2040', borderRadius: 10, padding: 10 }}>
              <Text style={{ color: '#7a9cc0', fontSize: 11 }}>Duración estimada</Text>
              <Text style={{ color: 'white', fontWeight: 'bold', marginTop: 4 }}>{result.duree}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#0f2040', borderRadius: 10, padding: 10 }}>
              <Text style={{ color: '#7a9cc0', fontSize: 11 }}>Presupuesto</Text>
              <Text style={{ color: '#10b981', fontWeight: 'bold', marginTop: 4 }}>{result.budgetMin}€ - {result.budgetMax}€</Text>
            </View>
          </View>
        </View>
        {result.pointsAttention && result.pointsAttention.length > 0 && (
          <View style={[styles.stepCard, { borderLeftWidth: 3, borderLeftColor: '#f59e0b' }]}>
            <Text style={[styles.stepTitle, { color: '#f59e0b' }]}>⚠️ Puntos de atención</Text>
            {result.pointsAttention.map((point, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                <Text style={{ color: '#f59e0b' }}>•</Text>
                <Text style={{ color: '#ccc', flex: 1, lineHeight: 20 }}>{point}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>Líneas del presupuesto</Text>
          {lignes.map((ligne, i) => (
            <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: '#1a3050', paddingVertical: 10 }}>
              {editingIndex === i ? (
                <View>
                  <TextInput style={{ color: 'white', backgroundColor: '#1a3050', borderRadius: 8, padding: 8, marginBottom: 6 }} value={ligne.label} onChangeText={v => { const l = [...lignes]; l[i].label = v; setLignes(l); }} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={{ flex: 1, color: 'white', backgroundColor: '#1a3050', borderRadius: 8, padding: 8 }} keyboardType="numeric" value={String(ligne.quantite)} onChangeText={v => { const l = [...lignes]; l[i].quantite = parseFloat(v) || 0; setLignes(l); }} />
                    <TextInput style={{ flex: 1, color: 'white', backgroundColor: '#1a3050', borderRadius: 8, padding: 8 }} keyboardType="numeric" value={String(ligne.prixUnitaire)} onChangeText={v => { const l = [...lignes]; l[i].prixUnitaire = parseFloat(v) || 0; setLignes(l); }} />
                  </View>
                  <TouchableOpacity onPress={() => setEditingIndex(null)} style={{ marginTop: 8, backgroundColor: '#10b981', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>✅ Validar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '500', flex: 1 }}>{ligne.label}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => setEditingIndex(i)} style={{ padding: 4 }}><Text style={{ color: '#4a80f0', fontSize: 12 }}>✏️</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => { const l = [...lignes]; l.splice(i, 1); setLignes(l); }} style={{ padding: 4 }}><Text style={{ color: '#ef4444', fontSize: 12 }}>🗑️</Text></TouchableOpacity>
                    </View>
                  </View>
                  {ligne.detail && <Text style={{ color: '#7a9cc0', fontSize: 12, marginTop: 2 }}>{ligne.detail}</Text>}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: '#7a9cc0', fontSize: 13 }}>{ligne.quantite} {ligne.unite} x {ligne.prixUnitaire}€</Text>
                    <Text style={{ color: '#4a80f0', fontWeight: 'bold' }}>{(ligne.quantite * ligne.prixUnitaire).toFixed(0)}€</Text>
                  </View>
                </View>
              )}
            </View>
          ))}
          {showAddLine ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="Descripción *" placeholderTextColor="#555" value={newLine.label} onChangeText={v => setNewLine({ ...newLine, label: v })} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Cant." placeholderTextColor="#555" keyboardType="numeric" value={newLine.quantite} onChangeText={v => setNewLine({ ...newLine, quantite: v })} />
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Unidad" placeholderTextColor="#555" value={newLine.unite} onChangeText={v => setNewLine({ ...newLine, unite: v })} />
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Precio" placeholderTextColor="#555" keyboardType="numeric" value={newLine.prixUnitaire} onChangeText={v => setNewLine({ ...newLine, prixUnitaire: v })} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#10b981', marginTop: 0 }]} onPress={addLine}><Text style={styles.buttonText}>✅ Añadir</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#1a3050', marginTop: 0 }]} onPress={() => setShowAddLine(false)}><Text style={styles.buttonText}>Cancelar</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowAddLine(true)} style={{ marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#4a80f0', borderStyle: 'dashed', alignItems: 'center' }}>
              <Text style={{ color: '#4a80f0', fontSize: 14 }}>+ Añadir línea</Text>
            </TouchableOpacity>
          )}
          <View style={{ marginTop: 16, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#7a9cc0' }}>Base imponible</Text>
              <Text style={{ color: 'white' }}>{total.toFixed(0)}€</Text>
            </View>
            <TouchableOpacity onPress={() => setShowTVASelector(!showTVASelector)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#7a9cc0' }}>IVA {tauxTVA}% ✏️</Text>
              <Text style={{ color: 'white' }}>{tva.toFixed(0)}€</Text>
            </TouchableOpacity>
            {showTVASelector && (
              <View style={{ backgroundColor: '#1a3050', borderRadius: 10, padding: 8, gap: 6 }}>
                {TVA_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt.value} onPress={() => { setTauxTVA(opt.value); setShowTVASelector(false); }} style={{ padding: 10, borderRadius: 8, backgroundColor: tauxTVA === opt.value ? '#4a80f022' : 'transparent', borderWidth: tauxTVA === opt.value ? 1 : 0, borderColor: '#4a80f0' }}>
                    <Text style={{ color: tauxTVA === opt.value ? '#4a80f0' : '#ccc', fontSize: 13 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>TOTAL</Text>
              <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 16 }}>{(total + tva).toFixed(0)}€</Text>
            </View>
          </View>
        </View>
        {signatureUri && (
          <View style={{ backgroundColor: '#10b98122', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 16 }}>✅</Text>
            <Text style={{ color: '#10b981', fontSize: 13 }}>{i18n.t('signedConfirm')}</Text>
          </View>
        )}
        <View style={{ gap: 12, marginBottom: 40 }}>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#f59e0b' }]} onPress={() => setShowSignature(true)}>
            <Text style={styles.buttonText}>✍️ {i18n.t('signClient')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: saving ? '#555' : '#1a56db' }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>💾 {i18n.t('save')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: generatingPDF ? '#555' : '#10b981' }]} onPress={handlePDF} disabled={generatingPDF}>
              {generatingPDF ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{i18n.t('pdf')}</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#0f2d6b' }]} onPress={handleEmail}>
              <Text style={styles.buttonText}>{i18n.t('emailBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#25D366' }]} onPress={handleWhatsApp}>
              <Text style={styles.buttonText}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <TrialBanner daysLeft={trialDaysLeft} onUpgrade={onUpgrade} />
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiResult, setAiResult] = useState(null);
  const [quoteData, setQuoteData] = useState({});
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(3);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    const init = async () => {
      await loadLanguage();
      const onboardingDone = await AsyncStorage.getItem('onboardingDone');
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) { await checkTrialStatus(session.user); }
        else if (onboardingDone) { setScreen('login'); }
        else { setScreen('onboarding'); }
      });
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) { await checkTrialStatus(session.user); } else { setScreen('login'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkTrialStatus(user) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
    try {
      const profilePromise = supabase.from('profiles').select('*').eq('user_id', user.id).single();
      const { data: profile } = await Promise.race([profilePromise, timeout]);
      if (profile?.is_paid) { setIsPaid(true); setScreen('main'); return; }
      const countPromise = supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      const { count } = await Promise.race([countPromise, timeout]);
      const quotesLeft = Math.max(0, 3 - (count || 0));
      setTrialDaysLeft(quotesLeft);
      setScreen('main');
    } catch (e) { setScreen('main'); }
  }

  async function handleUseQuota() {
    if (isPaid) return;
    if (trialDaysLeft <= 0) {
      Alert.alert('Prueba terminada', 'Has usado tus 3 análisis gratuitos. ¡Pasa a Premium para continuar!', [
        { text: 'Ver planes', onPress: () => goToPaywall() },
        { text: 'Cancelar', style: 'cancel' }
      ]);
      throw new Error('QUOTA_EXCEEDED');
    }
    setTrialDaysLeft(prev => Math.max(0, prev - 1));
  }

  function navigate(tab) {
    setActiveTab(tab);
    if (tab === 'newquote') { setScreen('newquote'); }
    else { setScreen('main'); }
  }

  function goToPaywall() { setActiveTab('paywall'); setScreen('main'); }

  if (screen === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a1628', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 32 }}>🏠</Text>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20, marginTop: 12 }}>PresupClick</Text>
        <ActivityIndicator color="#4a80f0" style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (screen === 'onboarding') return <OnboardingScreen onDone={async () => { await AsyncStorage.setItem('onboardingDone', 'true'); setScreen('login'); }} />;
  if (screen === 'login') return <LoginScreen onLogin={() => setScreen('main')} />;
  if (screen === 'newquote') return <View style={{ flex: 1 }}><NewQuoteScreen onBack={() => { setScreen('main'); setActiveTab('dashboard'); }} onQuoteGenerated={(result, clientName, clientEmail, clientPhone, clientAddress, description, tradeType) => { setAiResult(result); setQuoteData({ clientName, clientEmail, clientPhone, clientAddress, description, tradeType }); setScreen('result'); }} onUseQuota={handleUseQuota} /></View>;
  if (screen === 'result') return <View style={{ flex: 1 }}><QuoteResultScreen result={aiResult} clientName={quoteData.clientName} clientEmail={quoteData.clientEmail} clientPhone={quoteData.clientPhone} clientAddress={quoteData.clientAddress} description={quoteData.description} tradeType={quoteData.tradeType} onBack={() => setScreen('newquote')} onSave={() => { setScreen('main'); setActiveTab('dashboard'); }} trialDaysLeft={trialDaysLeft} onUpgrade={goToPaywall} /></View>;
  if (screen === 'quotedetail') return <View style={{ flex: 1 }}><QuoteDetailScreen quote={selectedQuote} onBack={() => { setScreen('main'); setActiveTab('dashboard'); }} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a1628' }}>
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && <DashboardScreen onQuoteDetail={(q) => { setSelectedQuote(q); setScreen('quotedetail'); }} trialDaysLeft={trialDaysLeft} onUpgrade={goToPaywall} />}
        {activeTab === 'paywall' && <PaywallScreen daysLeft={trialDaysLeft} />}
        {activeTab === 'profile' && <ProfileScreen onShowPaywall={() => setActiveTab('paywall')} />}
      </View>
      <BottomNav active={activeTab} onNavigate={navigate} isPaid={isPaid} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  header: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 32, fontWeight: 'bold', color: 'white' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  form: { backgroundColor: '#0f2040', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 32 },
  title: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 24 },
  input: { backgroundColor: '#1a3050', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 15, color: 'white' },
  button: { backgroundColor: '#1a56db', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: '#4a80f0', marginTop: 16, fontSize: 14 },
  dashContainer: { flex: 1, backgroundColor: '#0a1628', padding: 20, paddingTop: 60 },
  dashTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  dashSub: { fontSize: 14, color: '#7a9cc0', marginTop: 4, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#0f2040', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1a3a6a' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#4a80f0' },
  statLabel: { fontSize: 12, color: '#7a9cc0', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 12 },
  quoteRow: { backgroundColor: '#0f2040', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1a3a6a' },
  quoteNum: { fontSize: 14, fontWeight: 'bold', color: '#4a80f0' },
  quoteClient: { fontSize: 13, color: '#ccc', marginTop: 2 },
  quoteMontant: { fontSize: 14, fontWeight: 'bold', color: 'white' },
  quoteBadge: { fontSize: 11, color: '#10b981', marginTop: 2 },
  stepCard: { backgroundColor: '#0f2040', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1a3a6a' },
  stepTitle: { fontSize: 16, fontWeight: 'bold', color: 'white', marginBottom: 12 },
  backButton: { marginBottom: 16 },
  backText: { color: '#4a80f0', fontSize: 16 },
});