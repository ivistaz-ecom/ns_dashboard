<?php
require __DIR__ . '/cors.php';
require __DIR__ . '/response.php';
require __DIR__ . '/config.php';
require __DIR__ . '/require_auth.php';
require __DIR__ . '/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------
// GET /leads.php                     -> list, filterable
// GET /leads.php?id=8                -> single lead (joined names)
// POST /leads.php                    -> create
// PUT /leads.php?id=8                -> update
// PUT /leads.php?id=8&action=convert -> convert lead into a company row
// DELETE /leads.php?id=8            -> soft delete (status = inactive)
// DELETE /leads.php?id=8&hard=1     -> permanently remove the row
// ---------------------------------------------------------------------

const LEAD_SELECT = "
    SELECT pl.*, c.country_name, t.type_name AS mgmt_type_name, u.name AS user_name
    FROM potential_leads pl
    LEFT JOIN country c ON c.id = pl.country_id
    LEFT JOIN type t ON t.id = pl.mgmt_type_id
    LEFT JOIN users u ON u.id = pl.user_id
";

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $id = (int) $_GET['id'];
        $stmt = $conn->prepare(LEAD_SELECT . " WHERE pl.id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) send_error('Not found', 404);
        send_ok($row);
    }

    [$page, $per_page, $offset] = paginate_params();
    // Soft-deleted leads use status = 'inactive'. Hide them by default
    // (mirrors companies.php is_deleted / country status filters).
    // Pass include_inactive=1 to include inactive rows.
    $where = [];
    $types = '';
    $params = [];

    $include_inactive = isset($_GET['include_inactive']) && $_GET['include_inactive'] === '1';
    if (!$include_inactive) {
        // Case-insensitive so Active/Inactive and active/inactive both hide.
        $where[] = "(pl.status IS NULL OR LOWER(pl.status) <> 'inactive')";
    }
    if (!empty($_GET['lead_status'])) { $where[] = 'pl.lead_status = ?'; $types .= 's'; $params[] = $_GET['lead_status']; }
    if (!empty($_GET['status']))      { $where[] = 'pl.status = ?';      $types .= 's'; $params[] = $_GET['status']; }
    if (!empty($_GET['user_id']))     { $where[] = 'pl.user_id = ?';     $types .= 'i'; $params[] = (int) $_GET['user_id']; }
    if (!empty($_GET['country']))     { $where[] = 'c.country_name = ?'; $types .= 's'; $params[] = $_GET['country']; }
    if (!empty($_GET['mgmt_type']))   { $where[] = 't.type_name = ?';    $types .= 's'; $params[] = $_GET['mgmt_type']; }
    if (!empty($_GET['search']))      { $where[] = 'pl.company_name LIKE ?'; $types .= 's'; $params[] = '%' . $_GET['search'] . '%'; }

    $where_sql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $count_sql = "SELECT COUNT(*) AS total FROM potential_leads pl
                  LEFT JOIN country c ON c.id = pl.country_id
                  LEFT JOIN type t ON t.id = pl.mgmt_type_id
                  $where_sql";
    $count_stmt = $conn->prepare($count_sql);
    if ($types) $count_stmt->bind_param($types, ...$params);
    $count_stmt->execute();
    $total = (int) $count_stmt->get_result()->fetch_assoc()['total'];

    $sql = LEAD_SELECT . " $where_sql ORDER BY pl.id DESC LIMIT ? OFFSET ?";
    $stmt = $conn->prepare($sql);
    $all_types = $types . 'ii';
    $all_params = array_merge($params, [$per_page, $offset]);
    $stmt->bind_param($all_types, ...$all_params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    send_ok(['items' => $rows, 'page' => $page, 'per_page' => $per_page, 'total' => $total]);
}

