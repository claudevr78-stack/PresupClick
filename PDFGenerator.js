import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

async function buildHTML(quote, profile, total, iva, totalConIVA, isInvoice = false) {
  const docType = isInvoice ? 'FACTURA' : 'PRESUPUESTO';
  const docNumber = quote.quoteNumber || '';
  const signatureBase64 = (quote.signatureUri && quote.signatureUri !== 'signed') ? quote.signatureUri : null;
  const logoBase64 = profile?.logo_base64 || null;
  const tauxTVA = quote.tauxTVA || 21;

  const lignesHTML = quote.lignes.map(l => `
    <tr>
      <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:12px;">${l.label}${l.detail ? `<br><span style="color:#444;font-size:10px;">${l.detail}</span>` : ''}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">${l.quantite} ${l.unite}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">${l.prixUnitaire}&euro;</td>
      <td style="padding:7px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;color:#1a56db;font-size:12px;">${(l.quantite * l.prixUnitaire).toFixed(0)}&euro;</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:20px;font-size:13px;">

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td>
            ${logoBase64 ? `<img src="${logoBase64}" style="max-height:55px;max-width:140px;object-fit:contain;margin-bottom:6px;display:block;" />` : ''}
            <div style="font-size:20px;font-weight:bold;color:#1a56db;">${profile?.company_name || 'Mi Empresa'}</div>
            <div style="font-size:11px;color:#333;margin-top:4px;line-height:1.6;">
              ${profile?.address ? profile.address + ' ' : ''}${profile?.city ? profile.city + '<br>' : ''}
              ${profile?.phone ? 'Tel: ' + profile.phone + '&nbsp;&nbsp;' : ''}${profile?.email ? 'Email: ' + profile.email + '<br>' : ''}
              ${profile?.siret ? 'NIF/CIF: ' + profile.siret : ''}
            </div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="font-size:24px;font-weight:bold;color:#1a56db;">${docType}</div>
            <div style="font-size:11px;color:#333;margin-top:4px;">${docNumber ? docNumber + '<br>' : ''}Fecha: ${new Date().toLocaleDateString('es-ES')}</div>
            <div style="font-size:11px;color:#333;">${isInvoice ? 'Pagadero en 30 días' : 'Válido 30 días'}</div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
        <tr>
          <td width="48%" style="padding:10px;background:#f0f4ff;border-radius:6px;">
            <div style="font-size:10px;font-weight:bold;color:#1a56db;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Cliente</div>
            <div style="font-size:14px;font-weight:bold;color:#1a1a1a;">${quote.clientName}</div>
            <div style="font-size:11px;color:#555;margin-top:4px;line-height:1.6;">
              ${quote.clientEmail ? quote.clientEmail + '<br>' : ''}
              ${quote.clientPhone ? quote.clientPhone + '<br>' : ''}
              ${quote.clientAddress ? quote.clientAddress : ''}
            </div>
          </td>
          <td width="4%"></td>
          <td width="48%" style="padding:10px;background:#f0f4ff;border-radius:6px;">
            <div style="font-size:10px;font-weight:bold;color:#1a56db;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Tipo de trabajo</div>
            <div style="font-size:14px;font-weight:bold;color:#1a1a1a;">${quote.tradeType}</div>
          </td>
        </tr>
      </table>

      ${quote.aiSummary ? `
      <div style="padding:10px;background:#eff6ff;border-left:3px solid #1a56db;border-radius:3px;font-size:11px;color:#1a1a1a;line-height:1.5;margin-bottom:14px;">
        <strong>Análisis:</strong> ${quote.aiSummary}
      </div>` : ''}

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border-collapse:collapse;">
        <thead>
          <tr style="background:#1a56db;color:white;">
            <th style="padding:8px;text-align:left;font-size:11px;">Descripci&oacute;n</th>
            <th style="padding:8px;text-align:center;font-size:11px;">Cant.</th>
            <th style="padding:8px;text-align:right;font-size:11px;">Precio unit.</th>
            <th style="padding:8px;text-align:right;font-size:11px;">Total</th>
          </tr>
        </thead>
        <tbody>${lignesHTML}</tbody>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td width="55%" style="vertical-align:top;padding-right:12px;">
            ${signatureBase64 ? `
              <div style="font-size:11px;color:#333;margin-bottom:4px;font-weight:bold;">Firma del cliente:</div>
              <div style="border:1px solid #ddd;border-radius:6px;padding:4px;background:#fafafa;display:inline-block;">
                <img src="${signatureBase64}" style="max-width:200px;max-height:80px;" />
              </div>
              <div style="font-size:10px;color:#555;margin-top:3px;font-style:italic;">Conforme — ${new Date().toLocaleDateString('es-ES')}</div>
            ` : `<div style="font-size:11px;color:#999;font-style:italic;">${isInvoice ? 'Factura pagadera en 30 días.' : 'Para aceptar, firme y escriba "Conforme".'}</div>`}
          </td>
          <td width="45%">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#333;border-bottom:1px solid #eee;">Base imponible</td>
                <td style="padding:5px 0;font-size:13px;color:#333;text-align:right;border-bottom:1px solid #eee;">${total.toFixed(0)}&euro;</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#333;border-bottom:1px solid #eee;">IVA ${tauxTVA}%</td>
                <td style="padding:5px 0;font-size:13px;color:#333;text-align:right;border-bottom:1px solid #eee;">${iva.toFixed(0)}&euro;</td>
              </tr>
              <tr>
                <td colspan="2">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a56db;border-radius:6px;margin-top:6px;">
                    <tr>
                      <td style="padding:10px 12px;color:white;font-size:15px;font-weight:bold;">TOTAL</td>
                      <td style="padding:10px 12px;color:white;font-size:15px;font-weight:bold;text-align:right;">${totalConIVA.toFixed(0)}&euro;</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1a56db;">
        <tr>
          <td style="padding-top:8px;font-size:10px;color:#666;text-align:center;">
            ${profile?.company_name || ''} ${profile?.siret ? '&mdash; NIF/CIF: ' + profile.siret : ''} ${profile?.tva_number ? '&mdash; IVA: ' + profile.tva_number : ''}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function generateAndSharePDF(quote, profile) {
  const total = quote.lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0);
  const iva = total * ((quote.tauxTVA || 21) / 100);
  const totalConIVA = total + iva;
  const html = await buildHTML(quote, profile, total, iva, totalConIVA, false);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Presupuesto ${quote.clientName}` });
  return { uri };
}

export async function generateAndShareInvoicePDF(invoice, profile) {
  const total = invoice.lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0);
  const iva = total * ((invoice.tauxTVA || 21) / 100);
  const totalConIVA = total + iva;
  const html = await buildHTML(invoice, profile, total, iva, totalConIVA, true);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Factura ${invoice.clientName}` });
  return { uri };
}

export async function generatePDFUri(quote, profile) {
  const total = quote.lignes.reduce((sum, l) => sum + l.quantite * l.prixUnitaire, 0);
  const iva = total * ((quote.tauxTVA || 21) / 100);
  const totalConIVA = total + iva;
  const html = await buildHTML(quote, profile, total, iva, totalConIVA, false);
  const { uri } = await Print.printToFileAsync({ html });
  return { uri };
}