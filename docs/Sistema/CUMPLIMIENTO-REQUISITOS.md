# Cumplimiento de requisitos: Perfil y Proyecto de Grado

Revisión del 20 de octubre de 2026. Se contrastó el software con `Perfil de grado_Acha David.docx` y `Proyecto_Grado_David_Acha.docx`: objetivos, alcance, reglas RG, requerimientos RF y RNF, casos de uso, endpoints de la Tabla 3.20, diccionario de datos, plan de pruebas y lista de verificación del Apéndice 10. Los objetivos, el alcance y los límites coinciden en ambos documentos. El Proyecto es la especificación detallada.

**Estado:** los 30 requerimientos funcionales y las reglas RG-01 a RG-10 tienen implementación verificable. Lo que faltaba o no coincidía con el documento se implementó en esta revisión y se marca con ➕. Lo que solo puede comprobarse con personas, dispositivos o el sitio publicado aparece al final, en «Pendiente de ejecución».

## Evidencia automatizada

| Suite | Resultado | Qué cubre |
| --- | --- | --- |
| `backend: npm test` | 65 aprobadas (2 de integración se omiten sin base local) | Validación de archivos, detalles, búsqueda, roles, IA, planes y configuración |
| `backend: npm run test:integration` | 19 aprobadas en MySQL 8.4 local | PS-11, PF-19, RF-03, RF-07, CU-06, RF-18, RF-23, RF-25, RF-27 a RF-29, RF-30 y cupos de IA |
| `frontend: npm test` y `typecheck` | 15 aprobadas, tipos correctos | Contraste, URL de la API, accesos de IA y assets web |
| `verify-ui.cjs` | 63 comprobaciones sin desbordamiento | 320, 390, 768 y 1440 px; horizontal; zoom 200 %; texto 200 % |
| `verify-ai.cjs` | Sin errores | Selección explícita, cupos, aislamiento por perfil y consentimiento |
| Restauración (PI-08) | Filas, documentos y relaciones idénticos | `db:backup` → `db:restore` en una base aislada |
| CSP de producción | Sin violaciones | Recorrido de 13 pantallas con la política del `web.config` |

## Requerimientos funcionales

