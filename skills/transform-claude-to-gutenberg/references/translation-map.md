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
- **`add_editor_style()` con un array fijo de CSS "global" no basta si el
  theme también encola CSS condicional por página/plantilla** (ej.
  `assets/css/pages/{slug}.css`, cargado en `wp_enqueue_scripts` solo cuando
  `is_page()`/`is_front_page()` coincide con ese slug). El error se
  descubrió así en vicunav-web: el H1 de Home usaba
  `color:var(--color-light)` definido en `pages/home.css`, que nunca estaba
  en el array de `add_editor_style()` (solo tokens/base/layout/components
  globales), el editor mostraba el texto en el color oscuro por defecto
  mientras el frontend se veía perfecto, y el bug afectaba a **las 15
  páginas del sitio**, no solo a Home, porque ninguna cargaba su CSS propio
  en el editor. Diagnóstico reproducible: en la consola del navegador (no
  dentro del iframe, ya que ahí sí vive `document.styleSheets` del canvas),
  `document.querySelector('iframe[name="editor-canvas"]').contentDocument.styleSheets`
  y si el archivo de CSS de esa página no aparece entre las hojas cargadas
  (aparecen como `(inline)`, ya que `add_editor_style()` inyecta el
  contenido en vez de enlazar un `<link>`), ese es el archivo faltante.
  Arreglo aplicado: en vez de listar cada `pages/{slug}.css` a mano,
  `glob( get_stylesheet_directory() . '/assets/css/pages/*.css' )` y
  agregarlos todos al array antes de llamar a `add_editor_style()`; como
  cada archivo usa un prefijo de clase único por página, cargarlos todos a
  la vez en el editor no genera colisiones. (chequeo:
  `page-css-missing-from-editor-styles`, heurística a nivel de carpeta: no
  puede resolver esto 100% estático porque el nombre del archivo por página
  suele componerse dinámicamente, pero si ninguna subcarpeta de
  `assets/css/` aparece ni como string literal en `add_editor_style()` ni
  dentro de un `glob()` en `functions.php`, es señal fuerte de que esa
  carpeta nunca llega al editor.)
- **`align:"full"` en el atributo de un `core/group` no garantiza la clase
  `alignfull` en el DOM del editor.** El editor de bloques clampea a 800px
  cualquier bloque de nivel superior en `post_content` sin `alignfull`/
  `alignwide` (`.is-root-container > :not(.alignfull)`, una regla propia del
  editor que nunca existe en el frontend). Con `add_theme_support('align-wide')`
  y `supports.align` habilitado, se esperaría que `"align":"full"` en el
  atributo del bloque baste, pero en la versión de WordPress usada en
  vicunav-web (7.1), un `core/group` con `layout.type:"default"` guardaba el
  atributo `align:"full"` correctamente (confirmable con
  `wp.data.select('core/block-editor').getBlocks()`, corrido en el documento
  de nivel superior) sin que React aplicara la clase `alignfull` al elemento
  renderizado en el DOM del iframe: una limitación de renderizado del
  cliente, no un error de datos. Workaround robusto (no depender de que
  WordPress aplique la clase): añadir una clase propia (ej.
  `vicu-full-bleed`) directamente en el HTML guardado de cada sección de
  nivel superior, y neutralizar el clamp del editor para esa clase con
  `wp_add_inline_style('wp-edit-blocks', '.editor-styles-wrapper .is-root-container > .vicu-full-bleed{max-width:none !important;margin-left:0 !important;margin-right:0 !important;}')`
  colgado de `enqueue_block_editor_assets`.
