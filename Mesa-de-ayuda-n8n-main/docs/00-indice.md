# YaviBot — Diseño del Sistema (Fase 1: Análisis y Arquitectura)

**Proyecto:** YaviBot — Mesa de Ayuda Inteligente
**Institución:** Instituto Superior Tecnológico Yavirac
**Arquitectura decidida:** n8n puro (`Angular → Webhooks n8n → PostgreSQL`), Orientada a Eventos (EDA)
**Estado:** Diseño para aprobación. **Aún no se ha desarrollado código de aplicación.**

> Regla del proyecto: no se escribe código de la aplicación hasta que esta Fase 1 sea aprobada.

## Índice de entregables

| # | Documento | Contenido |
|---|-----------|-----------|
| 01 | [Análisis de requerimientos](01-analisis-requerimientos.md) | Actores, casos de uso, RF, RNF, reglas de negocio |
| 02 | [Arquitectura EDA](02-arquitectura.md) | Diagramas de contexto, arquitectura, componentes, despliegue, catálogo de eventos, integración Angular/n8n/PostgreSQL |
| 03 | [Modelo de datos](03-modelo-datos.md) | MER, modelo relacional, diccionario de datos, DDL PostgreSQL |
| 04 | [Workflows de n8n](04-workflows-n8n.md) | Diseño de cada workflow de automatización |
| 05 | [Seguridad](05-seguridad.md) | JWT, OTP, bcrypt, RBAC, validaciones, auditoría |
| 06 | [Frontend Angular](06-frontend-angular.md) | Sistema de diseño, estructura de carpetas, pantallas |
| 07 | [Contratos de API (Webhooks)](07-apis-webhooks.md) | Endpoints, request/response, códigos |
| 08 | [Manejo de errores](08-manejo-errores.md) | Estrategia de errores y excepciones |
| 09 | [Plan de pruebas](09-plan-pruebas.md) | Unitarias, integración, aceptación |

## Decisiones de arquitectura tomadas

1. **Backend = n8n puro.** No se desarrolla un backend tradicional. Angular consume webhooks de n8n; n8n orquesta la lógica y accede a PostgreSQL.
2. **Alcance = estricto al prompt.** Sin campo "Prioridad", sin estado "Rechazado", sin rol "Administrador/Secretaría" (extras vistos en Figma que no están en el prompt).
3. **Pantallas sin diseño Figma** (OTP, menú, alertas, configuración, estadísticas, verificación QR) se derivan del sistema de diseño extraído de las 4 pantallas existentes y se validan por módulo.

## Puntos abiertos (requieren confirmación)

- **PA-1:** El prompt exige "Configuración de responsables" e "Importación de Excel" pero no define un rol administrador. Propuesta: importación como workflow n8n disparado manualmente; configuración de responsables accesible al Coordinador/autoridad designada. Confirmar propietario.
- **PA-2:** Generación de PDF+QR en n8n puro requiere un nodo/servicio de render. Propuesta en doc 04. Confirmar disponibilidad de nodos community o microservicio de render.
- **PA-3:** OTP de 5 dígitos (menor entropía que 6). Se mantiene por requisito, compensado con expiración corta + bloqueo.
