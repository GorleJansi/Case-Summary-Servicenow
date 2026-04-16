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

var CaseSummaryAI = Class.create();
CaseSummaryAI.prototype = Object.extendsObject(AbstractAjaxProcessor, {

    getSummary: function () {
        var sysId = this.getParameter('sysparm_sys_id');
        var table = this.getParameter('sysparm_table') || 'sn_customerservice_case';

        if (!sysId) {
            return JSON.stringify({ success: false, error: 'Missing sys_id' });
        }

        try {
            var result = this._runPipeline(sysId, table);
            return JSON.stringify(result);
        } catch (e) {
            gs.error('[CaseSummaryAI] getSummary error: ' + e.message);
            return JSON.stringify({ success: false, error: e.message });
        }
    },

    generateAndSave: function (sysId, table) {
        try {
            var result = this._runPipeline(sysId, table);
            if (result.success) {
                var gr = new GlideRecord(table);
                if (gr.get(sysId)) {
                    var formattedNote = '[AI Summary - Powered by CIRCUIT LLM]\n\n' + result.summary;
                    gr.work_notes = formattedNote;
                    if (gr.isValidField('x_case_summary_ai_summary')) {
                        gr.setValue('x_case_summary_ai_summary', result.summary);
                    }
                    gr.update();
                }
            }
            return result;
        } catch (e) {
            gs.error('[CaseSummaryAI] generateAndSave error: ' + e.message);
            return { success: false, error: e.message };
        }
    },

    _runPipeline: function (sysId, table) {
        gs.info('[CaseSummaryAI] Starting pipeline for ' + table + ':' + sysId);

        var caseData = this._getCaseData(sysId, table);
        if (!caseData) {
            return { success: false, error: 'Record not found: ' + sysId };
        }

        var journalEntries = this._getJournalEntries(sysId);
        var emailEntries = this._getEmails(sysId, table);
        var timeline = this._buildTimeline(journalEntries, emailEntries);

        if (timeline.length === 0) {
            return {
                success: true,
                summary: 'No journal entries or emails found for this record.',
                case_number: caseData.number,
                sections: {},
                timeline_count: 0
            };
        }

        var prompt = this._buildPrompt(caseData, timeline);
        var rawSummary = this._callCircuitLLM(prompt);
        var finalSummary = this._prependCaseContext(rawSummary, caseData);
        var sections = this._parseSections(rawSummary);

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

    _getCaseData: function (sysId, table) {
        var gr = new GlideRecord(table);
        if (!gr.get(sysId)) {
            return null;
        }

        var title = '';
        if (gr.isValidField('short_description')) {
            title = gr.getDisplayValue('short_description');
        }

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

    _getJournalEntries: function (sysId) {
        var entries = [];
        var gr = new GlideRecord('sys_journal_field');
        gr.addQuery('element_id', sysId);
        gr.addQuery('element', 'IN', 'comments,work_notes');
        gr.orderBy('sys_created_on');
        gr.query();

        while (gr.next()) {
            entries.push({
                sys_created_on: gr.getValue('sys_created_on') || '',
                element:        gr.getValue('element') || '',
                value:          gr.getValue('value') || '',
                sys_created_by: gr.getValue('sys_created_by') || ''
            });
        }

        if (entries.length === 0) {
            gr = new GlideRecord('sys_journal_field');
            gr.addQuery('name', sysId);
            gr.addQuery('element', 'IN', 'comments,work_notes');
            gr.orderBy('sys_created_on');
            gr.query();
            while (gr.next()) {
                entries.push({
                    sys_created_on: gr.getValue('sys_created_on') || '',
                    element:        gr.getValue('element') || '',
                    value:          gr.getValue('value') || '',
                    sys_created_by: gr.getValue('sys_created_by') || ''
                });
            }
        }

        return entries;
    },

    _getEmails: function (sysId, table) {
        var emails = [];
        var gr = new GlideRecord('sys_email');
        gr.addQuery('instance', sysId);
        gr.addQuery('target_table', table);
        gr.orderBy('sys_created_on');
        gr.query();

        while (gr.next()) {
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

        return emails;
    },

    _buildTimeline: function (journalEntries, emailEntries) {
        var timeline = [];
        var speakerMap = { 'comments': 'customer', 'work_notes': 'support_engineer', 'email': 'customer' };
        var typeMap    = { 'comments': 'comment',  'work_notes': 'work_note',        'email': 'email' };

        for (var i = 0; i < journalEntries.length; i++) {
            var item = journalEntries[i];
            var element = item.element || '';
            var text = this._cleanText(item.value || '');
            if (!text) continue;
            timeline.push({
                type:      typeMap[element] || 'event',
                source:    element,
                speaker:   speakerMap[element] || 'unknown',
                timestamp: this._toIso(item.sys_created_on),
                text:      text
            });
        }

        for (var j = 0; j < emailEntries.length; j++) {
            var email = emailEntries[j];
            var emailText = this._cleanText(email.body_text || '');
            if (!emailText) continue;
            timeline.push({
                type:      'email',
                source:    'email',
                speaker:   'customer',
                timestamp: this._toIso(email.sys_created_on),
                text:      emailText
            });
        }

        timeline.sort(function (a, b) {
            if (a.timestamp > b.timestamp) return 1;
            if (a.timestamp < b.timestamp) return -1;
            return 0;
        });

        return timeline;
    },

    _buildPrompt: function (caseData, timeline) {
        var lines = [];
        for (var i = 0; i < timeline.length; i++) {
            var item = timeline[i];
            lines.push((i + 1) + '. [' + item.timestamp + '] ' + item.speaker + ': ' + item.text);
        }
        var timelineText = lines.length > 0 ? lines.join('\n') : 'No journal activity found.';

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

        return prompt;
    },

    _callCircuitLLM: function (prompt) {
        var clientId     = gs.getProperty('x_case_summary.circuit_client_id');
        var clientSecret = gs.getProperty('x_case_summary.circuit_client_secret');
        var appKey       = gs.getProperty('x_case_summary.circuit_app_key');
        var model        = gs.getProperty('x_case_summary.circuit_model') || 'gpt-4o-mini';
        var tokenUrl     = gs.getProperty('x_case_summary.circuit_token_url') || 'https://id.cisco.com/oauth2/default/v1/token';
        var chatBaseUrl  = gs.getProperty('x_case_summary.circuit_chat_base_url') || 'https://chat-ai.cisco.com/openai/deployments';

        if (!clientId || !clientSecret) {
            throw new Error('Missing CIRCUIT credentials in System Properties');
        }
        if (!appKey) {
            throw new Error('Missing CIRCUIT app key in System Properties');
        }

        var accessToken = this._getAccessToken(clientId, clientSecret, tokenUrl);

        var chatUrl = chatBaseUrl + '/' + model + '/chat/completions';

        var body = {
            messages: [
                {
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
            user: JSON.stringify({ appkey: appKey }),
            temperature: 0.05,
            max_tokens: 600
        };

        var sm = new sn_ws.RESTMessageV2();
        sm.setEndpoint(chatUrl);
        sm.setHttpMethod('POST');
        sm.setRequestHeader('Content-Type', 'application/json');
        sm.setRequestHeader('Accept', 'application/json');
        sm.setRequestHeader('api-key', accessToken);
        sm.setRequestBody(JSON.stringify(body));
        sm.setHttpTimeout(60000);

        var response = sm.execute();
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();

        if (httpStatus != 200) {
            throw new Error('CIRCUIT LLM returned HTTP ' + httpStatus + ': ' + responseBody.substring(0, 500));
        }

        var payload = JSON.parse(responseBody);

        if (payload.choices && payload.choices.length > 0) {
            var message = payload.choices[0].message || {};
            if (message.content) {
                return message.content.trim();
            }
        }

        throw new Error('Unexpected LLM response format');
    },

    _getAccessToken: function (clientId, clientSecret, tokenUrl) {
        var credentials = clientId + ':' + clientSecret;
        var encoded = GlideStringUtil.base64Encode(credentials);

        var sm = new sn_ws.RESTMessageV2();
        sm.setEndpoint(tokenUrl);
        sm.setHttpMethod('POST');
        sm.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        sm.setRequestHeader('Authorization', 'Basic ' + encoded);
        sm.setRequestBody('grant_type=client_credentials');
        sm.setHttpTimeout(30000);

        var response = sm.execute();
        var httpStatus = response.getStatusCode();
        var responseBody = response.getBody();

        if (httpStatus != 200) {
            throw new Error('OAuth2 token failed HTTP ' + httpStatus + ': ' + responseBody.substring(0, 300));
        }

        var payload = JSON.parse(responseBody);
        if (!payload.access_token) {
            throw new Error('Token response missing access_token');
        }

        return payload.access_token;
    },

    _prependCaseContext: function (summaryText, caseData) {
        var metaParts = [];
        if (caseData.priority) metaParts.push('Priority: ' + caseData.priority);
        if (caseData.state)    metaParts.push('State: ' + caseData.state);
        if (caseData.assignment_group) metaParts.push('Group: ' + caseData.assignment_group);
        if (caseData.sys_updated_on)   metaParts.push('Updated: ' + caseData.sys_updated_on);
        var metaLine = metaParts.join(' | ');

        var text = (summaryText || '').trim();

        if (metaLine) {
            return caseData.number + ' -- ' + metaLine + '\n\n' + text;
        }
        return caseData.number + '\n\n' + text;
    },

    _parseSections: function (rawSummary) {
        var sections = {};
        var knownHeaders = ['Issue', 'Action Taken', 'Resolution', 'SLA Information'];
        var lines = (rawSummary || '').split('\n');
        var currentHeader = '';
        var currentBody = [];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var foundHeader = false;

            for (var h = 0; h < knownHeaders.length; h++) {
                var header = knownHeaders[h];
                if (line === header + ':' || line === header) {
                    if (currentHeader) {
                        sections[currentHeader] = currentBody.join('\n').trim();
                    }
                    currentHeader = header;
                    currentBody = [];
                    foundHeader = true;
                    break;
                }
            }

            if (!foundHeader && currentHeader) {
                currentBody.push(line);
            }
        }

        if (currentHeader) {
            sections[currentHeader] = currentBody.join('\n').trim();
        }

        return sections;
    },

    _cleanText: function (text) {
        if (!text) return '';
        text = text.replace(/<[^>]*>/g, ' ');
        text = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length > 1000) {
            text = text.substring(0, 1000) + '...';
        }
        return text;
    },

    _toIso: function (ts) {
        if (!ts) return '1970-01-01T00:00:00Z';
        try {
            return ts.replace(' ', 'T') + 'Z';
        } catch (e) {
            return ts;
        }
    },

    type: 'CaseSummaryAI'
});
