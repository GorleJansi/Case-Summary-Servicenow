/**
 * ═══════════════════════════════════════════════════════════════
 *  UI Action: "🤖 AI Summary" Button
 * ═══════════════════════════════════════════════════════════════
 *
 *  Adds a button to the Incident / Case form header.
 *  When clicked:
 *    1. Shows a loading popup
 *    2. Calls CaseSummaryAI Script Include via GlideAjax
 *    3. Displays the AI summary in a styled modal (like AI Assist panel)
 *    4. Also saves the summary into the record (work_notes + custom field)
 *
 *  ServiceNow UI Action Configuration:
 *    Name:            AI Summary
 *    Table:           sn_customerservice_case
 *    Action name:     ai_summary
 *    Order:           50
 *    Active:          ✅
 *    Show insert:     ❌
 *    Show update:     ✅
 *    Client:          ✅
 *    Form button:     ✅
 *    Onclick:         generateAISummary()
 *    Condition:       (leave empty)
 *
 *  Author: Jansi Gorle · CX · April 2026
 * ═══════════════════════════════════════════════════════════════
 */

function generateAISummary() {

    // ── Get record context ──
    var sysId      = g_form.getUniqueValue();
    var table      = g_form.getTableName();
    var recordNum  = g_form.getValue('number');

    if (!sysId) {
        g_form.addErrorMessage('Please save the record before generating a summary.');
        return false;
    }

    // ── Show loading dialog ──
    var loadingDialog = new GlideModal('glide_modal_confirm', false, 500);
    loadingDialog.setTitle('🤖 AI Summary — ' + recordNum);
    loadingDialog.renderWithContent(
        '<div style="text-align:center; padding:50px 20px; font-family:SourceSansPro,Arial,sans-serif;">' +
            '<div style="margin-bottom:20px;">' +
                '<div style="display:inline-block; width:40px; height:40px; border:4px solid #e0e0e0; ' +
                'border-top:4px solid #0078d7; border-radius:50%; animation:spin 1s linear infinite;"></div>' +
            '</div>' +
            '<style>@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }</style>' +
            '<p style="font-size:16px; color:#333; font-weight:600; margin:0 0 8px 0;">Generating AI Summary...</p>' +
            '<p style="font-size:13px; color:#888; margin:0;">Fetching journal entries, building timeline, calling CIRCUIT LLM</p>' +
        '</div>'
    );

    // ── Call Script Include via GlideAjax ──
    var ga = new GlideAjax('CaseSummaryAI');
    ga.addParam('sysparm_name', 'getSummary');
    ga.addParam('sysparm_sys_id', sysId);
    ga.addParam('sysparm_table', table);
    ga.getXMLAnswer(function (response) {

        // Close loading dialog
        loadingDialog.destroy();

        try {
            var result = JSON.parse(response);

            if (result.success) {
                // Show the summary popup (styled like AI Assist panel)
                _showAISummaryPanel(recordNum, result);
            } else {
                _showErrorDialog(recordNum, result.error || 'Unknown error');
            }
        } catch (e) {
            _showErrorDialog(recordNum, 'Failed to parse response: ' + e.message);
        }
    });

    return false;
}


// ═══════════════════════════════════════════════════════════════
//  AI SUMMARY PANEL — styled exactly like ServiceNow's AI Assist
//  (matches the "Powered by AI Assist!" panel from your screenshot)
// ═══════════════════════════════════════════════════════════════

