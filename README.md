# Case Summary — ServiceNow Native Integration
# ════════════════════════════════════
#
# AI-powered case/incident summarization directly inside ServiceNow.
# Click "🤖 AI Summary" button on the form → see summary popup.
#
# Author: Jansi Gorle · CX · April 2026


## What This Does

```
Engineer opens Incident INC10791727 in ServiceNow
         │
         │  clicks [🤖 AI Summary] button
         ▼
┌────────────────────────────────────────────┐
│  Script Include (CaseSummaryAI) runs:      │
│                                            │
│  ① GlideRecord → incident metadata        │
│  ② GlideRecord → comments + work notes    │
│  ③ GlideRecord → email threads            │
│  ④ Build chronological timeline            │
│  ⑤ Construct LLM prompt                   │
│  ⑥ RESTMessageV2 → CIRCUIT LLM            │
│  ⑦ Parse structured response              │
│  ⑧ Save summary to record                 │
└────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  ✨ Powered by CIRCUIT LLM                 │
│                                            │
│  Issue:                                    │
│  Multiple storage nodes experienced an     │
│  outage due to high temperature alerts...  │
│                                            │
│  Action Taken:                             │
│  • Emergency firmware upgrade on nodes     │
│  • Installed temporary cooling fans        │
│  • Engaged on-site vendor support          │
│  • Bounced database and app services       │
│  • Implemented 8-hour monitoring cycles    │
│                                            │
│  Resolution:                               │
│  Storage nodes stabilized by temporary     │
│  cooling and firmware update. All services │
│  restarted and verified operational.       │
│                                            │
│  📋 👍 👎 🔄     Last generated: 15-04-2026│
└────────────────────────────────────────────┘
```


## Files

```
Case-Summary-ServiceNow/
│
├── script_include/
│   └── CaseSummaryAI.js          ← Server-side: data fetch + timeline + LLM call
│
├── ui_action/
│   └── ai_summary_button.js      ← Button + popup modal (client-side)
│
├── ui_macro/
│   └── x_case_summary_ai_panel.xml  ← Persistent panel on form (like AI Assist)
│
├── README.md                      ← This file
└── SETUP_GUIDE.md                 ← Step-by-step installation
```


## Quick Setup (5 steps)

See `SETUP_GUIDE.md` for full details.

1. **System Properties** — store CIRCUIT credentials
2. **Script Include** — paste `CaseSummaryAI.js`
3. **UI Action** — paste `ai_summary_button.js`
4. **(Optional) Custom fields + UI Macro** — for persistent panel on form
5. **Test** — open an incident, click the button