if ($method === 'POST') {
    $body = get_json_body();
    require_fields($body, ['company_name']);

    $stmt = $conn->prepare("
        INSERT INTO potential_leads
            (user_id, company_name, country_id, contact_name, source, mgmt_type_id, lead_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $user_id = $body['user_id'] ?? null;
    $country_id = $body['country_id'] ?? null;
    $contact_name = $body['contact_name'] ?? null;
    $source = $body['source'] ?? null;
    $mgmt_type_id = $body['mgmt_type_id'] ?? null;
    $lead_status = $body['lead_status'] ?? 'New';
    $notes = $body['notes'] ?? null;
    $stmt->bind_param(
        'isississ',
        $user_id, $body['company_name'], $country_id, $contact_name, $source, $mgmt_type_id, $lead_status, $notes
    );
    $stmt->execute();
    $new_id = $conn->insert_id;

    $row = $conn->query("SELECT * FROM potential_leads WHERE id = $new_id")->fetch_assoc();
    send_json(true, $row, 'Lead created', 201);
}

if ($method === 'PUT' || $method === 'PATCH') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('id query param is required', 422);
    
    // ---- Special action: convert a qualified lead into a company row ----
    if (($_GET['action'] ?? '') === 'convert') {
        $lead = $conn->query("SELECT * FROM potential_leads WHERE id = $id")->fetch_assoc();
        if (!$lead) send_error('Lead not found', 404);

        $body = get_json_body(); // optional overrides: stage_id, month, week_label, user_id

        $stage_id = $body['stage_id'] ?? null;
        $month = $body['month'] ?? null;
        $week_label = $body['week_label'] ?? null;
        $user_id = $body['user_id'] ?? $lead['user_id'];

        $stmt = $conn->prepare("
            INSERT INTO companies
                (user_id, company_name, country_id, mgmt_type_id, stage_id, month, week_label, contact_name, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param(
            'isiiissss',
            $user_id, $lead['company_name'], $lead['country_id'], $lead['mgmt_type_id'],
            $stage_id, $month, $week_label, $lead['contact_name'], $lead['notes']
        );
        $stmt->execute();
        $company_id = $conn->insert_id;

        $upd = $conn->prepare("UPDATE potential_leads SET lead_status = 'Converted', converted_company_id = ? WHERE id = ?");
        $upd->bind_param('ii', $company_id, $id);
        $upd->execute();

        $company = $conn->query("SELECT * FROM companies WHERE id = $company_id")->fetch_assoc();
        send_ok($company, 'Lead converted to company');
    }

    // ---- Normal update ----
    $body = get_json_body();
    $writable = ['user_id', 'company_name', 'country_id', 'contact_name', 'source', 'mgmt_type_id', 'lead_status', 'notes', 'status'];
    $sets = [];
    $types = '';
    $params = [];
    foreach ($writable as $f) {
        if (array_key_exists($f, $body)) {
            $val = $body[$f];
            // Normalize lifecycle status to lowercase active/inactive
            if ($f === 'status' && is_string($val)) {
                $val = strtolower(trim($val));
                if ($val === 'inactive' || $val === 'active') {
                    /* ok */
                }
            }
            $sets[] = "`$f` = ?";
            $types .= 's';
            $params[] = $val;
        }
    }
    if (empty($sets)) send_error('No writable fields supplied', 422);
    $types .= 'i';
    $params[] = $id;

    $stmt = $conn->prepare("UPDATE potential_leads SET " . implode(',', $sets) . " WHERE id = ?");
    $stmt->bind_param($types, ...$params);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        $exists = $conn->query("SELECT id FROM potential_leads WHERE id = $id")->fetch_assoc();
        if (!$exists) send_error('Not found', 404);
    }
    $row = $conn->query("SELECT * FROM potential_leads WHERE id = $id")->fetch_assoc();
    send_ok($row, 'Updated');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('id query param is required', 422);

    // Soft-delete by default: keep the row, set status active → inactive.
    // Pass ?hard=1 to permanently remove (rare / admin use).
    if (!empty($_GET['hard'])) {
        $stmt = $conn->prepare("DELETE FROM potential_leads WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        if ($stmt->affected_rows === 0) send_error('Not found', 404);
        send_ok(null, 'Permanently deleted');
    }

    $exists = $conn->query("SELECT id FROM potential_leads WHERE id = $id")->fetch_assoc();
    if (!$exists) send_error('Not found', 404);

    $stmt = $conn->prepare("UPDATE potential_leads SET status = 'inactive' WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();

    $row = $conn->query("SELECT * FROM potential_leads WHERE id = $id")->fetch_assoc();
    if (!$row || strtolower((string) $row['status']) !== 'inactive') {
        send_error('Failed to mark lead inactive', 500);
    }
    send_ok($row, 'Marked inactive');
}

send_error('Method not allowed', 405);
