<?php
/**
 * Lemon: outgoing email (password resets). Copied from dnd-web's mailer.php.
 *
 * Sends through an SMTP mailbox when SMTP_HOST is set in config.php,
 * otherwise falls back to PHP mail() (which needs SMTP set up in php.ini).
 * Requires config.php to be loaded first.
 */

/**
 * Send a plain-text email. Returns true on success; on failure logs why and,
 * when given, sets $error to a short reason.
 */
function sendMail(string $to, string $subject, string $body, ?string &$error = null): bool {
    $from = defined('MAIL_FROM') && MAIL_FROM !== '' ? MAIL_FROM : 'noreply@' . parse_url(APP_URL, PHP_URL_HOST);
    $fromName = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : 'Lemon';

    if (!defined('SMTP_HOST') || SMTP_HOST === '') {
        $headers = 'From: ' . encodeHeader($fromName) . " <$from>\r\nContent-Type: text/plain; charset=UTF-8\r\n";
        if (mail($to, encodeHeader($subject), $body, $headers)) return true;
        $error = 'mail() failed; set SMTP_HOST in config.php';
        error_log('sendMail: ' . $error);
        return false;
    }

    try {
        smtpSend($to, $from, $fromName, $subject, $body);
        return true;
    } catch (RuntimeException $e) {
        $error = $e->getMessage();
        error_log('sendMail: ' . $error);
        return false;
    }
}

function encodeHeader(string $text): string {
    return preg_match('/[^\x20-\x7E]/', $text) ? '=?UTF-8?B?' . base64_encode($text) . '?=' : $text;
}

/** Minimal SMTP client: implicit TLS (465), STARTTLS (587) or plain, with AUTH LOGIN. Throws on failure. */
function smtpSend(string $to, string $from, string $fromName, string $subject, string $body): void {
    $secure = defined('SMTP_SECURE') ? SMTP_SECURE : 'tls';    // 'ssl' (port 465), 'tls' (STARTTLS, port 587) or ''
    $port = defined('SMTP_PORT') ? (int)SMTP_PORT : ($secure === 'ssl' ? 465 : 587);
    $caFile = __DIR__ . '/certs/cacert.pem';
    $context = stream_context_create(['ssl' => array_filter([
        'verify_peer' => true,
        'verify_peer_name' => true,
        'cafile' => is_readable($caFile) ? $caFile : null,
    ], fn($v) => $v !== null)]);

    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . SMTP_HOST . ':' . $port;
    $sock = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!$sock) throw new RuntimeException("could not connect to $remote ($errstr)");
    stream_set_timeout($sock, 15);

    $read = function () use ($sock): array {
        $text = '';
        while (($line = fgets($sock, 515)) !== false) {
            $text .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;   // last line of a multi-line reply
        }
        return [(int)substr($text, 0, 3), trim($text)];
    };
    $cmd = function (string $line, array $expect) use ($sock, $read): string {
        fwrite($sock, $line . "\r\n");
        [$code, $text] = $read();
        if (!in_array($code, $expect, true)) {
            $shown = str_starts_with($line, 'AUTH') || !preg_match('/^[A-Z]/', $line) ? '(credentials)' : strtok($line, ' ');
            throw new RuntimeException("SMTP $shown got: $text");
        }
        return $text;
    };

    try {
        [$code, $text] = $read();
        if ($code !== 220) throw new RuntimeException("SMTP greeting: $text");
        $helo = parse_url(APP_URL, PHP_URL_HOST) ?: 'localhost';
        $cmd("EHLO $helo", [250]);

        if ($secure === 'tls') {
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new RuntimeException('STARTTLS handshake failed (certificate name must match SMTP_HOST)');
            }
            $cmd("EHLO $helo", [250]);
        }

        if (defined('SMTP_USER') && SMTP_USER !== '') {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode(SMTP_USER), [334]);
            $cmd(base64_encode(SMTP_PASS), [235]);
        }

        $cmd("MAIL FROM:<$from>", [250]);
        $cmd("RCPT TO:<$to>", [250, 251]);
        $cmd('DATA', [354]);

        $headers = [
            'Date: ' . date('r'),
            'From: ' . encodeHeader($fromName) . " <$from>",
            "To: <$to>",
            'Subject: ' . encodeHeader($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . "@$helo>",
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        $text = str_replace(["\r\n", "\r"], "\n", $body);
        $text = preg_replace('/^\./m', '..', $text);                 // dot-stuffing
        $cmd(implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $text) . "\r\n.", [250]);
        $cmd('QUIT', [221]);
    } finally {
        fclose($sock);
    }
}
