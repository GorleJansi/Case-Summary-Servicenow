# Case Summary — ServiceNow Native Integration

This project adds an `AI Summary` button in ServiceNow.

When a user clicks the button, ServiceNow reads the case history and asks an AI model to generate a short summary.

## What You Get

- A button on the form: `🤖 AI Summary`
- A popup with sections like `Issue`, `Action Taken`, and `Resolution`
- Optional persistent summary panel on the form
- No Node.js/Python app required for the core flow

## For Beginners: What This Means

Everything important runs inside ServiceNow:
- `UI Action` = the button users click
- `Script Include` = backend logic in ServiceNow
- `GlideRecord` = reads record data from ServiceNow tables
- `RESTMessageV2` = calls the external AI endpoint

## How It Works (Simple Flow)

1. User opens an `incident` or case record.
2. User clicks `🤖 AI Summary`.
3. `GlideAjax` calls `CaseSummaryAI`.
4. `CaseSummaryAI` uses `GlideRecord` to fetch record details, journal entries, and emails.
5. A chronological timeline is built and converted into a prompt.
6. `sn_ws.RESTMessageV2` calls CIRCUIT LLM.
7. The response is parsed into `Issue`, `Action Taken`, and `Resolution`.
8. The summary is shown in a popup (and can also be saved on the record).

## Main Files

- **`script_include/CaseSummaryAI.js`**: Main backend logic (fetches data + calls AI)
- **`ui_action/ai_summary_button.js`**: Button click + popup UI
- **`ui_macro/x_case_summary_ai_panel.xml`**: Optional persistent panel on the form
- **System Properties**: Store credentials and API configuration

## Project Structure

```text
Case-Summary-ServiceNow/
├── script_include/
│   └── CaseSummaryAI.js
├── ui_action/
│   └── ai_summary_button.js
├── ui_macro/
│   └── x_case_summary_ai_panel.xml
├── README.md
├── SETUP_GUIDE.md
├── END_TO_END_DOCUMENTATION.md
├── REQUIREMENTS.md
└── TOOLS_EXPLANATION.md
```

## Quick Start

See `SETUP_GUIDE.md` for full detailed steps.

Basic setup:
1. Create CIRCUIT-related ServiceNow system properties.
2. Create the `CaseSummaryAI` Script Include.
3. Create the `AI Summary` UI Action.
4. Optionally add custom fields, formatter, and UI Macro.
5. Test on an incident or case record.

## Documentation

- `SETUP_GUIDE.md` — step-by-step installation
- `END_TO_END_DOCUMENTATION.md` — complete architecture + request flow
- `REQUIREMENTS.md` — beginner-friendly requirements checklist
- `TOOLS_EXPLANATION.md` — beginner-friendly tool explanations

## Notes

- This repo is focused on **ServiceNow-native JavaScript** as the primary solution.
- It is designed so the main logic can be deployed directly in ServiceNow artifacts.

## Author

Jansi Gorle · CX · April 2026
