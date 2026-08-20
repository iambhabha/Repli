'use strict';

/**
 * Tests for the admin panel's UI, at the only level this repo can test it.
 *
 * There is no test runner in `admin-panel/` - it is a Next app with a
 * typecheck and nothing else - so these are static: they read the components
 * and the routes and assert that the contracts between them line up, and that
 * the UI cannot ask the backend for something the backend refuses to do.
 *
 * That is a real class of bug and worth catching: a form posting to a route
 * that does not exist, a picker offering a file type the server rejects, or a
 * control offering to rename a key that is a foreign key in all but name.
 *
 * What these do NOT do is exercise a browser. Said plainly here so nobody
 * reads a green line as "the upload was clicked and it worked".
 *
 *   node tests/panel.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PANEL = path.join(__dirname, '..', 'admin-panel');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ❌ ${name}\n     ${err.stack.split('\n').slice(0, 3).join('\n     ')}`);
  }
}

const read = (...parts) => fs.readFileSync(path.join(PANEL, ...parts), 'utf8');
const exists = (...parts) => fs.existsSync(path.join(PANEL, ...parts));

console.log('\n— every endpoint the UI calls exists —\n');

/** Turn `/api/products/${id}/image` into the route file it must resolve to. */
const ROUTES = {
  '/api/products/${productDraft.id}/image': 'app/api/products/[id]/image/route.ts',
  '/api/variants/${variantDraft.id}/image': 'app/api/variants/[id]/image/route.ts',
  '/api/settings/qr': 'app/api/settings/qr/route.ts',
  '/api/categories': 'app/api/categories/route.ts',
  '/api/categories/${draft.key}': 'app/api/categories/[key]/route.ts',
  '/api/categories/${hiding.key}': 'app/api/categories/[key]/route.ts',
};

check('every path the new UI posts to has a route file', () => {
  for (const [called, file] of Object.entries(ROUTES)) {
    assert.ok(exists(file), `${called} has no route at ${file}`);
  }
});

check('the product form calls the product image route', () => {
  const source = read('components', 'admin', 'ProductTable.tsx');
  assert.ok(source.includes('/api/products/${productDraft.id}/image'));
  assert.ok(source.includes('/api/variants/${variantDraft.id}/image'));
  assert.ok(source.includes("from '@/components/ui/ImageUpload'"));
});

check('the settings form calls the QR route', () => {
  const source = read('components', 'admin', 'SettingsForm.tsx');
  assert.ok(source.includes('endpoint="/api/settings/qr"'));
  assert.ok(source.includes('hasImage={Boolean(settings.paymentQr)}'));
});

check('the category table calls the category routes', () => {
  const source = read('components', 'admin', 'CategoryTable.tsx');
  assert.ok(source.includes("api.post('/api/categories'"));
  assert.ok(source.includes('api.put(`/api/categories/${draft.key}`'));
  assert.ok(source.includes('api.delete(`/api/categories/${hiding.key}`'));
});

console.log('\n— the picker and the server agree on what a photo is —\n');

check('the same three types, on both sides', () => {
  const ui = read('components', 'ui', 'ImageUpload.tsx');
  const server = read('lib', 'storage.ts');

  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.ok(ui.includes(type), `the picker should offer ${type}`);
    assert.ok(server.includes(`'${type}'`), `the server should accept ${type}`);
  }
  // The one that matters: a picker that offered SVG would be offering
  // something the server is right to refuse.
  assert.ok(!ui.includes('image/svg'), 'SVG must not be offered');
  assert.ok(!server.includes('image/svg'), 'SVG must not be accepted');
  assert.ok(!ui.includes('image/gif'), 'the picker must not offer what the server refuses');
});

check('the same size cap on both sides', () => {
  const ui = read('components', 'ui', 'ImageUpload.tsx');
  const server = read('lib', 'storage.ts');
  assert.ok(ui.includes('5 * 1024 * 1024'));
  assert.ok(server.includes('5 * 1024 * 1024'));
});

