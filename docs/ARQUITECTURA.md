# Arquitectura de Clinicsoft

## Diagrama lógico

```mermaid
flowchart LR
  A[React Native / Expo] -->|HTTPS + JWT| B[Node.js + Express API]
  B --> C[(MySQL)]
  B --> D[Storage Adapter]
  D --> D1[Local privado - desarrollo]
  D --> D2[S3 privado - producción]
  B --> E[AI Adapter]
  E --> E1[Modo demo local]
  E --> E2[DeepSeek API]
```

## Capas

### Móvil

- Autenticación y sesión con `expo-secure-store`.
- Selector de perfil activo.
- Formularios progresivos para eventos.
- Línea de tiempo y filtros.
- Documentos.
- Resumen preconsulta sin IA.
- Selección explícita de registros para IA.

### Backend

- `routes`: contratos HTTP.
- `middleware`: autenticación, errores y autorización por perfil.
- `services`: eventos, almacenamiento, IA, auditoría y tokens.
- `config`: variables de entorno y conexión MySQL.

### Base de datos

El historial no se concentra en una sola tabla. `health_events` contiene el núcleo cronológico y las tablas especializadas contienen los atributos propios de cada tipo.

```mermaid
erDiagram
  USERS ||--o{ HEALTH_PROFILES : owns
  HEALTH_PROFILES ||--o{ HEALTH_EVENTS : contains
  HEALTH_EVENTS ||--o| ANTECEDENTS : details
  HEALTH_EVENTS ||--o| CONSULTATIONS : details
  HEALTH_EVENTS ||--o| DIAGNOSES : details
  HEALTH_EVENTS ||--o| TREATMENTS : details
  HEALTH_EVENTS ||--o| MEDICATIONS : details
  HEALTH_EVENTS ||--o| ALLERGIES : details
  HEALTH_EVENTS ||--o| VACCINATIONS : details
  HEALTH_EVENTS ||--o| SURGERIES : details
  HEALTH_EVENTS ||--o| LAB_RESULTS : details
  HEALTH_PROFILES ||--o{ CLINICAL_DOCUMENTS : stores
  HEALTH_EVENTS o|--o{ CLINICAL_DOCUMENTS : links
  HEALTH_PROFILES ||--o{ AI_ANALYSES : reviewed
  USERS ||--o{ AUDIT_LOGS : performs
```

## Autorización

Todo endpoint que opere sobre un perfil ejecuta una verificación por `profile_id + owner_user_id`. Conocer un UUID no permite acceder a un recurso perteneciente a otra cuenta.

## IA

1. El usuario selecciona de 1 a 50 eventos.
2. Backend verifica que todos pertenecen al perfil autorizado.
3. Se recuperan únicamente esos registros y sus detalles.
4. El adaptador construye un payload sin nombre, correo ni identificadores directos del perfil.
5. DeepSeek recibe instrucciones estrictas de salida no diagnóstica.
6. Se valida formato JSON.
7. Un filtro de seguridad bloquea patrones incompatibles con el alcance.
8. Se registra la trazabilidad del análisis.

## Documentos

Los documentos nunca se sirven desde una carpeta pública. El backend verifica sesión, perfil y documento antes de abrir el stream del archivo local o del objeto S3.

## Frontend universal Android / iOS / Web

El frontend no se divide en una aplicación móvil y una web independiente. `frontend/` contiene una única aplicación React Native + Expo. React Native Web transforma los mismos componentes de interfaz para navegador, mientras Android e iOS usan sus renderizadores nativos. Las diferencias inevitables de plataforma (almacenamiento seguro, descarga de archivos y selección de documentos) se encapsulan mediante `Platform.OS` y adaptadores pequeños, manteniendo compartidas las pantallas, navegación, lógica de negocio, tipos y cliente de API.
