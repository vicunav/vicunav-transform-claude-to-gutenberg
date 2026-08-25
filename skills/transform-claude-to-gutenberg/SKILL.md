---
name: transform-claude-to-gutenberg
description: "Transformar diseños y proyectos creados con Claude Design y refinados en Claude Code (React, Next.js, Vite, HTML, CSS o prototipos similares) en un block theme nativo de WordPress Gutenberg, editable mediante Full Site Editing y ejecutado en LocalWP. Usar para auditar el proyecto fuente, congelar un baseline visual, extraer tokens y contenido, traducir componentes a bloques core, patterns, templates y template parts, decidir cuándo crear bloques custom o plugins, instalar el resultado en un sitio LocalWP y verificar fidelidad responsive, editabilidad, accesibilidad y rendimiento."
---

# Transformar Claude Code a Gutenberg FSE

## Objetivo

Convertir el proyecto aprobado de Claude Code en un sitio WordPress nativo y
mantenible. Conservar diseño, contenido y comportamiento acordados sin arrastrar
la arquitectura del prototipo frontend cuando WordPress ya ofrezca una solución
editable mediante bloques.

Tratar el proyecto fuente como especificación visual y funcional. Trabajar solo
en el LocalWP autorizado. No modificar producción ni borrar contenido,
customizaciones del Site Editor o datos locales sin aprobación explícita.

## Reunir el contexto mínimo

Confirmar o descubrir antes de editar:

- ruta del proyecto exportado o refinado en Claude Code;
- ruta del sitio LocalWP y del theme objetivo;
- commit, build o estado exacto que constituye el diseño aprobado;
- páginas, breakpoints, estados e interacciones incluidas;
- versión real de WordPress y PHP del sitio local;
- si el objetivo es paridad 1:1, optimización aprobada o rediseño;
- contenido e integraciones que deben ser editables desde WordPress;
- restricciones de plugins, bloques custom, fuentes y licencias de assets.

Si falta una decisión que cambie contenido, arquitectura, funcionalidad o
diseño, detenerse y pedirla. Si falta un dato recuperable del filesystem, del
frontend o del sitio local, inspeccionarlo y registrar el supuesto.

## Cargar las bases reutilizables

Aplicar los skills oficiales instalados según la fase:

- `wp-project-triage`: clasificar el proyecto WordPress y su toolchain;
- `wp-block-themes`: implementar `theme.json`, templates, parts, patterns y
  estilos FSE;
- `wp-block-development`: usar solo si una interacción exige un bloque custom;
- `wp-wpcli-and-ops`: inspeccionar o cambiar contenido y opciones con WP-CLI.

Verificar primero la versión objetivo. Si un skill oficial apunta a una versión
de WordPress posterior a la de LocalWP, usar únicamente las APIs compatibles y
consultar documentación oficial para resolver diferencias.

Leer recursos propios cuando correspondan:

- [source-contract.md](references/source-contract.md): antes de congelar el
  baseline y definir el contrato de migración;
- [migration-manifest.md](references/migration-manifest.md): antes de capturar el
  baseline o implementar cualquier cambio con impacto visual;
- [translation-map.md](references/translation-map.md): antes de decidir la
  arquitectura Gutenberg y durante la traducción de cada componente;
- [localwp.md](references/localwp.md): antes de tocar el sitio o su base de
  datos;
- [qa-checklist.md](references/qa-checklist.md): antes de la primera sección
  visible y nuevamente antes de declarar terminado el trabajo;
- [upstream.md](references/upstream.md): al actualizar, auditar o redistribuir
  las bases reutilizadas.

## Ejecutar el flujo

1. Leer instrucciones locales, estado Git y documentación directamente
   implicada en ambos proyectos.
2. Ejecutar `scripts/audit_source.mjs <ruta-fuente>` y revisar manualmente sus
   hallazgos. No tratar el reporte heurístico como una decisión arquitectónica.
3. Crear el manifiesto de migración, indexar todas las combinaciones esperadas y
   ejecutar `scripts/validate_migration_manifest.mjs <ruta-manifiesto>`.
4. Levantar el frontend fuente en un entorno limpio y capturar baseline en
   desktop, tablet y móvil, incluyendo estados interactivos relevantes.
5. Crear el contrato de migración: páginas, secciones, copy, assets, tokens,
   interacciones, fuentes de datos, integraciones y criterios de aceptación.
6. Separar tokens reutilizables de geometría local. Mapear los primeros a
   `theme.json` y conservar la segunda mediante bloques, layouts y clases
   semánticas mínimas.
7. Diseñar la arquitectura FSE: templates, template parts, patterns, contenido
   de páginas y, solo cuando sea necesario, bloques custom o plugins.
