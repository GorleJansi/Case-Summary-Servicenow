# Requirements & Tools Used

This document lists all tools, libraries, and technologies used in the **Case Summary ServiceNow** project.

## ServiceNow Platform
- **GlideRecord**: ServiceNow data retrieval and manipulation API
- **GlideAjax**: Client-side asynchronous communication with server-side scripts
- **GlideModal**: Client-side UI component for rendering modal dialogs
- **GlideStringUtil**: String utility functions (base64 encoding, etc.)
- **sn_ws.RESTMessageV2**: ServiceNow REST message utility for making outbound HTTP calls
- **AbstractAjaxProcessor**: Base class for server-side AJAX processors
- **gs.getProperty()**: ServiceNow global function to retrieve system properties

## External Services & APIs
- **CIRCUIT LLM (Cisco)**: AI language model for text summarization
  - OAuth2 token endpoint: `id.cisco.com`
  - Chat completion endpoint: `chat-ai.cisco.com`
- **OpenAI Models** (alternative): Can be swapped for CIRCUIT
- **HTTP/REST**: Standard protocol for API communication

## Client-Side Technologies
- **JavaScript (ES5+)**: Used in UI Action and UI Macro
- **DOM Manipulation**: HTML/CSS for modal rendering
- **CSS Styling**: Inline styles for modal panel design
- **Jelly (XML)**: ServiceNow templating language for UI Macro

## Development & Configuration
- **System Properties**: ServiceNow configuration storage for:
  - CIRCUIT credentials (client ID, secret, app key)
  - Model name and endpoint URLs
- **Update Sets**: ServiceNow packaging for deployment
- **Dictionary Fields**: Custom fields for data storage

## Optional Components
- **UI Macro**: Jelly/XML templating for persistent form panel
- **Formatter**: ServiceNow UI component for rendering formatted content
- **Custom Fields**: Extended data model for summary persistence

---

## Architecture Summary

| Layer | Tool/Technology | Purpose |
|-------|-----------------|---------|
| **Client UI** | JavaScript, GlideModal, CSS | Button interaction and modal display |
| **Communication** | GlideAjax | Client-server async messaging |
| **Server Logic** | GlideRecord, AbstractAjaxProcessor | Data retrieval and processing |
| **External API** | RESTMessageV2, OAuth2 | LLM integration |
| **Data Storage** | ServiceNow DB, sys_journal_field, sys_email | Record context and history |
| **Configuration** | sys_properties | Secrets and settings management |
| **(Optional) Display** | UI Macro, Formatter, Jelly | Persistent form panel |

---

## Why These Tools?

- **ServiceNow APIs**: Native platform integration—no external dependencies needed.
- **GlideRecord**: Direct database access is faster and more secure than REST APIs.
- **GlideAjax**: Lightweight, built-in mechanism for async client-server calls.
- **RESTMessageV2**: Standard ServiceNow approach for outbound service integration.
- **CIRCUIT LLM**: Enterprise-grade AI aligned with Cisco ecosystem.
- **OAuth2**: Secure credential management for API access.

---

## Deployment Requirements

- ServiceNow instance (Quebec or later recommended)
- Outbound HTTP connectivity to CIRCUIT endpoints
- CIRCUIT credentials (OAuth2 client ID, secret, app key)
- (Optional) Custom fields and UI Macro for persistent panel

---

## No External Dependencies Needed

Unlike traditional Python/Node projects, this POC requires **no package managers** (pip, npm):
- All ServiceNow APIs are built-in.
- CIRCUIT integration uses native HTTP/REST.
- Styling is CSS-in-JS.

This keeps the solution lightweight and deployment-simple.
