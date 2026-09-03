/** Sobre estándar de respuesta de los webhooks de n8n. */
export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
