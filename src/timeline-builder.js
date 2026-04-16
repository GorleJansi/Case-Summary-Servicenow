import { logger } from './logger.js';

export class TimelineBuilder {
  static build(journalEntries = [], emailEntries = []) {
    logger.info('Building timeline', { journalCount: journalEntries.length, emailCount: emailEntries.length });
    const speakerMap = { 'comments': 'customer', 'work_notes': 'support_engineer', 'email': 'customer' };
    const typeMap = { 'comments': 'comment', 'work_notes': 'work_note', 'email': 'email' };
    const timeline = [];

    journalEntries.forEach(entry => {
      const element = entry.element || '';
      const text = this._cleanText(entry.value || '');
      if (!text) return;
      timeline.push({
        type: typeMap[element] || 'event', source: element, speaker: speakerMap[element] || 'unknown',
        timestamp: this._toIso(entry.sys_created_on), text: text
      });
    });

    emailEntries.forEach(email => {
      const emailText = this._cleanText(email.body_text || '');
      if (!emailText) return;
      timeline.push({
        type: 'email', source: 'email', speaker: 'customer',
        timestamp: this._toIso(email.sys_created_on), text: emailText
      });
    });

    timeline.sort((a, b) => a.timestamp > b.timestamp ? 1 : a.timestamp < b.timestamp ? -1 : 0);
    logger.debug('Timeline built', { count: timeline.length });
    return timeline;
  }

  static _cleanText(text) {
    if (!text) return '';
    text = text.replace(/<[^>]*>/g, ' ').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 1000) text = text.substring(0, 1000) + '...';
    return text;
  }

  static _toIso(ts) {
    if (!ts) return '1970-01-01T00:00:00Z';
    try { return ts.replace(' ', 'T') + 'Z'; } catch (e) { return ts; }
  }
}
