const request = require('supertest');

describe('Backend Integration & Unit API Tests', () => {
    // CircleCI booted the API server up concurrently, so we hit it directly!
    const API_URL = 'http://127.0.0.1:5000';

    it('Should properly integrate with Database and return 200 OK from /health endpoint', async () => {
        const res = await request(API_URL).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.service).toBe('peerlearn-backend');
    });

    it('Should correctly return the baseline server root response', async () => {
        const res = await request(API_URL).get('/');
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('PeerLearn Backend Running');
    });
});
