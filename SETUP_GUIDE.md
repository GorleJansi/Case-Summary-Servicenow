# Setup Guide — ServiceNow AI Summary Button + Panel

> Step-by-step instructions to set up the "🤖 AI Summary" button  
> and the "Powered by CIRCUIT LLM" panel in ServiceNow.

---

## Step 1: Create System Properties (Store CIRCUIT Credentials)

Navigate to: **System Properties → All Properties** (`sys_properties_list.do`)

Click **New** for each property:

| Name | Value | Type |
|:-----|:------|:-----|
| `x_case_summary.circuit_client_id` | *(your CIRCUIT OAuth2 Client ID)* | `string` |
| `x_case_summary.circuit_client_secret` | *(your CIRCUIT OAuth2 Client Secret)* | `password2` |
| `x_case_summary.circuit_app_key` | *(your EGAI App Key)* | `string` |
| `x_case_summary.circuit_model` | `gpt-5-nano` | `string` |
| `x_case_summary.circuit_token_url` | `https://id.cisco.com/oauth2/default/v1/token` | `string` |
| `x_case_summary.circuit_chat_base_url` | `https://chat-ai.cisco.com/openai/deployments` | `string` |

---

## Step 2: Create the Script Include

Navigate to: **System Definition → Script Includes** (`sys_script_include_list.do`)

Click **New** and fill in:

| Field | Value |
|:------|:------|
| **Name** | `CaseSummaryAI` |
| **API Name** | `CaseSummaryAI` *(auto-fills)* |
| **Client callable** | ✅ **MUST be checked** |
| **Accessible from** | `All application scopes` |
| **Active** | ✅ |
| **Application** | `Global` |
| **Description** | `AI-powered case/incident summary using CIRCUIT LLM` |

**Script field:** Paste the entire contents of `script_include/CaseSummaryAI.js`

Click **Submit**.

---

## Step 3: Create the UI Action (Button)

Navigate to: **System Definition → UI Actions** (`sys_ui_action_list.do`)

Click **New** and fill in:

| Field | Value |
|:------|:------|
| **Name** | `AI Summary` |
| **Table** | `incident` |
| **Action name** | `ai_summary` |
| **Order** | `50` |
| **Active** | ✅ |
| **Show insert** | ❌ |
| **Show update** | ✅ |
| **Client** | ✅ **Check this** |
| **Form button** | ✅ **Check this** |
| **Form context menu** | ❌ |
| **Form link** | ❌ |
| **List banner button** | ❌ |
| **Onclick** | `generateAISummary()` |
| **Condition** | *(leave empty — shows on all records)* |

**Script field:** Paste the entire contents of `ui_action/ai_summary_button.js`

Click **Submit**.

> **Want it on CSM Cases too?** Create another UI Action with **Table** = `sn_customerservice_case`. Same script — it auto-detects the table.

---

## Step 4: Allow Outbound HTTP Calls

ServiceNow may block outbound REST calls. Ensure these domains are allowed:

| Domain | Purpose |
|:-------|:--------|
| `id.cisco.com` | OAuth2 token endpoint |
| `chat-ai.cisco.com` | CIRCUIT LLM API |

**Check:** Navigate to `sys_properties.do` and search for `glide.http.outbound`. Ensure outbound calls are enabled and timeout is ≥ 60 seconds.

---

## Step 5: Test It!

1. Open any **Incident** record (e.g., INC10791727)
2. Look for the **[AI Summary]** button in the form header buttons
3. Click it
4. Expected flow:
   - ⏳ Loading popup: "Generating AI Summary..."
   - ✨ Summary popup appears with sections: **Issue**, **Action Taken**, **Resolution**
5. Summary is also saved into **Work Notes** on the record

---

## (Optional) Step 6: Add Persistent Panel on the Form

This adds a panel at the **top of the form** (like the "Powered by AI Assist!" panel) that shows the summary permanently after it's generated.

### 6a. Add Custom Fields to the Incident Table

Navigate to: **System Definition → Tables** → find `incident` → click **Columns** tab

Add two new fields:

| Column label | Column name | Type | Max length |
|:-------------|:------------|:-----|:-----------|
| `AI Summary` | `x_case_summary_ai_summary` | `String` | `4000` |
| `AI Generated On` | `x_case_summary_ai_generated_on` | `String` | `40` |

### 6b. Create the UI Macro

Navigate to: **System UI → UI Macros** (`sys_ui_macro_list.do`)

Click **New**:

| Field | Value |
|:------|:------|
| **Name** | `x_case_summary_ai_panel` |
| **Active** | ✅ |
| **Description** | `AI Summary panel — shows CIRCUIT LLM summary on the form` |

**XML field:** Paste the XML from `ui_macro/x_case_summary_ai_panel.xml`  
(paste only the content between `<?xml ...>` and `</j:jelly>`)

Click **Submit**.

### 6c. Create a Formatter

Navigate to: **System UI → Formatters** (`sys_ui_formatter_list.do`)

