# Interfaz y accesibilidad — Clinia

Actualización: 18 de septiembre de 2026.

## Uso cotidiano

- Inicio ofrece registrar información, medicamentos, historial, documentos y resumen para consulta. IA reúne revisión manual, asistente, historial de revisiones, consentimiento y acceso al plan.
- Cinco destinos permanentes: Inicio, Medicinas, Historial, IA y Más. Menú lateral desde 1100 px; barra inferior en pantallas menores. La barra permanece visible dentro de las herramientas de IA.
- Gratis muestra 1 análisis y 10 mensajes semanales por cuenta, compartidos entre perfiles, con reinicio el lunes a las 00:00 de Bolivia y sin acumulación. Plata y Oro conservan sus reglas por perfil. La IA solo se ejecuta por solicitud; las pantallas actualizan la disponibilidad al renovar el cupo. Los resultados guardados no consumen cuota. Análisis y chat permiten elegir registros con búsqueda y paginación; el chat permite incluir horarios de medicamentos y explica qué información se enviará.
- La pantalla de planes explica que subir a un nivel de pago habilita un análisis inmediato y el cupo completo de chat del nuevo plan. La confirmación distingue subidas y bajadas. Seleccionar el plan actual, bajar de nivel o cancelar y reanudar no repone consumo; volver a Gratis conserva los usos semanales. Mientras se procesa un cambio se deshabilitan las demás acciones de suscripción.
- El nombre de la persona está visible antes de consultar o guardar datos. Los formularios de registros, medicamentos y documentos mantienen la persona seleccionada.
- El registro de una molestia requiere nombre y fecha, sin repetir el nombre en otro campo. Los detalles adicionales son opcionales y desplegables.
- El historial incluye búsqueda, filtros desplegables, selección visible del tipo y paginación.
- Los horarios de medicamentos se eligen explícitamente. Confirmar una toma exige revisar medicamento, dosis y hora; cancelar no guarda una toma.
- Se distinguen los estados de carga, error y ausencia de información en las pantallas principales. Guardar muestra un mensaje de confirmación.

## Presentación

Paleta azul noche con acentos verde agua, superficies diferenciadas y texto claro. Texto habitual de 16–18 px, títulos mayores y controles principales de al menos 56 px. Se conserva el aumento de texto del sistema; las alturas del contenido son flexibles.

Los formularios limitan el ancho para facilitar la lectura en escritorio. Las tarjetas usan una columna en móvil y dos cuando hay espacio. Los filtros y las opciones de persona se ajustan en varias filas, sin obligar a deslizar horizontalmente. Android/iOS permiten ambas orientaciones.

Etiquetas explícitas, estados de selección, foco visible de teclado, mensajes anunciados y opción de mostrar contraseña. La web declara idioma español y esquema oscuro, sin bloquear el zoom.

Referencia: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), especialmente contraste, redistribución del contenido y tamaño de controles. Las pruebas de paleta comprueban 4.5:1 para texto normal/secundario sobre las superficies y 3:1 para bordes de campos. Esto no constituye una auditoría completa de conformidad.

## Verificación realizada

Desde `frontend`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build:web
npm.cmd run check:native
```

Resultado: tipos correctos, 15 pruebas aprobadas y exportaciones web, Android e iOS completadas.

Revisión de navegador reproducible con Edge instalado:

```powershell
npm.cmd install --prefix .ui-qa --no-save --package-lock=false --ignore-scripts playwright
node scripts/verify-ui.cjs
node scripts/verify-ai.cjs
```

El script sirve la exportación local e intercepta todas las peticiones a la API con datos ficticios; no utiliza cuentas ni registros reales. Las peticiones externas sin fixture se bloquean.

Comprueba acceso, registro, navegación, documentos, resumen, formularios, confirmación/cancelación de tomas, cambio de persona y errores en 320, 390, 768 y 1440 px. También comprueba foco visible, móvil horizontal a 844 × 390, el espacio equivalente a escritorio con zoom al 200 % (720 × 450) y texto duplicado por CSS en Inicio. Las comprobaciones no encontraron desbordamientos horizontales en esos escenarios.

Capturas y resultados locales: `frontend/.ui-qa/results/` (excluidos de Git).

La comprobación específica de IA pasó en 320, 390 y 1440 px: selección explícita de registros y medicamentos, una sola solicitud por acción, cupo Gratis compartido entre perfiles, limpieza de selección al cambiar de persona, historial, consentimiento y proveedor sin configurar. No encontró errores JavaScript ni desbordamiento horizontal.

La prueba de texto duplicado es una simulación, no una prueba de Dynamic Type. Quedan por verificar en dispositivos físicos el teclado, las áreas seguras, los selectores nativos, VoiceOver/TalkBack y el uso con personas mayores. Las exportaciones móviles no equivalen a una prueba de ejecución en Android/iOS.
