# Case Summary ServiceNow — End-to-End Documentation

> Comprehensive implementation walkthrough for the ServiceNow + CIRCUIT LLM case summarization solution.
> 
> Last updated: 16 April 2026

---

## 1) Executive Summary (What We Built)

We implemented an AI-powered summarization capability directly inside ServiceNow so support engineers can understand a case/incident quickly without reading the full journal/email history.

The solution includes:
- A **client-side UI Action button** (`🤖 AI Summary`) that users click on a form.
- A **server-side Script Include** (`CaseSummaryAI`) that fetches record context, builds a timeline, calls CIRCUIT LLM, and returns structured output.
- A **UI Macro panel** (optional persistent formatter) that can show saved summaries on the form.

Primary outcome: users can generate a concise support handoff summary with sections like **Issue**, **Action Taken**, and **Resolution**.

---

## 2) Problem We’re Solving

### Before
Engineers had to manually read:
- incident/case description,
- long work notes,
- customer comments,
- email history,
- and sometimes repeated updates.

This is slow, error-prone, and creates longer MTTR during handoffs/escalations.

### After
With one click, the engineer gets:
- a condensed factual summary,
- normalized section format,
- less duplicate noise,
- faster understanding for triage and continuation.

---

## 3) Architecture

## High-Level Components

1. **Form UI (Client)**
   - `ui_action/ai_summary_button.js`
   - Triggers GlideAjax and renders modal output.

2. **Application Logic (Server)**
   - `script_include/CaseSummaryAI.js`
   - Gathers ServiceNow data, assembles timeline/prompt, calls LLM, parses response.

3. **LLM Provider**
   - CIRCUIT endpoints:
     - OAuth token endpoint (`id.cisco.com`)
     - Chat completion endpoint (`chat-ai.cisco.com`)

4. **Optional Persistent Display Layer**
   - `ui_macro/x_case_summary_ai_panel.xml`
   - Reads saved field (`x_case_summary_ai_summary`) and displays summary sections in form formatter.

## Architecture Diagram

```text
User on Incident/Case Form
        |
        | click "🤖 AI Summary"
        v
UI Action (client JS) -> GlideAjax('CaseSummaryAI', 'getSummary')
        |
        v
CaseSummaryAI Script Include (server)
  1) GlideRecord: record metadata
  2) GlideRecord: sys_journal_field (comments/work_notes)
  3) GlideRecord: sys_email
  4) Build chronological timeline
  5) Build strict prompt
  6) OAuth2 token (RESTMessageV2)
  7) LLM chat completion (RESTMessageV2)
  8) Parse sections
        |
        v
Return JSON -> UI Action renders styled modal panel
        |
        +--> (Optional persistence path for formatter panel)
```

---

## 4) How It Works — The User Experience

1. User opens an Incident/Case form.
2. User clicks **`🤖 AI Summary`** button.
3. A loading modal appears: “Generating AI Summary…”.
4. Backend pipeline runs and fetches all relevant timeline artifacts.
5. CIRCUIT LLM returns a structured plain-text summary.
6. UI displays a styled “Powered by CIRCUIT LLM” result modal.
7. (Optional) If summary is persisted to custom field, the top formatter panel can show it permanently.

---

## 5) Request Flow — Step by Step

## A) Client Request Trigger
- Function: `generateAISummary()` in `ui_action/ai_summary_button.js`
- Reads:
  - `sys_id` from `g_form.getUniqueValue()`
  - table from `g_form.getTableName()`
  - record number from `g_form.getValue('number')`
- Calls GlideAjax with:
  - `sysparm_name = getSummary`
  - `sysparm_sys_id = <record_sys_id>`
  - `sysparm_table = <current_table>`

## B) Server Pipeline (`CaseSummaryAI.getSummary`)
- Entry: `getSummary()`
- Delegates to: `_runPipeline(sysId, table)`

### `_runPipeline` internals
1. `_getCaseData(sysId, table)`
   - Pulls case/incident metadata via `GlideRecord(table)`.
2. `_getJournalEntries(sysId)`
   - Reads `sys_journal_field` for `comments` and `work_notes`.
   - Has fallback query path using `name = sysId`.
3. `_getEmails(sysId, table)`
   - Reads `sys_email` rows linked by `instance` + `target_table`.
4. `_buildTimeline(journalEntries, emailEntries)`
   - Cleans text, normalizes speaker/type, sorts oldest → newest.
5. `_buildPrompt(caseData, timeline)`
   - Creates strict instruction format for factual, deduplicated output.
6. `_callCircuitLLM(prompt)`
   - Reads system properties.
   - Calls `_getAccessToken(...)`.
   - Calls chat completion endpoint with low temperature.
7. `_prependCaseContext(rawSummary, caseData)`
   - Adds top metadata line (`case number`, `priority`, `state`, etc.).
8. `_parseSections(rawSummary)`
   - Extracts sections: `Issue`, `Action Taken`, `Resolution`, optional `SLA Information`.
9. Returns JSON payload to client.

## C) Client Rendering
- On success: `_showAISummaryPanel(recordNum, result)` displays formatted modal.
- On failure: `_showErrorDialog(recordNum, errorMsg)`.

---

## 6) 📁 Project Structure

```text
Case-Summary-ServiceNow/
├── README.md
├── SETUP_GUIDE.md
├── END_TO_END_DOCUMENTATION.md
├── script_include/
│   └── CaseSummaryAI.js
├── ui_action/
│   └── ai_summary_button.js
└── ui_macro/
    └── x_case_summary_ai_panel.xml
```

