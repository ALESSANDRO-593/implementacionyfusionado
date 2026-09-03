import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uni.certimatricula',
  appName: 'Mesa de Ayuda',
  webDir: 'www',
  // NOTA: NO configurar server.hostname = '169.58.138.164' — como la API
  // vive en ese mismo host, Capacitor intercepta las llamadas fetch/XHR
  // hacia ahí y las responde con los assets locales de la propia app
  // (devuelve el index.html en vez de pegarle al backend real). Se probó
  // y causa "Http failure during parsing" porque llega HTML donde se
  // esperaba JSON.
  //
  // El VPS institucional todavía no tiene HTTPS (solo IP, sin dominio).
  // Por defecto Capacitor sirve la app bajo "https://localhost", y desde
  // ahí cualquier llamada a http://169.58.138.164 se bloquea como
  // "contenido mixto" por el propio WebView (confirmado con status=0 /
  // isTrusted:true en el error real). Bajar el esquema local a "http"
  // (dejando el hostname en su valor por defecto "localhost", NO el de
  // la API) evita el contenido mixto sin causar la colisión de arriba.
  server: {
    androidScheme: 'http'
  },
  plugins: {
    SplashScreen: {
      // No lo ocultamos automáticamente: lo cierra AppComponent una vez que
      // Angular ya pintó la primera pantalla, para evitar el parpadeo blanco.
      launchAutoHide: false,
      backgroundColor: '#274386',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP'
    }
  }
};

export default config;