Click **New**:

| Field | Value |
|:------|:------|
| **Name** | `AI Summary Panel` |
| **Table** | `incident` |
| **Type** | `Formatter` |
| **Formatter** | `x_case_summary_ai_panel` *(the macro name)* |
| **Active** | ✅ |

Click **Submit**.

### 6d. Add Formatter to the Form Layout

1. Open any Incident record
2. Right-click the form header → **Configure → Form Layout**
3. Find **AI Summary Panel** in the **Available** list
4. Move it to the **top** of the **Selected** list (above all other fields)
5. Click **Save**

Now the AI summary panel will appear at the top of every incident — just like ServiceNow's built-in AI Assist panel.

---

## How It All Connects

```
┌─────────────────────────────────────────────────┐
│  INCIDENT FORM                                  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ ✨ Powered by CIRCUIT LLM              │    │  ← UI Macro panel
│  │                                         │    │     (reads from custom field)
│  │ Issue: Storage nodes experienced...     │    │
│  │ Action Taken:                           │    │
│  │ • Emergency firmware upgrade            │    │
│  │ • Installed temporary cooling fans      │    │
│  │ Resolution: Nodes stabilized...         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Save] [Update] [🤖 AI Summary]               │  ← UI Action button
│                        │                        │
│                   click│                        │
│                        ▼                        │
│              ┌─────────────────┐                │
│              │ GlideAjax call  │                │
│              └────────┬────────┘                │
│                       │                         │
│                       ▼                         │
│  ┌──────────────────────────────────────────┐   │
│  │ Script Include: CaseSummaryAI            │   │
│  │                                          │   │
│  │ ① GlideRecord → incident data           │   │  ← No REST needed!
│  │ ② GlideRecord → sys_journal_field       │   │     (we're inside SN)
│  │ ③ GlideRecord → sys_email               │   │
│  │ ④ Build timeline (sort by date)         │   │
│  │ ⑤ Build LLM prompt                     │   │
│  │ ⑥ RESTMessageV2 → id.cisco.com (token) │   │  ← Outbound only for LLM
│  │ ⑦ RESTMessageV2 → CIRCUIT LLM (summary)│   │
│  │ ⑧ Write summary to work_notes          │   │
│  │ ⑨ Write to custom field (for panel)    │   │
│  └──────────────────────────────────────────┘   │
│                       │                         │
│                       ▼                         │
│              ┌─────────────────────┐            │
│              │ GlideModal Popup    │            │  ← Immediate popup
│              │ (styled like AI     │            │
│              │  Assist panel)      │            │
│              └─────────────────────┘            │
│                                                 │
│  After page refresh → UI Macro panel shows      │  ← Persistent panel
│  the saved summary at the top of the form       │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Python ↔ ServiceNow Code Mapping

| Python Code | ServiceNow Code | Approach |
|:------------|:----------------|:---------|
| `servicenow_client.py` → `requests.get(table API)` | `CaseSummaryAI._getCaseData()` → `GlideRecord` | Direct DB query (faster, no REST) |
| `servicenow_client.py` → `get_case_journal_entries()` | `CaseSummaryAI._getJournalEntries()` → `GlideRecord('sys_journal_field')` | Same query, native API |
| `servicenow_client.py` → `get_case_emails()` | `CaseSummaryAI._getEmails()` → `GlideRecord('sys_email')` | Same query, native API |
| `formatter.py` → `build_timeline()` | `CaseSummaryAI._buildTimeline()` | Same merge + sort logic |
| `summarizer.py` → `get_access_token()` | `CaseSummaryAI._getAccessToken()` → `sn_ws.RESTMessageV2` | Same OAuth2 flow |
| `summarizer.py` → `call_circuit_llm()` | `CaseSummaryAI._callCircuitLLM()` → `sn_ws.RESTMessageV2` | Same CIRCUIT API |
| `summarizer.py` → `build_prompt()` | `CaseSummaryAI._buildPrompt()` | Same prompt, adapted for SN format |
| Webex Adaptive Card | GlideModal + UI Macro panel | Popup + persistent form panel |

---

## Troubleshooting

| Problem | Cause | Fix |
|:--------|:------|:----|
| Button doesn't appear | UI Action on wrong table | Check **Table** = `incident` |
| "Missing CIRCUIT credentials" | System Properties not created | Create all 6 properties (Step 1) |
| Token request fails (401) | Wrong client_id/secret | Verify in EGAI portal |
| LLM returns error | Wrong model name | Set property to `gpt-5-nano` |
| "Connection refused" | Outbound HTTP blocked | Allowlist `id.cisco.com` + `chat-ai.cisco.com` |
| GlideAjax empty response | Script Include not Client callable | Check **Client callable** ✅ |
| Panel doesn't show | Custom field empty or Formatter not added | Run AI Summary first, check form layout |
| Summary in popup but not on form | Custom fields not added | Create fields (Step 6a) |