- **Corrección al gotcha anterior: la causa real no es una "limitación de
  renderizado del cliente", es que el contenedor padre usaba
  `layout.type:"default"` en vez de `"constrained"`.** Migrando
  vicunav-demo-restaurante se repitió el mismo síntoma (`align:"full"`
  guardado correctamente, cero bloques inválidos, pero el editor nunca
  aplicaba `alignfull` a ningún `core/group` hijo de nivel superior) y esta
  vez se confirmó la causa exacta leyendo el bundle real
  `wp-includes/js/dist/block-editor.js` del sitio, no adivinándola:
  `packages/block-editor/build-module/hooks/align.mjs` decide la clase vía
  `useAvailableAlignments()`, que para un theme con `theme.json`
  (`settings.supportsLayout === true`) delega en
  `layoutType.getAlignments(layout, isBlockBasedTheme)` del layout **del
  padre** (no del bloque mismo). La implementación de Flow
  (`layouts/flow.mjs`, usada por `layout.type:"default"`) tiene una rama
  `if (!isBlockBasedTheme) { ...agrega "full"/"wide" si hay
  contentSize/wideSize... }`: en un theme de bloques `isBlockBasedTheme` es
  `true`, así que esa rama nunca se ejecuta y ningún hijo puede recibir
  `full`/`wide`, sin importar el `theme.json` o `add_theme_support(
  'align-wide')`. La implementación de Constrained (`layouts/constrained.mjs`)
  no tiene ese veto: lee `contentSize`/`wideSize` directo y sí habilita
  `full`/`wide` en los hijos. Es decir: **el padre inmediato de cualquier
  sección full-bleed de nivel superior debe declarar
  `"layout":{"type":"constrained"}`**, nunca `"default"`, en un theme de
  bloques; esto incluye el propio `wp:post-content` del template
  (`page.html`/`front-page.html`), que es casi siempre el padre real de las
  secciones de una página compuesta en el editor de página/Site Editor.
  `add_theme_support('align-wide')` se probó como hipótesis alterna y se
  descartó explícitamente: con esa declaración activa pero el padre en
  `"default"`, el síntoma persiste igual; con la declaración inactiva
  (ningún theme de bloques por defecto de WordPress la declara) pero el
  padre en `"constrained"`, el editor funciona correctamente. Preferir este
  fix (cambiar `layout.type` del padre) sobre el workaround de clase
  propia + `wp_add_inline_style()` del gotcha anterior: es la causa real,
  no un parche sobre el síntoma, y no requiere CSS adicional en el editor.
- **Un `wp:template-part` con `"theme"` explícito en un template heredado
  por un child theme nunca renderiza nada, ni en frontend ni en editor, sin
  ningún error visible.** Migrando vicunav-demo-restaurante,
  `templates/page.html`/`front-page.html` de `vicunav-theme-core`
  (theme padre) referenciaban su propio header/footer con
  `<!-- wp:template-part {"slug":"header-restaurant-inner","theme":"vicunav-theme-core"} /-->`.
  Con el child theme `vicunav-bonasera` activo, ese bloque renderizaba
  contenido vacío (`do_blocks()` sobre ese comentario a solas: `LEN=0`).
  Causa raíz confirmada leyendo `wp-includes/blocks/template-part.php`
  (`render_block_core_template_part()`): la función solo intenta resolver
  el template part cuando `get_stylesheet() === $attributes['theme']`; con
  el child activo, `get_stylesheet()` es `"vicunav-bonasera"`, nunca el
  nombre del theme padre, así que la condición falla y la función retorna
  sin buscar nada, ni siquiera intenta el fallback a archivo. La solución
  **no** es poner el nombre del child theme a mano (rompería el mismo
  template si algún día lo usa un theme padre distinto o el theme-core se
  activa solo): es **omitir el atributo `"theme"` por completo**. WordPress
  inyecta automáticamente el stylesheet activo en ese atributo al parsear
  el bloque (`_inject_theme_attribute_in_template_part_block()`,
  `wp-includes/block-template-utils.php`) **solo si el atributo no está ya
  presente**; un theme padre que escribe sus propios templates sin fijar
  `"theme"` sigue funcionando igual de bien activado directamente o como
  padre de cualquier child futuro, sin tocar el archivo. Confirmado
  reproduciendo el bug con `wp.data.resolveSelect` y con `do_blocks()`
  directo antes de aceptar la causa.
