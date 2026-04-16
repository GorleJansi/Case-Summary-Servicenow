# Requirements (Beginner-Friendly)

This file tells you what you need for this project in simple language.

Think of it as a checklist: platform, scripts, settings, and external access.

---

## 1) Main Platform Requirement

- **ServiceNow instance** (this is where the app runs)

You need access to create:
- Script Includes
- UI Actions
- UI Macros (optional)
- System Properties

---

## 2) Required Project Files (from this repo)

- `script_include/CaseSummaryAI.js` — backend logic inside ServiceNow
- `ui_action/ai_summary_button.js` — button and popup on the form
- `ui_macro/x_case_summary_ai_panel.xml` — optional persistent summary panel

---

## 3) Required ServiceNow Features / Tools

These are built-in ServiceNow tools used by this project:

- **GlideRecord** — reads data from ServiceNow tables
- **GlideAjax** — lets UI code call server code
- **AbstractAjaxProcessor** — allows Script Include methods to be called via GlideAjax
- **sn_ws.RESTMessageV2** — makes external API calls from ServiceNow
- **GlideModal** — shows popup dialog in the UI
- **System Properties** — stores credentials and config values

You do not need to install these; they already exist in ServiceNow.

---

## 4) Required ServiceNow Data Sources

The summary is generated from these tables:

- record table: `incident` (or another case table)
- journal table: `sys_journal_field` (comments/work notes)
- email table: `sys_email`

---

## 5) Required External Integration

This project calls Cisco CIRCUIT LLM.

You need:
- CIRCUIT client ID
- CIRCUIT client secret
- CIRCUIT app key
- token endpoint access (`id.cisco.com`)
- chat endpoint access (`chat-ai.cisco.com`)

---

## 6) Required System Properties in ServiceNow

Create these properties:

- `x_case_summary.circuit_client_id`
- `x_case_summary.circuit_client_secret`
- `x_case_summary.circuit_app_key`
- `x_case_summary.circuit_model`
- `x_case_summary.circuit_token_url`
- `x_case_summary.circuit_chat_base_url`

These keep secrets/config outside the code.

---

## 7) Optional Requirements (if you want persistent panel)

Optional custom fields:

- `x_case_summary_ai_summary`
- `x_case_summary_ai_generated_on`

Optional UI setup:

- create UI Macro using `x_case_summary_ai_panel.xml`
- create Formatter and add it to form layout

---

## 8) Network / Security Requirements

ServiceNow must be allowed to make outbound HTTPS calls to:

- `https://id.cisco.com`
- `https://chat-ai.cisco.com`

If blocked, token/LLM calls will fail.

---

## 9) What you do NOT need

For this ServiceNow-native version, you do **not** need:

- Node.js server
- npm packages
- Python runtime
- Docker

Everything runs using ServiceNow native scripts + external LLM API.

---

## 10) Quick Readiness Checklist

- [ ] ServiceNow admin access
- [ ] Required system properties created
- [ ] Script Include created and client-callable
- [ ] UI Action created on target table
- [ ] CIRCUIT credentials valid
- [ ] Outbound access to CIRCUIT URLs
- [ ] Test incident/case available with comments/work notes/emails

If all are checked, you are ready to run the solution.