| ID | Requisito | Implementación | Evidencia |
| --- | --- | --- | --- |
| RF-01 | Crear cuenta | `POST /auth/register` y pantalla Crear cuenta, con requisitos de contraseña visibles | `verify-ui`, integración |
| RF-02 | Iniciar sesión | `POST /auth/login` con mensaje genérico; cuenta inactiva rechazada | PF-01, PF-02 |
| RF-03 ➕ | Recuperar acceso | `POST /auth/recover` y `POST /auth/reset`: token de un solo uso con hash que vence en 30 minutos, respuesta que no revela cuentas y cierre de todas las sesiones. Pantallas «¿Olvidaste tu contraseña?» y «Nueva contraseña», con enlace web y código para el celular | Integración RF-03 |
| RF-04 ➕ | Cerrar sesión | La sesión se revoca y su token de acceso deja de valer de inmediato (`sid` validado en cada solicitud) | PF-19 |
| RF-05 | Gestionar perfil propio | `PATCH /profiles/:id` con auditoría | PF-03 |
| RF-06 | Crear perfil dependiente | `POST /profiles`; el perfil queda asociado al representante | PF-04 |
| RF-07 ➕ | Gestionar autorización | Tabla `profile_authorizations` con rol (`REPRESENTATIVE` o `VIEWER`) y estado (`ACTIVE` o `REVOKED`), única por usuario y perfil. Pantalla «Personas autorizadas» y endpoints `…/authorizations` (solo el titular) | Integración RF-07 |
| RF-08 | Cambiar perfil activo | Selector de persona; también lista los perfiles compartidos con su rol | PF-20, `verify-ui` |
| RF-09 | Registrar evento | Formulario guiado por tipo, en transacción con versión | PF-05 |
| RF-10 | Editar evento con trazabilidad | `health_event_versions` e «historial de cambios» | Auditoría |
| RF-11 | Consultar evento | Detalle con documentos y registros vinculados | Recorrido de pantallas |
| RF-12 a RF-17 | Antecedentes, alergias, medicamentos, vacunas, procedimientos y laboratorio | Tablas de detalle por tipo. ➕ Validación de fechas reales, valores numéricos, categorías, longitudes y orden inicio/fin | CU-06, PF-06 a PF-08 |
| RF-18 ➕ | Vincular registros | `health_event_links` y `POST/DELETE …/events/:id/links`; `PATCH …/documents/:id` para vincular un documento ya guardado. Selectores en Detalle y Documentos | Integración RF-18 |
| RF-19 | Cargar documento | PDF o imagen en almacenamiento privado. ➕ Verificación del tipo real por firma binaria, coherencia con la extensión y hash SHA-256 | PF-09, PF-10, PS-07 |
| RF-20 | Consultar documento | Descarga autorizada con `no-store`; sin URL pública permanente | PS-02 |
| RF-21 | Eliminar documento | Confirmación y registro en auditoría | Auditoría |
| RF-22 | Línea de tiempo | Orden cronológico, paginada. ➕ Agrupada por mes (CU-08) | PF-11 |
| RF-23 ➕ | Buscar | Busca también en notas y campos estructurados (medicamento, examen, alergia…). `GET /profiles/:id/search` incluye documentos; los comodines se escapan | PF-12, integración RF-23 |
| RF-24 | Filtrar | Fecha, tipo y categoría del lado del servidor; rango inválido rechazado | PF-13 |
| RF-25 ➕ | Vista estructurada | Elección de secciones (`?sections=`), sección de tratamientos y aviso «No registrado: …» por registro; sin IA y sin inventar valores | PF-14, integración RF-25 |
| RF-26 | Seleccionar información para IA | Selector paginado; cada ID se verifica en el backend | `verify-ai`, PS-10 |
| RF-27 / RF-28 ➕ | Resumen y revisión de consistencia | `POST /profiles/:id/ai/review` con `focus` (`SUMMARY`, `CONSISTENCY` o `COMPLETE`). El resultado muestra fecha de generación, finalidad y advertencia | PF-15, PF-16, integración |
| RF-29 ➕ | Consultar análisis previo | Historial con fecha, finalidad y la lista de **registros incluidos** (IA-07) | PF-17 |
| RF-30 ➕ | Consultar trazabilidad | `GET /profiles/:id/audit` y pantalla «Actividad y trazabilidad» con filtros por tipo y periodo, paginada, sin IP ni secretos | PF-18, integración RF-30 |

## Requerimientos no funcionales

| ID | Estado | Detalle |
| --- | --- | --- |
| RNF-01 ➕ | Implementado | API con HSTS (helmet). Ambos `web.config` redirigen HTTP → HTTPS; la web agrega HSTS y CSP |
| RNF-02 | Cumple | bcrypt con costo 12 |
| RNF-03 ➕ | Ampliado | Permiso verificado en cada ruta según el rol (lectura, escritura o titular); los rechazos se auditan |
| RNF-04 | Cumple | Solo se envían los registros seleccionados, sin nombre del perfil ni instituciones |
| RNF-05 ➕ | Ampliado | Se auditan además los intentos de acceso fallidos y bloqueados, el cierre de sesión, la recuperación, las autorizaciones, los vínculos y los accesos denegados |
| RNF-06 | Cumple | Claves foráneas y transacciones en operaciones con varias entidades |
| RNF-07 ➕ | Implementado | Validación del contenido real de cada archivo en el servidor |
| RNF-08 | Pendiente de ejecución | Reportes de Lighthouse (ver abajo) |
| RNF-09 | Cumple | Eventos, búsqueda, auditoría y documentos (con `page`) paginados en el servidor |
| RNF-10 / RNF-11 | Cumple | `verify-ui`: foco visible, etiquetas, contraste de 4.5:1, controles de 56 px o más y texto al 200 % |
| RNF-12 | Cumple en web; Android pendiente | Exportación nativa correcta; falta la prueba en dispositivo |
| RNF-13 | Cumple | Adaptadores de IA, almacenamiento (`database`, `local`, `s3`) y correo |
| RNF-14 | Cumple | Los errores del proveedor no bloquean el historial |
| RNF-15 ➕ | Implementado | `db:backup` y `db:restore`, con SHA-256, confirmación del nombre de la base y procedimiento documentado |
| RNF-16 ➕ | Implementado | `backend/.env.example` y `frontend/.env.example` sin credenciales; los respaldos están excluidos de Git |

