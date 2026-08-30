# Checklist de QA

Esta checklist es la referencia manual. Cuando `unlazy` esté instalado, la
contraparte ejecutable y reverificable de los puntos que sí pueden
comandarse vive en
[../templates/gates-fse-migration.md](../templates/gates-fse-migration.md):
copiarla a un `GATES.md` por página o sección antes de implementar, no
después de terminar.

## Gate 1: fuente reproducible

- [ ] El proyecto de Claude Code instala y ejecuta desde un estado limpio.
- [ ] El baseline referencia un commit o estado inmutable.
- [ ] Las capturas usan viewports, navegador y fuentes registrados.
- [ ] Copy, enlaces, assets, estados e integraciones están inventariados.

## Gate 2: arquitectura editable

- [ ] `theme.json` contiene los tokens compartidos y es válido para la versión
  objetivo.
- [ ] Templates y parts representan estructura global, no contenido rígido.
- [ ] Patterns usan bloques válidos y no `core/html`.
- [ ] El contenido editorial permanece editable en la superficie correcta.
- [ ] La lógica de negocio y persistencia no vive en el theme.
- [ ] No existen dependencias accidentales del build original.

## Gate 3: fidelidad visual

Comparar fuente y WordPress lado a lado o mediante overlay en al menos:

- desktop amplio;
- tablet vertical;
- móvil estrecho.

Revisar por separado:

- jerarquía, ancho, altura y ritmo de secciones;
- alineación, gaps, paddings y solapes;
- tipografía real, saltos de línea y altura de línea;
- recorte, ratio, foco y calidad de imágenes;
- color, contraste, bordes, radios y sombras;
- header, navegación, footer y posición de CTA;
- hover, focus, active, expanded y reduced motion;
- reordenamiento, ocultamiento y wrapping responsive.

No aceptar una diferencia clara solo porque la acción principal funcione.

## Gate 4: Gutenberg y Site Editor

- [ ] Abrir cada template y página implicada en el editor.
- [ ] Abrir cada página o post desde wp-admin → Páginas/Entradas → Editar
  (no solo su template desde Apariencia → Editor) y confirmar que muestra
  contenido real, editable y con conteo de palabras mayor a cero. Un
  template `page-{slug}.html` o `single-{cpt}.html` sin
  `<!-- wp:post-content /-->` casi siempre significa que el contenido quedó
  hardcodeado ahí en vez de vivir en el post_content real; ver
  [translation-map.md](translation-map.md#contenido-de-página-vs-contenido-de-template-error-real-ya-cometido).
- [ ] Confirmar que no aparezcan bloques inválidos o recuperaciones pendientes.
- [ ] Seleccionar y editar contenido, imágenes, botones y navegación.
- [ ] Guardar una copia de prueba y comprobar que el frontend no se rompa.
- [ ] Verificar que estilos de editor y frontend sean coherentes (requiere
  `add_theme_support('editor-styles')` + `add_editor_style()` si el theme
  encola su CSS solo vía `wp_enqueue_scripts`, que no llega al Site Editor).
- [ ] Confirmar que customizaciones antiguas de Global Styles no oculten el
  resultado del theme.
- [ ] Confirmar que no exista un título administrativo duplicado.
- [ ] Si una sección se repite con el mismo texto en más de una página,
  confirmar que es un bloque reutilizable sincronizado o un patrón, no
  markup copiado y pegado en cada template.

## Gate 5: accesibilidad

- [ ] Cumplir WCAG 2.1 AA en contraste de texto y controles.
- [ ] Completar navegación y acciones con teclado.
- [ ] Mantener foco visible y orden lógico.
- [ ] Conservar jerarquía de headings y landmarks.
- [ ] Añadir texto alternativo contextual o `alt=""` para decoración.
- [ ] Asociar labels, instrucciones y errores en formularios.
- [ ] Respetar preferencias de movimiento reducido.
- [ ] Ejecutar auditoría automática como apoyo y realizar prueba manual.

## Gate 6: calidad técnica

- [ ] `validate_fse_theme.mjs` termina sin errores.
- [ ] Los comandos de lint, build y pruebas del proyecto terminan correctamente.
- [ ] No hay errores de consola ni solicitudes 404.
- [ ] No se cargan assets remotos inesperados.
- [ ] No se exponen secretos o datos personales.
- [ ] Las imágenes tienen dimensiones y formatos adecuados.
- [ ] Lighthouse o herramienta equivalente no revela regresiones graves.
- [ ] El sitio funciona con JavaScript deshabilitado en lo que deba tener
  fallback.

## Gate 7: evidencia y rollback

- [ ] Las capturas finales corresponden al commit o estado entregado.
- [ ] Se enumeran páginas, viewports y estados probados.
- [ ] Se documentan diferencias aceptadas y riesgos residuales.
- [ ] Existe rollback para theme, páginas y opciones modificadas.
- [ ] No quedan archivos de depuración, datos simulados engañosos ni artefactos
  temporales dentro del theme.
