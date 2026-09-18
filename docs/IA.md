# IA: configuración y límites

La pestaña **IA** de la navegación reúne la revisión de registros, el chat de organización, el historial completo de cada revisión guardada, el consentimiento por perfil y el acceso a los planes.

## Activar el proveedor

En `backend/.env` para desarrollo o `backend/.env.production` para preparar el despliegue, completa únicamente la clave:

```dotenv
DEEPSEEK_API_KEY=tu_clave_de_deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
AI_MOCK_MODE=false
```

Reinicia el proceso del backend después de guardar. No pongas la clave en el frontend ni en variables `EXPO_PUBLIC_*`. Los archivos `.env` están excluidos de Git.

El empaquetador copia `.env.production` como `.env` del paquete. **Una actualización normal conserva el `.env` existente del hosting**: si la API ya está publicada, actualiza también su `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` y `AI_MOCK_MODE` en el servidor y reinicia el sitio. Editar solo el archivo local no actualiza el entorno remoto. Se debe publicar tanto el backend como la web para usar la nueva sección.

El modelo predeterminado se ajustó a `deepseek-flash`, con pensamiento desactivado, según la [guía oficial de DeepSeek](https://api-docs.deepseek.com/) y su [contrato de Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/), consultados el 18 de septiembre de 2026. Se puede cambiar mediante `DEEPSEEK_MODEL`. La clave debe ser válida y disponer de saldo en el proveedor.

Sin clave, la aplicación muestra el servicio como no disponible; permite leer resultados guardados y administrar los permisos y el plan. No simula respuestas silenciosamente. `AI_MOCK_MODE=true` es una opción explícita para demostraciones y la interfaz la identifica como tal. El estado de configuración no comprueba la validez ni el saldo de la clave; eso se verifica al solicitar una respuesta.

## Suscripciones actuales

Gratis tiene un cupo compartido por cuenta, incluidos los perfiles dependientes. Plata y Oro conservan sus reglas por perfil:

| Plan | Precio mensual simulado | Revisión informativa | Chat |
| --- | --- | --- | --- |
| Gratis | Bs 0 | 1 por semana por cuenta | 10 mensajes respondidos por semana por cuenta |
| Plata | Bs 19 | Una cada 7 días | 10 mensajes respondidos por semana |
| Oro | Bs 39 | Una cada 3 días | Sin cuota funcional; conserva el límite técnico de uso razonable |

Los cupos semanales se reinician el lunes a las **00:00 de Bolivia (`America/La_Paz`, UTC−04:00)**, equivalente a las 04:00 UTC. No se acumulan: una semana sin usar IA no aumenta la siguiente. Tanto el backend como las fechas de la interfaz usan esta regla, independientemente de la zona del servidor o del teléfono. SQL conserva UTC para almacenar instantes. No se necesita un cron ni cambiar la zona del sistema operativo: cada solicitud calcula la ventana semanal `[lunes, lunes siguiente)`.

Cambiar de perfil no multiplica el cupo Gratis; eliminar un dependiente conserva el consumo de la cuenta. Cambiar de plan no borra el uso anterior. Una solicitud que comienza antes del lunes y termina después pertenece a la semana en que fue admitida. Las cancelaciones y renovaciones mensuales continúan siendo simuladas, sin cobros.

El backend comprueba plan y consentimiento antes de llamar al proveedor. Usa un bloqueo de MySQL por cuenta para excluir solicitudes simultáneas incluso entre perfiles y procesos, y una transacción para guardar el resultado y el consumo juntos. Los errores del proveedor o del guardado no consumen el cupo. El límite técnico de 40 solicitudes por 15 minutos se aplica a generar análisis y mensajes; consultar resultados, ver el plan y cambiar el consentimiento no lo consumen.

Ejecuta `npm.cmd run db:migrate` antes de usar el backend actualizado. La migración 005 añade las versiones revisadas y un contador para ordenar mensajes enviados en el mismo segundo; la 007 conserva el consumo de la cuenta al eliminar un perfil. Los resultados anteriores siguen disponibles.

Verificado el 18 de septiembre de 2026: la base configurada tiene aplicadas las migraciones 001 a 007. Pasaron 50 pruebas locales del backend, la integración con MySQL (7 resultados, incluido el grupo), 15 pruebas de frontend, TypeScript, la exportación web y los bundles Android/iOS. La prueba de navegador comprobó solicitudes manuales, selección médica, cupos, perfiles y pantallas de 320, 390 y 1440 px sin errores JavaScript ni desbordamiento horizontal.

La clave está configurada en los dos archivos locales de entorno, con `AI_MOCK_MODE=false`. La API oficial aceptó la autenticación (`GET /models`: HTTP 200) y confirmó `deepseek-flash`. La prueba real del chat, sin datos médicos, devolvió **HTTP 402: saldo insuficiente**; no se obtuvo una respuesta generada ni se ejecutó la prueba de análisis posterior. Es necesario recargar la cuenta de DeepSeek para completar esa verificación. La prueba no consultó registros ni consumió cupos de usuarios. No se ha publicado el código actualizado. [Códigos de error de DeepSeek](https://api-docs.deepseek.com/quick_start/error_codes/).

## Solicitudes manuales y contexto seleccionado

Se eliminó el programador de IA. Autorizar, abrir la app, editar registros o llegar al lunes no envía información al proveedor. La IA solo se ejecuta al solicitar una revisión de los registros elegidos o al enviar un mensaje. Las revisiones automáticas antiguas se conservan en el historial identificadas como tales. Retirar el permiso impide nuevas solicitudes; una solicitud ya enviada puede terminar.

Análisis y chat permiten buscar y seleccionar registros de cualquier página, hasta 50 por solicitud. El chat permite además elegir hasta 50 horarios de medicamentos. El backend comprueba que cada identificador pertenezca al perfil y vuelve a leer su contenido actual en cada envío. Incluye fechas, notas y detalles clínicos como dosis registradas, unidades, resultados y antecedentes familiares; excluye identificadores internos, nombres de profesionales y adjuntos. El texto libre puede contener información personal escrita por el usuario. Si el contexto supera 60 000 caracteres se pide reducir la selección, sin recortar hechos silenciosamente.

El chat conserva hasta 12 intervenciones previas del mismo perfil. Sin selección, solo usa la conversación; la pantalla lo informa. El prompt distingue información registrada de inferencias, exige referencias y fechas, trata notas y mensajes como datos no confiables, y limita las recomendaciones a organización y preguntas neutrales. No debe emitir diagnósticos nuevos, cambios de tratamiento, estudios ni triaje. Se registra la versión del prompt, versiones de eventos, identificadores de medicamentos y hash del contexto en el consumo. Los filtros son controles adicionales, no una validación clínica de todas las respuestas del modelo.

Antes de arrancar esta versión aplica `007_preserve_account_ai_usage.sql` mediante `npm.cmd run db:migrate`. Conserva el consumo al borrar un perfil. Publica backend y frontend juntos y reinicia todos los procesos del backend para retirar cualquier programador antiguo que siga en memoria.

## Verificar

```powershell
cd backend
npm.cmd test
cd ../frontend
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:web
npm.cmd run check:native
```

Con Edge y Playwright instalados según [la guía de interfaz](UX-ACCESIBILIDAD.md), ejecuta desde `frontend`:

```powershell
node scripts/verify-ai.cjs
```

Esta comprobación usa la exportación local y respuestas ficticias; no inicia solicitudes reales al proveedor.

Las pruebas de proveedor usan respuestas controladas y las pruebas de cuota usan una base simulada: no envían información clínica ni gastan saldo. La comprobación real con DeepSeek requiere añadir una clave válida, autorizar el perfil y ejecutar una revisión o un mensaje permitido por su plan.

La prueba de integración opcional ejecuta las rutas HTTP y el SQL de la migración sobre **tablas temporales y datos ficticios** en una conexión MySQL/MariaDB. No consulta ni modifica registros reales; las tablas desaparecen al cerrar la conexión:

```powershell
cd backend
$env:AI_DATABASE_TESTS='true'
node --test tests/ai-database.integration.test.js
Remove-Item Env:AI_DATABASE_TESTS
```
