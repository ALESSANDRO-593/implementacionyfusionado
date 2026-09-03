import { AfterViewInit, Component, signal, computed, inject, ElementRef, viewChild, effect, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatbotApi, ParkingModality, ParkingState, ParkingTicket, ParkingVehicleType } from './data/chatbot-api';
import { AppConfig } from '../../core/config/app-config';

type Autor = 'bot' | 'user';
interface Mensaje { autor: Autor; texto: string; hora: string; opciones?: Opcion[]; ticket?: ParkingTicket; }
interface Opcion { etiqueta: string; valor: string; }

declare const grecaptcha: {
  render(container: string | HTMLElement, params: Record<string, unknown>): number;
  reset(widgetId?: number): void;
};

type Paso = 'cedula' | 'otp' | 'menu' | 'parking_tipo' | 'parking_placa' | 'parking_modalidad' | 'parking_confirmacion' | 'fin';

const MENU_ESTUDIANTE: Opcion[] = [
  { etiqueta: '📄 Solicitar Certificado de Matrícula', valor: 'CERT_MATRICULA' },
  { etiqueta: '🚗 Generar ticket de parqueadero', valor: 'PARKING' },
  { etiqueta: 'Solicitar Récord Académico', valor: 'RECORD_ACADEMICO' },
  { etiqueta: 'Solicitar Certificado de Vinculación', valor: 'CERT_VINCULACION' },
  { etiqueta: 'Solicitar Anulación de Matrícula', valor: 'ANULACION_MATRICULA' },
  { etiqueta: 'Consultar estado de mis tickets', valor: 'CONSULTAR' },
  { etiqueta: 'Finalizar conversación', valor: 'FIN' },
];

const MENU_DOCENTE: Opcion[] = [
  { etiqueta: '🚗 Generar ticket de parqueadero', valor: 'PARKING' },
  { etiqueta: 'Finalizar conversación', valor: 'FIN' },
];

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.scss',
})
export class Chatbot implements AfterViewInit {
  private api = inject(ChatbotApi);
  private ngZone = inject(NgZone);
  private scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

  mensajes = signal<Mensaje[]>([]);
  entrada = signal('');
  cargando = signal(false);
  captchaToken = signal<string | null>(null);
  private captchaWidgetId: number | null = null;
  private menuActual: Opcion[] = MENU_ESTUDIANTE;
  private paso = signal<Paso>('cedula');
  private cedula = '';
  private parkingVehicleType: ParkingVehicleType | null = null;
  private parkingPlate = '';
  private parkingModality: ParkingModality | null = null;

  esPasoCedula = computed(() => this.paso() === 'cedula');
  puedeEnviar = computed(() =>
    this.entrada().trim().length > 0 &&
    !this.cargando() &&
    (!this.esPasoCedula() || !!this.captchaToken())
  );

  constructor() {
    this.pushBot('Hola, soy YaviBot, tu asistente virtual del Instituto Yavirac. 👋');
    this.pushBot('Para comenzar, ingresa tu número de cédula.\n(prueba con: 1756234890)');
    effect(() => { this.mensajes(); queueMicrotask(() => this.scrollAbajo()); });
  }

  ngAfterViewInit(): void {
    this.renderCaptcha();
  }

  private renderCaptcha(intentos = 0): void {
    const contenedor = document.getElementById('recaptcha-mesa');
    if (typeof grecaptcha === 'undefined' || !contenedor) {
      if (intentos < 40) setTimeout(() => this.renderCaptcha(intentos + 1), 250);
      return;
    }
    this.captchaWidgetId = grecaptcha.render(contenedor, {
      sitekey: AppConfig.recaptchaSiteKey,
      callback: (token: string) => this.ngZone.run(() => this.captchaToken.set(token)),
      'expired-callback': () => this.ngZone.run(() => this.captchaToken.set(null)),
      'error-callback': () => this.ngZone.run(() => this.captchaToken.set(null)),
    });
  }

  private resetCaptcha(): void {
    this.captchaToken.set(null);
    if (this.captchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
      grecaptcha.reset(this.captchaWidgetId);
    }
  }

