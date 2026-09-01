# Gates: <página o sección> migrada a FSE

OWNS: theme/templates/<archivo>.html, theme/patterns/<archivo>.php

Scope: <página o sección> migrada del proyecto fuente a un block theme FSE, con contenido real editable, sin bloques inválidos y con fidelidad visual verificada.

- [ ] G1: el theme pasa el validador estructural sin errores
  CHECK: node <ruta-al-skill>/scripts/validate_fse_theme.mjs <ruta-al-theme>
  EXPECT: "valid": true
  EVIDENCE: pending

- [ ] G2: la página o post tiene contenido real en post_content, no hardcodeado en el template
  CHECK: <wp-cli-del-proyecto> post get <id> --field=post_content | wc -c
  EXPECT: /^\s*[1-9][0-9]{2,}/
  EVIDENCE: pending

- [ ] G3: el template usado por la página es el genérico (page.html/single.html/single-<cpt>.html) salvo chrome justificado
  CHECK: node <ruta-al-skill>/scripts/validate_fse_theme.mjs <ruta-al-theme>
  EXPECT: /"page-content-hardcoded-in-template"/i, negativa (ver nota abajo)
  EVIDENCE: pending

- [ ] G4: el bloque abre limpio en el editor de la página o post (no en su template)
  EVIDENCE: pending

- [ ] G5: el bloque abre limpio en el Site Editor, sin recuperaciones pendientes
  EVIDENCE: pending

- [ ] G6: no hay errores de consola ni recursos remotos inesperados en frontend
  EVIDENCE: pending

- [ ] G7: fidelidad visual verificada contra el baseline en desktop, tablet y móvil
  EVIDENCE: pending

- [ ] G8: accesibilidad WCAG 2.1 AA revisada (contraste, teclado, foco, headings)
  EVIDENCE: pending

- [ ] G9: cada sección full-bleed de la página ocupa el mismo porcentaje de ancho en frontend y en el Editor
  CHECK: node <ruta-al-skill>/scripts/verify_editor_frontend_parity.mjs --frontend-url=<url-frontend> --editor-url=<url-editor> --cookies=<ruta-cookies.json> --selector=".alignfull"
  EXPECT: PARIDAD_EDITOR_FRONTEND_OK
  EVIDENCE: pending

<!--
Reemplaza cada marcador de posición antes de correr el checker.

- <ruta-al-skill> es la ruta local a este skill (donde vive este archivo,
  bajo scripts/).
- <ruta-al-theme> es la ruta al theme FSE que se está construyendo.
- <wp-cli-del-proyecto> es la invocación real de WP-CLI del proyecto, que en
  LocalWP casi nunca es el binario `wp` global (usa el PHP del sitio, no el
  del sistema). Ver references/localwp.md.
- <id> es el ID numérico del post o página en WordPress.

G2 es el gate más importante de esta lista: previene el error real,
encontrado migrando vicunav-web, de crear 10 páginas sin post_content y
hardcodear todo el copy en theme/templates/page-{slug}.html. El frontend se
veía perfecto pero cada página quedaba vacía e ineditable desde su propio
editor. Ver references/translation-map.md, sección "Contenido de página vs.
contenido de template".

G3 usa un EXPECT negativo: el patrón de éxito real es que el código
"page-content-hardcoded-in-template" NO aparezca en la salida del
validador para el archivo de esta página. Como unlazy no tiene una sintaxis
nativa de "ausencia", implementa esto con un script propio de una línea que
invierta la salida, por ejemplo:

  CHECK: node <ruta-al-skill>/scripts/validate_fse_theme.mjs <ruta-al-theme> | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);const hit=r.errors.some(e=>e.code==='page-content-hardcoded-in-template'&&e.file.includes('<archivo>'));console.log(hit?'HARDCODED_CONTENT_FOUND':'NO_HARDCODED_CONTENT');process.exit(hit?1:0)})"
  EXPECT: NO_HARDCODED_CONTENT

G4 y G5 suelen ser manuales porque requieren observar el editor
visualmente; si el proyecto tiene un runner de accesibilidad de
navegador headless, conviértelos en gates ejecutables. No conviertas G7 en
automático solo porque exista una métrica de diferencia de píxeles: una
métrica perceptual no es aprobación de paridad por sí sola (ver el
contrato no negociable en SKILL.md).

G9 solo aplica si la página tiene al menos una sección `alignfull`/
`alignwide`; si no tiene ninguna, usa `ABANDON: G9 la página no tiene
secciones full-bleed`. <ruta-cookies.json> se genera con
`wp eval-file <ruta-al-skill>/scripts/wp_auth_cookies.php <user_id>`
(requiere `--url=` explícito apuntando al esquema real del sitio, http o
https, o el script detecta el esquema equivocado y genera una cookie que
WordPress rechaza). Ver references/translation-map.md, "Un bloque
alignfull puede no escapar de un padre is-layout-constrained ni siquiera
en el frontend", para el diagnóstico completo si este gate falla.

Antes de declarar terminada esta unidad, corre:
  node <ruta-a-unlazy>/scripts/gate-check.mjs --reverify GATES.md
y confirma ALL MET. Si un gate resulta genuinamente imposible, no lo borres:
usa ABANDON: <id> <razón> y repórtalo como handoff, nunca como éxito.
-->
