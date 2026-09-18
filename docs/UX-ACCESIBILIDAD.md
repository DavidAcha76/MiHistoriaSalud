# Interfaz y accesibilidad — Clinia

Actualización: 16 de septiembre de 2026.

## Uso cotidiano

- Inicio ofrece registrar información, medicamentos, historial, documentos y resumen para consulta. Los planes y la IA quedan en Más.
- Cuatro destinos permanentes: Inicio, Medicinas, Historial y Más. Menú lateral desde 1100 px; barra inferior en pantallas menores.
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

Resultado: tipos correctos, 11 pruebas aprobadas y exportaciones web, Android e iOS completadas.

Revisión de navegador reproducible con Edge instalado:

```powershell
npm.cmd install --prefix .ui-qa --no-save --package-lock=false --ignore-scripts playwright
node scripts/verify-ui.cjs
```

El script sirve la exportación local e intercepta todas las peticiones a la API con datos ficticios; no utiliza cuentas ni registros reales. Las peticiones externas sin fixture se bloquean.

Comprueba acceso, registro, navegación, documentos, resumen, formularios, confirmación/cancelación de tomas, cambio de persona y errores en 320, 390, 768 y 1440 px. También comprueba foco visible, móvil horizontal a 844 × 390, el espacio equivalente a escritorio con zoom al 200 % (720 × 450) y texto duplicado por CSS en Inicio. Las comprobaciones no encontraron desbordamientos horizontales en esos escenarios.

Capturas y resultados locales: `frontend/.ui-qa/results/` (excluidos de Git).

La prueba de texto duplicado es una simulación, no una prueba de Dynamic Type. Quedan por verificar en dispositivos físicos el teclado, las áreas seguras, los selectores nativos, VoiceOver/TalkBack y el uso con personas mayores. Las exportaciones móviles no equivalen a una prueba de ejecución en Android/iOS.
