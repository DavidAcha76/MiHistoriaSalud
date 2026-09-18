# Pruebas y despliegue en clinia.win

## Configuración actual

| Entorno | Web | API |
| --- | --- | --- |
| Desarrollo en esta PC | `http://localhost:8081` | `http://localhost:4000/api` |
| Teléfono / otro equipo en la LAN | `http://IP_DE_LA_PC:8081` | `http://IP_DE_LA_PC:4000/api` |
| Publicado | `https://www.clinia.win` | `https://api.clinia.win/api` |

**Desarrollo y producción usan la misma base remota** en `db65746.public.databaseasp.net:3306`, según la configuración indicada. Los cambios realizados al probar la app local se guardan en esa base compartida.

Conexión verificada: `DB_USER=db65746` y `DB_NAME=db65746`. La cadena inferior de la captura añade el dominio al usuario; esa variante fue rechazada por el servidor. La conexión con los valores corregidos funciona.

**Motor real del hosting:** `SELECT VERSION()` devuelve `10.11.15-MariaDB-log`. El servidor usa el protocolo MySQL; las tres migraciones se aplicaron correctamente sobre la base remota, que estaba vacía. No se insertaron cuentas ni datos demo. Se conserva la compatibilidad del SQL con MySQL 8.0.

Las migraciones usan sintaxis de MySQL 8.0: InnoDB, JSON, índices descendentes y claves foráneas. Para que MySQL aplique también la restricción `CHECK` de intensidad de síntomas se necesita 8.0.16 o posterior. El script `db:check` informa de la versión exacta del servidor. Las operaciones DDL de MySQL hacen commit implícito: si una migración falla después de crear o alterar tablas, su transacción no deshace todo el esquema; revisa el error antes de reejecutarla.

- `backend/.env`: servidor local, CORS de desarrollo y credenciales MySQL.
- `backend/.env.production`: servidor publicado, dominios HTTPS y las mismas credenciales MySQL.
- `frontend/.env`: `EXPO_PUBLIC_API_URL=` activa detección de la API local.
- Los archivos de entorno son privados y están excluidos de Git. No hay archivos de ejemplo.
- `SEED_DEMO=false` en ambos entornos; no se crean cuentas ni registros ficticios.
- La IA usa `AI_MOCK_MODE=false`: configura `DEEPSEEK_API_KEY` en el backend para habilitar el proveedor real. Los pagos siguen siendo simulados. Consulta [Configuración de IA](IA.md).

