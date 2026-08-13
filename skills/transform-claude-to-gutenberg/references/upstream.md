# Bases reutilizadas y procedencia

## WordPress Agent Skills

Fuente: <https://github.com/WordPress/agent-skills>

Licencia: GPL-2.0-or-later.

Usar las instalaciones separadas de:

- `wp-project-triage`;
- `wp-block-themes`;
- `wp-block-development`;
- `wp-wpcli-and-ops`.

Mantenerlas separadas de este skill para poder actualizar y auditar el upstream
sin sobrescribir la lógica específica de Claude Code y LocalWP. Antes de una
actualización, revisar compatibilidad de WordPress, diff, release notes y
escenarios de evaluación del repositorio.

## Prototipo de Automattic

Referencia conceptual:
<https://github.com/Automattic/wordpress-agent-skills>

El repositorio observado es experimental, está orientado a WordPress Studio y no
incluye una licencia raíz. No copiar código, prompts o assets. Reutilizar solo
ideas generales no protegibles del flujo, como separar tokens, mockup aprobado,
build y comparación visual, reimplementándolas para LocalWP.

## Límites de confianza

- Una procedencia oficial no reemplaza la validación contra el WordPress local.
- Los skills upstream pueden apuntar a una versión de core distinta.
- Los escenarios de evaluación prueban contratos concretos, no garantizan la
  fidelidad de un sitio particular.
- Registrar la revisión y el commit upstream cuando su comportamiento influya
  materialmente en una migración.
