# Operación segura con LocalWP

## Localizar y verificar el sitio

1. Resolver la ruta absoluta del sitio. En macOS suele contener
   `Local Sites/<slug>/app/public`, pero no asumirla sin inspección.
2. Confirmar que existen `wp-config.php`, `wp-content/` y el theme objetivo.
3. Obtener versión de WordPress, PHP, URL y theme activo con comandos de solo
   lectura antes de cambiar archivos o base de datos.
4. Usar el PHP, WP-CLI y variables que LocalWP expone para el sitio cuando estén
   disponibles.
5. No imprimir contraseñas, salts, tokens ni claves de integración.

## Diagnosticar la base de datos

Si PHP o WP-CLI muestran `Error establishing a database connection`, comprobar
el socket de LocalWP antes de modificar código:

- inspeccionar `DB_NAME`, `DB_USER` y `DB_HOST` sin mostrar `DB_PASSWORD`;
- localizar sockets candidatos en
  `~/Library/Application Support/Local/run/*/mysql/mysqld.sock`;
- identificar el sitio mediante una consulta de solo lectura a
  `wp_options.home` o `siteurl`;
- ejecutar PHP con `mysqli.default_socket` y
  `pdo_mysql.default_socket` apuntando al socket correcto.

Tratar una página HTML de error de WordPress como fallo aunque el proceso PHP
termine con código 0.

## Preservar el estado local

- Revisar `git status` en el theme o repositorio antes de escribir.
- No sobrescribir un theme existente sin inventariar sus cambios.
- Antes de reemplazar contenido o configuración, crear un respaldo recuperable
  del alcance afectado y registrar su ruta.
- No eliminar customizaciones de Global Styles guardadas en la base de datos.
  Detectarlas y explicar si ocultan cambios de `theme.json`.
- No actualizar plugins, WordPress o PHP como efecto colateral de la migración.
- No usar búsquedas y reemplazos amplios sin `--dry-run` y sin confirmar prefijo,
  URL y tablas objetivo.

## Instalar el theme

Preferir este orden:

1. desarrollar el theme como directorio versionado fuera o dentro de
   `wp-content/themes`, según el contrato del proyecto;
2. validar archivos estáticamente;
3. enlazar o copiar al sitio local mediante el flujo documentado;
4. confirmar el theme con `wp theme list`;
5. activar solo el slug exacto autorizado;
6. limpiar cachés locales aplicables;
7. comprobar frontend y Site Editor.

No asumir que activar el theme importa páginas o establece la portada.

## Crear contenido sin duplicados

- Buscar primero por ID o slug exacto.
- Crear una página solo si no existe.
- Si existe, comparar y respaldar su `post_content` antes de actualizar.
- Mantener un mapa estable entre archivo fuente, slug e ID WordPress.
- Establecer `show_on_front` y `page_on_front` únicamente después de validar el
  ID correcto.
- No publicar formularios funcionales con destinos simulados o credenciales de
  prueba incrustadas.

## Verificar el entorno efectivo

Registrar:

- URL local probada;
- slug y versión del theme activo;
- versión de WordPress y PHP;
- páginas creadas o actualizadas con sus IDs;
- customizaciones de base de datos que afecten estilos o templates;
- comandos de rollback para archivos, contenido y opciones.