- **El editor de contenido de una página nunca muestra el header/footer de
  la plantilla, ni siquiera cuando el template-part está perfectamente
  resuelto.** Migrando vicunav-demo-restaurante, tras cablear
  `wp:template-part` para header/footer en `page.html`/`front-page.html`
  (ver el gotcha de arriba sobre `layout.type`), el frontend y la vista de
  **plantilla** en el Site Editor (`Site Editor → Plantillas → Página`)
  mostraban el header y el footer correctos, pero el editor de la página
  individual (wp-admin → Páginas → Editar, o Site Editor → Páginas →
  Editar) seguía sin mostrarlos, aunque
  `wp.data.resolveSelect('core').getEntityRecord('postType','wp_template_part', id)`
  resolvía el contenido real y sin ningún error de consola. Se descartó
  timing/carga asíncrona como causa (aumentar la espera de 500ms a 15s no
  cambió el resultado; el header incluso aparecía "OK" en algunas
  corridas por una falsa coincidencia del propio script de verificación,
  que compara por posición de índice, no por identidad del elemento) y se
  descartó ownership de archivo (copiar el part directamente al child theme
  activo no cambió nada). Confirmado por inspección visual directa
  (captura de pantalla) que el lienzo de edición de una página SOLO
  contiene el título y el `post-content` de esa página, nunca el chrome de
  la plantilla, sin importar cuánto se espere o se haga scroll. Es
  separación intencional contenido/plantilla de WordPress, no un defecto
  de esta migración. **Consecuencia práctica para G9**: acotar siempre el
  selector de `verify_editor_frontend_parity.mjs` a `.wp-block-post-content`
  (ej. `.wp-block-post-content.alignfull, .wp-block-post-content
  .alignfull`), nunca a `.alignfull` sin acotar, o cualquier página con
  header/footer full-bleed reporta un falso `FALLO` en G9 que no tiene
  arreglo posible del lado del theme. Para verificar que el header/footer
  en sí están bien cableados, comparar el frontend contra la vista de
  **plantilla** del Site Editor, no contra el editor de una página
  individual.