`DB_SSL_MODE=preferred` solicita TLS sin verificación del certificado, siguiendo la cadena facilitada. Solo se admite una conexión sin TLS cuando el servidor declara no soportarlo. Los errores de autenticación o negociación TLS no provocan una degradación automática. También se admiten `required`, `verify_identity` y `disabled`. [Modos SSL de MySQL](https://dev.mysql.com/doc/refman/8.4/en/connection-options.html).

En la comprobación del hosting, `Ssl_cipher` quedó vacío: la conexión efectiva no usa TLS. Para exigir cifrado se necesita habilitarlo en el servidor y cambiar ambos entornos a `DB_SSL_MODE=required` (o `verify_identity` con un certificado válido).

Las contraseñas con `#` deben ir entre comillas en los archivos de entorno; de otro modo dotenv interpreta ese carácter como el inicio de un comentario.

## 1. Verificar acceso y preparar el esquema

Desde `backend`:

```powershell
npm.cmd run db:check
```

La comprobación conecta, informa de TLS y enumera tablas y migraciones sin modificar datos. Si aparece `ER_ACCESS_DENIED_ERROR`, revisa usuario, contraseña y permisos de acceso remoto del hosting. El nombre de la base y el usuario deben coincidir exactamente con el panel; no son necesariamente el nombre del servidor.

Para comprobar el archivo de producción:

```powershell
$env:DOTENV_CONFIG_PATH = '.env.production'
try {
    npm.cmd run db:check
} finally {
    Remove-Item Env:DOTENV_CONFIG_PATH
}
```

Antes del primer arranque, con acceso confirmado y una copia de seguridad si la base ya tiene datos:

```powershell
npm.cmd run db:migrate
```

Como ambos entornos apuntan a la misma base, basta aplicar sus migraciones una vez. El registro `schema_migrations` evita volver a aplicar las que ya terminaron. La base se crea en el panel del hosting: `db:create` rechaza servidores remotos. No uses `db:setup` ni `db:seed` para esta configuración.

## 2. Arranque local

Requisitos: Node.js 22.13 o posterior, dependencias instaladas e Internet para acceder a la base remota. No se necesita un MySQL local.

En Windows, desde la raíz:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

El instalador usa `npm ci` para conservar las versiones fijadas. El lanzador comprueba MySQL, inicia la API en 4000 y Expo en 8081. No ejecuta migraciones ni siembra datos al arrancar.

- Web: `http://localhost:8081`.
- API y estado de MySQL: `http://localhost:4000/health/ready`.
- Para iniciar solo la API, añade `-NoFrontend`.
- La API queda en segundo plano; sus logs son `backend/.api.stdout.log` y `.api.stderr.log`.
- Si cambias el archivo de entorno, reinicia la API para que tome la nueva conexión.
- Para recarga automática durante desarrollo, usa `npm.cmd run dev` en `backend`, con el puerto 4000 libre.
- Entra con una cuenta existente en la base compartida o crea una desde la app.

Arranque manual, en terminales separadas:

```powershell
cd backend
npm.cmd run dev
```

```powershell
cd frontend
npm.cmd run web
```

En PowerShell usa `npm.cmd` y `npx.cmd` para evitar el bloqueo de los scripts `npm.ps1`. En Linux/macOS: `bash setup-linux.sh`, seguido de `npm run dev` en backend y `npm run web` en frontend.

## 3. Probar como app

### Expo Go en un teléfono

1. Instala Expo Go compatible con SDK 57.
2. Conecta teléfono y PC a la misma red Wi-Fi.
3. Ejecuta el lanzador o `npm.cmd start` dentro de `frontend`.
4. Escanea el QR con Expo Go (Android) o con la cámara/Expo Go (iOS).

Con `EXPO_PUBLIC_API_URL` vacío, la app usa el host LAN de Expo y el puerto 4000; la web usa el host del navegador. El lanzador evita Tailscale y adaptadores virtuales al elegir la interfaz LAN. Si hay varias interfaces físicas:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.1.50'
npm.cmd start
```

Para usar otra máquina, otro puerto o un túnel de la API, define en `frontend/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000/api
```

Reinicia Expo al cambiar de entorno. Un túnel de Expo transporta Metro, no la API del puerto 4000. Fuera de la LAN usa la API publicada.

Si el teléfono no conecta, abre `http://IP_DE_LA_PC:4000/health/ready` desde su navegador. Revisa el acceso de Node a redes privadas en Windows (4000 y 8081) y el aislamiento de dispositivos de la Wi-Fi.

Los enlaces para compartir usan `APP_BASE_URL`. El lanzador asigna la IP LAN de la PC al iniciar la API. Para arranque manual, configura `APP_BASE_URL=http://IP_DE_LA_PC:4000` si abrirás enlaces desde el teléfono.

### Emuladores y compilaciones

- Android con SDK/emulador instalado: `npm.cmd run android`.
- Simulador iOS en macOS con Xcode: `npm run ios`.
- Sin host de Expo, Android usa `10.0.2.2:4000`; iOS usa `localhost:4000`.

| Perfil EAS | Uso | API |
| --- | --- | --- |
| `development` | Cliente de desarrollo conectado a Metro | Local; HTTP permitido en esa compilación |
| `preview` | APK Android instalable | `https://api.clinia.win/api` |
| `production` | Distribución | `https://api.clinia.win/api` |

Para un APK con la API publicada:

```powershell
cd frontend
.\build-celular.bat -Destino apk
```

También puedes abrir `build-celular.bat` con doble clic y elegir del menú. Comprueba TypeScript, solicita inicio de sesión en Expo si falta, vincula el proyecto con `eas-cli init` y espera la compilación en EAS. Al terminar muestra el enlace de descarga. La cuenta de Expo debe tener disponible el servicio de compilación; no se inicia una compilación en la nube al verificar los bundles localmente.

| Comando en `frontend` | Salida |
| --- | --- |
| `.\build-celular.bat -Destino apk` | APK Android instalable, API publicada |
| `.\build-celular.bat -Destino desarrollo` | Cliente Android de desarrollo para Metro y API local |
| `.\build-celular.bat -Destino android` | AAB para distribución en Google Play, API publicada |
| `.\build-celular.bat -Destino ios` | Compilación iOS para distribución, API publicada; requiere firma Apple |
| `.\build-celular.bat -SoloVerificar -Offline` | Bundles Android/iOS en `dist-native`; no crea APK/IPA |

Después de instalar el cliente de desarrollo, ejecuta `npm.cmd run start:dev-client` con la API local activa. Ya se incluye `expo-dev-client`. Los formatos de distribución y el perfil APK siguen la [documentación de Expo EAS](https://docs.expo.dev/build-reference/apk/).

Los perfiles publicados fijan HTTPS. No configures otra `EXPO_PUBLIC_API_URL` para esos entornos en el panel de EAS. Las excepciones de HTTP se aplican exclusivamente al modo local.

## 4. Probar contra la API publicada

Desde `frontend`:

```powershell
npm.cmd run start:published
# Para web:
npm.cmd run web:published
```

Estos comandos fijan `https://api.clinia.win/api` y limpian la caché de Metro, sin cambiar el archivo local. En la app nativa no aplica CORS.

Para probar la web local contra producción, añade temporalmente `http://localhost:8081` a `CORS_ORIGIN` del backend publicado y reinícialo. Incluye también `http://127.0.0.1:8081` si abres la web así. Los dominios públicos requieren HTTPS; HTTP solo se admite para hosts de loopback explícitos.

## 5. Backend en MonsterASP

Se sigue la [guía de Node.js de MonsterASP](https://help.monsterasp.net/books/nodejs/page/how-to-run-nodejs-application): IIS inicia Node con `httpPlatformHandler`, asigna `PORT` y requiere `node_modules` instalado en el paquete.

1. Configura el sitio `api.clinia.win`, DNS, HTTPS y una versión de Node compatible (22.13 o posterior).
2. Confirma el acceso con `backend/.env.production` y aplica las migraciones pendientes.
3. Activa Web Deploy en el panel y descarga el perfil de publicación del sitio de la API. Guárdalo en `backend/monsterasp.publishsettings`. Las credenciales del perfil pertenecen al sitio web; son distintas de las de MySQL. El archivo está excluido de Git.
4. Ejecuta el BAT:

```powershell
cd backend
.\build-monsterasp.bat
```

El BAT ejecuta las pruebas, valida `.env.production`, prepara `backend/dist/monsterasp-XXXXXX` y un ZIP con el mismo nombre. Instala las dependencias de producción y copia ese archivo como `.env` del paquete. El ZIP contiene secretos: pertenece únicamente al sitio de la API. `backend/dist/latest.json` identifica la última carpeta preparada.

Antes de subir comprueba la conexión y exige que todas las migraciones estén aplicadas. Usa Web Deploy, ya instalado en esta PC, siguiendo la [guía de publicación por línea de comandos de MonsterASP](https://help.monsterasp.net/books/deploy/page/how-to-deploy-website-content-from-command-line). Tras subir exige que `https://api.clinia.win/health/ready` confirme MySQL y que el preflight CORS de `https://clinia.win` responda correctamente. Si falta el perfil, conserva el ZIP y termina indicando el requisito pendiente.

| Opción del BAT | Uso |
| --- | --- |
| `-SoloBuild` | Generar carpeta y ZIP sin publicar ni conectar a MySQL |
| `-SoloBuild -Offline` | Usar únicamente las dependencias instaladas/en caché |
| `-SimularSubida` | Preparar y consultar los cambios en Web Deploy sin escribir en el hosting |
| `-PublishSettings "C:\ruta\sitio.publishsettings"` | Usar otro perfil de publicación |
| `-ActualizarEntorno` | Reemplazar también el `.env` remoto con el de producción local |
| `-PermitirCertificadoNoConfiable` | Omitir la validación del certificado Web Deploy, solo si se revisó ese fallo |
| `-Ayuda` | Mostrar los comandos disponibles |

Por defecto, la primera subida añade `.env`; las siguientes lo conservan. No borra archivos adicionales del servidor y omite `storage` y `logs`. La contraseña se lee desde el perfil, sin incluirla en los argumentos del proceso. Si el hosting bloquea archivos en uso, detén/reinicia el sitio desde el panel antes de repetir la subida.

Como alternativa, sube el ZIP desde el administrador de archivos de MonsterASP y descomprímelo en `/wwwroot`, conservando `.env` y documentos en actualizaciones. La estructura esperada es:

```text
/wwwroot/
  server.js
  web.config
  package.json
  package-lock.json
  .env
  node_modules/
  src/
  scripts/
  database/
  logs/
  storage/private/
```

No fijes `PORT` en producción: `web.config` usa `%HTTP_PLATFORM_PORT%`. El archivo sigue la configuración mínima publicada por MonsterASP: ejecuta `node .\server.js`, espera 20 segundos y define `NODE_ENV=production`. La aplicación configura por sí misma la confianza en el proxy de IIS. `APP_BASE_URL=https://api.clinia.win` genera los enlaces públicos correctos.

El directorio de trabajo de IIS no cambia la ubicación de la configuración ni de los documentos históricos. El proceso solo necesita acceso a `storage/private` para leer archivos locales cargados antes de la migración; los archivos privados y el código no se sirven estáticamente.

Los documentos nuevos se guardan como una única copia digital privada en `clinical_documents.content_blob`, junto a sus metadatos. Por eso la web, Android y otro dispositivo ven el mismo documento al identificarse en la misma cuenta, incluso si cada cliente usa una instancia distinta del backend conectada a la base compartida. No se requiere S3 ni se crea una copia adicional en `storage/private`.

`storage/private` se conserva únicamente para leer documentos antiguos cargados antes de esta migración. En actualizaciones sigue conservando `.env` y ese directorio para no perder esos archivos históricos.

Después de publicar verifica `https://api.clinia.win/health`, `/health/ready`, el acceso a la cuenta y la carga/descarga de documentos. El `web.config` se entrega con los logs de inicio desactivados, igual que la configuración de MonsterASP. Si IIS devuelve 500 antes de llegar a Express, activa **Detailed Settings → Logs → HttpPlatform Debug logs** en el panel, reinicia el AppPool y revisa el último `logs/node*.log` desde WebFTP, como indica la [guía de logs de Node.js](https://help.monsterasp.net/books/nodejs/page/nodejs-debug-logging). El backend registra en JSON el inicio, cierre, errores 500, fallos de disponibilidad de MySQL y límites de autenticación/IA. Cada respuesta incluye `X-Request-Id`, que permite encontrar el evento relacionado. No registra cuerpos de solicitudes, cabeceras, contraseñas, tokens, SQL ni datos clínicos. Desactiva los logs de depuración cuando termine el diagnóstico, porque MonsterASP advierte que consumen disco y rendimiento. La IA solo se ejecuta por solicitud del usuario. Los cupos semanales se calculan con el calendario de Bolivia, sin tareas programadas; reinicia los procesos al publicar para retirar cualquier programador antiguo de memoria.

## 6. Frontend en www.clinia.win

```powershell
cd frontend
.\build-web.bat
```

El BAT comprueba TypeScript, ejecuta las pruebas y exporta la web con `https://api.clinia.win/api`. Genera `frontend/dist` y `frontend/dist-web/clinia-web-FECHA.zip`. Mueve los assets que Expo ubica bajo `assets/node_modules` a `assets/vendor` y actualiza el bundle: IIS/MonsterASP puede bloquear el segmento `node_modules` aunque los archivos se hayan subido. Verifica específicamente `index.html`, `web.config`, JavaScript y los assets de navegación. `-Offline` evita las consultas de Expo y utiliza dependencias instaladas/en caché; `-Ayuda` muestra las opciones.

Para publicarla automáticamente, activa Web Deploy en MonsterASP, descarga el perfil específico de `www.clinia.win` y guárdalo como `frontend/monsterasp.publishsettings`. Después ejecuta:

```powershell
.\build-web.bat -Publicar
```

`-SimularPublicacion` muestra el cambio sin escribir; `-PublishSettings "C:\ruta\web.publishsettings"` permite indicar otra ubicación. Tras una subida real, el BAT comprueba que un asset de navegación responda públicamente. También puedes subir el ZIP y descomprimirlo **completo** en `/wwwroot`: debe incluir `index.html`, `_expo`, `assets` y `web.config`. La web es estática y no necesita Node ni `node_modules` en el servidor.

Configura DNS y HTTPS. Si usas `clinia.win` sin `www`, redirígelo a `https://www.clinia.win`; la API admite ambos orígenes HTTPS.

Expo incorpora la URL pública al compilar. Si cambia, recompila y vuelve a subir la web/app. [Variables de entorno en Expo](https://docs.expo.dev/guides/environment-variables/).

## 7. Comprobaciones

```powershell
cd backend
npm.cmd test
cd ../frontend
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:web
npm.cmd run check:native
```

`check:native` verifica los bundles Android/iOS; no genera APK/IPA ni ejecuta la app en un dispositivo. La conectividad real con la base se verifica por separado con `db:check`.

Verificado el 18 de septiembre de 2026: 50 pruebas locales de backend, integración de IA con MySQL (7 resultados, incluido el grupo), 15 pruebas de frontend, TypeScript, exportación web y bundles Android/iOS. La comprobación de IA en Edge pasó con datos ficticios en 320, 390 y 1440 px. La base remota tiene las migraciones 001 a 007 aplicadas. La prueba anterior de sincronización local de Web Deploy confirmó que actualiza código, añade `.env` en el primer despliegue y conserva el `.env` existente, documentos y archivos adicionales. La publicación real queda pendiente del perfil de MonsterASP; la compilación firmada móvil requiere la cuenta de Expo y, para iOS, Apple. La clave de DeepSeek está configurada y la autenticación fue aceptada; la generación real devuelve HTTP 402 por saldo insuficiente. Consulta [la configuración de IA](IA.md).

Comprobación pública: `https://www.clinia.win` responde HTTP 200; el asset de navegación todavía devuelve 404 hasta que se publique el ZIP web completo. `https://api.clinia.win/health/ready` y el preflight de registro devuelven HTTP 500 desde IIS, antes de que Express pueda aplicar CORS. Eso confirma que la API necesita una nueva publicación y, si persiste, revisar el registro privado de arranque. En la web local se verificó el formulario de acceso contra la API local con la base remota, tanto en tamaño de escritorio como de celular, sin errores JavaScript ni creación de cuentas de prueba.
