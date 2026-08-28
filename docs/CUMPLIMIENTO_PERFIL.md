# Matriz de cumplimiento del perfil de proyecto

| Punto del perfil | Implementación incluida |
|---|---|
| Aplicación móvil multiplataforma | React Native + Expo en `frontend/` |
| Backend Node.js + Express | `backend/src/` |
| MySQL | Migración relacional en `backend/database/migrations/001_initial.sql` |
| Cuenta autenticada | Registro, login, refresh, logout y `/me` |
| Perfiles propios/dependientes | Perfil SELF automático y CRUD de dependientes |
| Antecedentes | `health_events` + `antecedents` |
| Alergias | `health_events` + `allergies` |
| Vacunas | `health_events` + `vaccinations` |
| Medicamentos | `health_events` + `medications` |
| Cirugías | `health_events` + `surgeries` |
| Consultas | `health_events` + `consultations` |
| Diagnósticos declarados | `health_events` + `diagnoses` |
| Tratamientos | `health_events` + `treatments` |
| Laboratorio | `health_events` + `lab_results` |
| Línea de tiempo | Pantalla Historial + endpoint paginado |
| Búsqueda y filtros | Palabra clave, tipo, desde y hasta |
| PDF e imágenes | Multer + storage privado local/S3 |
| Documentos vinculados a eventos | `clinical_documents.event_id` opcional |
| Vista estructurada preconsulta sin IA | `/consultation-summary` + `SummaryScreen` |
| IA solo sobre información seleccionada | Selector de eventos + verificación backend |
| Resumen no diagnóstico | Adaptador IA con esquema de salida limitado |
| Datos incompletos/contradictorios | Campos específicos de la salida IA |
| Advertencias visibles | Disclaimer fijo en API y pantalla de IA |
| API DeepSeek solo desde backend | `ai-service.js`; no hay clave en móvil |
| Minimización de información | Payload de IA sin nombre/correo/ID directo del perfil |
| Trazabilidad de IA | Tabla `ai_analyses` |
| Auditoría | Tabla `audit_logs` y servicio de auditoría |
| Autorización por recurso | `assertProfileAccess()` antes de operaciones |
| Almacenamiento seguro de sesión móvil | `expo-secure-store` |
| Validación de archivos | MIME + tamaño máximo |
| Accesibilidad básica | Componentes nativos, labels y roles táctiles |
| Paginación | Endpoint de timeline |
| Pruebas | Unitarias de seguridad IA + plan funcional/integración/seguridad/usabilidad |
| Sin interoperabilidad institucional v1 | No se implementan conectores hospitalarios/laboratorios |
| Sin HL7 FHIR operativo v1 | No se expone capa FHIR |
| Sin diagnóstico / tratamiento / estudios | Reglas IA + filtro de seguridad + disclaimer |
