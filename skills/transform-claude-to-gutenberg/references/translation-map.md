# Mapa de traducción a Gutenberg

## Elegir la superficie correcta

| Fuente Claude Code | Destino preferido en WordPress |
| --- | --- |
| Layout global de aplicación | Template y template parts |
| Header o footer reutilizable | Template part |
| Sección editorial reutilizable | Pattern del theme |
| Contenido propio de una página | Bloques en `post_content` |
| Variables CSS compartidas | Presets y estilos de `theme.json` |
| Variante visual completa | Style variation si el alcance la requiere |
| Componente estático | Bloques core anidados y clase semántica |
| Lista de contenido WordPress | Query Loop y sus bloques internos |
| Interacción no cubierta por core | Bloque custom o Interactivity API |
| Modelo de negocio o integración | Plugin separado del theme |

## Traducir estructura

- Mapear `section`, contenedores y wrappers de layout a `core/group`,
  `core/columns`, `core/cover`, `core/grid` o bloques equivalentes disponibles
  en la versión objetivo.
- Mapear texto a heading, paragraph, list, quote y button manteniendo semántica,
  no solo apariencia.
- Mapear imágenes a image, gallery, media-text o cover según su función.
- Usar template parts solo para estructura global. No convertir cada componente
  React en un part.
- Mantener el orden del DOM accesible aunque CSS cambie la composición visual.
- Evitar wrappers que no tengan responsabilidad de layout, estilo o semántica.

## Traducir tokens

Mapear a `theme.json`:

- paleta semántica y gradientes aprobados;
- familias, pesos, tamaños y alturas de línea;
- escala de espaciado compartida;
- `contentSize`, `wideSize` y anchos reutilizables;
- radios, sombras y ratios cuando la versión objetivo los soporte;
- estilos de elementos y de bloques que deban aparecer también en el editor.

Conservar en CSS del theme:

- composición específica que `theme.json` no pueda expresar;
- pseudo-elementos decorativos;
- animaciones y transiciones aprobadas;
- estados complejos y ajustes responsive locales.

No duplicar el mismo valor como preset, variable independiente y literal salvo
que exista una razón de compatibilidad documentada.

## Traducir React y comportamiento

- Eliminar estado que solo simule contenido estático del prototipo.
- Usar Navigation, Details, Gallery y otros bloques core cuando cubran el
  contrato de interacción y accesibilidad.
- Para filtros, tabs, modales o menús propios, comprobar primero APIs core y la
  Interactivity API de la versión objetivo.
- Crear un bloque custom únicamente si necesita una experiencia de edición o un
  contrato de serialización propio.
- Mantener la lógica de servidor, permisos, nonces, sanitización y persistencia
  en un plugin cuando exista comportamiento real.
- No trasladar handlers JSX, hidratación o dependencias npm completas si solo se
  necesita una interacción pequeña.
- Implementar fallback sin JavaScript y respetar `prefers-reduced-motion` cuando
  aplique.

## Traducir rutas y contenido

- Convertir rutas editoriales a páginas WordPress con slugs aprobados.
- Usar templates para tipos de vista y páginas para contenido editable.
- No incrustar todo el copy en patterns si el usuario debe editar cada página
  independientemente.
- No duplicar el título administrativo dentro del contenido si el template ya
  incluye `post-title`.
- Para contenido repetible, decidir entre bloques, Query Loop, taxonomías y CPT
  según edición, volumen y reutilización, no por comodidad del prototipo.

## Contenido de página vs. contenido de template (error real, ya cometido)

Migrando vicunav-web se crearon 10 páginas completas con `wp post create`
sin `--post_content`, y todo el copy real se hardcodeó dentro de
`theme/templates/page-{slug}.html`. El frontend se veía perfecto (WordPress
resuelve la plantilla por slug), pero cada página quedó vacía en la base de
datos: abrir "Editar página" desde wp-admin, o abrir esa página (no la
plantilla) desde el Site Editor, mostraba un lienzo en blanco sin nada que
editar. El dueño del sitio lo detectó de inmediato al intentar editar una
subpágina de servicios y preguntó, con razón, si el sitio era "realmente
FSE" o solo HTML estático disfrazado de bloques.

**Diagnóstico rápido:** si un archivo se llama `page-{slug}.html` o
`single-{cpt}.html` y NO contiene un bloque `<!-- wp:post-content /-->`,
casi seguro es contenido único hardcodeado que debería vivir en el
`post_content` real de esa página o post. `scripts/validate_fse_theme.mjs`
ahora detecta este patrón automáticamente (`page-content-hardcoded-in-template`).

**Regla a seguir desde la primera página, no como corrección tardía:**

- Crear cada página/post CON su contenido real desde el principio:
  `wp post create ... --post_content="$(cat archivo-de-bloques.html)"`, o
  editarlo después con `wp post update <id> --post_content=...`.
- Usar un único template genérico por tipo (`templates/page.html`,
  `templates/single.html`, `templates/single-{cpt}.html`): header + un
  wrapper `core/group` (`tagName: main`) + `<!-- wp:post-content /-->` +
  footer. Reservar un `page-{slug}.html` específico solo para chrome
  realmente distinto de esa página (layout, no copy).
- Antes de dar por cerrada la primera página migrada, abrirla desde
  wp-admin → Páginas → Editar (no desde Apariencia → Editor → Plantillas) y
  confirmar que el contenido es real y editable ahí. Repetirlo en la
  primera unidad de cada página/CPT nuevo, no solo al final.
