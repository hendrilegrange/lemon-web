<?php
/**
 * Lemon: player accounts and online saves.
 *
 *   GET  api.php?action=me        who is signed in, and a summary of their online save
 *   GET  api.php?action=load      the signed-in player's saved game
 *   POST api.php?action=register  { username, email, password }  creates an account and signs in
 *   POST api.php?action=login     { username (or email), password }
 *   POST api.php?action=google    { credential }  Google sign-in; makes or links an account
 *   POST api.php?action=forgot    { email }  emails a password reset link
 *   POST api.php?action=reset     { token, password }  sets a new password from that link
 *   POST api.php?action=logout
 *   POST api.php?action=save      { game }  replaces the player's online save, and keeps any
 *                                 records in it that beat the player's best
 *   GET  api.php?action=leaders   the top 10 on each leaderboard; &board=et|rt|streak|cash for
 *                                 that board's top 100
 *
 * Google sign-in, email resets, the mailer and the CA bundle in certs/ are copied from dnd-web.
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
require __DIR__ . '/oauth.php';
require __DIR__ . '/mailer.php';

const MAX_SAVE_BYTES = 256 * 1024;
const USERNAME_PATTERN = '/^[A-Za-z0-9_]{3,20}$/';
// [max requests, window in seconds] per IP
// The leaderboards, each a column of lemon_records: [sort order, lowest and highest value
// believed]. The game runs in the browser, so a record is only as honest as its player; these
// bounds keep out the impossible ones (and the smoke test's save, whose cash is a timestamp).
const BOARDS = ['et' => ['ASC', 5, 60], 'rt' => ['ASC', 0, 2], 'streak' => ['DESC', 1, 100000], 'cash' => ['DESC', 1, 100000000],
                // fewest weeks from a new game to beating each era's King
                'k0' => ['ASC', 1, 100000], 'k1' => ['ASC', 1, 100000], 'k2' => ['ASC', 1, 100000],
                'k3' => ['ASC', 1, 100000], 'k4' => ['ASC', 1, 100000], 'k5' => ['ASC', 1, 100000]];
// The quarter mile and reaction boards started over from wins only: their own columns, filled
// only from saves marked winsOnly (the old et and rt columns, which counted losses, are left be)
const WIN_COLUMNS = ['et' => 'et_win', 'rt' => 'rt_win'];
const RATE_LIMITS = ['login' => [10, 300], 'register' => [5, 3600], 'google' => [20, 300], 'forgot' => [3, 300], 'reset' => [10, 300]];

$action = $_GET['action'] ?? '';
$posts = ['register', 'login', 'google', 'forgot', 'reset', 'logout', 'save'];
$gets = ['me', 'load', 'leaders'];
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
        email VARCHAR(254) NULL,
        password_hash VARCHAR(255) NULL,             -- NULL for a Google-only account
        google_sub VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY username (username),
        UNIQUE KEY email (email),
        UNIQUE KEY google_sub (google_sub)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS lemon_password_resets (
        token_hash CHAR(64) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        KEY user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES lemon_users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
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
    // Each player's all-time bests, and when each was set (the earlier wins a tie)
    $db->exec("CREATE TABLE IF NOT EXISTS lemon_records (
        user_id INT UNSIGNED PRIMARY KEY,
        et DECIMAL(6,3) NULL, et_at DATETIME NULL,
        rt DECIMAL(5,3) NULL, rt_at DATETIME NULL,
        streak INT UNSIGNED NULL, streak_at DATETIME NULL,
        cash INT UNSIGNED NULL, cash_at DATETIME NULL,
        KEY et (et), KEY rt (rt), KEY streak (streak), KEY cash (cash),
        FOREIGN KEY (user_id) REFERENCES lemon_users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // The King boards came later: add their columns to a table made before them
    $adds = [];
    for ($k = 0; $k <= 5; $k++) $adds[] = "ADD COLUMN IF NOT EXISTS k$k INT UNSIGNED NULL, ADD COLUMN IF NOT EXISTS k{$k}_at DATETIME NULL";
    $adds[] = 'ADD COLUMN IF NOT EXISTS et_win DECIMAL(6,3) NULL, ADD COLUMN IF NOT EXISTS et_win_at DATETIME NULL';
    $adds[] = 'ADD COLUMN IF NOT EXISTS rt_win DECIMAL(5,3) NULL, ADD COLUMN IF NOT EXISTS rt_win_at DATETIME NULL';
    $db->exec('ALTER TABLE lemon_records ' . implode(', ', $adds));
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

// The lemon_records column a board is kept in
function boardColumn(string $key): string {
    return WIN_COLUMNS[$key] ?? $key;
}

// Keeps the records in a saved game ($game['records']) that beat the player's best so far
function updateRecords(PDO $db, int $userId, array $game): void {
    $records = $game['records'] ?? null;
    if (!is_array($records) || !empty($game['smokeTest'])) return;
    $cols = array_map('boardColumn', array_keys(BOARDS));
    $stmt = $db->prepare('SELECT ' . implode(', ', $cols) . ' FROM lemon_records WHERE user_id = ?');
    $stmt->execute([$userId]);
    $best = $stmt->fetch() ?: [];
    $sets = [];
    $values = [];
    foreach (BOARDS as $key => [$order, $min, $max]) {
        $v = $records[$key] ?? null;
        if (!is_int($v) && !is_float($v) || $v < $min || $v > $max) continue;
        if (isset(WIN_COLUMNS[$key]) && empty($records['winsOnly'])) continue;     // an older game.js, which counted losses
        $col = boardColumn($key);
        $old = $best[$col] ?? null;
        if ($old !== null && ($order === 'ASC' ? $v >= (float)$old : $v <= (float)$old)) continue;
        $sets[] = "$col = ?, {$col}_at = NOW()";
        $values[] = $v;
    }
    if (!$sets) return;
    if (!$best) $db->prepare('INSERT IGNORE INTO lemon_records (user_id) VALUES (?)')->execute([$userId]);
    $values[] = $userId;
    $db->prepare('UPDATE lemon_records SET ' . implode(', ', $sets) . ' WHERE user_id = ?')->execute($values);
}

function badPassword(string $password): ?string {
    return strlen($password) < 8 || strlen($password) > 200 ? 'Use a password of at least 8 characters.' : null;
}

function signedIn(PDO $db, array $user): never {
    startSession($db, (int)$user['id']);
    respond(['user' => ['username' => $user['username']], 'save' => saveSummary($db, (int)$user['id'])]);
}

// A free username for a new Google account, made from the Google name or email
function freeUsername(PDO $db, string $name, string $email): string {
    $base = preg_replace('/[^A-Za-z0-9_]/', '', str_replace(' ', '_', $name));
    if (strlen($base) < 3) $base = preg_replace('/[^A-Za-z0-9_]/', '', strtok($email, '@') ?: '');
    if (strlen($base) < 3) $base = 'driver';
    $base = substr($base, 0, 16);
    $stmt = $db->prepare('SELECT 1 FROM lemon_users WHERE username = ?');
    for ($i = 0; $i < 50; $i++) {
        $name = $i === 0 ? $base : $base . random_int(10, 9999);
        $stmt->execute([$name]);
        if (!$stmt->fetchColumn()) return $name;
    }
    return 'driver' . bin2hex(random_bytes(4));
}

// ── Actions ────────────────────────────────────────────────────────────────

function handle(PDO $db, string $action): never {
    rateLimit($db, $action);
    switch ($action) {
        case 'me':
            $user = currentUser($db);
            respond(['user' => $user ? ['username' => $user['username']] : null,
                     'save' => $user ? saveSummary($db, (int)$user['id']) : null,
                     'google' => defined('GOOGLE_CLIENT_ID') ? GOOGLE_CLIENT_ID : '']);

        case 'register':
            $in = body();
            $username = trim((string)($in['username'] ?? ''));
            $email = strtolower(trim((string)($in['email'] ?? '')));
            $password = (string)($in['password'] ?? '');
            if (!preg_match(USERNAME_PATTERN, $username)) respond(['error' => 'Pick a name of 3 to 20 letters, numbers or underscores.'], 400);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) respond(['error' => 'Enter your email address, for password resets.'], 400);
            if ($err = badPassword($password)) respond(['error' => $err], 400);
            try {
                $db->prepare('INSERT INTO lemon_users (username, email, password_hash) VALUES (?, ?, ?)')
                   ->execute([$username, $email, password_hash($password, passwordAlgo())]);
            } catch (PDOException $e) {
                if ($e->getCode() !== '23000') throw $e;
                $taken = $db->prepare('SELECT 1 FROM lemon_users WHERE email = ?');
                $taken->execute([$email]);
                respond(['error' => $taken->fetchColumn()
                    ? 'That email already has an account. Sign in, or reset the password.'
                    : 'That name is taken. Try another.'], 409);
            }
            signedIn($db, ['id' => (int)$db->lastInsertId(), 'username' => $username]);

        case 'login':
            $in = body();
            $username = trim((string)($in['username'] ?? ''));
            $password = (string)($in['password'] ?? '');
            $stmt = $db->prepare('SELECT id, username, password_hash FROM lemon_users WHERE ' . (str_contains($username, '@') ? 'email' : 'username') . ' = ?');
            $stmt->execute([str_contains($username, '@') ? strtolower($username) : $username]);
            $row = $stmt->fetch();
            // Check a password even for an unknown name, so the time taken doesn't tell
            $ok = password_verify($password, $row && $row['password_hash'] ? $row['password_hash'] : '$2y$10$JBVvGaeYEuHHKQjKARmUeuAHlmklDfzwF11fIYLCt4FaoeSrJaYvu');
            if (!$row || !$ok) respond(['error' => $row && !$row['password_hash']
                ? 'That account signs in with Google. Use the Google button, or reset the password to set one.'
                : 'That name and password don\'t match.'], 401);
            if (password_needs_rehash($row['password_hash'], passwordAlgo())) {
                $db->prepare('UPDATE lemon_users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, passwordAlgo()), $row['id']]);
            }
            signedIn($db, $row);

        case 'google':
            $g = verifyGoogleIdToken((string)(body()['credential'] ?? ''), $reason);
            if (!$g) {
                error_log('lemon google: ' . $reason);
                respond(['error' => 'Couldn\'t check your Google sign-in: ' . $reason . '.'], 401);
            }
            $email = strtolower($g['email']);
            $stmt = $db->prepare('SELECT id, username, google_sub FROM lemon_users WHERE google_sub = ?');
            $stmt->execute([$g['sub']]);
            $row = $stmt->fetch();
            if (!$row && $email !== '') {
                // Google has checked the address, so an account made with it is this player's
                $stmt = $db->prepare('SELECT id, username, google_sub FROM lemon_users WHERE email = ?');
                $stmt->execute([$email]);
                $row = $stmt->fetch();
                if ($row && $row['google_sub'] === null) {
                    $db->prepare('UPDATE lemon_users SET google_sub = ? WHERE id = ?')->execute([$g['sub'], $row['id']]);
                } elseif ($row) {
                    respond(['error' => 'That email belongs to an account linked to another Google login.'], 409);
                }
            }
            if (!$row) {
                $username = freeUsername($db, $g['name'], $email);
                $db->prepare('INSERT INTO lemon_users (username, email, google_sub) VALUES (?, ?, ?)')
                   ->execute([$username, $email === '' ? null : $email, $g['sub']]);
                $row = ['id' => (int)$db->lastInsertId(), 'username' => $username];
            }
            signedIn($db, $row);

        case 'forgot':
            $email = strtolower(trim((string)(body()['email'] ?? '')));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(['error' => 'Enter the email address on your account.'], 400);
            $stmt = $db->prepare('SELECT id, username FROM lemon_users WHERE email = ?');
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            if ($user) {
                $db->prepare('UPDATE lemon_password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL')->execute([$user['id']]);
                $token = bin2hex(random_bytes(32));
                $db->prepare('INSERT INTO lemon_password_resets (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 1 HOUR)')
                   ->execute([hash('sha256', $token), $user['id']]);
                $link = rtrim(APP_URL, '/') . '/?reset_token=' . urlencode($token);
                $body = "Hi {$user['username']},\n\nSomeone asked to reset the password for your Lemon account. " .
                        "To choose a new one, open this link:\n\n{$link}\n\nIt works once, for an hour. " .
                        "If it wasn't you, ignore this email: your password stays as it is.\n";
                // A failure is logged, not shown, so the answer never says whether the email has an account
                if (!sendMail($email, 'Lemon: reset your password', $body, $mailError)) {
                    error_log('lemon forgot: email failed for user ' . $user['id'] . ': ' . $mailError);
                }
            }
            respond(['message' => 'If that email has an account, a reset link is on its way. It works for an hour.']);

        case 'reset':
            $in = body();
            $token = (string)($in['token'] ?? '');
            $password = (string)($in['password'] ?? '');
            if ($err = badPassword($password)) respond(['error' => $err], 400);
            $hash = hash('sha256', $token);
            $stmt = $db->prepare('SELECT r.user_id, u.username FROM lemon_password_resets r JOIN lemon_users u ON u.id = r.user_id
                                  WHERE r.token_hash = ? AND r.expires_at > NOW() AND r.used_at IS NULL');
            $stmt->execute([$hash]);
            $row = $stmt->fetch();
            if (!$row) respond(['error' => 'That reset link has expired or was already used. Ask for a new one.'], 400);
            $db->prepare('UPDATE lemon_password_resets SET used_at = NOW() WHERE token_hash = ?')->execute([$hash]);
            $db->prepare('UPDATE lemon_users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, passwordAlgo()), $row['user_id']]);
            // Sign out everywhere, in case someone else knew the old password, then sign in here
            $db->prepare('DELETE FROM lemon_sessions WHERE user_id = ?')->execute([$row['user_id']]);
            signedIn($db, ['id' => (int)$row['user_id'], 'username' => $row['username']]);

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
            updateRecords($db, (int)$user['id'], $game);
            respond(['ok' => true, 'save' => saveSummary($db, (int)$user['id'])]);

        case 'leaders':
            $board = (string)($_GET['board'] ?? '');
            if ($board !== '' && !isset(BOARDS[$board])) respond(['error' => 'No such leaderboard.'], 400);
            $limit = $board === '' ? 10 : 100;
            $boards = [];
            foreach ($board === '' ? array_keys(BOARDS) : [$board] as $key) {
                $order = BOARDS[$key][0];
                $col = boardColumn($key);
                $rows = $db->query("SELECT u.username, r.$col AS v FROM lemon_records r JOIN lemon_users u ON u.id = r.user_id
                                    WHERE r.$col IS NOT NULL ORDER BY r.$col $order, r.{$col}_at, r.user_id LIMIT $limit")->fetchAll();
                $boards[$key] = array_map(fn($row) => ['name' => $row['username'], 'value' => $key === 'et' || $key === 'rt' ? (float)$row['v'] : (int)$row['v']], $rows);
            }
            respond(['boards' => $boards]);
    }
    respond(['error' => 'Unknown action'], 404);
}

try {
    $db = getDB();
    try {
        handle($db, $action);
    } catch (PDOException $e) {
        // a table is missing (first run) or a column is (a board added since): make them
        if ($e->getCode() !== '42S02' && $e->getCode() !== '42S22') throw $e;
        createTables($db);
        handle($db, $action);
    }
} catch (Throwable $e) {
    error_log('lemon api: ' . $e->getMessage());
    respond(['error' => 'The server had a problem. Your game is still saved in this browser.'], 500);
}
