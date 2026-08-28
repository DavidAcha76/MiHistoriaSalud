# Plan de pruebas

## 1. Pruebas funcionales

| ID | Caso | Resultado esperado |
|---|---|---|
| F-01 | Registrar usuario válido | Crea cuenta, perfil SELF y sesión |
| F-02 | Login válido | Devuelve access/refresh token |
| F-03 | Crear perfil dependiente | Aparece en selector y solo para el propietario |
| F-04 | Crear cada tipo de evento | Se crea evento y tabla especializada |
| F-05 | Editar evento | Conserva tipo y actualiza datos |
| F-06 | Filtrar por tipo | Solo devuelve el tipo solicitado |
| F-07 | Filtrar por fecha | Solo devuelve eventos dentro del rango |
| F-08 | Buscar palabra clave | Coincide con título/descripción/fuente |
| F-09 | Subir PDF | Guarda metadatos y archivo privado |
| F-10 | Subir imagen | Guarda JPG/PNG/WEBP válido |
| F-11 | Subir tipo no permitido | Rechaza con 400 |
| F-12 | Vincular documento a evento | Documento aparece en detalle del evento |
| F-13 | Resumen preconsulta | Agrupa información estructurada sin IA |
| F-14 | IA con selección explícita | Solo usa los IDs seleccionados |
| F-15 | Logout | Revoca refresh token |

## 2. Integración

- React Native ↔ API con access token.
- Renovación automática con refresh token.
- API ↔ MySQL.
- API ↔ almacenamiento local.
- API ↔ almacenamiento S3 en ambiente de pruebas.
- API ↔ DeepSeek con datos sintéticos.

## 3. Seguridad

- Acceso a perfil de otro usuario debe devolver 404/denegación.
- Acceso a documento de otro perfil debe ser imposible.
- UUID conocido no debe omitir autorización.
- Archivo > límite configurado debe devolver 413.
- MIME no permitido debe ser rechazado.
- Contraseñas deben persistirse como hash bcrypt.
- Refresh token se almacena hasheado en MySQL.
- Secretos no deben existir en Git.
- Endpoints de autenticación deben tener rate limit.
- Producción debe rechazar secretos JWT débiles.

## 4. Pruebas específicas de IA

La salida debe:

- Cubrir la información seleccionada sin inventar datos.
- Señalar datos incompletos de forma neutral.
- Señalar contradicciones textuales solo cuando existan.
- Mostrar advertencia no diagnóstica.
- No emitir diagnósticos.
- No declarar factores o niveles de riesgo.
- No prescribir tratamientos o medicamentos.
- No recomendar estudios.
- No realizar triaje.

Los casos de evaluación deben ser ficticios o sintéticos.

## 5. Usabilidad

Tareas sugeridas para evaluación:

1. Crear un perfil.
2. Registrar un evento.
3. Cargar un documento.
4. Localizar un antecedente usando filtros.
5. Abrir el resumen preconsulta.
6. Seleccionar registros y solicitar un resumen no diagnóstico.
7. Identificar visualmente la advertencia y los límites de IA.

Registrar por tarea: finalización, tiempo, errores, retrocesos y necesidad de apoyo. Después aplicar System Usability Scale (SUS).

## 6. Rendimiento

- Línea de tiempo de 1.000 eventos con paginación.
- Búsqueda filtrada con índices MySQL.
- Archivos cercanos al límite de tamaño.
- 20 solicitudes concurrentes de lectura de historial en ambiente de prueba.
- Medir p50/p95 de endpoints principales.
