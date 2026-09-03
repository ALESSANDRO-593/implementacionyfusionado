export const environment = {
  production: false,
  // Cambiar a false después de importar y activar los workflows de parqueadero.
  useMocks: false,
  // El proxy redirige /webhook hacia el n8n local o el túnel SSH.
  n8nBaseUrl: '/webhook'
};
