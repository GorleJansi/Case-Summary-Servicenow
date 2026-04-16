import axios from 'axios';
import { config } from './config.js';
import { logger } from './logger.js';

export class LLMClient {
  constructor() {
    this.provider = this._detectProvider();
  }

  _detectProvider() {
    if (config.circuit.clientId && config.circuit.clientSecret) return 'circuit';
    if (config.openai.apiKey) return 'openai';
    throw new Error('No LLM provider configured');
  }

  async generateSummary(prompt) {
    if (this.provider === 'circuit') return this._generateViaCIRCUIT(prompt);
    else if (this.provider === 'openai') return this._generateViaOpenAI(prompt);
    throw new Error('Unknown LLM provider');
  }

  async _generateViaCIRCUIT(prompt) {
    try {
      logger.info('Calling CIRCUIT LLM');
      const token = await this._getCIRCUITToken();
      const chatUrl = `${config.circuit.chatBaseUrl}/${config.circuit.model}/chat/completions`;
      const body = {
        messages: [
          { role: 'system', content: 'You produce concise, factual ticket summaries for support engineers. Never repeat information. Never hallucinate. Keep the total summary under 200 words.' },
          { role: 'user', content: prompt }
        ],
        user: JSON.stringify({ appkey: config.circuit.appKey }),
        temperature: 0.05,
        max_tokens: 600
      };
      const response = await axios.post(chatUrl, body, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': token },
        timeout: 60000
      });
      if (response.status !== 200) throw new Error(`CIRCUIT LLM returned HTTP ${response.status}`);
      const payload = response.data;
      if (payload.choices && payload.choices.length > 0) {
        const message = payload.choices[0].message || {};
        if (message.content) return message.content.trim();
      }
      throw new Error('Unexpected LLM response format');
    } catch (error) {
      logger.error('Error calling CIRCUIT LLM:', { error: error.message });
      throw error;
    }
  }

  async _generateViaOpenAI(prompt) {
    try {
      logger.info('Calling OpenAI LLM');
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: config.openai.model,
        messages: [
          { role: 'system', content: 'You produce concise, factual ticket summaries for support engineers. Never hallucinate.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.05,
        max_tokens: 600
      }, {
        headers: { 'Authorization': `Bearer ${config.openai.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60000
      });
      if (response.data.choices && response.data.choices.length > 0) return response.data.choices[0].message.content.trim();
      throw new Error('Unexpected OpenAI response');
    } catch (error) {
      logger.error('Error calling OpenAI:', { error: error.message });
      throw error;
    }
  }

  async _getCIRCUITToken() {
    try {
      const credentials = `${config.circuit.clientId}:${config.circuit.clientSecret}`;
      const encoded = Buffer.from(credentials).toString('base64');
      const response = await axios.post(config.circuit.tokenUrl, 'grant_type=client_credentials', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${encoded}` },
        timeout: 30000
      });
      if (response.status !== 200) throw new Error(`OAuth2 token failed HTTP ${response.status}`);
      const payload = response.data;
      if (!payload.access_token) throw new Error('Token response missing access_token');
      return payload.access_token;
    } catch (error) {
      logger.error('Error getting CIRCUIT token:', { error: error.message });
      throw error;
    }
  }
}
