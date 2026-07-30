<?php
/**
 * Soft-delete a potential lead: status active → inactive.
 * Upload this NEW file next to auth.php / leads.php on Merlin
 * (do not replace leads.php — just add this file).
 *
 * POST|PUT|PATCH /lead_deactivate.php?id=6
 * Authorization: Bearer <token>
 *
 * Runs: UPDATE potential_leads SET status = 'inactive' WHERE id = ?
 */
require __DIR__ . '/cors.php';
require __DIR__ . '/response.php';
require __DIR__ . '/config.php';
require __DIR__ . '/require_auth.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    send_error('Method not allowed', 405);
}

$id = (int) ($_GET['id'] ?? 0);
if (!$id) {
    $body = get_json_body();
    $id = (int) ($body['id'] ?? 0);
}
if (!$id) send_error('id is required', 422);

$exists = $conn->query("SELECT id, status FROM potential_leads WHERE id = $id")->fetch_assoc();
if (!$exists) send_error('Not found', 404);

$stmt = $conn->prepare("UPDATE potential_leads SET status = 'inactive' WHERE id = ?");
$stmt->bind_param('i', $id);
$stmt->execute();

$row = $conn->query("SELECT * FROM potential_leads WHERE id = $id")->fetch_assoc();
if (!$row || strtolower((string) $row['status']) !== 'inactive') {
    send_error('Failed to mark lead inactive', 500);
}

send_ok($row, 'Marked inactive');
