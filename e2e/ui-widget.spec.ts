import { test, expect } from '@playwright/test';

test.describe('UI Widget Rendering', () => {
  test('MCP find_care_v1 returns UI structure', async ({ request }) => {
    // Test MCP endpoint returns UI structure
    const response = await request.post('/mcp', {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'find_care_v1',
          arguments: { zip: '98201', venue: 'urgent_care' }
        }
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify response structure
    expect(data.result.content[0].type).toBe('text');
    const uiData = JSON.parse(data.result.content[0].text);
    expect(uiData.ui).toBe('ui://find-care/widget.html');
    expect(uiData.props).toBeDefined();
    expect(uiData.props.query.zip).toBe('98201');
    expect(uiData.props.query.venue).toBe('urgent_care');
    expect(Array.isArray(uiData.props.results)).toBeTruthy();
    expect(uiData.fallback_markdown).toBeDefined();
  });

  test('Widget embed loads with props parameter', async ({ page }) => {
    // Test that the widget HTML loads and can accept props via URL parameter
    // (This is the fallback method when postMessage doesn't work)
    const testProps = {
      query: { zip: '98201', venue: 'urgent_care' },
      results: [
        {
          id: 'test1',
          name: 'Providence Urgent Care - Test',
          distance: 2.5,
          openNow: true,
          address: {
            line1: '123 Test St',
            city: 'Everett',
            state: 'WA',
            zip: '98201'
          }
        }
      ]
    };

    // Navigate to widget with test props via URL (fallback method)
    const propsParam = encodeURIComponent(JSON.stringify(testProps));
    await page.goto(`/public/find-care-test.html?props=${propsParam}`);

    // Verify embedded mode notice appears
    await expect(page.locator('#embedded-notice')).toBeVisible();
    await expect(page.locator('#embedded-notice')).toContainText('Embedded widget mode');

    // Verify facilities are rendered
    await expect(page.locator('.card')).toHaveCount(1);

    // Check facility content
    const card = page.locator('.card').first();
    await expect(card).toContainText('Providence Urgent Care - Test');
    await expect(card).toContainText('2.5 mi');
    await expect(card).toContainText('123 Test St');
  });

  test('UI detection logic works correctly', async ({ page }) => {
    // Navigate to the UI test page
    await page.goto('/public/ui-test.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Test valid UI response simulation by calling the function directly
    await page.evaluate(() => {
      if (window.testValidUI) window.testValidUI();
    });
    await page.waitForTimeout(500); // Give time for DOM update
    const result1 = page.locator('#test1-result');
    await expect(result1).toContainText('Widget Rendered: ui://find-care/widget.html');

    // Test invalid UI URI
    await page.evaluate(() => {
      if (window.testInvalidUI) window.testInvalidUI();
    });
    await page.waitForTimeout(500);
    const result2 = page.locator('#test2-result');
    await expect(result2).toContainText('Fallback: Unrecognized UI URI');

    // Test no UI field
    await page.evaluate(() => {
      if (window.testNoUI) window.testNoUI();
    });
    await page.waitForTimeout(500);
    const result3 = page.locator('#test3-result');
    await expect(result3).toContainText('Traditional Render');
  });

  test('MCP integration test via UI test page', async ({ page }) => {
    // Test the MCP integration through the UI test page
    await page.goto('/public/ui-test.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Call the MCP test function directly
    await page.evaluate(async () => {
      if (window.testMCPIntegration) await window.testMCPIntegration();
    });

    // Wait for the async operation to complete
    await page.waitForTimeout(2000);

    const result = page.locator('#test5-result');
    await expect(result).toContainText('MCP Response Valid');
    await expect(result).toContainText('ui://find-care/widget.html');
    await expect(result).toContainText('Has Fallback: true');
  });
});
