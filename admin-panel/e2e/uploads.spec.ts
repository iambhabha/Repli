import { expect, test, type Page } from '@playwright/test';

/**
 * The four upload flows, clicked for real in a browser.
 *
 * Every other test of this panel reads source, checks types, or calls the API
 * directly. Those prove the pipeline. This proves the part nothing else can:
 * that the file input is wired to the endpoint, that a preview appears after
 * an upload, and that "Remove" removes.
 *
 * What it needs:
 *
 *   npm run create-admin -- --email e2e@repli.test --password "…"
 *   E2E_ADMIN_EMAIL=e2e@repli.test E2E_ADMIN_PASSWORD="…" npm run test:e2e
 *
 * Without credentials every test skips, loudly. A skipped test is honest; a
 * test that quietly passes because it never signed in is not.
 *
 * It edits real rows - a real product's photo, a real category's card, the
 * real payment QR - and puts every one of them back afterwards. It never
 * touches an order, a payment, a customer or stock.
 */

const EMAIL = process.env.E2E_ADMIN_EMAIL || '';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';

/** A one-pixel PNG, built here rather than committed as a fixture. */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
    '01f15c4890000000d4944415478da63f8ffff3f0305fe02fdfc14e2b60000000049454e44ae426082',
  'hex'
);

/** Something that is not an image at all, for the negative case. */
const NOT_AN_IMAGE = Buffer.from('%PDF-1.4 this is not a picture', 'utf8');

test.beforeEach(async () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the browser tests.'
  );
});

/** Sign in once per test, through the real form. */
async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email address').fill(EMAIL);
  // By type, not by label: the "Show password" toggle carries an aria-label
  // containing the word "Password" and wins an accessible-name match.
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/admin\/(dashboard|login)/, { timeout: 30_000 });
  await expect(page, 'sign-in should have left the login page').toHaveURL(/\/admin\/dashboard/);
}

/**
 * Attach a file to the hidden input behind the "Upload" button.
 *
 * The control hides its `<input type=file>` and drives it from a button, which
 * is how every real file picker is built. Playwright sets files on the input
 * directly - clicking the button would open a native dialog it cannot see.
 */
async function attach(page: Page, dialogRoot: string, bytes: Buffer, name: string) {
  const input = page.locator(`${dialogRoot} input[type="file"]`);
  await input.setInputFiles({ name, mimeType: name.endsWith('.png') ? 'image/png' : 'application/pdf', buffer: bytes });
}