- **Un bloque `alignfull` puede no escapar de un padre `is-layout-constrained`
  ni siquiera en el frontend.** El gotcha anterior documenta el caso del
  editor; migrando vicunav-demo-restaurante se repitió la misma familia de
  bug pero del lado del frontend, con el editor comparativamente más cerca de
  lo correcto. Causa raíz confirmada leyendo el CSS global generado por
  WordPress en el navegador (no adivinada): `WP_Theme_JSON`/
  `block-supports/layout.php` sí generaban
  `.is-layout-constrained > .alignwide { max-width: var(--wp--style--global--wide-size); }`,
  pero **no** una regla equivalente `.is-layout-constrained > .alignfull`
  para el bloque dinámico `core/post-content` en WordPress 7.1 con este
  árbol de bloques concreto, ni como regla global ni como el CSS con clase
  única por instancia (`wp-container-content-N`) que ese archivo genera para
  otros bloques con `supports.layout`. Sin esa regla, un hijo `alignfull` de
  `wp:post-content` simplemente hereda el `width` de su padre constreñido:
  visualmente se ve como una sección más angosta de lo esperado, no como un
  bloque roto, así que se confunde fácil con "el CSS del theme está mal"
  cuando el dato (`align:"full"`) y el CSS del patrón están correctos.
  **No depender de que el núcleo genere esa regla condicional** (ya sea en
  frontend o editor): en el CSS del propio patrón/theme, cualquier sección
  que deba ser full-bleed se declara con la técnica autocontenida que
  funciona sin importar el ancho del padre:
  `width: auto; max-width: none; margin-inline: calc(50% - 50vw);`, en vez
  de `width: 100%` (que solo llena al padre, heredando su constricción) o de
  `width: 100vw` (que sí es autocontenido pero introduce desborde horizontal
  en páginas con scrollbar vertical, porque `100vw` incluye su ancho).
  **Verificación real, no visual:** `scripts/verify_editor_frontend_parity.mjs`
  automatiza exactamente esta comparación: carga la misma URL en frontend y
  en el Editor con una sesión autenticada real (cookies generadas por
  `scripts/wp_auth_cookies.php`, ya que Playwright necesita un login válido
  para abrir `post.php?action=edit`) y mide el ancho de cada sección de
  nivel superior **como porcentaje del ancho de referencia de su propio
  contexto** (`documentElement.clientWidth`), nunca en píxeles absolutos: el
  iframe del editor dispone de menos ancho que el navegador (barra lateral,
  chrome de wp-admin), así que comparar píxeles crudos entre ambos marca un
  falso mismatch aunque los dos estén realmente a ancho completo dentro de
  su propio contexto; este error de método se cometió armando el script por
  primera vez y quedó documentado aquí para no repetirlo. Incluir esta
  verificación como gate ejecutable (`CHECK:`/`EXPECT:` en `GATES.md`) para
  cualquier página con al menos una sección full-bleed, no solo como
  inspección manual puntual.
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
  bug de contenido, pero SÍ es una divergencia visual real que hay que
  evitar, no ignorar.** Un `core/group` con cero `innerBlocks` dispara el
  placeholder "Group blocks together: Select a layout" del editor de forma
  intencional y documentada de Gutenberg, no es un dato inválido
  (`wp.data.select('core/block-editor').getBlocks()`, corrido en el
  documento de nivel superior, no dentro del iframe, mostrará `isValid:
  true`), y el frontend nunca muestra ese placeholder. Como el pedido
  original es "el editor debe verse igual al frontend", este placeholder sí
  cuenta como bug de fidelidad visual aunque no sea bug de datos. La causa
  típica: usar `core/group` para un div puramente decorativo sin contenido
  editable (`.grain`, `.deco-ring`, `.deco-blob`, un separador visual). La
  prevención, no el diagnóstico posterior, es la solución: cualquier
  elemento decorativo sin contenido real desde el inicio va en `core/html`
  con el `<div>` vacío verbatim, nunca en un `core/group` vacío. (chequeo:
  `empty-group-should-be-html`, con la excepción explícita de un grupo cuyo
  único hijo es un bloque dinámico autocerrado como `wp:post-content /-->`,
  que sí es legítimo y no debe convertirse.)

- **Un slug de preset con un dígito pegado a una letra se renombra al compilar el
  CSS**: WordPress genera el nombre de la custom property de un preset
  (`--wp--preset--{categoría}--{slug}`) insertando un guion en cualquier frontera
  dígito-letra del slug que no tenga ya un guion explícito. Un slug declarado como
  `vicunav-space-2xs` en `theme.json` compila como
  `--wp--preset--spacing--vicunav-space-2-xs`, no `...-2xs`. Cualquier CSS o pattern
  que referencie `var(--wp--preset--spacing--vicunav-space-2xs)` nunca resuelve esa
  variable, sin lanzar error: simplemente no aplica el valor, lo que se puede confundir
  con "el preset no se está usando" en vez de "el nombre no coincide". Confirmado
  comparando `WP_Theme_JSON_Resolver::get_theme_data()->get_settings()` (que sí
  agrupa el slug tal cual está en `theme.json`, por origen) contra
  `->get_stylesheet()` (que aplica esta normalización al emitir el CSS real): el
  primero puede verse correcto mientras el segundo ya renombró el slug. Evitarlo
  desde el nombre: usar convenciones sin dígitos para escalas extendidas (`xxs`,
  `xxl`, o nombres semánticos como `space-section-lg`) en vez de `2xs`/`2xl`/`3xl`,
  que es la convención más intuitiva pero la que dispara este renombrado.

## Evitar traducciones frágiles

- No usar `core/html` para pegar la salida del frontend.
- No generar un bloque custom por cada componente React.
- No almacenar layout principal como estilos globales de base de datos.
- No depender de URLs del servidor Vite, Next.js o Claude Code.
- No conservar Tailwind únicamente para evitar traducir clases.
- No descargar imágenes o fuentes sin verificar licencia y procedencia.
- No introducir HTML inválido dentro de delimitadores de bloques.
