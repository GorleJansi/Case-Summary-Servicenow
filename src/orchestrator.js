import { ServiceNowClient } from './servicenow-client.js';
import { TimelineBuilder } from './timeline-builder.js';
import { PromptBuilder } from './prompt-builder.js';
import { LLMClient } from './llm-client.js';
import { logger } from './logger.js';

export class CaseSummaryOrchestrator {
  constructor() {
    this.snClient = new ServiceNowClient();
    this.llmClient = new LLMClient();
  }

  async generateSummary(sysId, table = 'incident') {
    logger.info('Starting summary generation', { sysId, table });
    try {
      const caseData = await this.snClient.getCaseData(sysId, table);
      if (!caseData) throw new Error(`Record not found: ${sysId}`);
      const [journalEntries, emailEntries] = await Promise.all([
        this.snClient.getJournalEntries(sysId),
        this.snClient.getEmails(sysId, table)
      ]);
      const timeline = TimelineBuilder.build(journalEntries, emailEntries);
      if (timeline.length === 0) {
        return {
          success: true,
          summary: 'No journal entries or emails found for this record.',
          case_number: caseData.number,
          sections: {},
          timeline_count: 0
        };
      }
      const prompt = PromptBuilder.build(caseData, timeline);
      const rawSummary = await this.llmClient.generateSummary(prompt);
      const sections = this._parseSections(rawSummary);
      const finalSummary = this._prependCaseContext(rawSummary, caseData);
      logger.info('Summary generated successfully', { caseNumber: caseData.number });
      return {
        success: true,
        summary: finalSummary,
        raw_summary: rawSummary,
        sections: sections,
        case_number: caseData.number,
        case_data: caseData,
        timeline_count: timeline.length
      };
    } catch (error) {
      logger.error('Error generating summary:', { error: error.message, sysId });
      return { success: false, error: error.message };
    }
  }

  _parseSections(rawSummary) {
    const sections = {};
    const knownHeaders = ['Issue', 'Action Taken', 'Resolution', 'SLA Information'];
    const lines = (rawSummary || '').split('\n');
    let currentHeader = '';
    let currentBody = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      let foundHeader = false;
      for (const header of knownHeaders) {
        if (trimmed === header + ':' || trimmed === header) {
          if (currentHeader) sections[currentHeader] = currentBody.join('\n').trim();
          currentHeader = header;
          currentBody = [];
          foundHeader = true;
          break;
        }
      }
      if (!foundHeader && currentHeader) currentBody.push(trimmed);
    });
    if (currentHeader) sections[currentHeader] = currentBody.join('\n').trim();
    return sections;
  }

  _prependCaseContext(summaryText, caseData) {
    const metaParts = [];
    if (caseData.priority) metaParts.push('Priority: ' + caseData.priority);
    if (caseData.state) metaParts.push('State: ' + caseData.state);
    if (caseData.assignment_group) metaParts.push('Group: ' + caseData.assignment_group);
    if (caseData.sys_updated_on) metaParts.push('Updated: ' + caseData.sys_updated_on);
    const metaLine = metaParts.join(' | ');
    const text = (summaryText || '').trim();
    if (metaLine) return `${caseData.number} -- ${metaLine}\n\n${text}`;
    return `${caseData.number}\n\n${text}`;
  }
}
