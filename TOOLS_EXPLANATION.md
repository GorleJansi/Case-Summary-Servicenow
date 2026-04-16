# Tools Explanation — Beginner Guide

This file explains the tools used in this project in a simple way.

The goal is not just to say **why** they are used, but first to explain **what they actually are**.

---

## 1) What is ServiceNow?

ServiceNow is a cloud platform used by companies to manage IT work such as:
- incidents,
- cases,
- service requests,
- approvals,
- workflows.

In this project, ServiceNow is the main system where the user opens a record and clicks the `AI Summary` button.

---

## 2) What is a Script Include?

A Script Include is a **server-side JavaScript file inside ServiceNow**.

You can think of it like a backend helper class or reusable backend code.

In this project:
- `CaseSummaryAI.js` is the Script Include.
- It runs on the server side.
- It fetches record data, builds the timeline, calls the LLM, and returns the result.

So, the Script Include is the **main brain** of this solution.

---

## 3) What is a UI Action?

A UI Action is a **button, link, or action in the ServiceNow interface**.

Examples:
- form button,
- list button,
- form link.

In this project:
- the `AI Summary` button is a UI Action.
- when the user clicks it, JavaScript runs.
- that JavaScript calls the Script Include.

So, the UI Action is the **thing the user clicks**.

---

## 4) What is GlideAjax?

GlideAjax is a ServiceNow feature that lets **browser-side JavaScript talk to server-side JavaScript**.

Simple meaning:
- the button is on the page,
- the page needs data from the server,
- GlideAjax sends that request.

In this project:
- the UI Action uses GlideAjax,
- GlideAjax calls `CaseSummaryAI`,
- the Script Include sends back JSON.

So, GlideAjax is the **messenger between the UI and the server code**.

---

## 5) What is AbstractAjaxProcessor?

`AbstractAjaxProcessor` is a **base class provided by ServiceNow**.

When a Script Include extends it, ServiceNow allows that Script Include to be called through GlideAjax.

In this project:
- `CaseSummaryAI` extends `AbstractAjaxProcessor`.
- that is what makes `getSummary()` callable from the UI Action.

So, this is what makes the Script Include work with GlideAjax.

---

## 6) What is GlideRecord?

GlideRecord is ServiceNow’s **server-side database access tool**.

It is used to:
- read records,
- update records,
- query tables,
- loop through results.

In this project, GlideRecord is used to read:
- the incident/case record,
- journal entries,
- email records.

So, GlideRecord is the **tool that reads data from ServiceNow tables**.

---

## 7) What are `sys_journal_field` and `sys_email`?

These are **tables inside ServiceNow**.

### `sys_journal_field`
This table stores journal-style updates such as:
- comments,
- work notes.

### `sys_email`
This table stores email activity related to records.

In this project, those tables are used to build the case history.

So, these tables are the **source of the timeline content**.

---

## 8) What is `sn_ws.RESTMessageV2`?

`sn_ws.RESTMessageV2` is ServiceNow’s built-in tool for **making HTTP/REST API calls from the server side**.

That means ServiceNow can call an external system such as:
- an AI model,
- another web service,
- a third-party API.

In this project:
- it is used to call the CIRCUIT token endpoint,
- then it is used again to call the CIRCUIT LLM endpoint.

So, this is the **tool that connects ServiceNow to the external AI service**.

---

## 9) What is OAuth2?

OAuth2 is a standard way for applications to **authenticate securely** when calling APIs.

Instead of sending username/password every time, the system first gets an **access token**.

In this project:
- the Script Include sends client ID + secret,
- CIRCUIT returns an access token,
- that token is then used to call the summarization endpoint.

So, OAuth2 is the **login/authentication method used to access the LLM API**.

---

## 10) What is CIRCUIT LLM?

CIRCUIT LLM is the **AI model service** used in this project.

LLM means **Large Language Model**.

A large language model is an AI system that can:
- read text,
- understand context,
- generate summaries,
- answer questions.

In this project:
- CIRCUIT receives the case timeline,
- it generates the summary,
- it returns structured output like `Issue`, `Action Taken`, and `Resolution`.

So, CIRCUIT LLM is the **AI engine that writes the summary**.

