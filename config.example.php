<?php
/**
 * Lemon: database settings for player accounts and online saves.
 *
 * TEMPLATE: copy to config.php next to api.php on the server and fill in the real values.
 * config.php is git-ignored and the pipeline never uploads it, so the password only ever
 * lives on the server.
 *
 * Setup in SolidCP:
 *   1. Databases → MariaDB → create a database (or reuse dnd-web's: every table here
 *      starts with lemon_, so they don't collide)
 *   2. Create a user with a strong password and give it full rights on that database
 *   3. Fill in the values below (SolidCP may prefix names with your account name)
 * api.php creates its tables on first use.
 */

define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'your_db_name');
define('DB_USER', 'your_db_user');
define('DB_PASS', 'change-me');

define('SESSION_LIFETIME', 90 * 24 * 60 * 60);   // stay signed in for 90 days
define('SESSION_COOKIE_NAME', 'lemon_session');
define('APP_URL', 'https://lemon.dontbeone.co.za');   // reset links point here

// Google sign-in: the same client ID as dnd-web works, once https://lemon.dontbeone.co.za is
// added to its Authorized JavaScript origins (console.cloud.google.com → APIs & Services →
// Credentials → the OAuth client). Leave empty to hide the Google button.
define('GOOGLE_CLIENT_ID', '');

// Outgoing email for password resets: the same mailbox as dnd-web's config.php works.
// Leave SMTP_HOST empty to fall back to PHP mail().
define('SMTP_HOST', '');            // e.g. 'mail.dontbeone.co.za', matching the mail server's certificate
define('SMTP_PORT', 587);           // 587 with 'tls', 465 with 'ssl'
define('SMTP_SECURE', 'tls');       // 'tls' (STARTTLS), 'ssl' or '' (local testing only)
define('SMTP_USER', '');            // full mailbox address, e.g. 'noreply@dontbeone.co.za'
define('SMTP_PASS', '');
define('MAIL_FROM', '');            // usually the same as SMTP_USER
define('MAIL_FROM_NAME', 'Lemon');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
