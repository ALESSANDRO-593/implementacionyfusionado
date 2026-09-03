export const environment = {
  production: true,
  // Producción consume los workflows publicados en el n8n central.
  useMocks: false,
  // Nginx reenvía /webhook al n8n central bajo el mismo origen.
  n8nBaseUrl: '/webhook'
};
