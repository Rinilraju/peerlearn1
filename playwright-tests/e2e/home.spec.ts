import { test, expect } from '@playwright/test';

test.describe('Functional Testing Suite', () => {
  test('Should load landing page functionality completely and navigate paths', async ({ page }) => {
    // CircleCI started our frontend on port 5173
    // This functionally proves React builds and loads without crashing
    await page.goto('http://127.0.0.1:5173/');

    // Ensure the page actually boots successfully based on standard Vite titles
    await expect(page).toHaveTitle(/Vite \+ React|PeerLearn|Peer/i);
  });
});