check('the client check is a courtesy, and says so', () => {
  const ui = read('components', 'ui', 'ImageUpload.tsx');
  assert.ok(
    /courtesy|not a defence|re-checks/i.test(ui),
    'it must be clear the server is what actually validates'
  );
  const server = read('lib', 'storage.ts');
  assert.ok(server.includes('looksLike('), 'and the server checks magic numbers, not the name');
});

console.log('\n— failure leaves the shop where it was —\n');

check('the picker only claims success after the server confirmed', () => {
  const ui = read('components', 'ui', 'ImageUpload.tsx');
  const upload = ui.indexOf('await api.upload(endpoint, file)');
  const mark = ui.indexOf('setPresent(true)');
  assert.ok(upload > 0 && mark > upload, 'state changes only after the await returns');

  // The failure branch must not touch the row's state at all.
  const catchBlock = ui.slice(ui.indexOf('} catch (error) {', upload), ui.indexOf('} finally {', upload));
  assert.ok(!catchBlock.includes('setPresent('), 'a failed upload must not change what is shown');
  assert.ok(catchBlock.includes('toast('), 'but it must say so');
});

check('a busy upload cannot be started twice', () => {
  const ui = read('components', 'ui', 'ImageUpload.tsx');
  assert.ok(ui.includes('disabled={busy !== null}'), 'the buttons are disabled while working');
  assert.ok(ui.includes('animate-spin'), 'and there is a progress indicator');
});

check('a missing picture shows a placeholder, never a broken image', () => {
  const ui = read('components', 'ui', 'ImageUpload.tsx');
  assert.ok(ui.includes('if (!present) {'), 'no fetch when there is nothing to show');
  assert.ok(ui.includes('<ImageIcon'), 'a placeholder instead');
  assert.ok(ui.includes('.catch('), 'and a failed preview fetch is swallowed, not thrown');
});

check('the upload helper lets the browser set its own multipart boundary', () => {
  const client = read('lib', 'api', 'client.ts');
  const upload = client.slice(client.indexOf('upload:'));
  assert.ok(upload.includes('new FormData()'));
  assert.ok(!/content-type/i.test(upload), 'setting it by hand breaks the parse server-side');
});

console.log('\n— the UI cannot offer what the backend refuses —\n');

check('a category key is fixed once the row exists', () => {
  const ui = read('components', 'admin', 'CategoryTable.tsx');
  const service = read('lib', 'services', 'categories.ts');

  assert.ok(ui.includes('disabled={draft.existing}'), 'the key input is locked when editing');
  assert.ok(
    service.includes('A category key cannot be changed'),
    'and the server refuses it regardless'
  );
});

check('a category is hidden, never deleted', () => {
  const ui = read('components', 'admin', 'CategoryTable.tsx');
  const route = read('app', 'api', 'categories', '[key]', 'route.ts');

  assert.ok(!/\bdelete it\b/i.test(ui), 'the UI must not promise a delete');
  assert.ok(ui.includes('Hide it'), 'it offers hiding');
  assert.ok(route.includes('deactivateCategory'), 'and DELETE deactivates');
  assert.ok(!route.includes('.delete()'), 'no row is ever removed');
});

check('the UI repeats the rule that stock decides visibility', () => {
  const ui = read('components', 'admin', 'CategoryTable.tsx');
  const page = read('app', 'admin', '(app)', 'categories', 'page.tsx');
  assert.ok(
    /only .{0,20}offered .{0,40}in stock/i.test(ui + page),
    'an owner must not think Active alone puts a category in front of a customer'
  );
});

check('the QR picker keeps the UPI text as the fallback', () => {
  const ui = read('components', 'admin', 'SettingsForm.tsx');
  assert.ok(ui.includes('Payment link'), 'the text field is still there');
  assert.ok(/fallback/i.test(ui), 'and the QR control says the text is the fallback');
});

check('paymentQr is readable but not writable through the settings save', () => {
  const service = read('lib', 'services', 'settings.ts');
  assert.ok(service.includes('paymentQr: map.get(SETTING_KEYS.paymentQr)'), 'it is read');

  // SettingsUpdate is the JSON save. The QR must not be in it, or a plain
  // settings save could blank a file the shop is still using.
  const update = service.slice(service.indexOf('interface SettingsUpdate'), service.indexOf('export async function updateSettings'));
  assert.ok(!update.includes('paymentQr'), 'it must not be settable from the JSON save');
});

