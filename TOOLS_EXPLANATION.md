# Tools Explanation — Study Guide

This document explains **why** each tool/technology is used in the Case Summary ServiceNow POC and **what role** it plays.

---

## 1) GlideRecord — Why Use It?

**What it is**: ServiceNow's native data access API.

**Why used here**:
- Direct database queries are **faster** than REST API calls.
- **Secure**: Runs server-side, no data exposed to client.
- **Simple**: Query builder with .get(), .query(), .next() pattern.
- **Built-in**: No external dependencies or authentication needed.

**Alternative**: We could use the ServiceNow REST API, but it would be slower and require more setup.

---

## 2) GlideAjax — Why Use It?

**What it is**: ServiceNow's built-in async communication from browser to server.

**Why used here**:
- **Lightweight**: Small payload, no setup needed.
- **Asynchronous**: UI stays responsive during processing.
- **Integrated**: Works seamlessly with Script Includes.
- **No CORS issues**: Runs within ServiceNow domain.

**Alternative**: We could use fetch/XMLHttpRequest, but GlideAjax is simpler and safer.

---

## 3) AbstractAjaxProcessor — Why Extend It?

**What it is**: ServiceNow base class for server-side AJAX handlers.

**Why used here**:
- **Pattern**: Standardized way to expose server methods to client.
- **Security**: Built-in authentication and scope protection.
- **Method exposure**: Functions become callable via GlideAjax automatically.
- **JSON serialization**: Automatic conversion of return values.

**Alternative**: Could write raw server-side code, but this is cleaner and safer.

---

## 4) sn_ws.RESTMessageV2 — Why Use It?

**What it is**: ServiceNow's REST client for calling external APIs.

**Why used here**:
- **Built-in**: No external HTTP library needed.
- **Secure**: Handles certificates, timeouts, retries.
- **Logging**: Integrated error tracking and debugging.
- **Multi-protocol**: Works with OAuth2, API keys, basic auth.

**Alternative**: Could use native JavaScript fetch, but server-side REST is more secure.

---

## 5) OAuth2 (CIRCUIT) — Why Use It?

**What it is**: Industry-standard API authentication protocol.

**Why used here**:
- **Secure credentials**: Client ID + secret, not exposed in requests.
- **Token-based**: Each call carries a temporary access token.
- **Cisco standard**: CIRCUIT LLM is Cisco-aligned and uses OAuth2.
- **Revocable**: Can invalidate tokens if compromised.

**Alternative**: API key auth would be simpler but less secure.

---

## 6) GlideModal — Why Use It?

**What it is**: ServiceNow's modal dialog component.

**Why used here**:
- **Consistent UX**: Matches ServiceNow look & feel.
- **Accessible**: Built-in keyboard navigation and screen reader support.
- **Responsive**: Scales on mobile and desktop.
- **Simple API**: Just call `setTitle()`, `renderWithContent()`.

**Alternative**: Could use plain HTML popups, but GlideModal is more polished.

---

## 7) System Properties — Why Store Config Here?

**What it is**: ServiceNow's key-value store for secrets and settings.

**Why used here**:
- **Secure**: Password-type properties are encrypted.
- **Environment-specific**: Different values per instance (dev/prod).
- **Centralized**: No hardcoding in scripts.
- **Auditable**: Changes are logged and trackable.

**Alternative**: Could hardcode in script, but that's a security risk.

---

## 8) Jelly (UI Macro XML) — Why Use It?

**What it is**: ServiceNow's templating language for dynamic UI.

**Why used here**:
- **Form integration**: Seamlessly renders as part of the form layout.
- **Server-side evaluation**: Can access record data directly.
- **Conditional rendering**: Show/hide based on field values.
- **Escape handling**: Built-in HTML escaping for security.

**Alternative**: Could use pure JavaScript, but Jelly is more integrated with ServiceNow.

---

## 9) JavaScript (Client-Side) — Why Use It?

**What it is**: The language for browser-side interactions.

**Why used here**:
- **UI interactions**: Handle button clicks, modal rendering.
- **Validation**: Check record state before sending request.
- **Async handling**: Manage loading states and responses.
- **DOM manipulation**: Build and style modal content dynamically.

**Alternative**: ServiceNow supports other languages server-side, but client-side is always JavaScript.

---

## 10) CIRCUIT LLM — Why Use It?

**What it is**: Cisco's enterprise large language model.

**Why used here**:
- **Enterprise-grade**: Designed for business/support use cases.
- **Fast inference**: Optimized for low latency.
- **Configurable**: Temperature, max tokens, model choice.
- **Cisco ecosystem**: Aligns with Webex/other Cisco tools.

**Alternative**: Could use OpenAI GPT-4, but CIRCUIT is aligned with customer ecosystem.

---

## 11) sys_journal_field, sys_email Tables — Why Use Them?

**What they are**: ServiceNow's built-in tables for case history.

**Why used here**:
- **Native storage**: All comments/work notes automatically recorded here.
- **Indexed**: Fast queries on large tables.
- **Structured**: Metadata like creator, timestamp, type.
- **Queryable**: Can filter by element (comment vs work note).

**Alternative**: Could store summaries in custom tables, but sys_journal_field is standard.

---

## 12) Custom Fields (x_case_summary_*) — Why Add Them?

**What they are**: Extended data model fields specific to your namespace.

**Why used here**:
- **Persistence**: Store generated summary on the record for later viewing.
- **Formatting**: UI Macro reads field and displays it in panel.
- **Auditability**: Track when summaries were generated.
- **Reusability**: Other workflows can access the summary field.

**Alternative**: Could only show modal and not persist, but custom fields enable richer UX.

---

## Architecture Decision: Why No External Libraries?

Traditional RAG POCs use Python + external packages. **This one uses ServiceNow native APIs because:**

1. **No dependency management**: No pip/npm needed.
2. **Simple deployment**: Just copy scripts into ServiceNow.
3. **No security scanning**: Fewer dependencies = smaller attack surface.
4. **Tight integration**: ServiceNow APIs are optimized for the platform.
5. **Cost**: Fewer external services to pay for.

---

## Learning Outcomes

By studying this POC, you'll understand:

- How to fetch and process ServiceNow data efficiently.
- How to make secure outbound API calls.
- How to build interactive UI components.
- How to architect a simple RAG-like system without external ML libraries.
- How to configure and manage secrets in enterprise platforms.

---

## Suggested Next Steps for Study

1. **Trace a request**: Follow a user click through GlideAjax → Script Include → REST call → response.
2. **Modify the prompt**: Change the LLM instruction and observe answer quality changes.
3. **Add a field**: Create a custom field and have `generateAndSave()` populate it.
4. **Extend the timeline**: Add more data sources (e.g., attachments, linked records).
5. **Optimize retrieval**: Tune the LLM temperature and max tokens for faster inference.

---

## One-Line Summary

This POC shows how to build a working AI summarization system using **only ServiceNow's native APIs + an external LLM**, with no additional dependencies or frameworks.
