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

## Evitar traducciones frágiles

- No usar `core/html` para pegar la salida del frontend.
- No generar un bloque custom por cada componente React.
- No almacenar layout principal como estilos globales de base de datos.
- No depender de URLs del servidor Vite, Next.js o Claude Code.
- No conservar Tailwind únicamente para evitar traducir clases.
- No descargar imágenes o fuentes sin verificar licencia y procedencia.
- No introducir HTML inválido dentro de delimitadores de bloques.
