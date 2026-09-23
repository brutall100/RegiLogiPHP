<?php
// JSON API for registration and login.
// Actions: stats (GET), me (GET), register (POST), login (POST), logout (POST).

declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Strict',
    'secure' => !empty($_SERVER['HTTPS']),
]);
session_start();

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function hash_preview(string $hash): string
{
    return substr($hash, 0, 18) . '…' . substr($hash, -6);
}

function current_user(PDO $pdo): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT name, password_hash FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch();
    return $row ? ['name' => $row['name'], 'hashPreview' => hash_preview($row['password_hash'])] : null;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

try {
    $pdo = db();

    switch ($action) {
        case 'stats':
            $users = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            $logins = (int) $pdo->query('SELECT COALESCE(SUM(login_count), 0) FROM users')->fetchColumn();
            respond(['ok' => true, 'users' => $users, 'logins' => $logins]);

        case 'me':
            respond(['ok' => true, 'user' => current_user($pdo)]);

        case 'register':
            if (!$isPost) {
                respond(['ok' => false, 'message' => 'Naudok POST.'], 405);
            }
            $name = trim((string) ($_POST['name'] ?? ''));
            $email = strtolower(trim((string) ($_POST['email'] ?? '')));
            $password = (string) ($_POST['password'] ?? '');

            if (!preg_match('/^[A-Za-z0-9_.\-]{3,32}$/', $name)) {
                respond(['ok' => false, 'message' => 'Vardas: 3–32 simboliai (raidės, skaičiai, _ . -).']);
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
                respond(['ok' => false, 'message' => 'Neteisingas el. pašto adresas.']);
            }
            if (strlen($password) < 8) {
                respond(['ok' => false, 'message' => 'Slaptažodis turi būti bent 8 simbolių.']);
            }

            $stmt = $pdo->prepare('SELECT 1 FROM users WHERE LOWER(name) = LOWER(?) OR email = ?');
            $stmt->execute([$name, $email]);
            if ($stmt->fetchColumn()) {
                respond(['ok' => false, 'message' => 'Toks vartotojas arba el. paštas jau užregistruotas.']);
            }

            $stmt = $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
            $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
            respond(['ok' => true, 'message' => 'Paskyra sukurta! Dabar prisijunk.'], 201);

        case 'login':
            if (!$isPost) {
                respond(['ok' => false, 'message' => 'Naudok POST.'], 405);
            }
            $name = trim((string) ($_POST['name'] ?? ''));
            $password = (string) ($_POST['password'] ?? '');

            $stmt = $pdo->prepare('SELECT id, name, password_hash FROM users WHERE LOWER(name) = LOWER(?)');
            $stmt->execute([$name]);
            $user = $stmt->fetch();

            if (!$user || !password_verify($password, $user['password_hash'])) {
                respond(['ok' => false, 'message' => 'Neteisingas vardas arba slaptažodis.']);
            }

            if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
                $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
            }
            $pdo->prepare('UPDATE users SET login_count = login_count + 1 WHERE id = ?')->execute([$user['id']]);

            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $user['id'];
            respond(['ok' => true, 'message' => 'Prisijungta!', 'user' => current_user($pdo)]);

        case 'logout':
            if (!$isPost) {
                respond(['ok' => false, 'message' => 'Naudok POST.'], 405);
            }
            $_SESSION = [];
            session_destroy();
            respond(['ok' => true, 'message' => 'Atsijungta.']);

        default:
            respond(['ok' => false, 'message' => 'Nežinomas veiksmas.'], 400);
    }
} catch (Throwable $e) {
    // Log the real error for the developer, show a safe message to the visitor.
    error_log('auth.php: ' . $e->getMessage());
    respond(['ok' => false, 'message' => 'Serverio klaida. Bandyk vėliau.'], 500);
}
