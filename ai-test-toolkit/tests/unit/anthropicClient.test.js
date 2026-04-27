import { callClaude, parseJsonResponse } from '../../../src/utils/anthropicClient';

describe('anthropicClient', () => {
  describe('parseJsonResponse', () => {
    it('parses clean JSON', () => {
      const raw = '{"key": "value"}';
      expect(parseJsonResponse(raw)).toEqual({ key: 'value' });
    });

    it('strips ```json fences', () => {
      const raw = '```json\n{"key": "value"}\n```';
      expect(parseJsonResponse(raw)).toEqual({ key: 'value' });
    });

    it('strips plain ``` fences', () => {
      const raw = '```\n{"key": "value"}\n```';
      expect(parseJsonResponse(raw)).toEqual({ key: 'value' });
    });

    it('handles extra whitespace', () => {
      const raw = '  \n  {"key": 42}  \n  ';
      expect(parseJsonResponse(raw)).toEqual({ key: 42 });
    });

    it('throws on invalid JSON', () => {
      expect(() => parseJsonResponse('not json')).toThrow(SyntaxError);
    });

    it('parses arrays', () => {
      expect(parseJsonResponse('[1, 2, 3]')).toEqual([1, 2, 3]);
    });
  });

  describe('callClaude', () => {
    const mockSuccessResponse = {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Hello from Claude' }],
      }),
    };

    it('calls the Anthropic API with correct structure', async () => {
      global.fetch.mockResolvedValueOnce(mockSuccessResponse);

      await callClaude('System prompt', 'User message', 500);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.model).toBe('claude-sonnet-4-20250514');
      expect(body.max_tokens).toBe(500);
      expect(body.system).toBe('System prompt');
      expect(body.messages[0]).toEqual({ role: 'user', content: 'User message' });
    });

    it('returns text content from successful response', async () => {
      global.fetch.mockResolvedValueOnce(mockSuccessResponse);
      const result = await callClaude('sys', 'msg');
      expect(result).toBe('Hello from Claude');
    });

    it('throws on non-ok HTTP response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      await expect(callClaude('sys', 'msg')).rejects.toThrow('API error 429: Rate limit exceeded');
    });

    it('throws when response has no text content block', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: 'tool_use', id: 'xyz' }] }),
      });

      await expect(callClaude('sys', 'msg')).rejects.toThrow('No text content in API response');
    });

    it('uses default max_tokens of 1000 when not specified', async () => {
      global.fetch.mockResolvedValueOnce(mockSuccessResponse);
      await callClaude('sys', 'msg');
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.max_tokens).toBe(1000);
    });
  });
});
