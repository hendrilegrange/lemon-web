<?php
/**
 * Lemon: player accounts and online saves.
 *
 *   GET  api.php?action=me        who is signed in, and a summary of their online save
 *   GET  api.php?action=load      the signed-in player's saved game
 *   POST api.php?action=register  { username, password }  creates an account and signs in
 *   POST api.php?action=login     { username, password }
 *   POST api.php?action=logout
 *   POST api.php?action=save      { game }  replaces the player's online save
 *
 * Every response is JSON through respond(). POSTs must carry X-Requested-With: XMLHttpRequest;
 * the API sends no CORS headers, so a page on another site can't add that header and a forged
 * cross-site request is refused. The session is an httponly cookie holding a random token;
 * only its SHA-256 is stored. Without config.php the API answers 503 and the game just keeps
 * saving in the browser.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!is_file(__DIR__ . '/config.php')) {
    respond(['error' => 'Accounts aren\'t set up on this server yet.', 'offline' => true], 503);
}
require __DIR__ . '/config.php';

const MAX_SAVE_BYTES = 256 * 1024;
const USERNAME_PATTERN = '/^[A-Za-z0-9_]{3,20}$/';
// [max requests, window in seconds] per IP
const RATE_LIMITS = ['login' => [10, 300], 'register' => [5, 3600]];

$action = $_GET['action'] ?? '';
$posts = ['register', 'login', 'logout', 'save'];
$gets = ['me', 'load'];
if (!in_array($action, $posts, true) && !in_array($action, $gets, true)) {
    respond(['error' => 'Unknown action'], 404);
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (in_array($action, $posts, true)) {
    if ($method !== 'POST') { header('Allow: POST'); respond(['error' => 'Method not allowed'], 405); }
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'XMLHttpRequest') respond(['error' => 'Invalid request'], 403);
} elseif ($method !== 'GET') {
    header('Allow: GET');
    respond(['error' => 'Method not allowed'], 405);
}

// ── Schema ─────────────────────────────────────────────────────────────────
// Created on first use, so setting up the server is only config.php

function createTables(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS lemon_users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(20) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS lemon_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        expires_at DATETIME NOT NULL,
        KEY user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES lemon_users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS lemon_saves (
        user_id INT UNSIGNED PRIMARY KEY,
        game MEDIUMTEXT NOT NULL,
        saved_at BIGINT NOT NULL,
        week INT NOT NULL,
        cash INT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES lemon_users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS lemon_rate_limits (
        ip VARCHAR(45) NOT NULL,
        action VARCHAR(20) NOT NULL,
        window_start INT UNSIGNED NOT NULL,
        hits INT UNSIGNED NOT NULL,
        PRIMARY KEY (ip, action, window_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

// ── Sessions ───────────────────────────────────────────────────────────────

function cookieOptions(int $expires): array {
    return [
        'expires'  => $expires,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function startSession(PDO $db, int $userId): void {
    $token = bin2hex(random_bytes(32));
    $db->prepare('INSERT INTO lemon_sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND)')
       ->execute([hash('sha256', $token), $userId, SESSION_LIFETIME]);
    setcookie(SESSION_COOKIE_NAME, $token, cookieOptions(time() + SESSION_LIFETIME));
    if (mt_rand(1, 50) === 1) $db->exec('DELETE FROM lemon_sessions WHERE expires_at < NOW()');
}

function currentUser(PDO $db): ?array {
    $token = $_COOKIE[SESSION_COOKIE_NAME] ?? '';
    if (!is_string($token) || $token === '') return null;
    $stmt = $db->prepare('SELECT u.id, u.username FROM lemon_sessions s JOIN lemon_users u ON u.id = s.user_id
                          WHERE s.token_hash = ? AND s.expires_at > NOW()');
    $stmt->execute([hash('sha256', $token)]);
    return $stmt->fetch() ?: null;
}

function requireUser(PDO $db): array {
    return currentUser($db) ?? respond(['error' => 'Sign in first.'], 401);
}

// Counts this request against the IP's limit for the action; refuses it once over
function rateLimit(PDO $db, string $action): void {
    if (!isset(RATE_LIMITS[$action])) return;
    [$max, $window] = RATE_LIMITS[$action];
    $ip = substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 45);
    $start = intdiv(time(), $window) * $window;
    $db->prepare('INSERT INTO lemon_rate_limits (ip, action, window_start, hits) VALUES (?, ?, ?, 1)
                  ON DUPLICATE KEY UPDATE hits = hits + 1')->execute([$ip, $action, $start]);
    $stmt = $db->prepare('SELECT hits FROM lemon_rate_limits WHERE ip = ? AND action = ? AND window_start = ?');
    $stmt->execute([$ip, $action, $start]);
    if ((int)$stmt->fetchColumn() > $max) respond(['error' => 'Too many tries. Wait a few minutes and try again.'], 429);
    if (mt_rand(1, 50) === 1) $db->prepare('DELETE FROM lemon_rate_limits WHERE window_start < ?')->execute([time() - 86400]);
}

function passwordAlgo(): string {
    return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
}

function body(): array {
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}

function saveSummary(PDO $db, int $userId): ?array {
    $stmt = $db->prepare('SELECT saved_at, week, cash FROM lemon_saves WHERE user_id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ? ['savedAt' => (int)$row['saved_at'], 'week' => (int)$row['week'], 'cash' => (int)$row['cash']] : null;
}

function credentials(): array {
    $in = body();
    $username = trim((string)($in['username'] ?? ''));
    $password = (string)($in['password'] ?? '');
    return [$username, $password];
}

// ── Actions ────────────────────────────────────────────────────────────────

function handle(PDO $db, string $action): never {
    rateLimit($db, $action);
    switch ($action) {
        case 'me':
            $user = currentUser($db);
            respond(['user' => $user ? ['username' => $user['username']] : null,
                     'save' => $user ? saveSummary($db, (int)$user['id']) : null]);

        case 'register':
            [$username, $password] = credentials();
            if (!preg_match(USERNAME_PATTERN, $username)) respond(['error' => 'Pick a name of 3 to 20 letters, numbers or underscores.'], 400);
            if (strlen($password) < 8 || strlen($password) > 200) respond(['error' => 'Use a password of at least 8 characters.'], 400);
            $hash = password_hash($password, passwordAlgo());
            try {
                $db->prepare('INSERT INTO lemon_users (username, password_hash) VALUES (?, ?)')->execute([$username, $hash]);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') respond(['error' => 'That name is taken. Try another.'], 409);
                throw $e;
            }
            startSession($db, (int)$db->lastInsertId());
            respond(['user' => ['username' => $username], 'save' => null]);

        case 'login':
            [$username, $password] = credentials();
            $stmt = $db->prepare('SELECT id, username, password_hash FROM lemon_users WHERE username = ?');
            $stmt->execute([$username]);
            $row = $stmt->fetch();
            // Check a password even for an unknown name, so the time taken doesn't tell
            $ok = password_verify($password, $row ? $row['password_hash'] : '$2y$10$JBVvGaeYEuHHKQjKARmUeuAHlmklDfzwF11fIYLCt4FaoeSrJaYvu');
            if (!$row || !$ok) respond(['error' => 'That name and password don\'t match.'], 401);
            if (password_needs_rehash($row['password_hash'], passwordAlgo())) {
                $db->prepare('UPDATE lemon_users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, passwordAlgo()), $row['id']]);
            }
            startSession($db, (int)$row['id']);
            respond(['user' => ['username' => $row['username']], 'save' => saveSummary($db, (int)$row['id'])]);

        case 'logout':
            $token = $_COOKIE[SESSION_COOKIE_NAME] ?? '';
            if (is_string($token) && $token !== '') $db->prepare('DELETE FROM lemon_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
            setcookie(SESSION_COOKIE_NAME, '', cookieOptions(time() - 3600));
            respond(['user' => null]);

        case 'load':
            $user = requireUser($db);
            $stmt = $db->prepare('SELECT game FROM lemon_saves WHERE user_id = ?');
            $stmt->execute([$user['id']]);
            $game = $stmt->fetchColumn();
            respond(['game' => $game === false ? null : json_decode($game, true)]);

        case 'save':
            $user = requireUser($db);
            $raw = file_get_contents('php://input') ?: '';
            if (strlen($raw) > MAX_SAVE_BYTES) respond(['error' => 'That save is too big.'], 413);
            $game = json_decode($raw, true)['game'] ?? null;
            if (!is_array($game) || !isset($game['week'], $game['cash'], $game['savedAt'])) respond(['error' => 'That isn\'t a saved game.'], 400);
            $db->prepare('INSERT INTO lemon_saves (user_id, game, saved_at, week, cash) VALUES (?, ?, ?, ?, ?)
                          ON DUPLICATE KEY UPDATE game = VALUES(game), saved_at = VALUES(saved_at), week = VALUES(week), cash = VALUES(cash)')
               ->execute([$user['id'], json_encode($game, JSON_UNESCAPED_UNICODE), (int)$game['savedAt'], (int)$game['week'], (int)$game['cash']]);
            respond(['ok' => true, 'save' => saveSummary($db, (int)$user['id'])]);
    }
    respond(['error' => 'Unknown action'], 404);
}

try {
    $db = getDB();
    try {
        handle($db, $action);
    } catch (PDOException $e) {
        if ($e->getCode() !== '42S02') throw $e;      // a table is missing: first run
        createTables($db);
        handle($db, $action);
    }
} catch (Throwable $e) {
    error_log('lemon api: ' . $e->getMessage());
    respond(['error' => 'The server had a problem. Your game is still saved in this browser.'], 500);
}
