import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://voxaaxieobhmvfmfajbh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IO3qVvCh7gytk9rbnPMgyA_LPhxWsIl';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function generateQuoteNumber(userId) {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const number = String((count || 0) + 1).padStart(3, '0');
  return `PRE-${year}-${number}`;
}

export async function saveQuote(quote) {
  const { data: { user } } = await supabase.auth.getUser();
  const quoteNumber = await generateQuoteNumber(user.id);
  const { data, error } = await supabase
    .from('quotes')
    .insert([{
      user_id: user.id,
      quote_number: quoteNumber,
      client_name: quote.clientName,
      client_email: quote.clientEmail || null,
      client_phone: quote.clientPhone || null,
      client_address: quote.clientAddress || null,
      description: quote.description,
      trade_type: quote.tradeType,
      total_ht: quote.totalHT,
      total_ttc: quote.totalTTC,
      status: 'draft',
      ai_summary: quote.aiSummary,
      lignes: quote.lignes,
    }])
    .select();
  if (error) throw new Error(error.message);
  return data[0];
}

export async function getQuotes() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveInvoice(invoice) {
  const { data: { user } } = await supabase.auth.getUser();
  const year = new Date().getFullYear();
  const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  const number = String((count || 0) + 1).padStart(3, '0');
  const invoiceNumber = `FAT-${year}-${number}`;
  const { data, error } = await supabase.from('invoices').insert([{
    user_id: user.id,
    quote_id: invoice.quoteId || null,
    invoice_number: invoiceNumber,
    client_name: invoice.clientName,
    client_email: invoice.clientEmail || null,
    client_phone: invoice.clientPhone || null,
    client_address: invoice.clientAddress || null,
    trade_type: invoice.tradeType,
    total_ht: invoice.totalHT,
    total_ttc: invoice.totalTTC,
    status: 'unpaid',
    lignes: invoice.lignes,
  }]).select();
  if (error) throw new Error(error.message);
  return data[0];
}

export async function getInvoices() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}