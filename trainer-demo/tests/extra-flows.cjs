// Extra flows: Quick Session, text→structured, unsaved-changes guard, messaging.
// Usage: node tests/extra-flows.cjs ./test-output
const { chromium } = require('playwright');
const URL = 'http://localhost:5173';
const out = []; const ok = (n, c, i='') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? ' — ' + i : ''}`);
const S = (p) => p.evaluate(() => window.__fernly.getState());
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '/'); await p.waitForTimeout(400);
  // Quick session
  const t0 = Date.now();
  await p.getByRole('button', { name: 'Quick Session' }).first().click();
  const d = p.getByRole('dialog');
  await d.getByLabel('Client').selectOption('c-mia');
  await d.locator('.tiptap').click(); await p.keyboard.type('Gentle mobility today\n- Cat-cow x 10\n- 90/90 x 8');
  await d.getByText('Also save as a reusable template').click();
  await d.getByRole('button', { name: 'Save & Assign' }).click();
  await p.waitForTimeout(300);
  let st = await S(p);
  const qs = st.workouts.filter(w => w.html.includes('Gentle mobility today'));
  const sess = st.sessions.find(s => qs.some(w => w.id === s.workoutId) && s.clientId === 'c-mia');
  ok('Quick Session save & assign (+template)', qs.length === 2 && qs.some(w => !w.clientId) && !!sess, `${Date.now() - t0}ms`);
  // Convert text to structured, original kept
  await p.goto(URL + '/workouts/w-lowerCardio');
  await p.getByRole('button', { name: 'Preview conversion' }).click();
  const rows = await p.getByRole('dialog').locator('li').count();
  await p.getByRole('dialog').getByRole('button', { name: 'Use this list' }).click();
  const names = await p.getByLabel('Exercise name').evaluateAll(e => e.map(x => x.value));
  await p.getByRole('tab', { name: 'Quick Write' }).click();
  const html = await p.locator('.tiptap').innerHTML();
  ok('Text → structured preview, original text kept', rows > 5 && names.includes('Squats') && html.includes('Romanian Deadlifts — 3 x 12'), JSON.stringify(names));
  // Unsaved changes guard
  await p.locator('.tiptap').click(); await p.keyboard.type(' EXTRA LINE');
  await p.getByRole('link', { name: 'Clients' }).first().click();
  const guard = await p.getByText('Save before leaving?').waitFor({ timeout: 3000 }).then(() => 1, () => 0); 
  await p.getByRole('button', { name: 'Leave — keep draft' }).click();
  await p.goto(URL + '/workouts/w-lowerCardio'); await p.waitForTimeout(500);
  const offer = await p.getByRole('button', { name: 'Restore draft' }).count();
  if (offer) await p.getByRole('button', { name: 'Restore draft' }).click();
  const restored = (await p.locator('.tiptap').innerHTML()).includes('EXTRA LINE');
  ok('Unsaved-changes guard + draft restore', guard > 0 && offer > 0 && restored, `guard=${guard} offer=${offer} restored=${restored}`);
  await p.getByRole('button', { name: 'Save workout' }).click();
  // Messages
  await p.goto(URL + '/messages/c-emma');
  await p.getByLabel('Message').fill('Friday works, see you then!'); await p.keyboard.press('Enter');
  st = await S(p);
  const unreadEmma = st.messages.filter(m => m.clientId === 'c-emma' && m.from === 'client' && !m.read).length;
  ok('Trainer sends message; opening marks read', st.messages.some(m => m.text === 'Friday works, see you then!') && unreadEmma === 0);
  await p.goto(URL + '/client'); await p.getByLabel('Which client to view as').selectOption('c-emma');
  await p.getByRole('link', { name: 'Messages' }).click();
  await p.waitForTimeout(500); const seen = await p.getByText('Friday works, see you then!').count(); await p.screenshot({path: require('path').join(process.argv[2] || '.', 'cmsg.png')});
  ok('Client sees trainer reply', seen > 0);
  // Month view & archive
  await p.getByRole('tab', { name: /Trainer/ }).click();
  await p.goto(URL + '/calendar'); await p.getByRole('tab', { name: 'Month' }).click(); await p.waitForTimeout(300);
  await p.screenshot({ path: require('path').join(process.argv[2] || '.', 'month.png') });
  ok('No page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(out.join('\n')); await b.close();
})();