Protección frente a intentos repetidos (CU-01, PS-11) ➕: tras 5 intentos fallidos en 15 minutos la cuenta se bloquea temporalmente (`429`), y hay un límite adicional de 20 solicitudes de credenciales por IP.

## Lista de verificación de entrega (Apéndice 10)

| N.º | Criterio | Estado |
| --- | --- | --- |
| 1 | Sin secretos en el repositorio | Cumple (`.env*` excluidos; solo plantillas) |
| 2 | Variables documentadas con un archivo de ejemplo | Cumple ➕ |
| 3 | Migraciones reproducibles y restauración probada | Cumple ➕ (001 a 009 aplicadas desde cero; restauración verificada) |
| 4 | Endpoints documentados y probados con datos ficticios | Cumple (`backend/docs/API.md`) |
| 5 | Autorización por recurso verificada | Cumple ➕ (integración RF-07 y PS-02) |
| 6 | Restricciones de tamaño y formato | Cumple ➕ |
| 7 | IA desacoplada con errores controlados | Cumple |
| 8 | Advertencias de IA en Android y web | Web verificada; Android pendiente de revisión en dispositivo |
| 9 | Regresión tras correcciones | Cumple (suites anteriores) |
| 10 | Evidencias de Lighthouse y Observatory | Pendiente de ejecución |

## Pendiente de ejecución (requiere personas, dispositivos o el sitio publicado)

1. **Aplicar la migración 009 en producción.** Desarrollo y producción comparten la base: ejecuta antes `npm.cmd run db:backup` y luego `npm.cmd run db:migrate`. No se aplicó desde esta revisión para no modificar datos reales sin tu confirmación.
2. **Correo de recuperación**: configura `MAIL_DRIVER=resend`, `MAIL_API_KEY` y `MAIL_FROM` en producción. Sin proveedor, el enlace no llega.
3. **PS-01 y PR-01 a PR-03**: después de publicar los nuevos `web.config`, ejecuta Mozilla HTTP Observatory sobre `https://www.clinia.win` y Lighthouse sobre la página inicial y la línea de tiempo. Guarda los reportes.
4. **PR-04 y PR-05**: tareas principales en el dispositivo Android de referencia y en Chrome, Edge y Firefox.
5. **AU-07 y AU-08**: guía de 10 tareas y cuestionario SUS con al menos 25 participantes; entrevistas a profesionales de salud.
6. **IA-01 a IA-07**: aplicar la rúbrica con el proveedor real (`AI_MOCK_MODE=false`) y casos sintéticos.

## Diferencias con el documento que conviene resolver en la redacción

- **Almacenamiento de documentos.** El documento indica «almacenamiento privado de objetos, fuera de la base transaccional». Producción usa `STORAGE_DRIVER=database` (columna `LONGBLOB` privada, accesible solo por la API). El código admite `s3` (privado, con cifrado del lado del servidor) y `local`, pero cambiar de driver requiere un bucket y credenciales. Opciones: configurar S3 o justificar la decisión en el documento.
- **Funciones fuera del alcance evaluado.** El alcance deja como evolución futura la *exportación de información* y la *gestión de consentimientos en la aplicación*; el software ya incluye la descarga de una copia de los datos, enlaces temporales para compartir y el consentimiento de IA por perfil. También tiene funciones que el documento no menciona: el asistente de chat, los planes simulados, los recordatorios de medicamentos y los avisos. Ninguna contradice los límites (la IA sigue sin diagnosticar), pero el documento debería mencionarlas como complementarias o retirarlas de la evaluación.
