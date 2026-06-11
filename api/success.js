export default function handler(req, res) {
  res.send(`
    <html>
      <body style="background:#0f0f0f;color:white;font-family:Arial;text-align:center;padding:60px">
        <h1>✅ Paiement réussi !</h1>
        <p>Merci pour votre abonnement BatiSmart.</p>
        <p>Retournez sur l'application pour continuer.</p>
      </body>
    </html>
  `);
}