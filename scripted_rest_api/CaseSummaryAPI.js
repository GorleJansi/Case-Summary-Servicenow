/*
 * Scripted REST API Resource: Case Summary
 *
 * This is the "front door" that lets external systems (like the Webex bot)
 * request an AI summary without needing to be inside ServiceNow.
 *
 * Setup in ServiceNow:
 *   1. Navigate to: System Web Services → Scripted REST APIs → New
 *   2. Name:   CaseSummaryAPI
 *   3. API ID: x_case_summary_api
 *   4. Add a new Resource with settings below
 *
 * Resource Configuration:
 *   Name:            Get Summary
 *   HTTP Method:     GET
 *   Relative path:   /summary/{case_number}
 *   Requires auth:   ✅ (use Basic Auth or OAuth for security)
 *
 * How to call it:
 *   GET https://<instance>.service-now.com/api/x_case_summary_api/summary/CS-12345
 *
 * Response:
 *   {
 *     "success": true,
 *     "summary": "...",
 *     "sections": { "Issue": "...", "Action Taken": "...", "Resolution": "..." },
 *     "case_number": "CS-12345",
 *     "timeline_count": 15
 *   }
 *
 * Author: Jansi Gorle · CX · April 2026
 */

(function process(request, response) {

    // Read case number from the URL path (e.g. /summary/CS-12345)
    var caseNumber = request.pathParams.case_number;

    // Validate that a case number was provided
    if (!caseNumber) {
        response.setStatus(400);
        response.setBody({ success: false, error: 'Missing case_number in URL path' });
        return;
    }

    // --- Step 1: Look up the case record by its number ---
    // Try CSM case table first, then fall back to incident table
    var table = 'sn_customerservice_case';
    var gr = new GlideRecord(table);
    gr.addQuery('number', caseNumber);
    gr.query();

    // If not found in CSM cases, try incident table
    if (!gr.next()) {
        table = 'incident';
        gr = new GlideRecord(table);
        gr.addQuery('number', caseNumber);
        gr.query();

        if (!gr.next()) {
            // Record not found in either table
            response.setStatus(404);
            response.setBody({
                success: false,
                error: 'Case not found: ' + caseNumber
            });
            return;
        }
    }

    // Get the sys_id from the found record
    var sysId = gr.getUniqueValue();

    // --- Step 2: Reuse the existing CaseSummaryAI pipeline ---
    // This is the SAME logic the ServiceNow button uses
    try {
        var ai = new CaseSummaryAI();
        var result = ai._runPipeline(sysId, table);

        // Return the full summary result as JSON
        response.setStatus(200);
        response.setBody(result);

    } catch (e) {
        // Log error for debugging
        gs.error('[CaseSummaryAPI] Error for ' + caseNumber + ': ' + e.message);

        response.setStatus(500);
        response.setBody({
            success: false,
            error: 'Summary generation failed: ' + e.message
        });
    }

})(request, response);