8. Implementar primero una sección representativa. Comparar frontend y Site
   Editor antes de escalar el patrón al resto del sitio.
9. Migrar página por página y sección por sección. Mantener el proyecto fuente
   visible como referencia durante toda la implementación.
10. Instalar o activar el theme en LocalWP mediante el flujo documentado del
   proyecto. Crear o actualizar contenido de forma idempotente y preservando lo
   existente.
11. Ejecutar `scripts/validate_fse_theme.mjs <ruta-theme>` y corregir todos los
    errores. Revisar las advertencias aplicables.
12. Completar QA visual, estructural, editorial, responsive, accesible y de
    rendimiento en frontend y Site Editor.
13. Ejecutar captura, comparación y gate mediante
    `capture_visual_evidence.mjs`, `compare_visual_evidence.mjs` y
    `verify_visual_evidence.mjs`; revisar manualmente lado a lado y overlay.
14. Entregar evidencia, limitaciones, rollback y siguiente unidad de trabajo.

## Mantener contratos no negociables

- Preferir bloques core, patterns del theme y APIs públicas de WordPress.
- No usar `core/html` como atajo para conservar el HTML del prototipo.
- Usar `theme.json` como fuente de verdad para tokens compartidos.
- Mantener templates y parts para estructura global; usar contenido de página o
  patterns para composición editorial.
- No introducir React, Tailwind o el runtime del prototipo en el frontend de
  WordPress salvo requisito demostrado y aprobado.
- Crear bloques custom solo para comportamiento o edición que los bloques core
  no puedan expresar de forma mantenible.
- Colocar lógica de negocio, reservas, pedidos y modelos de datos en plugins, no
  en el theme.
- Servir fuentes e imágenes localmente y conservar licencia, procedencia y texto
  alternativo.
- Mantener frontend y Site Editor como superficies obligatorias.
- No implementar una migración visual sin manifiesto válido y matriz completa.
- No convertir una métrica perceptual en aprobación automática de paridad.
- No depender de estilos globales accidentales guardados en la base de datos.
- Respetar `prefers-reduced-motion`, teclado, foco visible y WCAG 2.1 AA.
- No inventar contenido, rutas o funcionalidades para cubrir vacíos del diseño.

## Aplicar el criterio del demo de restaurante

- Modelar un menú pequeño y puramente editorial con bloques y patterns.
- Proponer un CPT como `vicu_menu_item` únicamente si el menú necesita edición
  estructurada, filtros, reutilización o crecimiento real; registrarlo en un
  plugin y probar su comportamiento.
- Tratar reservas, pedidos, pagos, horarios dinámicos y disponibilidad como
  integraciones funcionales separadas. No simularlas silenciosamente con un
  formulario estático.
- Reutilizar header, footer, llamadas a reservar y módulos de contacto mediante
  parts o patterns sincronizados con la arquitectura aprobada.

## Trabajar en unidades verificables

Cerrar una página o sección únicamente cuando:

- el contenido, enlaces y assets coincidan con el contrato;
- el markup sea válido y sus bloques permanezcan editables;
- frontend y editor representen correctamente los estilos;
- desktop, tablet y móvil estén comparados contra el baseline;
- los estados hover, focus, active, loading y error aplicables estén probados;
- no existan errores de consola, recursos remotos inesperados ni dependencias
  del servidor de desarrollo de Claude Code;
- la evidencia corresponda al estado exacto probado;
- la combinación tenga una fila única en el manifiesto y no permanezca `pending`.

## Entregar un estado verificable

Informar:

- páginas y secciones completadas;
- arquitectura y archivos afectados;
- decisiones core block, pattern, bloque custom o plugin;
- comandos y checks ejecutados con sus resultados;
- URLs y viewports usados para comparación;
- diferencias aceptadas, riesgos residuales y rollback;
- ruta del manifiesto validado y resumen de su matriz de evidencia.

No afirmar paridad visual porque el sitio renderice o porque el HTML contenga el
mismo copy. La paridad requiere comparación visual y validación de editabilidad.

## Ejemplos de invocación

```text
Usa $transform-claude-to-gutenberg para auditar este proyecto de Claude Code y
crear el contrato de migración de la homepage al sitio LocalWP indicado.
```

```text
Usa $transform-claude-to-gutenberg para transformar el demo de restaurante en
un block theme FSE 1:1, usando bloques core y assets locales.
```

```text
Usa $transform-claude-to-gutenberg para revisar el theme migrado y enumerar qué
impide considerarlo editable y visualmente equivalente al prototipo aprobado.
```