function _showAISummaryPanel(recordNum, result) {
    var sections = result.sections || {};
    var caseData = result.case_data || {};
    var timelineCount = result.timeline_count || 0;

    var html = [];

    // ── Outer container (matches AI Assist styling) ──
    html.push('<div style="font-family:SourceSansPro,Arial,sans-serif; padding:0; max-height:550px; overflow-y:auto;">');

    // ── Header bar (purple/blue gradient like AI Assist) ──
    html.push(
        '<div style="background:linear-gradient(135deg, #6366f1 0%, #0078d7 100%); ' +
        'color:white; padding:14px 20px; display:flex; align-items:center; gap:8px;">' +
            '<span style="font-size:18px;">✨</span>' +
            '<span style="font-size:15px; font-weight:600;">Powered by CIRCUIT LLM</span>' +
            '<span style="font-size:11px; opacity:0.8; margin-left:auto;">' + timelineCount + ' entries analyzed</span>' +
        '</div>'
    );

    // ── Content area ──
    html.push('<div style="padding:20px;">');

    // ── Issue Section ──
    if (sections['Issue']) {
        html.push(
            '<div style="margin-bottom:18px;">' +
                '<div style="font-size:14px; font-weight:700; color:#1a1a1a; margin-bottom:6px;">Issue:</div>' +
                '<div style="font-size:13px; color:#333; line-height:1.6;">' +
                    _escHtml(sections['Issue']) +
                '</div>' +
            '</div>'
        );
    }

    // ── Action Taken Section ──
    if (sections['Action Taken']) {
        html.push(
            '<div style="margin-bottom:18px;">' +
                '<div style="font-size:14px; font-weight:700; color:#1a1a1a; margin-bottom:6px;">Action Taken:</div>' +
                '<div style="font-size:13px; color:#333; line-height:1.8;">'
        );

        // Parse bullet points
        var actionLines = sections['Action Taken'].split('\n');
        for (var a = 0; a < actionLines.length; a++) {
            var actionLine = actionLines[a].trim();
            if (!actionLine) continue;
            // Normalize bullet style
            actionLine = actionLine.replace(/^[•\-\*]\s*/, '');
            if (actionLine) {
                html.push('<div style="padding-left:16px; text-indent:-16px; margin-bottom:2px;">• ' + _escHtml(actionLine) + '</div>');
            }
        }

        html.push('</div></div>');
    }

    // ── Resolution Section ──
    if (sections['Resolution']) {
        html.push(
            '<div style="margin-bottom:18px;">' +
                '<div style="font-size:14px; font-weight:700; color:#1a1a1a; margin-bottom:6px;">Resolution:</div>' +
                '<div style="font-size:13px; color:#333; line-height:1.6;">' +
                    _escHtml(sections['Resolution']) +
                '</div>' +
            '</div>'
        );
    }

    // ── SLA Information Section (only if present) ──
    if (sections['SLA Information']) {
        html.push(
            '<div style="margin-bottom:18px;">' +
                '<div style="font-size:14px; font-weight:700; color:#1a1a1a; margin-bottom:6px;">SLA Information:</div>' +
                '<div style="font-size:13px; color:#333; line-height:1.8;">'
        );

        var slaLines = sections['SLA Information'].split('\n');
        for (var s = 0; s < slaLines.length; s++) {
            var slaLine = slaLines[s].trim();
            if (!slaLine) continue;
            slaLine = slaLine.replace(/^[•\-\*]\s*/, '');
            if (slaLine) {
                html.push('<div style="padding-left:16px; text-indent:-16px; margin-bottom:2px;">• ' + _escHtml(slaLine) + '</div>');
            }
        }

        html.push('</div></div>');
    }

    // ── Attachment / Meta line ──
    html.push(
        '<div style="margin-bottom:12px;">' +
            '<div style="font-size:14px; font-weight:700; color:#1a1a1a; margin-bottom:6px;">Attachment:</div>' +
            '<div style="font-size:13px; color:#333;">• N/A</div>' +
        '</div>'
    );

    // ── Footer ──
    html.push(
        '<div style="border-top:1px solid #e5e7eb; padding-top:12px; margin-top:16px; ' +
        'display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
            '<span style="font-size:11px; color:#9ca3af;">Last generated: ' + new Date().toLocaleString() + '</span>' +
        '</div>'
    );

    html.push('</div>');  // content
    html.push('</div>');  // outer

    // ── Create modal ──
    var dialog = new GlideModal('glide_modal_confirm', false, 600);
    dialog.setTitle('✨ AI Summary — ' + recordNum);
    dialog.renderWithContent(html.join(''));
}


// ═══════════════════════════════════════════════════════════════
//  ERROR DIALOG
// ═══════════════════════════════════════════════════════════════

function _showErrorDialog(recordNum, errorMsg) {
    var html =
        '<div style="padding:30px; text-align:center; font-family:SourceSansPro,Arial,sans-serif;">' +
            '<div style="font-size:48px; margin-bottom:16px;">⚠️</div>' +
            '<div style="font-size:16px; color:#dc2626; font-weight:600; margin-bottom:8px;">Summary Generation Failed</div>' +
            '<div style="font-size:13px; color:#666; max-width:400px; margin:0 auto;">' + _escHtml(errorMsg) + '</div>' +
        '</div>';

    var dialog = new GlideModal('glide_modal_confirm', false, 450);
    dialog.setTitle('🤖 AI Summary — ' + recordNum);
    dialog.renderWithContent(html);
}


// ═══════════════════════════════════════════════════════════════
//  HTML ESCAPE HELPER
// ═══════════════════════════════════════════════════════════════

function _escHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
