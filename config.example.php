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
