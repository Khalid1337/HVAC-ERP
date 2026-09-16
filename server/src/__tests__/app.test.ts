import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('Dashboard API', () => {
  const app = createApp();

  it('returns a healthy API response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it('responds with JSON content', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it.each([
    '/api/inventory',
    '/api/customers',
    '/api/invoices',
    '/api/expenses/summary/monthly?month=2026-09',
    '/api/expenses/summary/lifetime'
  ])('returns data from %s', async (endpoint) => {
    const res = await request(app).get(endpoint);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toBeDefined();
  });
});
