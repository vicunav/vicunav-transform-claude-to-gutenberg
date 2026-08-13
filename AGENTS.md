# vicunav-transform-claude-to-gutenberg

Propósito: Mantener un skill portable para traducir prototipos de Claude Code a
block themes Gutenberg FSE editables y verificables en LocalWP.

## Reglas aplicables

Las reglas transversales del repositorio están en
[`docs/standards/`](docs/standards/). Consúltalas antes de realizar cambios.

No repitas esas reglas aquí; este archivo solo contiene el contexto específico
del repositorio.

## Límites del repositorio

- El skill y sus recursos viven en
  `skills/transform-claude-to-gutenberg/`.
- El README raíz es la superficie pública de instalación y portafolio.
- Los proyectos fuente, sitios LocalWP, bases de datos, capturas y contenido de
  clientes nunca se versionan aquí.
- Los skills oficiales de WordPress son dependencias separadas. No copies su
  contenido dentro de este repositorio.
- No copies código, prompts o assets desde repositorios sin licencia compatible.

## Validación

```sh
npm run validate
```

La validación debe comprobar metadatos, enlaces, sintaxis, auditoría de fuente,
themes FSE válidos e inválidos y ausencia de rutas personales o secretos.
