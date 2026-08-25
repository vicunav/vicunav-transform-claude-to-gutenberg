# Manifiesto de migración visual

## Objetivo

Convertir el contrato visual en un artefacto versionado y validable. El manifiesto
conecta la fuente aprobada, el entorno de captura, las superficies, sus estados, los
repositorios propietarios y la matriz completa de evidencia.

Crear el manifiesto antes de implementar una migración con impacto visual. Actualizar
sus commits y resultados durante el trabajo sin cambiar el baseline aprobado de forma
silenciosa.

## Ubicación

El repositorio que coordina la migración decide la ruta estable. Se recomienda:

```text
docs/visual/migration-manifest.json
```

Las rutas de capturas son relativas al directorio del manifiesto. No usar rutas
personales absolutas, URLs temporales ni referencias que escapen con `../`.

## Forma contractual

```json
{
  "schemaVersion": 1,
  "impact": "paridad-1-1",
  "project": {
    "id": "restaurant-demo",
    "title": "Restaurant demo"
  },
  "source": {
    "repository": "organization/source-prototype",
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "installCommand": "npm ci",
    "runCommand": "npm run dev"
  },
  "target": {
    "repository": "organization/wordpress-demo",
    "commit": null,
    "wordpressVersion": "7.1",
    "phpVersion": "8.2"
  },
  "environment": {
    "browser": "Chromium",
    "browserVersion": "140",
    "locale": "es-VE",
    "timezone": "America/Caracas",
    "colorScheme": "light",
    "reducedMotion": "no-preference",
    "fonts": ["Display Font 800", "Body Font 400"]
  },
  "viewports": [
    {
      "id": "desktop",
      "width": 1440,
      "height": 1000,
      "deviceScaleFactor": 1
    }
  ],
  "surfaces": [
    {
      "id": "home",
      "owner": "organization/wordpress-demo",
      "sourceUrl": "http://127.0.0.1:5173/",
      "targetUrl": "https://example.local/",
      "fixture": "public-default",
      "states": ["default"],
      "viewports": ["desktop"]
    }
  ],
  "ownership": [
    {
      "id": "global-tokens",
      "kind": "token",
      "owner": "organization/theme-core"
    }
  ],
  "assets": [
    {
      "id": "hero",
      "status": "available",
      "owner": "organization/wordpress-demo",
      "source": "assets/hero.webp",
      "license": "documented"
    }
  ],
  "evidence": [
    {
      "surface": "home",
      "state": "default",
      "viewport": "desktop",
      "sourceCapture": "evidence/source/home-default-desktop.png",
      "targetCapture": "evidence/target/home-default-desktop.png",
      "comparisonCapture": "evidence/comparison/home-default-desktop.png",
      "status": "pending",
      "difference": null,
      "approval": null
    }
  ]
}
```

## Reglas

- `schemaVersion` es `1` hasta publicar otra versión explícita.
- `impact` acepta `ninguno`, `cambio-visual` o `paridad-1-1`.
- Los commits usan hashes Git inmutables. El commit objetivo puede ser `null` mientras
  se implementa, pero debe fijarse antes del gate final.
- Los IDs son únicos dentro de su colección y usan minúsculas, números y guiones.
- Cada superficie declara al menos un estado y un viewport existente.
- La matriz `evidence` contiene exactamente una fila por cada combinación declarada de
  superficie, estado y viewport.
- `pending` identifica trabajo no comprobado; no significa aprobado.
- `approved-difference` requiere explicar `difference` y enlazar `approval.authority`
  y `approval.reference`.
- Un asset `missing` bloquea paridad hasta recuperarlo o cambiarlo a
  `approved-substitute` con una decisión humana enlazada.
- El manifiesto no contiene cookies, tokens, credenciales, datos personales ni rutas
  privadas.

## Validación

```bash
node scripts/validate_migration_manifest.mjs \
  docs/visual/migration-manifest.json
```

El comando comprueba estructura, IDs, referencias, matriz completa, rutas seguras y
requisitos de aprobación. TOOL-VIS-02 añadirá el gate que inspecciona archivos de
captura y resultados finales; este validador no afirma por sí solo paridad visual.
