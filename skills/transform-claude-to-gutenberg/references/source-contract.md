# Contrato de la fuente y del baseline

## Objetivo

Convertir una salida cambiante de diseño y código en una especificación finita,
observable y verificable antes de implementar WordPress.

## Fijar la fuente

Registrar:

- ruta absoluta y commit o hash del estado aprobado;
- comando de instalación, build y ejecución verificado desde limpio;
- URL local y datos necesarios para ver cada estado;
- lista de rutas incluidas y excluidas;
- viewports de escritorio, tablet y móvil;
- navegador, escala y fuentes cargadas durante las capturas;
- assets originales y su licencia.

No continuar con una fuente que cambia durante la migración. Si Claude Code
recibe mejoras posteriores, aprobar un nuevo baseline y registrar qué unidades
de Gutenberg deben recalibrarse.

## Inventariar por página

Para cada ruta registrar:

1. propósito y jerarquía de encabezados;
2. copy exacto, enlaces y llamadas a la acción;
3. secciones en orden visual;
4. componentes reutilizados y variantes;
5. imágenes, iconos, videos y fuentes;
6. estados responsive y cambios de orden;
7. hover, focus, active, expanded, loading, empty y error;
8. datos estáticos, datos simulados y servicios reales;
9. formulario, destino, validación y resultado esperado;
10. elementos deliberadamente fuera de alcance.

## Clasificar cada observación

Separar siempre:

- `contenido`: copy, media, enlaces y datos;
- `token`: valor compartido con significado semántico;
- `composición`: geometría local de una sección;
- `comportamiento`: transición, estado o interacción;
- `integración`: servicio, formulario o persistencia externa;
- `decisión`: diferencia nueva que requiere aprobación.

No convertir cada valor CSS en un token ni presentar una simplificación técnica
como si fuera una equivalencia visual.

## Evidencia mínima

Conservar por página:

- captura completa en tres viewports;
- capturas de estados que no aparezcan en el recorrido inicial;
- inventario de contenido y assets;
- reporte de `audit_source.mjs`;
- notas sobre animaciones, scroll y cambios responsive;
- lista de diferencias aceptadas por el usuario.

## Criterio de cambio de alcance

Solicitar una decisión cuando la traducción obligue a:

- cambiar copy, orden o jerarquía;
- sustituir una interacción por otra;
- introducir un plugin o bloque custom;
- convertir datos simulados en persistencia real;
- usar un asset o fuente sin licencia clara;
- omitir una superficie por incompatibilidad demostrada.