console.log('\n— the panel never handles a raw storage reference —\n');

check('previews are short-lived signed URLs, generated server-side', () => {
  for (const file of [
    ['app', 'api', 'products', '[id]', 'image', 'route.ts'],
    ['app', 'api', 'variants', '[id]', 'image', 'route.ts'],
    ['app', 'api', 'settings', 'qr', 'route.ts'],
  ]) {
    const source = read(...file);
    assert.ok(source.includes('signedUrl('), `${file.join('/')} should sign, not expose`);
    assert.ok(source.includes('300'), 'five minutes');
    assert.ok(source.includes('requireAdminApi()'), 'and only for a signed-in admin');
  }
});

check('no component ever builds a storage URL itself', () => {
  for (const file of ['ImageUpload.tsx']) {
    const source = read('components', 'ui', file);
    assert.ok(!source.includes('storage:'), 'the browser never sees a reference');
    assert.ok(!source.includes('supabase'), 'and never talks to Storage directly');
    assert.ok(!source.includes('getPublicUrl'), 'the bucket stays private');
  }
  for (const file of ['ProductTable.tsx', 'SettingsForm.tsx', 'CategoryTable.tsx']) {
    const source = read('components', 'admin', file);
    assert.ok(!source.includes('storage:'), `${file} must not know the reference format`);
  }
});

console.log('\n— the two-step flow is stated, not left to be discovered —\n');

check('a new product says the photo comes after the first save', () => {
  const source = read('components', 'admin', 'ProductTable.tsx');
  assert.ok(
    /save the product\s*\n?\s*first/i.test(source),
    'the product form must say so in words'
  );
  assert.ok(/save this variant\s*\n?\s*first/i.test(source), 'and so must the variant form');
  // And the picker is still only rendered once there is an id to attach to.
  assert.ok(source.includes('{productDraft.id ? ('));
  assert.ok(source.includes('{variantDraft.id ? ('));
});

check('a new category says the same thing', () => {
  const source = read('components', 'admin', 'CategoryTable.tsx');
  assert.ok(/Save the category first/i.test(source));
  assert.ok(source.includes('{draft.existing ? ('), 'the picker waits for the row to exist');
});

console.log('\n— category images use the same machinery as everything else —\n');

check('the category image route exists and mirrors the others', () => {
  assert.ok(exists('app', 'api', 'categories', '[key]', 'image', 'route.ts'));
  const source = read('app', 'api', 'categories', '[key]', 'image', 'route.ts');

  assert.ok(source.includes('requireAdminApi()'), 'server-side admin check');
  assert.ok(source.includes("setImage('category'"), 'goes through the same media service');
  assert.ok(source.includes("clearImage('category'"));
  assert.ok(source.includes('signedUrl('), 'previews are signed, never public');
  assert.ok(source.includes('300'));
});

check('a category is keyed by its key, not an invented id', () => {
  const media = read('lib', 'services', 'media.ts');
  assert.ok(media.includes("category: 'key'"), 'the lookup column is the key');
  assert.ok(media.includes("category: 'product_categories'"));
  assert.ok(media.includes("category: 'categories'"), 'and it has its own storage folder');
});

check('a category image change invalidates the category cache', () => {
  const media = read('lib', 'services', 'media.ts');
  assert.ok(
    media.includes("if (target === 'category') return invalidateCategories("),
    'and nothing else - a category photo does not stale the catalogue'
  );
});

check('the category UI posts to the category image route', () => {
  const source = read('components', 'admin', 'CategoryTable.tsx');
  assert.ok(source.includes('/api/categories/${draft.key}/image'));
  assert.ok(!source.includes('storage:'), 'the browser never sees a reference');
});

check('the new page is reachable from the sidebar', () => {
  const sidebar = read('components', 'admin', 'Sidebar.tsx');
  assert.ok(sidebar.includes("href: '/admin/categories'"));
  assert.ok(exists('app', 'admin', '(app)', 'categories', 'page.tsx'));
});

console.log(`\n${passed}/${passed + failed} passed\n`);
process.exit(failed ? 1 : 0);
