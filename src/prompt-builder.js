import { logger } from './logger.js';

export class PromptBuilder {
  static build(caseData, timeline) {
    logger.debug('Building LLM prompt', { timelineLength: timeline.length });
    const lines = timeline.map((item, idx) => `${idx + 1}. [${item.timestamp}] ${item.speaker}: ${item.text}`);
    const timelineText = lines.length > 0 ? lines.join('\n') : 'No journal activity found.';
    return `Summarize this ServiceNow case for an engineer picking up the ticket.
They need to understand the situation in 30 seconds without reading the full timeline.

RULES:
1. Use ONLY facts from the data below. Never invent or assume.
2. Deduplicate: if the same thing is said multiple times, mention it once.
3. No email addresses, no personal names, no PII.
4. Keep each bullet to one short sentence.
5. If something is not stated, omit it entirely.
6. Do NOT repeat the case number, priority, or dates.

Case: ${caseData.number} | Title: ${caseData.short_description || ''}
State: ${caseData.state} | Priority: ${caseData.priority}
Description: ${caseData.description}

Timeline (oldest first):
${timelineText}

Return EXACTLY this format (plain text, no markdown, no fences):

Issue:
<1-3 sentences: what is broken, who is affected, and the scope of impact>

Action Taken:
<each distinct action taken, deduplicated, one bullet per action>

Resolution:
<1-2 sentences: how the issue was resolved or current status if unresolved>`;
  }
}
