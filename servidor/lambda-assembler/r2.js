/* r2.js — EL VIDEO TERMINADO EN CLOUDFLARE R2 (6-oct-2026, fase 7 del plan del martes). APAGADO.
 *
 * Decidido el 5-oct (camino «mixto»): los originales se quedan en Amazon S3, al lado de las Lambdas que fabrican (así
 * fabricar no tarda más), y SOLO el video terminado —el que se queda y se descarga— va a R2, donde las descargas son
 * gratis. Sergio: dejarlo programado y configurado pero APAGADO hasta que entren clientes (hoy hay capa gratis y
 * créditos de Amazon). Para prenderlo, él crea la cuenta de Cloudflare (R2 pide tarjeta) y en las variables de esta
 * Lambda se ponen:
 *   R2_ACTIVO=si · R2_CUENTA (id de la cuenta) · R2_LLAVE / R2_SECRETO (token de R2 con escritura en el bucket) ·
 *   R2_BUCKET · R2_PUBLICO (la dirección pública del bucket, p. ej. https://videos.cherrysweet.app)
 * El video se sube con la MISMA ruta (renders/<id>/output….mp4): el Calendario e ig-publicar reconocen el render por ella.
 * Si R2 falla, el video se queda en Amazon como siempre: nunca se pierde un video por esto.
 */
var fs = require('fs');
var S3Mod = null;
try { S3Mod = require('@aws-sdk/client-s3'); } catch (e) { S3Mod = null; }
var E = process.env;

function activo() {
  return E.R2_ACTIVO === 'si' && !!(S3Mod && E.R2_CUENTA && E.R2_LLAVE && E.R2_SECRETO && E.R2_BUCKET && E.R2_PUBLICO);
}
var cliente = null;
function c() {
  if (!cliente) cliente = new S3Mod.S3Client({ region: 'auto', endpoint: 'https://' + E.R2_CUENTA + '.r2.cloudflarestorage.com',
    credentials: { accessKeyId: E.R2_LLAVE, secretAccessKey: E.R2_SECRETO } });
  return cliente;
}
async function subir(local, key, tipo) {
  var st = fs.statSync(local);
  await c().send(new S3Mod.PutObjectCommand({ Bucket: E.R2_BUCKET, Key: key, Body: fs.createReadStream(local), ContentLength: st.size,
    ContentType: tipo || 'video/mp4', CacheControl: 'public, max-age=31536000, immutable' }));
  return String(E.R2_PUBLICO).replace(/\/$/, '') + '/' + key;
}

module.exports = { activo: activo, subir: subir };
