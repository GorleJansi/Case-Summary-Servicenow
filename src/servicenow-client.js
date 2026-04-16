import axios from 'axios';
import { config } from './config.js';
import { logger } from './logger.js';

export class ServiceNowClient {
  constructor() {
    this.baseURL = config.servicenow.instance;
    this.auth = { username: config.servicenow.username, password: config.servicenow.password };
  }

  async getCaseData(sysId, table = 'incident') {
    try {
      logger.info(`Fetching case data for ${table}:${sysId}`);
      const response = await axios.get(`${this.baseURL}/api/now/table/${table}/${sysId}`, {
        auth: this.auth,
        params: { sysparm_fields: 'number,short_description,description,state,priority,severity,assignment_group,assigned_to,category,impact,urgency,sys_created_on,sys_updated_on' }
      });
      if (!response.data.result) return null;
      const record = response.data.result;
      return {
        sys_id: sysId, number: record.number, short_description: record.short_description,
        description: record.description, state: record.state, priority: record.priority,
        severity: record.severity || '', assignment_group: record.assignment_group,
        assigned_to: record.assigned_to, category: record.category || '', impact: record.impact || '',
        urgency: record.urgency || '', sys_created_on: record.sys_created_on, sys_updated_on: record.sys_updated_on
      };
    } catch (error) {
      logger.error('Error fetching case data:', { error: error.message, sysId });
      throw error;
    }
  }

  async getJournalEntries(sysId) {
    try {
      logger.info(`Fetching journal entries for ${sysId}`);
      const response = await axios.get(`${this.baseURL}/api/now/table/sys_journal_field`, {
        auth: this.auth,
        params: {
          sysparm_query: `element_id=${sysId}^elementIN comments,work_notes^ORDERBYsys_created_on`,
          sysparm_fields: 'sys_created_on,element,value,sys_created_by'
        }
      });
      return (response.data.result || []).map(entry => ({
        sys_created_on: entry.sys_created_on, element: entry.element, value: entry.value, sys_created_by: entry.sys_created_by
      }));
    } catch (error) {
      logger.error('Error fetching journal entries:', { error: error.message, sysId });
      return [];
    }
  }

  async getEmails(sysId, table = 'incident') {
    try {
      logger.info(`Fetching emails for ${sysId}`);
      const response = await axios.get(`${this.baseURL}/api/now/table/sys_email`, {
        auth: this.auth,
        params: {
          sysparm_query: `instance=${sysId}^target_table=${table}^ORDERBYsys_created_on`,
          sysparm_fields: 'sys_created_on,body_text,body,subject,type'
        }
      });
      return (response.data.result || []).map(email => ({
        sys_created_on: email.sys_created_on, body_text: email.body_text || email.body || email.subject || '',
        type: email.type, subject: email.subject
      }));
    } catch (error) {
      logger.error('Error fetching emails:', { error: error.message, sysId });
      return [];
    }
  }
}
