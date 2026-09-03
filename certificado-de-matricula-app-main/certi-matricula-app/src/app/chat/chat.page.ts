import { Component, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { IonContent } from '@ionic/angular';
import * as QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Network } from '@capacitor/network';
import { EstudianteService } from '../services/estudiante.service';
import { CertificadoPdfService } from '../services/certificado-pdf.service';
import { validarCedulaEcuatoriana } from '../utils/validar-cedula';
import { environment } from '../../environments/environment';
import {
  CertificadoMatricula,
  Estudiante,
  IncidenciaLaboratorio,
  Laboratorio,
  ModalidadParqueadero,
  OpcionChat,
  TicketParqueadero,
  TipoVehiculoParqueadero,
  VehiculoParqueadero,
  TicketSolicitud,
  Usuario
} from '../models/estudiante.model';

// El script de Google (index.html) crea este global; no hay @types oficial
// instalado en el proyecto, así que se declara mínimamente aquí.
declare const grecaptcha: {
  render(container: string | HTMLElement, params: Record<string, unknown>): number;
  reset(widgetId?: number): void;
  getResponse(widgetId?: number): string;
};

const LONGITUD_TICKET_VERIFICACION = 5;

type TipoMensaje =
  | 'bot-texto'
  | 'bot-escribiendo'
  | 'usuario-texto'
  | 'bot-opciones'
  | 'bot-preview-certificado'
  | 'bot-resultado-certificado'
  | 'bot-tickets'
  | 'bot-confirmacion-anulacion'
  | 'bot-confirmacion-reseteo'
  | 'bot-laboratorios'
  | 'bot-confirmacion-incidencia'
  | 'bot-resultado-incidencia'
  | 'bot-vehiculo-parqueadero'
  | 'bot-tipos-vehiculo'
  | 'bot-modalidades-parqueadero'
  | 'bot-confirmacion-vehiculo'
  | 'bot-ticket-parqueadero';

interface ChatMensaje {
  tipo: TipoMensaje;
  texto?: string;
  estudiante?: Estudiante;
  certificado?: CertificadoMatricula;
  qrDataUrl?: string;
  tickets?: TicketSolicitud[];
  laboratorios?: Laboratorio[];
  laboratorioSeleccionado?: Laboratorio;
  descripcionIncidencia?: string;
  fotoPreviewUrl?: string;
  incidencia?: IncidenciaLaboratorio;
  vehiculoParqueadero?: VehiculoParqueadero;
  ticketParqueadero?: TicketParqueadero;
}

type EstadoConversacion =
  | 'esperando_cedula'
  | 'consultando'
  | 'enviando_ticket'
  | 'esperando_ticket'
  | 'validando_ticket'
  | 'menu'
  | 'preview_certificado'
  | 'generando_certificado'
  | 'consultando_tickets'
  | 'confirmando_anulacion'
  | 'procesando_anulacion'
  | 'confirmando_reseteo_correo'
  | 'procesando_reseteo_correo'
  | 'seleccionando_laboratorio'
  | 'escribiendo_incidencia'
  | 'adjuntando_foto'
  | 'confirmando_incidencia'
  | 'reportando_incidencia'
  | 'consultando_parqueadero'
  | 'confirmando_vehiculo_parqueadero'
  | 'seleccionando_tipo_vehiculo'
  | 'ingresando_placa'
  | 'seleccionando_modalidad_parqueadero'
  | 'confirmando_datos_vehiculo'
  | 'generando_ticket_parqueadero'
  | 'finalizado';

const OPCIONES_MENU_ESTUDIANTE: OpcionChat[] = [
  { id: 'CERTIFICADO_MATRICULA', etiqueta: 'Solicitar Certificado de Matrícula', icono: 'document-text-outline', disponible: true },
  { id: 'TICKET_PARQUEADERO', etiqueta: 'Generar ticket de parqueadero', icono: 'car-outline', disponible: true },
  { id: 'ANULACION_MATRICULA', etiqueta: 'Solicitar Anulación de Matrícula', icono: 'close-circle-outline', disponible: true },
  { id: 'ESTADO_TICKETS', etiqueta: 'Consultar estado de mis tickets', icono: 'list-outline', disponible: true },
  { id: 'FINALIZAR_CONVERSACION', etiqueta: 'Finalizar conversación', icono: 'exit-outline', disponible: true }
];

/**
 * El rol Docente solo tiene un trámite disponible por ahora (ver
 * ARQUITECTURA.md, "Rol Docente") — no comparte los trámites de estudiante.
 */
