/*
 * CaseSummaryAI - Script Include (ServiceNow Server-Side)
 *
 * Replicates the Python pipeline (servicenow_client.py + formatter.py
 * + summarizer.py) entirely inside ServiceNow using:
 *   - GlideRecord    to fetch case/incident data, journals, emails
 *   - RESTMessageV2  to call Cisco CIRCUIT LLM
 *
 * Setup:
 *   Name:            CaseSummaryAI
 *   Client callable: true
 *   Active:          true
 *
 * System Properties needed:
 *   x_case_summary.circuit_client_id
 *   x_case_summary.circuit_client_secret
 *   x_case_summary.circuit_app_key
 *   x_case_summary.circuit_model
 *   x_case_summary.circuit_token_url
 *   x_case_summary.circuit_chat_base_url
 */

// Create a Script Include class constructor.
var CaseSummaryAI = Class.create();
// Extend AbstractAjaxProcessor so this Script Include can be called via GlideAjax.
CaseSummaryAI.prototype = Object.extendsObject(AbstractAjaxProcessor, {

    // Entry point used by GlideAjax from the UI Action.
    getSummary: function () {
        // Read the record sys_id sent from client-side script.
        var sysId = this.getParameter('sysparm_sys_id');
        // Read table name; default to CSM case table if client did not pass one.
        var table = this.getParameter('sysparm_table') || 'sn_customerservice_case';

        // If sys_id is missing, return an immediate error payload.
        if (!sysId) {
            return JSON.stringify({ success: false, error: 'Missing sys_id' });
        }

        try {
            // Run the full server-side summarization pipeline.
            var result = this._runPipeline(sysId, table);
            // Always return JSON string because GlideAjax expects string response.
            return JSON.stringify(result);
        } catch (e) {
            // Log server-side error in ServiceNow system logs.
            gs.error('[CaseSummaryAI] getSummary error: ' + e.message);
            // Send friendly error response back to client callback.
            return JSON.stringify({ success: false, error: e.message });
        }
    },

    // Optional utility method: generate summary and persist it to the record.
    generateAndSave: function (sysId, table) {
        try {
            // Reuse the same pipeline that getSummary uses.
            var result = this._runPipeline(sysId, table);
            // Save only if summary generation succeeded.
            if (result.success) {
                // Open the target record.
                var gr = new GlideRecord(table);
                // Proceed only if record exists.
                if (gr.get(sysId)) {
                    // Add a label before summary and place in work notes.
                    var formattedNote = '[AI Summary - Powered by CIRCUIT LLM]\n\n' + result.summary;
                    gr.work_notes = formattedNote;
                    // Also save raw summary in custom field if field exists.
                    if (gr.isValidField('x_case_summary_ai_summary')) {
                        gr.setValue('x_case_summary_ai_summary', result.summary);
                    }
                    // Persist updates to database.
                    gr.update();
                }
            }
            // Return result object to caller.
            return result;
        } catch (e) {
            // Log error for troubleshooting.
            gs.error('[CaseSummaryAI] generateAndSave error: ' + e.message);
            // Return consistent error structure.
            return { success: false, error: e.message };
        }
    },

    // Master orchestration function for the entire AI summary flow.
    _runPipeline: function (sysId, table) {
        // Log start of pipeline with record context.
        gs.info('[CaseSummaryAI] Starting pipeline for ' + table + ':' + sysId);

        // Step 1: fetch record fields.
        var caseData = this._getCaseData(sysId, table);
        // Stop early if record does not exist.
        if (!caseData) {
            return { success: false, error: 'Record not found: ' + sysId };
        }

        // Step 2: fetch comments and work notes.
        var journalEntries = this._getJournalEntries(sysId);
        // Step 3: fetch related emails.
        var emailEntries = this._getEmails(sysId, table);
        // Step 4: merge and sort everything into timeline.
        var timeline = this._buildTimeline(journalEntries, emailEntries);

        // If no content exists, return a simple successful message.
        if (timeline.length === 0) {
            return {
                success: true,
                summary: 'No journal entries or emails found for this record.',
                case_number: caseData.number,
                sections: {},
                timeline_count: 0
            };
        }

        // Step 5: convert data into strict LLM prompt.
        var prompt = this._buildPrompt(caseData, timeline);
        // Step 6: call CIRCUIT LLM and get raw text response.
        var rawSummary = this._callCircuitLLM(prompt);
        // Step 7: prepend ticket metadata line for quick context.
        var finalSummary = this._prependCaseContext(rawSummary, caseData);
        // Step 8: parse sections so UI can render structured blocks.
        var sections = this._parseSections(rawSummary);

        // Return full payload used by UI modal.
        return {
            success: true,
            summary: finalSummary,
            raw_summary: rawSummary,
            sections: sections,
            case_number: caseData.number,
            case_data: caseData,
            timeline_count: timeline.length
        };
    },

    // Load core case/incident fields from target table.
    _getCaseData: function (sysId, table) {
        // Create GlideRecord for dynamic table name.
        var gr = new GlideRecord(table);
        // Return null if record not found.
        if (!gr.get(sysId)) {
            return null;
        }

        // Read short_description only if field exists on this table.
        var title = '';
        if (gr.isValidField('short_description')) {
            title = gr.getDisplayValue('short_description');
        }

        // Return normalized object with safe defaults.
        return {
            sys_id:            sysId,
            number:            gr.getDisplayValue('number') || '',
            short_description: title,
            description:       gr.getDisplayValue('description') || '',
            state:             gr.getDisplayValue('state') || '',
            priority:          gr.getDisplayValue('priority') || '',
            severity:          gr.isValidField('severity') ? gr.getDisplayValue('severity') : '',
            assignment_group:  gr.getDisplayValue('assignment_group') || '',
            assigned_to:       gr.getDisplayValue('assigned_to') || '',
            category:          gr.isValidField('category') ? gr.getDisplayValue('category') : '',
            impact:            gr.isValidField('impact') ? gr.getDisplayValue('impact') : '',
            urgency:           gr.isValidField('urgency') ? gr.getDisplayValue('urgency') : '',
            sys_created_on:    gr.getDisplayValue('sys_created_on') || '',
            sys_updated_on:    gr.getDisplayValue('sys_updated_on') || ''
        };
    },

    // Get comments/work notes from sys_journal_field for this record.
    _getJournalEntries: function (sysId) {
        // Collect results here.
        var entries = [];
        // Primary query by element_id.
        var gr = new GlideRecord('sys_journal_field');
        gr.addQuery('element_id', sysId);
        gr.addQuery('element', 'IN', 'comments,work_notes');
        // Oldest-first ordering preserves timeline sequence.
        gr.orderBy('sys_created_on');
        gr.query();

        // Convert each row into plain JS object.
        while (gr.next()) {
            entries.push({
                sys_created_on: gr.getValue('sys_created_on') || '',
                element:        gr.getValue('element') || '',
                value:          gr.getValue('value') || '',
                sys_created_by: gr.getValue('sys_created_by') || ''
            });
        }

        // Fallback query by name field for environments where element_id mapping differs.
        if (entries.length === 0) {
            gr = new GlideRecord('sys_journal_field');
            gr.addQuery('name', sysId);
            gr.addQuery('element', 'IN', 'comments,work_notes');
            gr.orderBy('sys_created_on');
            gr.query();
            // Push fallback results in the same structure.
            while (gr.next()) {
                entries.push({
                    sys_created_on: gr.getValue('sys_created_on') || '',
                    element:        gr.getValue('element') || '',
                    value:          gr.getValue('value') || '',
                    sys_created_by: gr.getValue('sys_created_by') || ''
                });
            }
        }

        // Return journal array (can be empty).
        return entries;
    },

    // Get emails linked to this record from sys_email table.
    _getEmails: function (sysId, table) {
        // Collect email objects here.
        var emails = [];
        var gr = new GlideRecord('sys_email');
        // Match the target record and table.
        gr.addQuery('instance', sysId);
        gr.addQuery('target_table', table);
        gr.orderBy('sys_created_on');
        gr.query();

        // Convert each email row into standardized object.
        while (gr.next()) {
            // Prefer body_text, then body, then subject as fallback.
            var bodyText = gr.getValue('body_text') ||
                           gr.getValue('body') ||
                           gr.getValue('subject') || '';
            emails.push({
                sys_created_on: gr.getValue('sys_created_on') || '',
                body_text:      bodyText,
                type:           gr.getValue('type') || '',
                subject:        gr.getValue('subject') || ''
            });
        }

        // Return email entries (can be empty).
        return emails;
    },

    // Merge journals + emails into a cleaned, sorted timeline.
    _buildTimeline: function (journalEntries, emailEntries) {
        // Final unified timeline list.
        var timeline = [];
        // Map ServiceNow element type to speaker label.
        var speakerMap = { 'comments': 'customer', 'work_notes': 'support_engineer', 'email': 'customer' };
        // Map source element to normalized entry type.
        var typeMap    = { 'comments': 'comment',  'work_notes': 'work_note',        'email': 'email' };

        // Process journal records first.
        for (var i = 0; i < journalEntries.length; i++) {
            var item = journalEntries[i];
            var element = item.element || '';
            // Clean text to remove HTML/noise.
            var text = this._cleanText(item.value || '');
            // Skip empty text after cleanup.
            if (!text) continue;
            // Push normalized timeline event.
            timeline.push({
                type:      typeMap[element] || 'event',
                source:    element,
                speaker:   speakerMap[element] || 'unknown',
                timestamp: this._toIso(item.sys_created_on),
                text:      text
            });
        }

        // Process email records.
        for (var j = 0; j < emailEntries.length; j++) {
            var email = emailEntries[j];
            var emailText = this._cleanText(email.body_text || '');
            // Skip empty email payloads.
            if (!emailText) continue;
            timeline.push({
                type:      'email',
                source:    'email',
                speaker:   'customer',
                timestamp: this._toIso(email.sys_created_on),
                text:      emailText
            });
        }

        // Sort all events by timestamp ascending.
        timeline.sort(function (a, b) {
            if (a.timestamp > b.timestamp) return 1;
            if (a.timestamp < b.timestamp) return -1;
            return 0;
        });

        // Return merged timeline.
        return timeline;
    },

    // Build a strict instruction prompt for the LLM.
    _buildPrompt: function (caseData, timeline) {
        // Convert timeline items into numbered lines.
        var lines = [];
        for (var i = 0; i < timeline.length; i++) {
            var item = timeline[i];
            lines.push((i + 1) + '. [' + item.timestamp + '] ' + item.speaker + ': ' + item.text);
        }
        // If timeline empty, provide fallback sentence.
        var timelineText = lines.length > 0 ? lines.join('\n') : 'No journal activity found.';

        // Construct one full prompt string with strict format instructions.
        var prompt =
            'Summarize this ServiceNow case for an engineer picking up the ticket.\n' +
            'They need to understand the situation in 30 seconds without reading the full timeline.\n\n' +
            'RULES:\n' +
            '1. Use ONLY facts from the data below. Never invent or assume.\n' +
            '2. Deduplicate: if the same thing is said multiple times, mention it once.\n' +
            '3. No email addresses, no personal names, no PII.\n' +
            '4. Keep each bullet to one short sentence.\n' +
            '5. If something is not stated, omit it entirely.\n' +
            '6. Do NOT repeat the case number, priority, or dates.\n\n' +
            'Case: ' + caseData.number + ' | Title: ' + (caseData.short_description || '') + '\n' +
            'State: ' + caseData.state + ' | Priority: ' + caseData.priority + '\n' +
            'Description: ' + caseData.description + '\n\n' +
            'Timeline (oldest first):\n' +
            timelineText + '\n\n' +
            'Return EXACTLY this format (plain text, no markdown, no fences):\n\n' +
            'Issue:\n' +
            '<1-3 sentences: what is broken, who is affected, and the scope of impact>\n\n' +
            'Action Taken:\n' +
            '<each distinct action taken, deduplicated, one bullet per action>\n\n' +
            'Resolution:\n' +
            '<1-2 sentences: how the issue was resolved or current status if unresolved>';

        // Return prepared prompt text.
        return prompt;
    },

    // Call Cisco CIRCUIT LLM endpoint and return model response text.
    _callCircuitLLM: function (prompt) {
        // Read credentials and endpoint settings from System Properties.
        var clientId     = gs.getProperty('x_case_summary.circuit_client_id');
        var clientSecret = gs.getProperty('x_case_summary.circuit_client_secret');
        var appKey       = gs.getProperty('x_case_summary.circuit_app_key');
        var model        = gs.getProperty('x_case_summary.circuit_model') || 'gpt-4o-mini';
        var tokenUrl     = gs.getProperty('x_case_summary.circuit_token_url') || 'https://id.cisco.com/oauth2/default/v1/token';
        var chatBaseUrl  = gs.getProperty('x_case_summary.circuit_chat_base_url') || 'https://chat-ai.cisco.com/openai/deployments';

        // Validate required auth configuration.
        if (!clientId || !clientSecret) {
            throw new Error('Missing CIRCUIT credentials in System Properties');
        }
        if (!appKey) {
            throw new Error('Missing CIRCUIT app key in System Properties');
        }

        // Get OAuth access token before calling chat endpoint.
        var accessToken = this._getAccessToken(clientId, clientSecret, tokenUrl);

        // Build final chat completions endpoint URL.
        var chatUrl = chatBaseUrl + '/' + model + '/chat/completions';

        // Build request payload expected by CIRCUIT chat API.
        var body = {
            messages: [
                {
                    // System message constrains style and accuracy.
                    role: 'system',
                    content: 'You produce concise, factual ticket summaries for support engineers. ' +
                             'Never repeat information. Never hallucinate. ' +
                             'If something is not in the data, leave it out entirely. ' +
                             'Keep the total summary under 200 words. ' +
                             'Use the EXACT section headers requested.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            // CIRCUIT requires app key in user payload.
            user: JSON.stringify({ appkey: appKey }),
            // Low temperature for deterministic output.
            temperature: 0.05,
            // Token cap to prevent oversized responses.
            max_tokens: 600
        };

        // Create REST request object.
        var sm = new sn_ws.RESTMessageV2();
        // Set endpoint and HTTP method.
        sm.setEndpoint(chatUrl);
        sm.setHttpMethod('POST');
        // Set required headers.
        sm.setRequestHeader('Content-Type', 'application/json');
        sm.setRequestHeader('Accept', 'application/json');
        // CIRCUIT in this flow expects token in api-key header.
        sm.setRequestHeader('api-key', accessToken);
        // Attach serialized request body.
        sm.setRequestBody(JSON.stringify(body));
        // Set timeout to 60 seconds.
        sm.setHttpTimeout(60000);

        // Execute HTTP call.
        var response = sm.execute();
        // Capture status and body for validation.
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();

        // Reject non-200 responses with shortened body in error.
        if (httpStatus != 200) {
            throw new Error('CIRCUIT LLM returned HTTP ' + httpStatus + ': ' + responseBody.substring(0, 500));
        }

        // Parse JSON response payload.
        var payload = JSON.parse(responseBody);

        // Extract first choice message content when available.
        if (payload.choices && payload.choices.length > 0) {
            var message = payload.choices[0].message || {};
            if (message.content) {
                // Return trimmed model output text.
                return message.content.trim();
            }
        }

        // Fail fast if response shape is unexpected.
        throw new Error('Unexpected LLM response format');
    },

    // Perform OAuth2 client-credentials token request.
    _getAccessToken: function (clientId, clientSecret, tokenUrl) {
        // Build "clientId:clientSecret" pair for basic auth.
        var credentials = clientId + ':' + clientSecret;
        // Base64 encode credentials for Authorization header.
        var encoded = GlideStringUtil.base64Encode(credentials);

        // Prepare token request.
        var sm = new sn_ws.RESTMessageV2();
        sm.setEndpoint(tokenUrl);
        sm.setHttpMethod('POST');
        // OAuth token endpoint requires form-encoded body.
        sm.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        sm.setRequestHeader('Authorization', 'Basic ' + encoded);
        // Request client credentials grant.
        sm.setRequestBody('grant_type=client_credentials');
        // 30-second timeout for token call.
        sm.setHttpTimeout(30000);

        // Execute token request.
        var response = sm.execute();
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();

        // Throw explicit error on failed token response.
        if (httpStatus != 200) {
            throw new Error('OAuth2 token failed HTTP ' + httpStatus + ': ' + responseBody.substring(0, 300));
        }

        // Parse token JSON payload.
        var payload = JSON.parse(responseBody);
        // Validate presence of access_token.
        if (!payload.access_token) {
            throw new Error('Token response missing access_token');
        }

        // Return token string for subsequent CIRCUIT call.
        return payload.access_token;
    },

    // Add top metadata line to summary text for quick ticket context.
    _prependCaseContext: function (summaryText, caseData) {
        // Build list of available metadata fragments.
        var metaParts = [];
        if (caseData.priority) metaParts.push('Priority: ' + caseData.priority);
        if (caseData.state)    metaParts.push('State: ' + caseData.state);
        if (caseData.assignment_group) metaParts.push('Group: ' + caseData.assignment_group);
        if (caseData.sys_updated_on)   metaParts.push('Updated: ' + caseData.sys_updated_on);
        // Join parts with separators.
        var metaLine = metaParts.join(' | ');

        // Normalize summary text before prepending.
        var text = (summaryText || '').trim();

        // Include metadata line when available.
        if (metaLine) {
            return caseData.number + ' -- ' + metaLine + '\n\n' + text;
        }
        // Fallback to case number only.
        return caseData.number + '\n\n' + text;
    },

    // Parse model output into named sections for UI rendering.
    _parseSections: function (rawSummary) {
        // Final object: { Issue: '...', 'Action Taken': '...', ... }
        var sections = {};
        // Headers expected from prompt instructions.
        var knownHeaders = ['Issue', 'Action Taken', 'Resolution', 'SLA Information'];
        // Split summary by lines for sequential parsing.
        var lines = (rawSummary || '').split('\n');
        // Track current section being populated.
        var currentHeader = '';
        var currentBody = [];

        // Walk all lines in order.
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            // Mark whether current line is a section header.
            var foundHeader = false;

            // Compare line against known section names.
            for (var h = 0; h < knownHeaders.length; h++) {
                var header = knownHeaders[h];
                if (line === header + ':' || line === header) {
                    // Save previous section before switching to new one.
                    if (currentHeader) {
                        sections[currentHeader] = currentBody.join('\n').trim();
                    }
                    // Start collecting lines for new section.
                    currentHeader = header;
                    currentBody = [];
                    foundHeader = true;
                    break;
                }
            }

            // If line is body text under current header, append it.
            if (!foundHeader && currentHeader) {
                currentBody.push(line);
            }
        }

        // Save final section after loop ends.
        if (currentHeader) {
            sections[currentHeader] = currentBody.join('\n').trim();
        }

        // Return parsed sections object.
        return sections;
    },

    // Clean raw journal/email text to make it prompt-safe and compact.
    _cleanText: function (text) {
        // Return empty string for null/undefined input.
        if (!text) return '';
        // Remove HTML tags.
        text = text.replace(/<[^>]*>/g, ' ');
        // Collapse newlines/multiple spaces into single spaces.
        text = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        // Trim overly long entries so prompt size stays manageable.
        if (text.length > 1000) {
            text = text.substring(0, 1000) + '...';
        }
        // Return cleaned text.
        return text;
    },

    // Convert ServiceNow datetime string to ISO-like format for sorting/prompting.
    _toIso: function (ts) {
        // Fallback timestamp if value is empty.
        if (!ts) return '1970-01-01T00:00:00Z';
        try {
            // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ssZ".
            return ts.replace(' ', 'T') + 'Z';
        } catch (e) {
            // Return original value if transformation fails.
            return ts;
        }
    },

    // Script Include class identifier required by ServiceNow.
    type: 'CaseSummaryAI'
});
