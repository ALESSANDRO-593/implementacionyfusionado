export const environment = {
  production: true,
  usarMock: false,
  // n8n compartido con el equipo web (VPS institucional) — tus workflows
  // corren ahí, apuntando a la misma base de datos real que usa su panel.
  n8nBaseUrl: '/webhook',
  apiKey: 'jZtUx2MlGnNOwzBcovu-ykTdlAtyIlvHWdLVmY79R_Y',
  // reCAPTCHA v2 real ("YaviBot Chat", cuenta mesadeayuda@yavirac.edu.ec) —
  // antes de desplegar, agregar el dominio real del instituto a esta misma
  // clave en google.com/recaptcha/admin (ver environment.ts para el detalle).
  recaptchaSiteKey: '6LeuMWUtAAAAAEBTzcrnzI15rw-nbShRQei3hGCY'
};