- Si la misma sección (ej. una banda de CTA) va a aparecer con el mismo
  texto en más de una página, no copiar y pegar el markup: usar un bloque
  reutilizable sincronizado (`wp_block`, insertado como
  `<!-- wp:block {"ref":ID} /-->`) cuando el texto deba ser idéntico en
  todas partes, o un patrón registrado en `theme/patterns/*.php` (leído
  automáticamente por WordPress desde esa carpeta, sin llamada de registro
  manual) cuando la estructura se repite pero el texto cambia por página.

## Escalera de implementación

Elegir la primera alternativa que cumpla el contrato:

1. bloque core sin CSS adicional;
2. bloque core con presets de `theme.json`;
3. composición de bloques core con pattern;
4. composición con una clase semántica y CSS mínimo;
5. variación o block style registrado;
6. bloque custom con APIs WordPress;
7. plugin de dominio o integración.

Documentar la limitación concreta antes de avanzar al nivel siguiente.

## Gotchas concretos de bloques core (evitar redescubrirlos)

Aprendidos migrando vicunav-web. Revisar esta lista antes de reportar un bug
de renderizado como misterioso; varios de estos ya tienen chequeo automático
en `validate_fse_theme.mjs` (se indica entre paréntesis).

- **`layout.type` "constrained" vs "default"**: "constrained" clampea los
  hijos al `contentSize` de `theme.json` (pensado para columnas de lectura).
  Usarlo en una sección full-bleed produce un "contenedor angosto" que
  parece un bug de CSS pero es de configuración del bloque. Usar "default"
  para secciones que deben ocupar el ancho completo. (chequeo:
  `constrained-layout-type`)
- **`className` de `core/button`**: WordPress espera el atributo en el
  `<div class="wp-block-button ...">` exterior, no en el `<a>` interior.
  Ponerlo en el `<a>` marca el bloque como inválido en el editor ("Block
  contains unexpected or invalid content"), aunque el HTML se vea idéntico.
  Si el botón no tiene color propio, WordPress pinta su propio fondo oscuro
  por defecto en `.wp-block-button__link`; neutralizarlo con
  `wp_add_inline_style()` si las clases reales del diseño ya definen el
  color.
- **Comentarios HTML sueltos dentro de un bloque**: cualquier `<!-- ... -->`
  que no sea un delimitador `wp:`/`/wp:` rompe el parser si vive dentro de
  un `core/group` u otro contenedor (ej. `<!-- TODO: ... -->`). Solo es
  seguro como primera línea del archivo (cita de fuente). (chequeo:
  `non-block-comment`)
- **El Site Editor no hereda `wp_enqueue_scripts`**: ese hook es solo de
  frontend. Sin `add_theme_support('editor-styles')` +
  `add_editor_style(...)` (en `after_setup_theme`), el editor renderiza los
  bloques sin ningún CSS del theme, lo que puede confundirse con "el editor
  está roto" cuando solo está sin estilos.
- **Un bloque dinámico no puede anidarse como comentario dentro de
  `core/paragraph`**: `core/paragraph` guarda HTML plano, no bloques.
  Escribir `<!-- wp:post-terms /-->` dentro del contenido de un
  `<!-- wp:paragraph -->` no compone; el resultado queda fuera de flujo y
  mal estilado. Usar bloques hermanos dentro de un `core/group` con
  `layout: {"type":"flex"}` cuando se necesite un breadcrumb con un
  segmento dinámico (ej. la categoría de un post).
- **`core/query` no es el contenedor real de la grilla**: el `className`
  puesto en `core/query` cae en el `<div class="wp-block-query ...">`, pero
  las tarjetas repetidas viven dentro de `core/post-template`, que
  WordPress renderiza como `<ul class="wp-block-post-template">` con un
  `<li>` por elemento. Un CSS de grilla del diseño original (pensado para
  un `<div>` plano de tarjetas) necesita el `className` en
  `core/post-template`, no en `core/query`, y probablemente necesite
  también un reset (`list-style:none;margin:0;padding:0`) para el `<ul>`
  que el HTML original no tenía. (chequeo:
  `query-classname-should-be-on-post-template`)
- **Enlaces reales donde el prototipo usaba `<button>` o texto plano**:
  convertir un filtro/chip/badge de `<button onClick>` a un `<a href>` real
  (navegación real de WordPress) hereda el subrayado por defecto del
  navegador si la clase CSS original nunca necesitó `text-decoration:none`
  (porque nunca fue pensada para un `<a>`). Revisar cada elemento
  interactivo migrado de botón-JS a enlace real y añadir el reset si hace
  falta.
- **Un placeholder vacío en el canvas del Site Editor no es prueba de un
  bug de contenido.** Antes de asumir que un bloque está vacío o inválido
  porque el canvas muestra "Group blocks together: Select a layout",
  verificar el estado real del editor en la consola del navegador (correr
  en el documento de nivel superior, no dentro del iframe del canvas, ya
  que `wp` no existe ahí):
  `wp.data.select('core/block-editor').getBlocks()`. Si `isValid` es
  `true` y `innerBlocks` tiene el conteo esperado en todos los niveles, y
  el frontend renderiza correctamente, es un glitch cosmético del canvas,
  no un problema de datos; no seguir depurando esa pista.

## Evitar traducciones frágiles

- No usar `core/html` para pegar la salida del frontend.
- No generar un bloque custom por cada componente React.
- No almacenar layout principal como estilos globales de base de datos.
- No depender de URLs del servidor Vite, Next.js o Claude Code.
- No conservar Tailwind únicamente para evitar traducir clases.
- No descargar imágenes o fuentes sin verificar licencia y procedencia.
- No introducir HTML inválido dentro de delimitadores de bloques.
