# MiHistoria Salud — React Native universal

Prototipo académico completo de **historia clínica personal longitudinal**. El frontend usa **una sola base de código React Native + Expo** para **Android, iOS y Web**, conectado al mismo backend Node.js + Express y a MySQL.

## Estructura

```text
MiHistoriaSalud/
├── backend/       API Node.js + Express + MySQL
├── frontend/      React Native + Expo -> Android / iOS / Web
├── docs/          Arquitectura y plan de pruebas
├── setup-windows.ps1
└── setup-linux.sh
```

No existe un frontend web separado: la versión web se genera desde `frontend/` mediante React Native Web.

## Funciones incluidas

- Registro e inicio de sesión.
- Perfiles propios y dependientes.
- Historial clínico longitudinal.
- Consultas, diagnósticos declarados, tratamientos, medicamentos, alergias, vacunas, cirugías y laboratorios.
- Búsqueda y filtros por fecha, tipo y palabras clave.
- Carga privada de PDF e imágenes desde móvil o navegador.
- Apertura/descarga autorizada de documentos en web y apertura/compartición en Android/iOS.
- Resumen estructurado para consulta sin IA.
- Análisis opcional con DeepSeek desde el backend, limitado a resumen no diagnóstico, datos incompletos/contradictorios y preguntas informativas.
- Auditoría, autorización por recurso, JWT access/refresh, validación, CORS, Helmet y rate limit.
- Almacenamiento local privado para desarrollo y adaptador S3 para producción.

> **Alcance médico:** no reemplaza una historia clínica institucional. La IA no diagnostica, no prescribe, no recomienda estudios, no calcula factores de riesgo y no realiza triaje.

## Requisitos

- Node.js 22+
- MySQL 8+
- Navegador moderno para Web
- Android Studio o dispositivo Android para Android
- macOS/Xcode o EAS Build para iOS

## 1. Ejecutar backend

En PowerShell desde la carpeta `MiHistoriaSalud`:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run db:setup
npm run dev
```

API:

```text
http://localhost:4000
```

Comprobación:

```text
http://localhost:4000/health
```

Configura MySQL en `backend/.env` si tu usuario root tiene contraseña:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_clave
DB_NAME=mihistoria_salud
```

## 2. Ejecutar el mismo frontend como Web

Abre otra terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npx expo install --fix
npm run web
```

Expo abrirá la aplicación en el navegador. En desarrollo web usa automáticamente:

```text
http://localhost:4000/api
```

También puedes usar directamente:

```powershell
npx expo start --web
```

## 3. Ejecutar el mismo frontend en Android

Desde `frontend`:

```powershell
npm run android
```

O:

```powershell
npm start
```

Y presiona `a`.

En el emulador Android, si `EXPO_PUBLIC_API_URL` queda vacío, se usa automáticamente:

```text
http://10.0.2.2:4000/api
```

Para un teléfono físico cambia `frontend/.env` a la IP LAN de tu PC:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000/api
```

## 4. Ejecutar en iOS

En macOS:

```bash
cd frontend
npm run ios
```

## Credenciales demo

`npm run db:setup` crea información ficticia cuando `SEED_DEMO=true`:

```text
Correo: demo@mihistoria.local
Contraseña: Demo1234!
```

## DeepSeek

Por defecto el sistema funciona sin enviar datos a servicios externos:

```env
AI_MOCK_MODE=true
```

Para conectar DeepSeek configura `backend/.env`:

```env
AI_MOCK_MODE=false
DEEPSEEK_API_KEY=tu_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

La API key permanece únicamente en el backend.

## Generar la web de producción

Desde `frontend`:

```powershell
npx expo export --platform web
```

El resultado queda en `frontend/dist/` y puede publicarse como sitio estático. Debes configurar `EXPO_PUBLIC_API_URL` con la URL HTTPS del backend antes de exportar.

## Generar APK

Desde `frontend`:

```powershell
npm install -g eas-cli
npx eas login
npx eas build -p android --profile preview
```

## Pruebas backend

```powershell
cd backend
npm test
```

## Nota de almacenamiento de sesión

- Android/iOS usan `expo-secure-store`.
- Web usa almacenamiento del navegador para mantener una única API de sesión en este prototipo.
- Para un despliegue web con datos reales se recomienda mover el refresh token a cookies `HttpOnly + Secure + SameSite` y servir frontend/backend exclusivamente por HTTPS.
