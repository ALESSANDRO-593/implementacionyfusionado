/**
 * Configuración central de la aplicación.
 *
 * La dirección de los webhooks se deduce de dónde se está sirviendo la página,
 * así que el mismo compilado sirve en cualquier servidor:
 *
 *   · Desarrollo → Angular en :4200 y n8n en :5678, dos orígenes distintos.
 *   · Producción → Nginx entrega el frontend y redirige /webhook a n8n, de modo
 *     que ambos comparten origen y basta una ruta relativa.
 *
 * Gracias a esto no hay que recompilar si cambia la IP o si más adelante se
 * pasa a un dominio con HTTPS.
 */
function baseDeWebhooks(): string {
  const enDesarrollo = location.port === '4200';
  return enDesarrollo ? 'http://localhost:5678/webhook' : `${location.origin}/webhook`;
}

export const AppConfig = {
  /** Base de los webhooks de n8n. Nota: en n8n los webhooks de test usan /webhook-test. */
  n8nBaseUrl: baseDeWebhooks(),
  storageTokenKey: 'yavibot.panel.token',
  storageChatSessionKey: 'yavibot.chat.session',
  /** Site Key publica de reCAPTCHA v2 compartida con la aplicacion /app. */
  recaptchaSiteKey: '6LeuMWUtAAAAAEBTzcrnzI15rw-nbShRQei3hGCY',
} as const;