---

## 7) How the Files Connect

## `script_include/CaseSummaryAI.js`
- Core backend implementation.
- Owns data retrieval, timeline construction, prompt engineering, OAuth/token retrieval, LLM invocation, output parsing.
- Public callable method used by UI Action: `getSummary()`.
- Includes additional method `generateAndSave(sysId, table)` for persistence path.

## `ui_action/ai_summary_button.js`
- User interaction layer.
- Calls `CaseSummaryAI.getSummary` through GlideAjax.
- Renders result with sections in a modal.

## `ui_macro/x_case_summary_ai_panel.xml`
- Optional persistent display panel.
- Expects summary saved in custom field `x_case_summary_ai_summary`.
- Intended to be embedded as a formatter at top of form.

## `SETUP_GUIDE.md`
- Manual installation steps in ServiceNow (properties, Script Include, UI Action, formatter/macro).

## `README.md`
- Fast overview and quick-start narrative.

---

## 8) Tech Stack

- **Platform**: ServiceNow (server + client scripting)
- **Server-side APIs**:
  - `GlideRecord`
  - `AbstractAjaxProcessor`
  - `sn_ws.RESTMessageV2`
  - `gs.getProperty`
- **Client-side APIs**:
  - `g_form`
  - `GlideAjax`
  - `GlideModal`
- **External AI**:
  - CIRCUIT LLM chat completion endpoint
  - OAuth2 client-credentials auth
- **Config storage**:
  - `sys_properties`

---

## 9) Data Model & Configuration

## Required System Properties
- `x_case_summary.circuit_client_id`
- `x_case_summary.circuit_client_secret`
- `x_case_summary.circuit_app_key`
- `x_case_summary.circuit_model`
- `x_case_summary.circuit_token_url`
- `x_case_summary.circuit_chat_base_url`

## Optional Custom Fields (for persistent panel)
- `x_case_summary_ai_summary` (String, ~4000)
- `x_case_summary_ai_generated_on` (String)

---

## 10) Deployment

## Recommended Deployment Approach
1. Move artifacts via Update Set/app packaging:
   - Script Include
   - UI Action
   - UI Macro
   - Formatter
   - Dictionary fields
   - System properties (or create manually per env)
2. Configure environment-specific secret values in target instance.
3. Validate outbound HTTP allowlist/access for:
   - `id.cisco.com`
   - `chat-ai.cisco.com`
4. Smoke test with a known incident/case containing journals + emails.

## Environment Checklist
- Script Include is **Client callable**.
- UI Action is **Client** + **Form button** enabled.
- Outbound calls are allowed and timeout is sufficient.
- Model value exists in CIRCUIT deployment.

---

## 11) Important Behavior Note (Current Code Path)

Current UI Action calls `getSummary()` and displays the modal response.

That means:
- **Modal summary works immediately**.
- **Persistent panel requires data in `x_case_summary_ai_summary`**, which is written by `generateAndSave(...)` (not currently called by UI Action).

If you want guaranteed persistence after button click, wire the UI Action to a persistence method (or update `getSummary()` path to save as part of execution).

---

## 12) Security & Guardrails

- CIRCUIT credentials are read from system properties (not hardcoded).
- Prompt explicitly instructs: no hallucination, no PII, deduplicated facts.
- HTML output is escaped client-side before rendering summary content.
- REST timeout and error handling are implemented with explicit exceptions.

---

## 13) Demo Script (Presenter Runbook)

Use this for stakeholder demos (5–7 minutes).

### Scene Setup
- Open an incident with realistic:
  - short description,
  - multiple work notes/comments,
  - one or more related emails.

### Talk Track
1. “Engineers lose time reading long case history during handoffs.”
2. “Now they click one button to get a factual summary.”
3. Click **`🤖 AI Summary`**.
4. Show loading state and explain backend steps (journal/email aggregation + LLM summarization).
5. Show resulting sections:
   - **Issue**
   - **Action Taken**
   - **Resolution**
6. “This format standardizes handoff quality and reduces triage time.”
7. (Optional) Refresh and show persistent formatter panel if persistence is enabled.

### Success Criteria to Highlight
- Concise summary appears quickly.
- Content is grounded in ticket activity.
- Repeated updates are deduplicated.
- Engineers can continue from latest state faster.

---

## 14) Limitations & Next Enhancements

## Current Limitations
- UI Action path currently returns summary but does not always persist (unless save path invoked).
- Section parser assumes known headers.
- Very long timelines are truncated at entry level (`_cleanText` cutoff), which may drop deep context.

## Suggested Next Enhancements
1. Persist summary and generation timestamp in same request path.
2. Add “Regenerate” server call with reason/context options.
3. Add ACL checks for who can generate/view summaries.
4. Add telemetry (generation latency, token failures, model errors).
5. Add localization-ready section labels.
6. Add unit-style ATF tests for Script Include response contract.

---

## 15) Quick Validation Checklist

- [ ] Button visible on intended table(s).
- [ ] GlideAjax call returns `success: true`.
- [ ] Modal renders sections correctly.
- [ ] OAuth token call succeeds.
- [ ] LLM endpoint returns HTTP 200.
- [ ] Error dialog appears for failures.
- [ ] (Optional) Persistent field and formatter show saved summary.

---

## 16) One-Line Value Proposition

**This solution turns raw ServiceNow case history into a fast, structured engineering handoff summary using CIRCUIT LLM—directly inside the form experience.**