  private hora(): string {
    return new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  }
  private pushBot(texto: string, opciones?: Opcion[], ticket?: ParkingTicket) {
    this.mensajes.update(m => [...m, { autor: 'bot', texto, hora: this.hora(), opciones, ticket }]);
  }
  private pushUser(texto: string) {
    this.mensajes.update(m => [...m, { autor: 'user', texto, hora: this.hora() }]);
  }
  private scrollAbajo() {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  enviar() {
    const texto = this.entrada().trim();
    if (!texto || this.cargando()) return;
    if (this.esPasoCedula() && !this.captchaToken()) {
      this.pushBot('Completa la verificación reCAPTCHA antes de enviar tu cédula.');
      return;
    }
    this.pushUser(texto);
    this.entrada.set('');
    this.procesar(texto);
  }

  elegir(op: Opcion) {
    if (this.cargando()) return;
    this.pushUser(op.etiqueta);
    switch (op.valor) {
      case 'PARKING_USAR_REGISTRADO': return this.preguntarModalidad();
      case 'PARKING_OTRO': return this.preguntarTipoVehiculo();
      case 'PARKING_TIPO_AUTO': return this.seleccionarTipoVehiculo('AUTO');
      case 'PARKING_TIPO_MOTO': return this.seleccionarTipoVehiculo('MOTO');
      case 'PARKING_MODALIDAD_DIARIA': return this.seleccionarModalidad('DIARIO');
      case 'PARKING_MODALIDAD_MENSUAL': return this.seleccionarModalidad('MENSUAL');
      case 'PARKING_CONFIRMAR': return this.solicitarParking();
      case 'PARKING_CORREGIR': return this.preguntarTipoVehiculo();
      default: return this.manejarMenu(op.valor);
    }
  }

  private procesar(texto: string) {
    switch (this.paso()) {
      case 'cedula': return this.validarCedula(texto);
      case 'otp':    return this.validarOtp(texto);
      case 'parking_placa': return this.capturarPlaca(texto);
      default:       return this.pushBot('Por favor selecciona una opción del menú.');
    }
  }

  private validarCedula(cedula: string) {
    if (!/^[0-9]{10}$/.test(cedula)) {
      this.pushBot('La cédula debe tener 10 dígitos numéricos. Intenta nuevamente.');
      return;
    }
    this.cedula = cedula;
    this.cargando.set(true);
    this.api.iniciar(cedula, this.captchaToken() ?? '').subscribe({
      next: (r) => {
        this.cargando.set(false);
        this.resetCaptcha();
        if (r.data?.acceso === false) {
          this.pushBot(r.data.mensaje ?? 'No encontramos un usuario habilitado con esa cédula.');
          this.paso.set('fin');
          return;
        }
        this.paso.set('otp');
        this.pushBot('Te enviamos un código de 5 dígitos a tu correo institucional. Ingrésalo para continuar.');
      },
      error: (e) => {
        this.cargando.set(false);
        this.resetCaptcha();
        this.pushBot(`⚠️ ${e.message ?? 'No se pudo validar la cédula.'} (El workflow de n8n aún no está activo.)`);
      },
    });
  }

  private validarOtp(codigo: string) {
    if (!/^[0-9]{5}$/.test(codigo)) {
      this.pushBot('El código debe tener 5 dígitos numéricos.');
      return;
    }
    this.cargando.set(true);
    this.api.validarOtp(this.cedula, codigo).subscribe({
      next: (r) => {
        this.cargando.set(false);
        if (!r.ok) { this.pushBot(r.error?.message ?? 'Código incorrecto.'); return; }
        if (r.data?.sesion) sessionStorage.setItem(AppConfig.storageChatSessionKey, r.data.sesion);
        const usuario = r.data?.usuario ?? r.data?.estudiante;
        this.menuActual = usuario?.tipoUsuario === 'DOCENTE' ? MENU_DOCENTE : MENU_ESTUDIANTE;
        this.paso.set('menu');
        this.pushBot('¡Identidad verificada! 👋 Hola ' + (usuario?.nombres ?? '') + ', ¿qué deseas consultar hoy?', this.menuActual);
      },
      error: (e) => {
        this.cargando.set(false);
        this.pushBot(`⚠️ ${e.message ?? 'No se pudo validar el código.'}`);
      },
    });
  }

  private manejarMenu(valor: string) {
    if (valor === 'PARKING') { this.abrirParking(); return; }
    if (valor === 'FIN') {
      this.pushBot('Gracias por usar YaviBot. ¡Hasta pronto! 👋');
      this.paso.set('fin');
      return;
    }
    if (valor === 'CERT_MATRICULA') {
      this.cargando.set(true);
      this.api.solicitarCertificado().subscribe({
        next: (r) => { this.cargando.set(false); this.pushBot(r.data?.mensaje ?? 'Certificado generado.', this.menuActual); },
        error: (e) => { this.cargando.set(false); this.pushBot(`⚠️ ${e.message}`, this.menuActual); },
      });
      return;
    }
    if (valor === 'CONSULTAR') {
      this.cargando.set(true);
      this.api.misTickets().subscribe({
        next: (r) => {
          this.cargando.set(false);
          const items = r.data ?? [];
          if (!items.length) { this.pushBot('No tienes tickets registrados.', this.menuActual); return; }
          const txt = items.map(t => `• ${t.codigo} — ${t.tipo} — ${t.estado}`).join('\n');
          this.pushBot('Tus tickets:\n' + txt, this.menuActual);
        },
        error: (e) => { this.cargando.set(false); this.pushBot(`⚠️ ${e.message}`, this.menuActual); },
      });
      return;
    }
    // Récord / Vinculación / Anulación → ticket
    this.cargando.set(true);
    this.api.crearTicket(valor).subscribe({
      next: (r) => { this.cargando.set(false); this.pushBot(`Ticket ${r.data?.codigo} creado (estado: ${r.data?.estado}). Te notificaremos por correo.`, this.menuActual); },
      error: (e) => { this.cargando.set(false); this.pushBot(`⚠️ ${e.message}`, this.menuActual); },
    });
  }
  private abrirParking() {
    this.cargando.set(true);
    this.api.parkingState().subscribe({
      next: (response) => {
        this.cargando.set(false);
        const state = response?.data;
        if (!state) { this.pushBot('No fue posible consultar el estado del parqueadero.', this.menuActual); return; }
        if (state.ticket?.state === 'PENDIENTE' || state.ticket?.state === 'APROBADO') {
          this.mostrarTicket(state.ticket);
          return;
        }
        if (state.ticket?.state === 'RECHAZADO') {
          this.pushBot(`La solicitud ${state.ticket.code} fue rechazada.${state.ticket.rejectionReason ? ` Motivo: ${state.ticket.rejectionReason}` : ''}`, undefined, state.ticket);
        }
        this.prepararVehiculo(state);
      },
      error: (error) => { this.cargando.set(false); this.pushBot(`⚠️ ${error.message}`, this.menuActual); },
    });
  }

  private prepararVehiculo(state: ParkingState) {
    if (state.vehicle) {
      this.parkingVehicleType = state.vehicle.type;
      this.parkingPlate = state.vehicle.plate;
      this.parkingModality = null;
      this.paso.set('parking_confirmacion');
      this.pushBot(`Tenemos registrado a tu nombre el vehículo con placa ${state.vehicle.plate}. ¿Deseas generar el ticket para este vehículo?`, [
        { etiqueta: 'Sí, confirmar vehículo', valor: 'PARKING_USAR_REGISTRADO' },
        { etiqueta: 'Registrar / Usar otro vehículo', valor: 'PARKING_OTRO' },
      ]);
      return;
    }
    this.preguntarTipoVehiculo();
  }

  private preguntarTipoVehiculo() {
    this.parkingVehicleType = null;
    this.parkingPlate = '';
    this.parkingModality = null;
    this.paso.set('parking_tipo');
    this.pushBot('Por favor, selecciona el tipo de vehículo:', [
      { etiqueta: 'Automóvil', valor: 'PARKING_TIPO_AUTO' },
      { etiqueta: 'Motocicleta', valor: 'PARKING_TIPO_MOTO' },
    ]);
  }

  private seleccionarTipoVehiculo(type: ParkingVehicleType) {
    this.parkingVehicleType = type;
    this.paso.set('parking_placa');
    this.pushBot('Ingresa el número de placa de tu vehículo:');
  }

  private capturarPlaca(value: string) {
    const compact = value.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    if (!/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{5,8}$/.test(compact)) {
      this.pushBot('La placa ingresada no es válida. Usa solo letras y números, por ejemplo PBW-4567.');
      return;
    }
    this.parkingPlate = /^[A-Z]{3}[0-9]{3,4}$/.test(compact)
      ? `${compact.slice(0, 3)}-${compact.slice(3)}` : compact;
    this.preguntarModalidad();
  }

  private preguntarModalidad() {
    this.parkingModality = null;
    this.paso.set('parking_modalidad');
    this.pushBot('Selecciona la modalidad del ticket de parqueadero:', [
      { etiqueta: 'Diaria', valor: 'PARKING_MODALIDAD_DIARIA' },
      { etiqueta: 'Mensual', valor: 'PARKING_MODALIDAD_MENSUAL' },
    ]);
  }

  private seleccionarModalidad(modality: ParkingModality) {
    this.parkingModality = modality;
    this.paso.set('parking_confirmacion');
    const type = this.parkingVehicleType === 'MOTO' ? 'Motocicleta' : 'Automóvil';
    const modalityLabel = modality === 'MENSUAL' ? 'Mensual' : 'Diaria';
    this.pushBot(`Confirmación: Tipo: ${type} | Placa: ${this.parkingPlate} | Modalidad: ${modalityLabel}. ¿La información es correcta?`, [
      { etiqueta: 'Confirmar y generar ticket', valor: 'PARKING_CONFIRMAR' },
      { etiqueta: 'Corregir datos', valor: 'PARKING_CORREGIR' },
    ]);
  }
  private solicitarParking() {
    if (!this.parkingVehicleType || !this.parkingPlate) { this.preguntarTipoVehiculo(); return; }
    if (!this.parkingModality) { this.preguntarModalidad(); return; }
    this.cargando.set(true);
    this.api.createParkingRequest(this.parkingVehicleType, this.parkingPlate, this.parkingModality).subscribe({
      next: (response) => {
        this.cargando.set(false);
        if (!response.ok) {
          this.pushBot(`⚠️ ${response.error?.message ?? 'No fue posible generar el ticket de parqueadero.'}`, this.menuActual);
          return;
        }
        if (response.data?.ticket) this.mostrarTicket(response.data.ticket);
        else this.pushBot('El servidor no devolvió el detalle del ticket. Consulta si ya existe una solicitud pendiente antes de intentarlo nuevamente.', this.menuActual);
      },
      error: (error) => { this.cargando.set(false); this.pushBot(`⚠️ ${error.message}`, this.menuActual); },
    });
  }

  private mostrarTicket(ticket: ParkingTicket) {
    this.paso.set('menu');
    if (ticket.state === 'APROBADO') {
      this.pushBot('Tu ticket de parqueadero se encuentra activo.', this.menuActual, ticket);
      return;
    }
    this.pushBot(
      'Tu solicitud ha sido registrada correctamente. Acércate o contacta a Administración para solicitar la aprobación de tu ticket.',
      this.menuActual,
      ticket,
    );
  }

  descargarTicket(ticket: ParkingTicket) {
    this.cargando.set(true);
    this.api.downloadParkingTicket(ticket.requestId).subscribe({
      next: (response) => {
        this.cargando.set(false);
        const data = response?.data;
        if (!data) { this.pushBot('No fue posible preparar el archivo del ticket.', this.menuActual); return; }
        const bytes = Uint8Array.from(atob(data.contentBase64), char => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = data.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => { this.cargando.set(false); this.pushBot(`⚠️ ${error.message}`, this.menuActual); },
    });
  }

  formatParkingDate(value: string | null): string {
    if (!value) return '';
    const [year, month, day] = value.slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : '';
  }
}
