# Cómo contribuir

Este repositorio usa cambios atómicos: cada cambio corresponde a un issue, una
rama, un pull request y un único commit final en `main`.

La fuente normativa es
[`docs/standards/docs/git.md`](docs/standards/docs/git.md), incluida mediante el
submódulo `docs/standards/`.

## Preparar el repositorio

```bash
git clone --recurse-submodules \
  https://github.com/vicunav/vicunav-transform-claude-to-gutenberg.git
cd vicunav-transform-claude-to-gutenberg
npm run validate
```

## Implementar un cambio

1. Crear o seleccionar un issue con un solo objetivo y criterios observables.
2. Crear una rama `tipo/N-slug` desde `main`.
3. Modificar únicamente el alcance acordado.
4. Ejecutar `npm run validate`.
5. Revisar que no existan datos privados, rutas personales, credenciales ni
   artefactos de proyectos usados para probar el skill.
6. Abrir un pull request que cierre el issue mediante `Closes #N`.
7. Fusionar mediante Squash and merge después de aprobar los checks.

Los commits nuevos usan Conventional Commits y se escriben en español.

## Cambiar el skill

- Mantener `SKILL.md` conciso y por debajo de 500 líneas.
- Conservar instrucciones detalladas en `references/` y enlazarlas directamente
  desde `SKILL.md`.
- Añadir scripts solo para verificaciones deterministas o trabajo repetido.
- Probar todo script añadido con una entrada representativa y una entrada de
  fallo.
- Mantener el frontmatter de `SKILL.md` limitado a `name` y `description`.
- Regenerar `agents/openai.yaml` cuando cambien el nombre, alcance o prompt
  principal del skill.

## Reportar problemas de seguridad

No publiques secretos, datos personales o contenido de clientes en un issue.
Usa el canal privado de reporte de vulnerabilidades de GitHub cuando esté
disponible para este repositorio.