---

## 11) What is GlideModal?

GlideModal is ServiceNow’s built-in way to show a **popup window / modal dialog**.

In this project:
- after the summary is generated,
- the result is shown in a popup,
- the popup is styled to look like an AI panel.

So, GlideModal is the **tool that displays the summary nicely to the user**.

---

## 12) What is a UI Macro?

A UI Macro is a reusable UI component in ServiceNow.

It is usually written using **Jelly/XML**.

You can think of it like a reusable visual block that can be placed on a form.

In this project:
- `x_case_summary_ai_panel.xml` is the UI Macro,
- it shows the saved summary on the form,
- it acts like a persistent AI summary panel.

So, the UI Macro is the **saved summary panel shown on the record**.

---

## 13) What is Jelly?

Jelly is a templating language used by ServiceNow for building dynamic UI pieces.

It mixes:
- XML-like markup,
- ServiceNow data access,
- UI rendering logic.

In this project, Jelly is used inside the UI Macro.

So, Jelly is the **format ServiceNow uses to build certain UI components**.

---

## 14) What are System Properties?

System Properties are configuration values stored in ServiceNow.

They are used to keep settings outside the code.

Examples in this project:
- CIRCUIT client ID
- CIRCUIT client secret
- app key
- model name
- endpoint URLs

So, System Properties are the **settings/configuration storage** for the project.

---

## 15) What are Custom Fields?

Custom fields are additional columns added to a ServiceNow table.

In this project, they are optional fields like:
- `x_case_summary_ai_summary`
- `x_case_summary_ai_generated_on`

These fields help store:
- the generated summary,
- when it was generated.

So, custom fields are the **extra storage added to the record**.

---

## 16) What is JavaScript in this project?

JavaScript is the programming language used in this project.

It is used in two places:

### Client-side JavaScript
Runs in the browser.
Used for:
- button click handling,
- popup display,
- calling GlideAjax.

### Server-side JavaScript in ServiceNow
Runs inside ServiceNow on the backend.
Used for:
- reading records,
- making REST calls,
- building summaries.

So, JavaScript is the **main programming language for the whole solution**.

---

## 17) How do all these tools connect together?

Here is the simple flow:

1. User clicks the **UI Action** button.
2. The page uses **GlideAjax**.
3. GlideAjax calls the **Script Include**.
4. The Script Include uses **GlideRecord** to read data from ServiceNow tables.
5. The Script Include uses **RESTMessageV2** to call **CIRCUIT LLM**.
6. The response comes back.
7. The result is shown using **GlideModal**.
8. Optionally, the result is saved into **custom fields** and shown in a **UI Macro**.

---

## 18) Why this is still called a native ServiceNow solution

This is called **ServiceNow-native** because the main logic lives inside ServiceNow itself.

That means:
- the UI is in ServiceNow,
- the server code is in ServiceNow,
- the data is read directly from ServiceNow tables,
- only the LLM call goes outside ServiceNow.

So, the solution is native to ServiceNow even though it uses an external AI endpoint.

---

## 19) Simple one-line explanation of each tool

- **ServiceNow**: The platform where the case exists.
- **Script Include**: Backend JavaScript logic.
- **UI Action**: The button the user clicks.
- **GlideAjax**: Connects the UI to the backend code.
- **AbstractAjaxProcessor**: Makes the Script Include callable from the UI.
- **GlideRecord**: Reads data from ServiceNow tables.
- **sys_journal_field**: Stores comments and work notes.
- **sys_email**: Stores related email activity.
- **RESTMessageV2**: Calls external APIs.
- **OAuth2**: Authenticates to the AI API.
- **CIRCUIT LLM**: Generates the summary.
- **GlideModal**: Shows the popup.
- **UI Macro**: Shows a reusable summary panel on the form.
- **Jelly**: The template format used in UI Macro.
- **System Properties**: Store settings and secrets.
- **Custom Fields**: Save the summary on the record.

---

## 20) Final summary

If you are new to these tools, the easiest way to understand the project is this:

**A button on a ServiceNow record calls backend JavaScript, that backend reads case history, sends it to an AI model, and shows the returned summary in a popup or panel.**
