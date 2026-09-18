# Clinicsoft / MiHistoriaSalud

Una aplicación Expo para web, Android e iOS, conectada a una API Node.js/Express con MySQL.

## Probar en esta PC (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

El lanzador comprueba la base remota, inicia la API en segundo plano y muestra el QR de Expo.

- Web: <http://localhost:8081>
- API: <http://localhost:4000/api>
- Estado de API y MySQL: <http://localhost:4000/health/ready>
- App: Expo Go compatible con SDK 57, teléfono y PC en la misma red; escanear el QR.
- Desarrollo y producción usan la misma base remota del hosting; no se cargan cuentas ni datos demo.

## Publicar

- API: `https://api.clinia.win/api`
- Web: `https://www.clinia.win`

| BAT (doble clic) | Resultado |
| --- | --- |
| [backend/build-monsterasp.bat](backend/build-monsterasp.bat) | Prueba el backend, genera carpeta + ZIP y sube con Web Deploy. |
| [frontend/build-web.bat](frontend/build-web.bat) | Comprueba y compila la web; genera un ZIP y puede subir todos los archivos con Web Deploy. |
| [frontend/build-celular.bat](frontend/build-celular.bat) | Menú para APK instalable, cliente local de desarrollo, AAB de Android o iOS mediante Expo EAS. |

**Primera subida:** activa Web Deploy en MonsterASP y descarga un perfil por cada sitio: `backend/monsterasp.publishsettings` para `api.clinia.win` y `frontend/monsterasp.publishsettings` para `www.clinia.win`. Esos archivos contienen las credenciales de publicación y quedan excluidos de Git. Web Deploy ya está instalado en esta PC. Con `build-monsterasp.bat -SoloBuild` generas el paquete API sin subirlo; con `build-web.bat -Publicar` se sube la web completa, incluidos sus assets.

**Celular:** el BAT solicita iniciar sesión y vincular el proyecto a tu cuenta de Expo la primera vez. La opción APK usa la API publicada; la opción de desarrollo usa Metro y tu backend local. iOS requiere la firma de Apple. Los bundles Android/iOS están verificados; todavía no se ha generado un APK/IPA firmado ni probado un teléfono físico.

Los ZIP web y backend se descomprimen en `/wwwroot` de sus respectivos sitios. No se ha realizado una publicación remota desde este equipo.

Las conexiones están en `backend/.env` y `backend/.env.production`. Verifica el acceso con `npm.cmd run db:check` y aplica las migraciones una sola vez antes de iniciar la API. Los archivos de entorno están excluidos del repositorio; no se utilizan archivos de ejemplo.

Conexión verificada: usuario y base `db65746`. El hosting responde con MariaDB 10.11.15 (protocolo MySQL); las tres migraciones se aplicaron correctamente. El código conserva sintaxis compatible con MySQL 8.0.

Instrucciones completas: [Pruebas y despliegue](docs/PRUEBAS-Y-DESPLIEGUE.md).
