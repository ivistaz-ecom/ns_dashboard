# Soft-delete Potential Leads (Merlin)

When you click **Delete** on Potential Leads, the app must set:

```sql
UPDATE potential_leads SET status = 'inactive' WHERE id = ?
```

Live `leads.php` on Merlin still rejects `status` updates. Use this instead:

## Upload this ONE new file (easiest)

1. Hostinger hPanel → **File Manager**
2. Open the folder that already has `auth.php`, `health.php`, `leads.php`
3. Upload **as a new file** (do not replace leads.php):

   `api-patches/lead_deactivate.php`

4. Confirm it exists by opening:

   `https://merlin.crafttechhub.com/lead_deactivate.php`

   You should get JSON (e.g. auth error), **not** a Hostinger HTML page.

5. Hard-refresh the dashboard (`Cmd+Shift+R`) and delete a lead.

phpMyAdmin → `potential_leads.status` should become `inactive`. The card disappears from Potential Leads.

## Optional: also replace leads.php

`api-patches/leads.php` adds `status` to the normal update/delete path.
Upload it too if you want soft-delete via `leads.php` itself.
