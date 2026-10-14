<?php
/**
 * Lemon: Google sign-in. Verifies the ID token from Google Identity Services on the
 * server. Copied from dnd-web's oauth.php. Requires config.php to be loaded first.
 */

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE SIGN-IN (Google Identity Services)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify a Google ID token (JWT credential from GIS).
 *
 * Uses Google's tokeninfo endpoint for simplicity (no JWT library needed).
 * For higher security at scale, implement local JWT verification with
 * Google's public keys from https://www.googleapis.com/oauth2/v3/certs
 *
 * Returns ['sub', 'email', 'name', 'picture'] or null on failure,
 * with $reason set to a short, non-secret explanation of what failed.
 */
function verifyGoogleIdToken(string $idToken, ?string &$reason = null): ?array {
    if (!defined('GOOGLE_CLIENT_ID') || GOOGLE_CLIENT_ID === '') {
        $reason = 'Google sign-in is not configured on the server';
        return null;
    }

    // Call Google's tokeninfo endpoint
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
    $response = httpGet($url, $httpError);
    if ($response === null) {
        $reason = $httpError === 'HTTP 400'
            ? 'Google did not accept the token'
            : 'the server could not check the token with Google (' . $httpError . ')';
        return null;
    }

    $data = json_decode($response, true);
    if (!$data || !isset($data['sub'])) {
        $reason = 'Google did not accept the token';
        return null;
    }

    // Verify the audience matches our client ID
    if (($data['aud'] ?? '') !== GOOGLE_CLIENT_ID) {
        $reason = 'the token was issued for a different Google client ID than the one in config.php';
        return null;
    }

    // Verify the issuer
    $validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!in_array($data['iss'] ?? '', $validIssuers, true)) {
        $reason = 'the token has an unexpected issuer';
        return null;
    }

    // Check expiry
    if (isset($data['exp']) && (int)$data['exp'] < time()) {
        $reason = 'the token has expired (check the server clock)';
        return null;
    }

    return [
        'sub'     => $data['sub'],
        'email'   => $data['email'] ?? '',
        'name'    => $data['name'] ?? ($data['given_name'] ?? 'User'),
        'picture' => $data['picture'] ?? null,
    ];
}

/**
 * GET a URL and return the body, or null on failure.
 * Prefers cURL, because shared hosts often disable allow_url_fopen.
 */
function httpGet(string $url, ?string &$error = null): ?string {
    // The host's PHP has no CA bundle configured, so ship Mozilla's (from certifi) with the site
    $caFile = __DIR__ . '/certs/cacert.pem';
    $hasCa = is_readable($caFile);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        if ($hasCa) curl_setopt($ch, CURLOPT_CAINFO, $caFile);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        if ($body === false) {
            $error = 'cURL: ' . $curlError;
            error_log('httpGet: ' . $error . ' for ' . parse_url($url, PHP_URL_HOST));
            return null;
        }
        if ($status !== 200) {
            $error = 'HTTP ' . $status;
            return null;
        }
        return $body;
    }
    $context = $hasCa ? stream_context_create(['ssl' => ['cafile' => $caFile, 'verify_peer' => true]]) : null;
    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        $error = 'file_get_contents failed, allow_url_fopen may be off';
        error_log('httpGet: ' . $error . ' for ' . parse_url($url, PHP_URL_HOST));
        return null;
    }
    return $body;
}
