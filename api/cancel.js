export default function handler(req, res) {
  res.send(`
    <html>
      <body style="background:#0f0f0f;color:white;font-family:Arial;text-align:center;padding:60px">
        <h1>❌ Paiement annulé</h1>
        <p>Votre paiement a été annulé.</p>
        <p>Retournez sur l'application pour réessayer.</p>
      </body>
    </html>
  `);
}