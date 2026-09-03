# 06 — Frontend Angular

## 6.1 Sistema de diseño (extraído del Figma)

### Tokens de color
```scss
// _tokens.scss
$navy-900: #002559;  // paneles laterales, sidebar
$navy-700: #003883;  // botón primario, header de tabla
$navy-600: #003D8E;
$gold-500: #FFC107;  // acento AQUÍ, logo, nav activo, robot
$gold-400: #FFBF00;
$cream-bg: #F4F0E6;  // fondo del chatbot
$panel-bg: #F6F8FB;  // fondo del panel web
$surface:  #FFFFFF;
$text-900: #1F2A37;
$text-500: #6B7280;
// estados
$danger:   #DB3444;  // Alta / Rechazar (Rechazar NO se usa por decisión de alcance)
$warning:  #FFB954;  // Media
$success:  #2FA84F;  // Baja / Resuelto
$info:     #2E9BE6;  // En proceso
$pending:  #F5C518;  // Pendiente
```
> Prioridad (Alta/Media/Baja) y estado Rechazado quedan **fuera de alcance** por decisión; sus colores se documentan solo por trazabilidad del Figma.

### Componentes base (Angular Material + custom)
- Card con `border-radius: 16px` y sombra suave.
- Layout split (navy izquierda / claro derecha) para landing chatbot y login.
- Sidebar navy con nav activo resaltado en `$gold-500`.
- Pills de estado (Pendiente/En Proceso/Resuelto).
- Botón primario navy; secundarios verde (Resolver) y navy (Guardar).
- Tipografía: familia sans-serif (Inter/Roboto), pesos 400/600/700.

### Pantallas
| Pantalla | Origen | Estado diseño |
|----------|--------|---------------|
| Landing + Chatbot | Figma p1 | ✅ definido |
| Login Panel | Figma p2 | ✅ definido |
| Dashboard tickets | Figma p3 | ✅ definido |
| Detalle de ticket | Figma p4 | ✅ definido |
| Ingreso OTP (chat) | derivado | 🟡 a validar |
| Menú del chatbot | derivado | 🟡 a validar |
| Módulo Alertas (crear/listar) | derivado | 🟡 a validar |
| Configuración responsables | derivado | 🟡 a validar |
| Dashboard estadísticas | derivado | 🟡 a validar |
| Recuperación de contraseña | derivado | 🟡 a validar |
| Verificación pública de QR | derivado | 🟡 a validar |

## 6.2 Estructura de carpetas (Clean Architecture + Angular)

```
src/app/
├── core/                        # singleton: se importa una vez
│   ├── config/                  # environment, endpoints n8n, tokens de config
│   ├── http/                    # ApiService (HttpClient wrapper), sobre estándar
│   ├── auth/                    # AuthService (JWT panel), ChatSessionService (OTP)
│   ├── guards/                  # authGuard, roleGuard, chatSessionGuard
│   ├── interceptors/            # authInterceptor, errorInterceptor
│   └── models/                  # interfaces de dominio (Ticket, Estudiante, Alerta...)
├── shared/                      # reutilizable, sin estado
│   ├── ui/                      # StatusPill, StatCard, DataTable, Card, SplitLayout
│   ├── design-system/           # _tokens.scss, tema Material, tipografía
│   ├── pipes/  directives/
├── features/
│   ├── chatbot/                 # conversación, OTP, menú, certificado, tickets
│   │   ├── data/                #   chatbot-api.service (llama webhooks)
│   │   ├── domain/              #   casos de uso / lógica de presentación
│   │   └── ui/                  #   componentes de pantalla
│   ├── auth-panel/              # login, recuperación
│   ├── tickets/                 # bandeja, detalle, respuesta (Coordinador/Vinculación)
│   ├── alertas/                 # crear (profesor), bandeja (laboratorios)
│   ├── config/                  # responsables
│   ├── dashboard/               # estadísticas
│   └── verificar-qr/            # página pública
└── app.routes.ts                # lazy loading por feature
```

Principios aplicados:
- **SOLID/SRP:** cada servicio una responsabilidad; `*-api.service` solo I/O, casos de uso la lógica de presentación.
- **DRY:** componentes `shared/ui` reutilizados (StatusPill, StatCard, DataTable).
- **KISS:** sin estado global complejo innecesario; RxJS + signals para reactividad.
- **Desacoplamiento:** los feature-modules dependen de `core` (abstracción), no de detalles de n8n.
- Lazy loading por ruta; `OnPush` change detection; tipado estricto TS.

## 6.3 Interacción del chatbot (decisión de diseño)
Híbrido **quick-replies + texto**: el menú (opciones 1–6) se presenta como botones de respuesta rápida sobre el input de texto del Figma. Evita NLP innecesario, respeta el diseño y el flujo del prompt.

## 6.4 Ruteo (resumen)
```
/                         → landing + chatbot (público)
/verificar/:id            → verificación pública de certificado
/panel/login              → login
/panel/recuperar          → recuperación
/panel/tickets            → bandeja (authGuard + roleGuard [COORDINADOR, RESP_VINCULACION])
/panel/tickets/:id        → detalle
/panel/alertas            → alertas (roleGuard [PROFESOR, RESP_LABORATORIOS])
/panel/config             → configuración (permiso config.responsables)
/panel/dashboard          → estadísticas
```