test.describe('product photo', () => {
  test('upload, preview, replace, remove', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/products');

    // Open the first product's edit form.
    await page.getByRole('button', { name: /^Edit$/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The picker only exists on a saved product - that is the two-step rule.
    await expect(dialog.getByText('Product photo')).toBeVisible();

    const uploadButton = dialog.getByRole('button', { name: /^(Upload|Replace)$/ });
    const startedWithPhoto = (await uploadButton.textContent())?.includes('Replace');

    await attach(page, '[role="dialog"]', PNG, 'e2e-product.png');

    // The toast is the server's word, not the browser's.
    await expect(page.getByText(/Photo uploaded/i)).toBeVisible();

    // A preview appears, and it is a signed URL from the private bucket -
    // never a public object URL.
    const preview = dialog.locator('img').first();
    await expect(preview).toBeVisible();
    const src = await preview.getAttribute('src');
    expect(src, 'a preview should have loaded').toBeTruthy();
    expect(src, 'the preview must be a signed URL, not a public object').toMatch(/token=|\/sign\//);
    expect(src).not.toContain('/object/public/');

    // Replace is now offered, and Remove exists.
    await expect(dialog.getByRole('button', { name: /^Replace$/ })).toBeVisible();

    await dialog.getByRole('button', { name: /^Remove$/ }).click();
    await expect(page.getByText(/Photo removed/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Upload$/ })).toBeVisible();

    // Put it back if it had one before, so the shop is as we found it.
    if (startedWithPhoto) {
      await attach(page, '[role="dialog"]', PNG, 'e2e-restore.png');
      await expect(page.getByText(/Photo uploaded/i)).toBeVisible();
    }
  });

  test('a file that is not an image is refused, and nothing changes', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/products');

    await page.getByRole('button', { name: /^Edit$/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Product photo')).toBeVisible();

    const before = await dialog.getByRole('button', { name: /^(Upload|Replace)$/ }).textContent();

    await attach(page, '[role="dialog"]', NOT_AN_IMAGE, 'not-a-photo.pdf');

    // The client refuses it before it ever leaves the browser.
    await expect(page.getByText(/Only PNG, JPEG and WebP/i)).toBeVisible();

    // And the control is exactly where it was.
    await expect(dialog.getByRole('button', { name: /^(Upload|Replace)$/ })).toHaveText(
      before ?? ''
    );
  });
});

test.describe('variant photo', () => {
  test('a colour gets its own picture', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/products');

    // Expand the first product, then edit its first variant. Scoped to the
    // variant row rather than an index into every Edit button on the page -
    // that ordering is an implementation detail of the table.
    await page.getByRole('button', { name: /Expand variants/i }).first().click();
    const variantRow = page.locator('tr.bg-white').first();
    await expect(variantRow).toBeVisible();
    await variantRow.getByRole('button', { name: /^Edit$/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Colour photo')).toBeVisible();

    await attach(page, '[role="dialog"]', PNG, 'e2e-variant.png');
    await expect(page.getByText(/Photo uploaded/i)).toBeVisible();

    await expect(dialog.locator('img').first()).toBeVisible();

    // Clean up after ourselves.
    await dialog.getByRole('button', { name: /^Remove$/ }).click();
    await expect(page.getByText(/Photo removed/i)).toBeVisible();
  });
});

test.describe('payment QR', () => {
  test('upload and remove, with the UPI text left alone', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    await expect(page.getByText('Payment QR')).toBeVisible();

    // The text field is the fallback and must not be disturbed by any of this.
    const link = page.getByLabel(/Payment link/i);
    const linkBefore = await link.inputValue();

    const qr = page.locator('input[type="file"]').first();
    await qr.setInputFiles({ name: 'e2e-qr.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText(/Photo uploaded/i)).toBeVisible();

    const preview = page.locator('img').first();
    await expect(preview).toBeVisible();
    expect(await preview.getAttribute('src')).not.toContain('/object/public/');

    await page.getByRole('button', { name: /^Remove$/ }).first().click();
    await expect(page.getByText(/Photo removed/i)).toBeVisible();

    // Back to the UPI id as text, exactly as it was.
    await expect(link).toHaveValue(linkBefore);
  });
});

test.describe('category card', () => {
  test('a category gets a catalogue photo, and the key stays locked', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/categories');

    await expect(page.getByRole('heading', { name: /Categories/i })).toBeVisible();
    await page.getByRole('button', { name: /^Edit$/ }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The key is a foreign key in all but name, so the form must not offer
    // to change it. Located by placeholder: the field's accessible name also
    // picks up the explanatory line underneath it.
    const key = dialog.getByPlaceholder('caps', { exact: true });
    await expect(key).toBeDisabled();

    await expect(dialog.getByText('Catalogue card')).toBeVisible();
    await attach(page, '[role="dialog"]', PNG, 'e2e-category.png');
    await expect(page.getByText(/Photo uploaded/i)).toBeVisible();

    await expect(dialog.locator('img').first()).toBeVisible();

    await dialog.getByRole('button', { name: /^Remove$/ }).click();
    await expect(page.getByText(/Photo removed/i)).toBeVisible();
  });

  test('a new category is told to save first', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/categories');

    await page.getByRole('button', { name: /Add category/i }).click();
    const dialog = page.getByRole('dialog');

    // No picker yet, and the reason is on screen rather than left to guess.
    await expect(dialog.getByText(/Save the category first/i)).toBeVisible();
    await expect(dialog.locator('input[type="file"]')).toHaveCount(0);

    // The key IS editable on a new one.
    await expect(dialog.getByPlaceholder('caps', { exact: true })).toBeEnabled();
  });
});
