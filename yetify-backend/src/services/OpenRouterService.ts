import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly httpReferer: string;
  private readonly siteName: string;
  private readonly defaultModel: string = 'deepseek/deepseek-r1:free';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.httpReferer = process.env.OPENROUTER_HTTP_REFERER || 'https://yetify.ai';
    this.siteName = process.env.OPENROUTER_SITE_NAME || 'Yetify';

    if (!this.apiKey) {
      logger.error('OPENROUTER_API_KEY not found in environment variables');
      throw new Error('OpenRouter API key is required');
    }
  }

  async generateCompletion(
    messages: OpenRouterMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const requestBody: OpenRouterRequest = {
        model: options?.model || this.defaultModel,
        messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 4000,
      };

      logger.ai('Making OpenRouter API request', {
        model: requestBody.model,
        messageCount: messages.length,
        temperature: requestBody.temperature
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.httpReferer,
          'X-Title': this.siteName,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      
      const duration = Date.now() - startTime;
      logger.performance('OpenRouter API call', duration, {
        model: data.model,
        tokensUsed: data.usage?.total_tokens || 0,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0
      });

      const completion = data.choices?.[0]?.message?.content;
      if (!completion) {
        throw new Error('No completion received from OpenRouter API');
      }

      logger.ai('OpenRouter completion received', {
        model: data.model,
        completionLength: completion.length,
        finishReason: data.choices?.[0]?.finish_reason
      });

      return completion;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('OpenRouter API request failed', {
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async generateStrategy(systemPrompt: string, userPrompt: string): Promise<string> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];

    return this.generateCompletion(messages, {
      model: this.defaultModel,
      temperature: 0.7,
      maxTokens: 4000
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      logger.info('Testing OpenRouter connection...');
      
      const testResponse = await this.generateCompletion([
        {
          role: 'user',
          content: 'Hello, please respond with "OpenRouter connection successful"'
        }
      ], {
        maxTokens: 50
      });

      const isSuccessful = testResponse.toLowerCase().includes('successful') || 
                          testResponse.toLowerCase().includes('openrouter');
      
      if (isSuccessful) {
        logger.info('OpenRouter connection test passed');
      } else {
        logger.warn('OpenRouter connection test failed - unexpected response:', testResponse);
      }
      
      return isSuccessful;
    } catch (error) {
      logger.error('OpenRouter connection test failed:', error);
      return false;
    }
  }

  getModelInfo() {
    return {
      model: this.defaultModel,
      provider: 'DeepSeek',
      cost: 'Free tier',
      features: ['JSON output', 'Multi-turn chat', 'Fast inference']
    };
  }
}