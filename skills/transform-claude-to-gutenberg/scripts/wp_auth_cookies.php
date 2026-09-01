<?php
/**
 * Emite las cookies de autenticación reales de WordPress para un usuario, en
 * JSON, sin imprimir la contraseña ni ningún secreto de configuración.
 *
 * Uso: wp eval-file wp_auth_cookies.php <user_id>
 *
 * Existe porque Playwright necesita una sesión autenticada real para abrir el
 * editor de bloques, y WP-CLI no expone un comando nativo para generarla; este
 * script reutiliza las mismas funciones que WordPress usa al iniciar sesión
 * por HTTP (wp_generate_auth_cookie()), así que el editor las acepta como
 * cualquier sesión real.
 *
 * `wp eval-file` solo pasa argumentos posicionales (variable `$args`), nunca
 * `--flag=valor`, a diferencia de un comando normal de WP-CLI.
 *
 * @package Vicunav_Transform_Claude_To_Gutenberg
 */

$user_id = isset( $args[0] ) ? (int) $args[0] : 0;
if ( $user_id <= 0 ) {
	WP_CLI::error( 'Falta --user_id=<id>.' );
}

$user = get_user_by( 'id', $user_id );
if ( ! $user ) {
	WP_CLI::error( "No existe el usuario {$user_id}." );
}

$expiration = time() + 2 * HOUR_IN_SECONDS;
$scheme     = is_ssl() ? 'secure_auth' : 'auth';
$auth_cookie_name = is_ssl() ? SECURE_AUTH_COOKIE : AUTH_COOKIE;

$auth_cookie      = wp_generate_auth_cookie( $user_id, $expiration, $scheme );
$logged_in_cookie = wp_generate_auth_cookie( $user_id, $expiration, 'logged_in' );

$domain = defined( 'COOKIE_DOMAIN' ) && COOKIE_DOMAIN ? COOKIE_DOMAIN : wp_parse_url( home_url(), PHP_URL_HOST );

echo wp_json_encode(
	array(
		'domain'     => $domain,
		'expiration' => $expiration,
		'cookies'    => array(
			array(
				'name'  => $auth_cookie_name,
				'value' => $auth_cookie,
				'path'  => defined( 'ADMIN_COOKIE_PATH' ) ? ADMIN_COOKIE_PATH : '/wp-admin',
			),
			array(
				'name'  => LOGGED_IN_COOKIE,
				'value' => $logged_in_cookie,
				'path'  => defined( 'COOKIEPATH' ) ? COOKIEPATH : '/',
			),
			array(
				'name'  => LOGGED_IN_COOKIE,
				'value' => $logged_in_cookie,
				'path'  => defined( 'SITECOOKIEPATH' ) ? SITECOOKIEPATH : '/wp-admin',
			),
		),
	)
);
