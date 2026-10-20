# API de Clinia

Base URL: `http://localhost:4000/api` (publicada: `https://api.clinia.win/api`).

Todas las rutas, salvo registro, inicio de sesión, renovación, recuperación y `/health`, exigen `Authorization: Bearer ACCESS_TOKEN`. El token pertenece a una sesión: cerrar sesión o restablecer la contraseña la revoca, y sus tokens dejan de funcionar de inmediato.

## Permisos sobre perfiles

| Rol | Quién | Puede |
| --- | --- | --- |
| `OWNER` | Cuenta titular que creó el perfil | Todo, incluidas las autorizaciones, el consentimiento de IA y la eliminación |
| `REPRESENTATIVE` | Cuenta autorizada por el titular | Consultar y actualizar registros, documentos, medicamentos y solicitudes de IA |
| `VIEWER` | Cuenta autorizada por el titular | Solo consultar |

Si el perfil no existe o la cuenta no tiene autorización, la respuesta es `404`. Si el rol no alcanza para la operación, es `403`. Ambos casos se registran como `ACCESS_DENIED` en la auditoría.

## Endpoints

| Método y ruta | Uso | Requisito |
| --- | --- | --- |
| `POST /auth/register` | Crea la cuenta y su perfil principal | RF-01 |
| `POST /auth/login` | Inicia sesión. Tras 5 intentos fallidos en 15 minutos responde `429` | RF-02, PS-11 |
| `POST /auth/refresh` | Renueva la sesión y rota el refresh token | RF-02 |
| `POST /auth/logout` | Revoca la sesión | RF-04 |
| `POST /auth/recover` | Envía un enlace de un solo uso. Responde siempre `202` | RF-03 |
| `POST /auth/reset` | Fija la contraseña nueva con el token y cierra todas las sesiones | RF-03 |
| `GET /profiles` | Perfiles propios y autorizados, con `accessRole` | RF-02, RF-08 |
| `POST /profiles` · `PATCH /profiles/:id` · `DELETE /profiles/:id` | Gestión de perfiles | RF-05, RF-06 |
| `GET/POST /profiles/:id/authorizations` · `PATCH/DELETE …/:authorizationId` | Autorizaciones por correo, rol y estado (solo titular) | RF-07 |
| `GET /profiles/:id/events` | Línea de tiempo paginada con `type`, `from`, `to`, `q`, `page` y `pageSize` | RF-22, RF-24, RNF-09 |
| `GET /profiles/:id/search?q=` | Búsqueda en registros, campos estructurados y nombres de documentos | RF-23 |
| `POST /profiles/:id/events` · `PATCH/DELETE …/:eventId` | Registro y edición con versiones | RF-09 a RF-17 |
| `GET /profiles/:id/events/:eventId` · `…/versions` | Detalle, documentos, registros vinculados e historial de cambios | RF-11 |
| `POST /profiles/:id/events/:eventId/links` · `DELETE …/links/:linkedEventId` | Vincula registros del mismo perfil | RF-18 |
| `GET /profiles/:id/documents[?page=]` | Documentos (paginados si se envía `page`) | RF-20 |
| `POST /profiles/:id/documents` | Carga privada con validación del tipo real y hash SHA-256 | RF-19, RNF-07 |
| `PATCH /profiles/:id/documents/:documentId` | Vincula o desvincula un documento (`eventId` o `null`) | RF-18 |
| `GET …/documents/:documentId/download` · `DELETE …/:documentId` | Descarga autorizada y eliminación auditada | RF-20, RF-21 |
| `GET /profiles/:id/consultation-summary[?sections=]` | Vista estructurada sin IA, con los datos no registrados señalados | RF-25 |
| `POST /profiles/:id/ai/review` (alias `…/ai/analyze`) | Revisión con IA de los registros seleccionados | RF-26 a RF-28 |
| `GET /profiles/:id/ai/analyses` | Revisiones anteriores con fecha, finalidad y registros incluidos | RF-29 |
| `GET /profiles/:id/audit` | Trazabilidad paginada con `from`, `to`, `type` (`ACCESS`, `CHANGES`, `AI` o `SHARING`) | RF-30 |

## Ejemplos

### Registrar un resultado de laboratorio

```http
POST /profiles/{profileId}/events
Content-Type: application/json

{
  "eventType": "LAB_RESULT",
  "title": "Hemograma - registro de ejemplo",
  "eventDate": "2026-08-28",
  "details": { "test_name": "Hemoglobina", "value_numeric": "13.8", "unit": "g/dL", "reference_range": "12-16" }
}
```

Si `value_numeric` no es un número o una fecha no existe (por ejemplo, `2026-02-30`), la respuesta es `400` y no se guarda nada.

### Autorizar a otra cuenta

```http
POST /profiles/{profileId}/authorizations
Content-Type: application/json

{ "email": "familiar@example.com", "role": "VIEWER" }
```

### Revisión de consistencia con IA

```http
POST /profiles/{profileId}/ai/review
Content-Type: application/json

{
  "eventIds": ["uuid-1", "uuid-2"],
  "purpose": "Revisar si hay datos incompletos antes de la consulta",
  "focus": "CONSISTENCY"
}
```

`focus` puede ser `COMPLETE` (predeterminado), `SUMMARY` (RF-27) o `CONSISTENCY` (RF-28). La respuesta incluye `createdAt`, `purpose`, `focus`, `selectedCount` y la advertencia `disclaimer`.

### Documento

`multipart/form-data` con estos campos:

- `file`: PDF, JPG, PNG o WEBP, de hasta `MAX_FILE_MB`. El servidor comprueba la firma binaria y rechaza el archivo si el contenido no coincide con el tipo declarado o con la extensión.
- `eventId`: UUID opcional del registro al que se vincula.

## Respaldo y restauración

```powershell
npm.cmd run db:backup                      # crea backups/clinia-<base>-<fecha>.sql con .sha256 y .json
npm.cmd run db:restore -- --file=backups/<archivo>.sql --confirm=<NOMBRE_DE_LA_BASE>
```

La restauración verifica la suma SHA-256 y se niega a escribir en una base remota sin `--allow-remote`. El procedimiento completo está en [PRUEBAS-Y-DESPLIEGUE.md](../../docs/Sistema/PRUEBAS-Y-DESPLIEGUE.md).
