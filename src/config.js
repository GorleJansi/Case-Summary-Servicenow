import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  circuit: {
    clientId: process.env.CIRCUIT_CLIENT_ID,
    clientSecret: process.env.CIRCUIT_CLIENT_SECRET,
    appKey: process.env.CIRCUIT_APP_KEY,
    model: process.env.CIRCUIT_MODEL || 'gpt-5-nano',
    tokenUrl: process.env.CIRCUIT_TOKEN_URL || 'https://id.cisco.com/oauth2/default/v1/token',
    chatBaseUrl: process.env.CIRCUIT_CHAT_BASE_URL || 'https://chat-ai.cisco.com/openai/deployments'
  },
  servicenow: {
    instance: process.env.SERVICENOW_INSTANCE,
    username: process.env.SERVICENOW_USERNAME,
    password: process.env.SERVICENOW_PASSWORD
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
};

export const validateConfig = () => {
  const required = ['circuit.clientId', 'circuit.clientSecret', 'circuit.appKey'];
  const missing = [];
  required.forEach(key => {
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
      value = value[k];
      if (!value) {
        missing.push(key);
        break;
      }
    }
  });
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
};