const OPCIONES_MENU_DOCENTE: OpcionChat[] = [
  { id: 'TICKET_PARQUEADERO', etiqueta: 'Generar ticket de parqueadero', icono: 'car-outline', disponible: true },
  { id: 'REPORTAR_INCIDENCIA_LAB', etiqueta: 'Reportar incidencia en laboratorio', icono: 'alert-circle-outline', disponible: true },
  { id: 'FINALIZAR_CONVERSACION', etiqueta: 'Finalizar conversación', icono: 'exit-outline', disponible: true }
];

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: false,
})
export class ChatPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) contenido!: IonContent;

  mensajes: ChatMensaje[] = [];
  sinConexion = false;
  private listenerRed: PluginListenerHandle | null = null;

  estado: EstadoConversacion = 'esperando_cedula';
  cedulaIngresada = '';
  errorCedula = '';

  ticketIngresado = '';
  errorTicket = '';
  reenviandoTicket = false;
  private cedulaSesionPendiente = '';

  captchaToken: string | null = null;
  private recaptchaWidgetId: number | null = null;

  descripcionIncidencia = '';
  errorFoto = '';
  placaParqueadero = '';
  errorPlacaParqueadero = '';
  tipoVehiculoParqueadero: TipoVehiculoParqueadero | null = null;
  modalidadParqueadero: ModalidadParqueadero | null = null;
  private vehiculoParqueadero: VehiculoParqueadero | null = null;
  fotoSeleccionada: { base64: string; mime: string; previewUrl: string } | null = null;

  usuarioActual: Usuario | null = null;
  private laboratorioSeleccionado: Laboratorio | null = null;
  private descripcionPendiente = '';

  constructor(
    private estudianteService: EstudianteService,
    private certificadoPdfService: CertificadoPdfService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.iniciarConversacion();
    this.renderCaptcha();
    this.iniciarMonitorDeRed();
  }

  ngOnDestroy(): void {
    this.listenerRed?.remove();
  }

  /**
   * Banner persistente (no solo un aviso puntual al intentar una acción):
   * apenas el dispositivo pierde conexión, `sinConexion` se activa de
   * inmediato vía el listener de Capacitor, sin esperar a que el usuario
   * intente algo primero. Corre fuera de la zona de Angular, por eso el
   * `ngZone.run` (mismo patrón que los callbacks de reCAPTCHA).
   */
  private async iniciarMonitorDeRed(): Promise<void> {
    const estadoInicial = await Network.getStatus();
    this.sinConexion = !estadoInicial.connected;
    this.listenerRed = await Network.addListener('networkStatusChange', estado => {
      this.ngZone.run(() => { this.sinConexion = !estado.connected; });
    });
  }

  /**
   * Renderiza el widget de reCAPTCHA en el contenedor del footer. El script
   * de Google (index.html) carga de forma asíncrona, así que reintenta
   * hasta que `grecaptcha` esté disponible — el contenedor #recaptcha-cedula
   * ya existe desde el primer render porque `estado` arranca en
   * 'esperando_cedula'.
   */
  private renderCaptcha(intentos = 0): void {
    const contenedor = document.getElementById('recaptcha-cedula');
    if (typeof grecaptcha === 'undefined' || !grecaptcha.render || !contenedor) {
      if (intentos < 40) {
        setTimeout(() => this.renderCaptcha(intentos + 1), 250);
      }
      return;
    }

    this.recaptchaWidgetId = grecaptcha.render(contenedor, {
      sitekey: environment.recaptchaSiteKey,
      callback: (token: string) => this.ngZone.run(() => { this.captchaToken = token; }),
      'expired-callback': () => this.ngZone.run(() => { this.captchaToken = null; }),
      'error-callback': () => this.ngZone.run(() => { this.captchaToken = null; })
    });
  }

  /**
   * Los tokens de reCAPTCHA v2 son de un solo uso: hay que reiniciar el
   * widget después de cada intento (exitoso o no) para pedir uno nuevo.
   */
  private resetCaptcha(): void {
    this.captchaToken = null;
    if (this.recaptchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
      grecaptcha.reset(this.recaptchaWidgetId);
    }
  }

  get opcionesMenu(): OpcionChat[] {
    return this.usuarioActual?.tipoUsuario === 'DOCENTE' ? OPCIONES_MENU_DOCENTE : OPCIONES_MENU_ESTUDIANTE;
  }

  private async iniciarConversacion(): Promise<void> {
    this.mensajes = [];
    this.usuarioActual = null;
    this.cedulaIngresada = '';
    this.errorCedula = '';
    this.ticketIngresado = '';
    this.cedulaSesionPendiente = '';
    this.errorTicket = '';
    this.descripcionIncidencia = '';
    this.laboratorioSeleccionado = null;
    this.descripcionPendiente = '';
    this.placaParqueadero = '';
    this.errorPlacaParqueadero = '';
    this.tipoVehiculoParqueadero = null;
    this.modalidadParqueadero = null;
    this.vehiculoParqueadero = null;
    sessionStorage.removeItem('yavibot.chat.session');

    await this.hablar('¡Hola! 👋 Soy YaviBot, tu asistente virtual académico.');
    await this.hablar('Para ayudarte, primero necesito verificar tu identidad. Por favor ingresa tu número de cédula.');
    this.estado = 'esperando_cedula';
  }

  get puedeEnviarCedula(): boolean {
    return validarCedulaEcuatoriana(this.cedulaIngresada) && !!this.captchaToken && this.estado === 'esperando_cedula';
  }

  async enviarCedula(): Promise<void> {
    if (!this.puedeEnviarCedula) {
      this.errorCedula = !validarCedulaEcuatoriana(this.cedulaIngresada)
        ? (/^\d{10}$/.test(this.cedulaIngresada)
          ? 'Ese número de cédula no es válido. Verifica que esté bien escrito.'
          : 'Ingresa un número de cédula de 10 dígitos.')
        : 'Marca la casilla de verificación "No soy un robot" antes de continuar.';
      return;
    }
    this.errorCedula = '';

    const cedula = this.cedulaIngresada;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: cedula });
    this.cedulaIngresada = '';
    this.estado = 'consultando';

    if (!(await this.requiereConexion())) {
      this.estado = 'esperando_cedula';
      return;
    }

    this.mostrarEscribiendo();
    this.estudianteService.iniciarChatbot(cedula, this.captchaToken ?? '').subscribe({
      next: async resultado => {
        this.quitarEscribiendo();
        this.resetCaptcha();
        if (!resultado.acceso) {
          await this.hablar(resultado.mensaje ?? 'No encontramos un usuario habilitado con esa cédula.');
          this.estado = 'esperando_cedula';
          return;
        }
        this.cedulaSesionPendiente = cedula;
        await this.hablar('Te enviamos un código de 5 dígitos a tu correo institucional. Ingrésalo para continuar.');
        if (environment.usarMock && resultado.mensaje) await this.hablar(resultado.mensaje);
        this.estado = 'esperando_ticket';
      },
      error: async () => {
        this.quitarEscribiendo();
        this.resetCaptcha();
        await this.hablar('No pude iniciar la verificación. Intenta nuevamente en unos segundos.');
        this.estado = 'esperando_cedula';
      }
    });
  }
  get puedeVerificarTicket(): boolean {
    return /^\d{5}$/.test(this.ticketIngresado)
      && !!this.cedulaSesionPendiente
      && this.estado === 'esperando_ticket';
  }

  async verificarTicketIngresado(): Promise<void> {
    if (!this.puedeVerificarTicket) {
      this.errorTicket = `Ingresa el código de ${LONGITUD_TICKET_VERIFICACION} dígitos que enviamos a tu correo.`;
      return;
    }
    this.errorTicket = '';

    const ticket = this.ticketIngresado;
    const cedula = this.cedulaSesionPendiente;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: ticket });
    this.ticketIngresado = '';
    this.estado = 'validando_ticket';

    if (!(await this.requiereConexion())) {
      this.estado = 'esperando_ticket';
      return;
    }

    this.mostrarEscribiendo();
    this.estudianteService.verificarTicket(cedula, ticket).subscribe({
      next: async usuario => {
        this.quitarEscribiendo();
        if (!usuario) {
          await this.hablar('Ese código no es correcto. Verifica tu correo e inténtalo de nuevo.');
          this.estado = 'esperando_ticket';
          return;
        }

        this.usuarioActual = usuario;
        this.cedulaSesionPendiente = '';
        await this.hablar(`¡Identidad verificada! 👋 Hola ${this.nombreVisible(usuario)}, ¿qué deseas consultar hoy?`);
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        if (error.status === 429) {
          await this.hablar('Hiciste demasiados intentos con ese código. Por seguridad, vamos a solicitar uno nuevo.');
          await this.iniciarConversacion();
          return;
        }
        await this.hablar('Tuve un problema verificando el código. Intenta nuevamente en unos segundos.');
        this.estado = 'esperando_ticket';
      }
    });
  }
  /**
   * Pide un nuevo ticket sin reiniciar toda la conversación (a diferencia de
   * `enviarTicketDeVerificacion`, un fallo aquí NO debe devolver al usuario a
   * la pantalla de cédula — ya está identificado, solo necesita un código
   * nuevo). El cooldown de 60s lo aplica el backend (429); este método solo
   * evita que se pueda disparar dos veces mientras la primera sigue en vuelo.
   */
  async reenviarTicket(): Promise<void> {
    if (this.estado !== 'esperando_ticket' || !this.cedulaSesionPendiente || this.reenviandoTicket) return;
    const cedula = this.cedulaSesionPendiente;
    this.reenviandoTicket = true;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Reenviar código' });

    if (!(await this.requiereConexion())) {
      this.reenviandoTicket = false;
      return;
    }

    this.mostrarEscribiendo();
    this.estudianteService.reenviarOtpChatbot(cedula).subscribe({
      next: async () => {
        this.quitarEscribiendo();
        this.reenviandoTicket = false;
        await this.hablar('Te reenviamos un nuevo código a tu correo institucional.');
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        this.reenviandoTicket = false;
        if (error.status === 429) {
          await this.hablar('Ya te enviamos un código hace unos segundos. Espera un momento antes de pedir otro.');
        } else {
          await this.hablar('No pude reenviar el código en este momento. Intenta nuevamente en unos segundos.');
        }
      }
    });
  }
  async seleccionarOpcion(opcion: OpcionChat): Promise<void> {
    if (this.estado !== 'menu' || !this.usuarioActual) {
      return;
    }

    this.agregarMensaje({ tipo: 'usuario-texto', texto: opcion.etiqueta });

    if (!opcion.disponible) {
      await this.hablar('Esa opción todavía está en construcción 🚧, muy pronto estará disponible.');
      this.agregarMensaje({ tipo: 'bot-opciones' });
      return;
    }

    const usuario = this.usuarioActual;

    if (opcion.id === 'CERTIFICADO_MATRICULA' && this.esEstudiante(usuario)) {
      await this.hablar('Estos son tus datos. Verifícalos antes de generar tu certificado:');
      this.agregarMensaje({ tipo: 'bot-preview-certificado', estudiante: usuario });
      this.estado = 'preview_certificado';
      return;
    }

    if (opcion.id === 'TICKET_PARQUEADERO') {
      await this.iniciarFlujoParqueadero(usuario);
      return;
    }

    if (opcion.id === 'ANULACION_MATRICULA' && this.esEstudiante(usuario)) {
      await this.iniciarAnulacionMatricula(usuario);
      return;
    }

    if (opcion.id === 'RESET_CORREO' && this.esEstudiante(usuario)) {
      await this.iniciarReseteoCorreo(usuario);
      return;
    }

    if (opcion.id === 'ESTADO_TICKETS' && this.esEstudiante(usuario)) {
      await this.consultarEstadoTickets(usuario);
      return;
    }

    if (opcion.id === 'REPORTAR_INCIDENCIA_LAB') {
      await this.iniciarReporteIncidencia();
      return;
    }

    if (opcion.id === 'FINALIZAR_CONVERSACION') {
      await this.finalizarConversacion();
      return;
    }
  }

  private async iniciarFlujoParqueadero(usuario: Usuario): Promise<void> {
    this.estado = 'consultando_parqueadero';
    if (!(await this.requiereConexion())) { this.volverAlMenu(); return; }
    this.mostrarEscribiendo();
    this.estudianteService.consultarEstadoParqueadero(usuario.cedula).subscribe({
      next: async resultado => {
        this.quitarEscribiendo();
        if (resultado.ticket?.estado === 'PENDIENTE' || resultado.ticket?.estado === 'APROBADO') {
          await this.mostrarTicketParqueadero(resultado.ticket);
          return;
        }
        if (resultado.ticket?.estado === 'RECHAZADO') {
          await this.hablar(`La solicitud ${resultado.ticket.codigo} fue rechazada.${resultado.ticket.motivoRechazo ? ` Motivo: ${resultado.ticket.motivoRechazo}` : ''}`);
          this.agregarMensaje({ tipo: 'bot-ticket-parqueadero', ticketParqueadero: resultado.ticket });
        }
        if (resultado.vehiculo) {
          this.vehiculoParqueadero = resultado.vehiculo;
          this.tipoVehiculoParqueadero = resultado.vehiculo.tipo;
          this.placaParqueadero = resultado.vehiculo.placa;
          await this.hablar(`Tenemos registrado a tu nombre el vehículo con placa ${resultado.vehiculo.placa}. ¿Deseas generar el ticket para este vehículo?`);
          this.agregarMensaje({ tipo: 'bot-vehiculo-parqueadero', vehiculoParqueadero: resultado.vehiculo });
          this.estado = 'confirmando_vehiculo_parqueadero';
          return;
        }
        await this.solicitarTipoVehiculo(false);
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        if (error.status === 401 || error.status === 403) { await this.manejarSesionExpirada(); return; }
        await this.hablar('No pude consultar tu información de parqueadero. Intenta nuevamente en unos segundos.');
        this.volverAlMenu();
      }
    });
  }

  async confirmarVehiculoRegistrado(): Promise<void> {
    if (this.estado !== 'confirmando_vehiculo_parqueadero' || !this.vehiculoParqueadero) return;
    this.tipoVehiculoParqueadero = this.vehiculoParqueadero.tipo;
    this.placaParqueadero = this.vehiculoParqueadero.placa;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Sí, confirmar vehículo' });
    await this.solicitarModalidadParqueadero();
  }

  async solicitarTipoVehiculo(mostrarEleccion = true): Promise<void> {
    if (mostrarEleccion) this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Registrar / Usar otro vehículo' });
    this.vehiculoParqueadero = null;
    this.tipoVehiculoParqueadero = null;
    this.modalidadParqueadero = null;
    this.placaParqueadero = '';
    await this.hablar('Por favor, selecciona el tipo de vehículo:');
    this.agregarMensaje({ tipo: 'bot-tipos-vehiculo' });
    this.estado = 'seleccionando_tipo_vehiculo';
  }

  async seleccionarTipoVehiculo(tipo: TipoVehiculoParqueadero): Promise<void> {
    if (this.estado !== 'seleccionando_tipo_vehiculo') return;
    this.tipoVehiculoParqueadero = tipo;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: tipo === 'AUTO' ? 'Automóvil' : 'Motocicleta' });
    await this.hablar('Ingresa el número de placa de tu vehículo:');
    this.estado = 'ingresando_placa';
  }

  get puedeEnviarPlaca(): boolean {
    const compacta = this.placaParqueadero.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    return this.estado === 'ingresando_placa' && /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{5,8}$/.test(compacta);
  }

  async enviarPlacaParqueadero(): Promise<void> {
    const compacta = this.placaParqueadero.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    if (!this.puedeEnviarPlaca || !this.tipoVehiculoParqueadero) {
      this.errorPlacaParqueadero = 'Ingresa una placa válida, por ejemplo PBW-4567.';
      return;
    }
    this.errorPlacaParqueadero = '';
    this.placaParqueadero = /^[A-Z]{3}[0-9]{3,4}$/.test(compacta)
      ? `${compacta.slice(0, 3)}-${compacta.slice(3)}` : compacta;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: this.placaParqueadero });
    await this.solicitarModalidadParqueadero();
  }

  private async solicitarModalidadParqueadero(): Promise<void> {
    this.modalidadParqueadero = null;
    await this.hablar('Selecciona la modalidad del ticket de parqueadero:');
    this.agregarMensaje({ tipo: 'bot-modalidades-parqueadero' });
    this.estado = 'seleccionando_modalidad_parqueadero';
  }

  async seleccionarModalidadParqueadero(modalidad: ModalidadParqueadero): Promise<void> {
    if (this.estado !== 'seleccionando_modalidad_parqueadero' || !this.tipoVehiculoParqueadero) return;
    this.modalidadParqueadero = modalidad;
    const modalidadEtiqueta = modalidad === 'MENSUAL' ? 'Mensual' : 'Diaria';
    const tipoEtiqueta = this.tipoVehiculoParqueadero === 'MOTO' ? 'Motocicleta' : 'Automóvil';
    this.agregarMensaje({ tipo: 'usuario-texto', texto: modalidadEtiqueta });
    await this.hablar(`Confirmación: Tipo: ${tipoEtiqueta} | Placa: ${this.placaParqueadero} | Modalidad: ${modalidadEtiqueta}. ¿La información es correcta?`);
    this.agregarMensaje({ tipo: 'bot-confirmacion-vehiculo' });
    this.estado = 'confirmando_datos_vehiculo';
  }

  async confirmarDatosVehiculo(): Promise<void> {
    if (this.estado !== 'confirmando_datos_vehiculo' || !this.tipoVehiculoParqueadero || !this.modalidadParqueadero) return;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Confirmar y generar ticket' });
    await this.generarSolicitudParqueadero(this.placaParqueadero, this.tipoVehiculoParqueadero, this.modalidadParqueadero);
  }

  async corregirDatosVehiculo(): Promise<void> {
    if (this.estado !== 'confirmando_datos_vehiculo') return;
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Corregir datos' });
    await this.solicitarTipoVehiculo(false);
  }

  private async generarSolicitudParqueadero(
    placa: string,
    tipo: TipoVehiculoParqueadero,
    modalidad: ModalidadParqueadero
  ): Promise<void> {
    if (!this.usuarioActual) return;
    this.estado = 'generando_ticket_parqueadero';
    if (!(await this.requiereConexion())) { await this.solicitarTipoVehiculo(false); return; }
    this.mostrarEscribiendo();
    this.estudianteService.solicitarTicketParqueadero(this.usuarioActual.cedula, placa, tipo, modalidad).subscribe({
      next: async ticket => {
        this.quitarEscribiendo();
        await this.mostrarTicketParqueadero(ticket);
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        if (error.status === 401 || error.status === 403) { await this.manejarSesionExpirada(); return; }
        await this.hablar(error.error?.error?.message ?? error.error?.error ?? error.message ?? 'No pude registrar la solicitud de parqueadero. Intenta nuevamente.');
        this.volverAlMenu();
      }
    });
  }

  private async mostrarTicketParqueadero(ticket: TicketParqueadero): Promise<void> {
    if (ticket.estado === 'APROBADO') {
      await this.hablar('Tu ticket de parqueadero se encuentra activo.');
    } else if (ticket.estado === 'RECHAZADO') {
      await this.hablar('Tu solicitud de parqueadero fue rechazada.');
    } else {
      await this.hablar('Tu solicitud ha sido registrada correctamente. Acércate o contacta a Administración para solicitar la aprobación de tu ticket.');
    }
    this.agregarMensaje({ tipo: 'bot-ticket-parqueadero', ticketParqueadero: ticket });
    this.estado = 'menu';
  }

  async descargarTicketParqueadero(ticket: TicketParqueadero): Promise<void> {
    if (ticket.estado !== 'APROBADO' || !(await this.requiereConexion())) return;
    try {
      const descarga = await firstValueFrom(this.estudianteService.descargarTicketParqueadero(ticket.id));
      if (!Capacitor.isNativePlatform()) {
        const bytes = Uint8Array.from(atob(descarga.contenidoBase64), caracter => caracter.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = descarga.nombreArchivo;
        enlace.click();
        URL.revokeObjectURL(url);
        return;
      }
      const archivo = await Filesystem.writeFile({
        path: descarga.nombreArchivo,
        data: descarga.contenidoBase64,
        directory: Directory.Cache
      });
      await Share.share({ title: 'Ticket de parqueadero', url: archivo.uri, dialogTitle: 'Guardar o compartir ticket' });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No fue posible descargar el ticket.';
      await this.hablar(mensaje);
    }
  }

  formatearFechaTicket(fecha: string | null | undefined): string {
    if (!fecha) return 'Pendiente de aprobación';
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : '';
  }
  private esEstudiante(usuario: Usuario): usuario is Estudiante {
    return usuario.tipoUsuario === 'ESTUDIANTE';
  }

  private nombreVisible(usuario: Usuario): string {
    return this.esEstudiante(usuario) ? `${usuario.nombres} ${usuario.apellidos}`.trim() : usuario.nombres;
  }

  private async iniciarAnulacionMatricula(estudiante: Estudiante): Promise<void> {
    await this.hablar(
      `⚠️ Estás solicitando la anulación de tu matrícula del periodo ${estudiante.periodoActual}. ` +
      `Esta acción implica la cancelación de tu inscripción en todos los cursos del periodo actual.`
    );
    await this.hablar('Por favor confirma los datos de tu solicitud antes de continuar:');
    this.agregarMensaje({ tipo: 'bot-confirmacion-anulacion', estudiante });
    this.estado = 'confirmando_anulacion';
  }

  async confirmarAnulacion(): Promise<void> {
    if (this.estado !== 'confirmando_anulacion' || !this.usuarioActual) {
      return;
    }

    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Confirmar solicitud de anulación' });
    this.estado = 'procesando_anulacion';

    if (!(await this.requiereConexion())) {
      this.agregarMensaje({ tipo: 'bot-opciones' });
      this.estado = 'menu';
      return;
    }

    this.mostrarEscribiendo();
    this.estudianteService.crearTicketSolicitud(this.usuarioActual.cedula, 'ANULACION_MATRICULA').subscribe({
      next: async ticket => {
        this.quitarEscribiendo();
        await this.hablar(
          `✅ Tu solicitud de anulación ha sido registrada exitosamente con el número de ticket ` +
          `<strong>${ticket.id}</strong>.`
        );
        await this.hablar(
          `📧 Recibirás una confirmación en tu correo institucional ` +
          `(${this.usuarioActual?.correoInstitucional}). ` +
          `El personal de Secretaría procesará tu solicitud en un plazo de 3 a 5 días hábiles.`
        );
        await this.hablar('¿Deseas hacer algo más?');
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        if (error.status === 403) {
          await this.manejarSesionExpirada();
          return;
        }
        await this.hablar('No pude registrar tu solicitud en este momento. Intenta nuevamente en unos segundos, o elige otra opción.');
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      }
    });
  }

  async cancelarAnulacion(): Promise<void> {
    if (this.estado !== 'confirmando_anulacion') {
      return;
    }
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Cancelar' });
    await this.hablar('Solicitud cancelada. ¿En qué más puedo ayudarte?');
    this.agregarMensaje({ tipo: 'bot-opciones' });
    this.estado = 'menu';
  }

  private async iniciarReseteoCorreo(estudiante: Estudiante): Promise<void> {
    await this.hablar(
      `Vas a resetear la contraseña de tu correo institucional ` +
      `(${estudiante.correoInstitucional}). Se generará una nueva contraseña temporal ` +
      `de inmediato y te la enviaremos a ese mismo correo.`
    );
    this.agregarMensaje({ tipo: 'bot-confirmacion-reseteo', estudiante });
    this.estado = 'confirmando_reseteo_correo';
  }

  async confirmarReseteoCorreo(): Promise<void> {
    if (this.estado !== 'confirmando_reseteo_correo' || !this.usuarioActual) {
      return;
    }

    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Confirmar reseteo de contraseña' });
    this.estado = 'procesando_reseteo_correo';

    if (!(await this.requiereConexion())) {
      this.agregarMensaje({ tipo: 'bot-opciones' });
      this.estado = 'menu';
      return;
    }

    this.mostrarEscribiendo();
    this.estudianteService.resetearContrasenaCorreo(this.usuarioActual.cedula).subscribe({
      next: async resultado => {
        this.quitarEscribiendo();
        await this.hablar(`✅ ${resultado.mensaje}`);
        await this.hablar('¿Deseas hacer algo más?');
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        if (error.status === 403) {
          await this.manejarSesionExpirada();
          return;
        }
        await this.hablar('No pude completar el reseteo en este momento. Intenta nuevamente en unos segundos, o elige otra opción.');
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      }
    });
  }

  async cancelarReseteoCorreo(): Promise<void> {
    if (this.estado !== 'confirmando_reseteo_correo') {
      return;
    }
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Cancelar' });
    await this.hablar('Solicitud cancelada. ¿En qué más puedo ayudarte?');
    this.agregarMensaje({ tipo: 'bot-opciones' });
    this.estado = 'menu';
  }

  private async consultarEstadoTickets(estudiante: Estudiante): Promise<void> {
    this.estado = 'consultando_tickets';

    if (!(await this.requiereConexion())) {
      this.estado = 'menu';
      return;
    }

    this.mostrarEscribiendo();
    this.estudianteService.consultarTicketsSolicitud(estudiante.cedula).subscribe({
      next: async tickets => {
        this.quitarEscribiendo();
        if (tickets.length === 0) {
          await this.hablar('No tienes tickets registrados todavía.');
        } else {
          await this.hablar('Este es el seguimiento de tus tickets:');
          this.agregarMensaje({ tipo: 'bot-tickets', tickets });
        }
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        if (error.status === 403) {
          await this.manejarSesionExpirada();
          return;
        }
        await this.hablar('No pude consultar tus tickets en este momento. Intenta nuevamente en unos segundos.');
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      }
    });
  }

  private async finalizarConversacion(): Promise<void> {
    await this.hablar('¡Gracias por usar YaviBot! Que tengas un excelente día 👋');
    this.estado = 'finalizado';
  }

  async generarCertificado(): Promise<void> {
    if (this.estado !== 'preview_certificado' || !this.usuarioActual) {
      return;
    }

    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Generar certificado de matrícula' });
    this.estado = 'generando_certificado';

    if (!(await this.requiereConexion())) {
      this.agregarMensaje({ tipo: 'bot-opciones' });
      this.estado = 'menu';
      return;
    }

    this.mostrarEscribiendo();

    this.estudianteService.generarCertificadoMatricula(this.usuarioActual.cedula).subscribe({
      next: async certificado => {
        this.quitarEscribiendo();
        const qrDataUrl = await QRCode.toDataURL(certificado.urlVerificacion, {
          margin: 1,
          width: 260
        });

        await this.hablar('¡Listo! Tu certificado de matrícula ha sido generado exitosamente. 🎓');
        this.agregarMensaje({ tipo: 'bot-resultado-certificado', certificado, qrDataUrl });

        try {
          const pdfBlob = await this.certificadoPdfService.generarPdf(certificado, qrDataUrl);
          const pdfBase64 = await this.blobABase64(pdfBlob);
          await firstValueFrom(
            this.estudianteService.enviarCertificadoPdf(certificado.cedula, certificado.codigoUnico, pdfBase64)
          );
          await this.hablar(
            `📧 El certificado en formato PDF ha sido enviado a tu correo institucional ` +
            `(${this.usuarioActual?.correoInstitucional ?? 'correo institucional'}). ` +
            `Revisa tu bandeja de entrada.`
          );
        } catch {
          await this.hablar('⚠️ Generé tu certificado, pero no pude enviarlo por correo en este momento. Puedes intentarlo nuevamente más tarde.');
        }

        await this.hablar('Este QR es único e irrepetible: podrá verificarse en el sistema web con este mismo código. ¿Deseas algo más?');
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      },
      error: async (error: HttpErrorResponse) => {
        this.quitarEscribiendo();
        if (error.status === 403) {
          await this.manejarSesionExpirada();
          return;
        }
        if (error.status === 400) {
          await this.hablar(
            error.error?.error ?? 'No puedes generar el certificado: no apareces matriculado en el periodo actual.'
          );
        } else {
          await this.hablar('No pude generar el certificado en este momento. Intenta nuevamente en unos segundos, o elige otra opción.');
        }
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      }
    });
  }

  private blobABase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onloadend = () => {
        const resultado = lector.result as string;
        resolve(resultado.split(',')[1]);
      };
      lector.onerror = () => reject(lector.error);
      lector.readAsDataURL(blob);
    });
  }

  // ── Rol Docente: reportar incidencia de laboratorio ──────────────────────

  private async iniciarReporteIncidencia(): Promise<void> {
    this.estado = 'seleccionando_laboratorio';

    if (!(await this.requiereConexion())) {
      this.agregarMensaje({ tipo: 'bot-opciones' });
      this.estado = 'menu';
      return;
    }

    this.mostrarEscribiendo();
    this.estudianteService.consultarLaboratorios().subscribe({
      next: async laboratorios => {
        this.quitarEscribiendo();
        await this.hablar('¿En qué laboratorio ocurrió la incidencia?');
        this.agregarMensaje({ tipo: 'bot-laboratorios', laboratorios });
      },
      error: async () => {
        this.quitarEscribiendo();
        await this.hablar('No pude cargar la lista de laboratorios. Intenta nuevamente en unos segundos.');
        this.agregarMensaje({ tipo: 'bot-opciones' });
        this.estado = 'menu';
      }
    });
  }

  async seleccionarLaboratorio(laboratorio: Laboratorio): Promise<void> {
    if (this.estado !== 'seleccionando_laboratorio') {
      return;
    }
    this.agregarMensaje({ tipo: 'usuario-texto', texto: laboratorio.nombre });
    this.laboratorioSeleccionado = laboratorio;
    await this.hablar('Describe brevemente qué ocurrió (equipo afectado, hora aproximada, etc.):');
    this.estado = 'escribiendo_incidencia';
  }

  get puedeEnviarDescripcionIncidencia(): boolean {
    return this.descripcionIncidencia.trim().length >= 10 && this.estado === 'escribiendo_incidencia';
  }

  async enviarDescripcionIncidencia(): Promise<void> {
    if (!this.puedeEnviarDescripcionIncidencia || !this.laboratorioSeleccionado) {
      return;
    }
    const descripcion = this.descripcionIncidencia.trim();
    this.descripcionPendiente = descripcion;
    this.descripcionIncidencia = '';
    this.agregarMensaje({ tipo: 'usuario-texto', texto: descripcion });

    await this.hablar('¿Quieres adjuntar una foto de la incidencia? Es opcional.');
    this.errorFoto = '';
    this.estado = 'adjuntando_foto';
  }

  async onFotoSeleccionada(event: Event): Promise<void> {
    if (this.estado !== 'adjuntando_foto') {
      return;
    }
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) {
      return;
    }

    if (archivo.type !== 'image/jpeg' && archivo.type !== 'image/png') {
      this.errorFoto = 'Solo se aceptan fotos en formato JPG o PNG.';
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      this.errorFoto = 'La foto no puede pesar más de 5MB.';
      return;
    }
    this.errorFoto = '';

    let base64: string;
    try {
      base64 = await this.blobABase64(archivo);
    } catch {
      this.errorFoto = 'No se pudo leer la foto. Intenta con otra o continúa sin foto.';
      return;
    }
    this.fotoSeleccionada = { base64, mime: archivo.type, previewUrl: `data:${archivo.type};base64,${base64}` };
    this.agregarMensaje({ tipo: 'usuario-texto', texto: '📷 Foto adjuntada' });
    await this.mostrarConfirmacionIncidencia();
  }

  async continuarSinFoto(): Promise<void> {
    if (this.estado !== 'adjuntando_foto') {
      return;
    }
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Continuar sin foto' });
    await this.mostrarConfirmacionIncidencia();
  }

  private async mostrarConfirmacionIncidencia(): Promise<void> {
    if (!this.laboratorioSeleccionado) {
      return;
    }
    await this.hablar('Revisa los datos antes de enviar el reporte:');
    this.agregarMensaje({
      tipo: 'bot-confirmacion-incidencia',
      laboratorioSeleccionado: this.laboratorioSeleccionado,
      descripcionIncidencia: this.descripcionPendiente,
      fotoPreviewUrl: this.fotoSeleccionada?.previewUrl
    });
    this.estado = 'confirmando_incidencia';
  }

  async confirmarReporteIncidencia(): Promise<void> {
    if (this.estado !== 'confirmando_incidencia' || !this.usuarioActual || !this.laboratorioSeleccionado) {
      return;
    }

    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Confirmar reporte' });
    this.estado = 'reportando_incidencia';

    if (!(await this.requiereConexion())) {
      this.agregarMensaje({ tipo: 'bot-opciones' });
      this.estado = 'menu';
      return;
    }

    this.mostrarEscribiendo();
    const foto = this.fotoSeleccionada ? { base64: this.fotoSeleccionada.base64, mime: this.fotoSeleccionada.mime } : undefined;
    this.estudianteService
      .reportarIncidenciaLaboratorio(this.usuarioActual.cedula, this.laboratorioSeleccionado.codigo, this.descripcionPendiente, foto)
      .subscribe({
        next: async incidencia => {
          this.quitarEscribiendo();
          this.laboratorioSeleccionado = null;
          this.fotoSeleccionada = null;
          this.descripcionPendiente = '';
          await this.hablar('✅ Tu reporte fue registrado correctamente.');
          this.agregarMensaje({ tipo: 'bot-resultado-incidencia', incidencia });
          await this.hablar('El equipo de laboratorios revisará la incidencia. ¿Deseas hacer algo más?');
          this.agregarMensaje({ tipo: 'bot-opciones' });
          this.estado = 'menu';
        },
        error: async (error: HttpErrorResponse) => {
          this.quitarEscribiendo();
          if (error.status === 403) {
            await this.manejarSesionExpirada();
            return;
          }
          await this.hablar('No pude registrar tu reporte en este momento. Intenta nuevamente en unos segundos, o elige otra opción.');
          this.agregarMensaje({ tipo: 'bot-opciones' });
          this.estado = 'menu';
        }
      });
  }

  async cancelarReporteIncidencia(): Promise<void> {
    if (this.estado !== 'confirmando_incidencia') {
      return;
    }
    this.agregarMensaje({ tipo: 'usuario-texto', texto: 'Cancelar' });
    this.laboratorioSeleccionado = null;
    this.descripcionPendiente = '';
    this.fotoSeleccionada = null;
    this.errorFoto = '';
    await this.hablar('Reporte cancelado. ¿En qué más puedo ayudarte?');
    this.agregarMensaje({ tipo: 'bot-opciones' });
    this.estado = 'menu';
  }

  // ── Comunes ────────────────────────────────────────────────────────────

  nuevaConsulta(): void {
    this.iniciarConversacion();
  }

  volverAlMenu(): void {
    if (!this.usuarioActual) {
      return;
    }
    this.agregarMensaje({ tipo: 'bot-opciones' });
    this.estado = 'menu';
  }

  /**
   * El backend exige una verificación OTP reciente (últimos 20 min) antes de
   * ejecutar acciones sensibles; si expiró, responde 403. En vez de dejar al
   * usuario en un bucle de "intenta de nuevo" que va a seguir fallando hasta
   * que vuelva a verificarse, se reinicia la conversación directamente para
   * que repita cédula + ticket con una sesión nueva.
   */
  private async manejarSesionExpirada(): Promise<void> {
    await this.hablar('🔒 Por seguridad, tu verificación anterior ya expiró. Vamos a comenzar de nuevo para confirmar tu identidad.');
    await this.iniciarConversacion();
  }

  /**
   * Verifica conexión antes de una llamada de red. Si no hay conexión,
   * avisa en el chat y devuelve false para que el llamador cancele la acción.
   */
  private async requiereConexion(): Promise<boolean> {
    const estadoRed = await Network.getStatus();
    if (estadoRed.connected) {
      return true;
    }
    await this.hablar('📡 No tienes conexión a internet en este momento. Verifica tu conexión e inténtalo de nuevo.');
    return false;
  }

  private mostrarEscribiendo(): void {
    this.agregarMensaje({ tipo: 'bot-escribiendo' });
  }

  private quitarEscribiendo(): void {
    this.mensajes = this.mensajes.filter(m => m.tipo !== 'bot-escribiendo');
  }

  private async hablar(texto: string, tiempoEscribiendo = 700): Promise<void> {
    this.mostrarEscribiendo();
    await this.esperar(tiempoEscribiendo);
    this.quitarEscribiendo();
    this.agregarMensaje({ tipo: 'bot-texto', texto });
  }

  private agregarMensaje(mensaje: ChatMensaje): void {
    this.mensajes = [...this.mensajes, mensaje];
    this.scrollAlFinal();
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private scrollAlFinal(): void {
    setTimeout(() => {
      this.contenido?.scrollToBottom(200);
    }, 50);
  }
}
