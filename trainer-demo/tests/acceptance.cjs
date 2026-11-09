// Browser acceptance tests (A–J from the brief). Needs the dev server running on :5173.
// Usage: node tests/acceptance.cjs ./test-output   (requires: npm i -D playwright && npx playwright install chromium)
const { chromium } = require('playwright');
const URL = 'http://localhost:5173';
const results = [];
const ok = (name, cond, info = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); };
const S = (p) => p.evaluate(() => window.__muscleup.getState());

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const step = async (name, fn) => { try { await fn(); } catch (e) { ok(name, false, 'threw: ' + e.message.split('\n')[0]); await p.screenshot({ path: require('path').join(process.argv[2] || '.', 'fail_' + name.replace(/\W+/g, '_') + '.png') }); } };

  await p.goto(URL + '/'); await p.waitForTimeout(500);

  await step('A create client persists', async () => {
    await p.goto(URL + '/clients');
    await p.getByRole('button', { name: 'Add client' }).first().click();
    await p.getByLabel('Name').fill('Test Client');
    await p.getByRole('dialog').getByRole('button', { name: 'Add client' }).click();
    await p.waitForURL(/\/clients\/c-/);
    await p.reload(); await p.waitForTimeout(400);
    await p.goto(URL + '/clients');
    const modeOk = (await S(p)).mode === 'trainer' && (await p.getByRole('tab', { name: /Trainer/ }).getAttribute('aria-selected')) === 'true';
    ok('A create client persists', await p.getByText('Test Client').count() > 0 && modeOk, `demo bar shows trainer view=${modeOk}`);
  });

  let writeId;
  await step('B free-text workout preserved', async () => {
    await p.goto(URL + '/workouts/new');
    await p.getByLabel('Workout name').fill('Test Lower Body');
    const ed = p.locator('.tiptap');
    await ed.click();
    await p.keyboard.type('## Warm Up\n5 min bike\nBodyweight squats x 15\n## Main Workout\nSquats — 4 x 10\nRomanian Deadlifts — 3 x 12\n');
    await p.keyboard.type('Notes: focus on technique');
    await p.getByRole('button', { name: 'Save workout' }).click();
    await p.waitForURL(/\/workouts\/w-/);
    writeId = p.url().split('/').pop();
    await p.reload(); await p.waitForTimeout(600);
    const html = await p.locator('.tiptap').innerHTML();
    ok('B free-text workout preserved', /<h2>Warm Up<\/h2>/.test(html) && html.includes('Squats — 4 x 10') && html.includes('Notes: focus on technique') && (await p.getByLabel('Workout name').inputValue()) === 'Test Lower Body', html.slice(0, 120));
  });

  await step('C structured workout edit', async () => {
    await p.goto(URL + '/workouts/new?mode=build');
    await p.getByLabel('Workout name').fill('Test Structured');
    const search = p.getByLabel('Search exercises').first();
    for (const q of ['barbell back squat', 'dumbbell bench', 'seated cable row']) { await search.fill(q); await p.keyboard.press('Enter'); }
    const names = await p.getByLabel('Exercise name').evaluateAll(els => els.map(e => e.value));
    const sets = p.locator('label:has-text("Sets") input');
    const reps = p.locator('label:has-text("Reps") input');
    await sets.nth(0).fill('4'); await reps.nth(0).fill('10');
    await sets.nth(2).fill('3'); await reps.nth(2).fill('12');
    await p.getByRole('button', { name: 'Save workout' }).click();
    await p.waitForURL(/\/workouts\/w-/);
    await p.reload(); await p.waitForTimeout(500);
    const after = await p.getByLabel('Exercise name').evaluateAll(els => els.map(e => e.value));
    const s0 = await p.locator('label:has-text("Sets") input').nth(0).inputValue();
    const r2 = await p.locator('label:has-text("Reps") input').nth(2).inputValue();
    ok('C structured workout edit', after.length === 3 && s0 === '4' && r2 === '12', JSON.stringify(after) + ` sets0=${s0} reps2=${r2} (added: ${JSON.stringify(names)})`);
  });

  let tplId, emmaProgId;
  await step('D create 4-week program & assign', async () => {
    await p.goto(URL + '/programs/new');
    await p.getByLabel('Program name').fill('Test 4 Week Program');
    await p.getByRole('button', { name: 'Add a workout on Mon, week 1' }).click();
    await p.getByRole('dialog').getByPlaceholder('Or choose an existing workout…').fill('Full Body A');
    await p.getByRole('dialog').getByRole('button', { name: /Full Body A/ }).first().click();
    await p.getByRole('button', { name: 'Copy Week 1 to all weeks' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Copy to all weeks' }).click();
    await p.getByRole('button', { name: 'Save program' }).click();
    await p.waitForURL(/\/programs\/p-/);
    tplId = p.url().split('/').pop();
    const st = await S(p);
    const tpl = st.programs.find(x => x.id === tplId);
    await p.getByRole('button', { name: 'Assign to clients' }).click();
    await p.getByRole('dialog').getByText('Emma Wilson').click();
    await p.getByRole('dialog').getByRole('button', { name: 'Assign program' }).click();
    await p.waitForURL(/\/clients\/c-emma/);
    const st2 = await S(p);
    const copy = st2.programs.find(x => x.clientId === 'c-emma' && x.status === 'active');
    emmaProgId = copy?.id;
    ok('D create 4-week program & assign', tpl.weeks.length === 4 && tpl.weeks.every(w => w.days[0].workoutId) && copy && copy.sourceId === tplId && copy.weeks.length === 4,
      `weeks=${tpl.weeks.length} copy=${!!copy}`);
  });

  await step('E client copy edit leaves master unchanged', async () => {
    await p.goto(URL + '/programs/' + emmaProgId);
    await p.waitForTimeout(400);
    // add a workout on Wednesday of week 1 (third "Add" button in week 1)
    await p.getByRole('button', { name: 'Add a workout on Tue, week 1' }).click();
    await p.getByRole('dialog').getByPlaceholder('Or choose an existing workout…').fill('Push Day');
    await p.getByRole('dialog').getByRole('button', { name: /Push Day/ }).first().click();
    await p.getByRole('button', { name: 'Save program' }).click();
    await p.waitForTimeout(400);
    await p.reload(); await p.waitForTimeout(400);
    const st = await S(p);
    const copy = st.programs.find(x => x.id === emmaProgId);
    const tpl = st.programs.find(x => x.id === tplId);
    const copyTue = copy.weeks[0].days[1].workoutId;
    const copyW = st.workouts.find(w => w.id === copyTue);
    ok('E client copy edit leaves master unchanged', !!copyTue && copyW?.clientId === 'c-emma' && tpl.weeks[0].days[1].workoutId === null && tpl.weeks[0].days[0].workoutId !== copy.weeks[0].days[0].workoutId,
      `copyTue=${copyW?.name} tplTue=${tpl.weeks[0].days[1].workoutId}`);
  });

  await step('F schedule and drag-move persists', async () => {
    await p.goto(URL + '/calendar?client=c-sophie');
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Add session', exact: true }).click();
    const dlg = p.getByRole('dialog');
    await dlg.getByLabel('Client').selectOption('c-sophie');
    const st0 = await S(p);
    const today = new Date(); const pad = n => String(n).padStart(2, '0');
    const dow = (today.getDay() + 6) % 7; // Mon=0
    const sunday = new Date(today); sunday.setDate(today.getDate() + (6 - dow));
    const sat = new Date(sunday); sat.setDate(sunday.getDate() - 1);
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    await dlg.getByLabel('Date').fill(iso(sunday));
    await dlg.getByLabel('Workout').selectOption({ label: 'Mobility Reset' });
    await dlg.getByRole('button', { name: 'Schedule workout' }).click();
    await p.waitForTimeout(300);
    const st1 = await S(p);
    const added = st1.sessions.find(s => !st0.sessions.some(o => o.id === s.id));
    // drag from Sunday column to Saturday column
    const card = p.getByRole('button', { name: /Mobility Reset/ }).last();
    const target = p.locator(`[aria-label="Add session on ${sat.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}"]`);
    const cb = await card.boundingBox(); const tb = await target.boundingBox();
    await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.mouse.down();
    await p.mouse.move(cb.x + cb.width / 2 - 20, cb.y + 20, { steps: 5 });
    await p.mouse.move(tb.x - 40, tb.y + 80, { steps: 15 }); await p.mouse.up();
    await p.waitForTimeout(400);
    await p.reload(); await p.waitForTimeout(400);
    const st2 = await S(p);
    const moved = st2.sessions.find(s => s.id === added.id);
    ok('F schedule and drag-move persists', added.date === iso(sunday) && moved.date === iso(sat), `from ${added.date} to ${moved.date}`);
  });

  await step('G client completes, trainer sees it', async () => {
    await p.goto(URL + '/');
    await p.getByRole('tab', { name: /Client/ }).click();
    await p.getByLabel('Which client to view as').selectOption('c-chloe');
    await p.waitForURL(/\/client$/);
    await p.getByRole('button', { name: 'Start workout' }).first().click();
    await p.waitForURL(/\/client\/workout\//);
    const title = await p.locator('header h1').innerText();
    await p.getByRole('button', { name: 'Mark as complete' }).click();
    await p.getByLabel(/Notes for/).fill('Felt good to be back');
    await p.getByRole('button', { name: 'Complete workout' }).click();
    await p.getByText('Workout complete!').waitFor();
    // structured: Emma
    await p.getByLabel('Which client to view as').selectOption('c-emma');
    await p.waitForTimeout(300);
    const emmaStart = p.getByRole('button', { name: 'Start workout' });
    let structuredOk = true;
    if (await emmaStart.count()) {
      await emmaStart.first().click();
      await p.getByRole('button', { name: /Mark set 1 done/ }).first().click();
      await p.getByLabel('Set 1 weight in kg').first().fill('14');
      await p.getByRole('button', { name: 'Finish workout' }).click();
      await p.getByRole('button', { name: 'Complete workout' }).click();
      await p.getByText('Workout complete!').waitFor();
      const st = await S(p);
      const c = st.completions.filter(x => x.clientId === 'c-emma').sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
      structuredOk = c.results.some(r => r.sets.some(s => s.done && s.weight === '14'));
    }
    await p.getByRole('tab', { name: /Trainer/ }).click();
    await p.waitForURL(URL + '/');
    await p.waitForTimeout(300);
    const completedToday = await p.locator('text=Completed today').count();
    const chloeDone = await p.locator('li', { hasText: 'Chloe Anderson' }).filter({ hasText: title }).count();
    ok('G client completes, trainer sees it', completedToday > 0 && chloeDone > 0 && structuredOk, `title=${title} structuredOk=${structuredOk}`);
  });

  await step('H custom exercise searchable', async () => {
    await p.goto(URL + '/exercises');
    await p.getByRole('button', { name: 'Add custom exercise' }).first().click();
    await p.getByRole('dialog').getByLabel('Name').fill('Banded Monster Walk');
    await p.getByRole('dialog').getByRole('button', { name: 'Save exercise' }).click();
    await p.keyboard.press('Escape');
    await p.getByLabel('Search exercises').fill('monster');
    const found = await p.getByRole('button', { name: /Banded Monster Walk/ }).count();
    await p.goto(URL + '/workouts/new?mode=build');
    await p.getByLabel('Search exercises').first().fill('monster');
    const inBuilder = await p.getByRole('option', { name: /Banded Monster Walk/ }).count();
    ok('H custom exercise searchable', found > 0 && inBuilder > 0, `library=${found} builder=${inBuilder}`);
    await p.getByLabel('Search exercises').first().fill('');
  });

  await step('I mobile navigation', async () => {
    const m = await b.newPage({ viewport: { width: 390, height: 844 } });
    await m.goto(URL + '/');
    await m.waitForTimeout(400);
    const dashOverflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const nav = m.locator('nav[aria-label="Main"]').last();
    await nav.getByRole('link', { name: 'Clients' }).click(); await m.waitForURL(/\/clients$/);
    await nav.getByRole('link', { name: 'Calendar' }).click(); await m.waitForURL(/\/calendar/);
    await nav.getByRole('link', { name: 'Messages' }).click(); await m.waitForURL(/\/messages/);
    await m.screenshot({ path: require('path').join(process.argv[2] || '.', 'mobile_trainer.png') });
    await m.getByRole('tab', { name: /Client/ }).click(); await m.waitForURL(/\/client$/);
    const cnav = m.locator('nav[aria-label="Client"]');
    await cnav.getByRole('link', { name: 'Progress' }).click(); await m.waitForURL(/\/client\/progress/);
    await cnav.getByRole('link', { name: 'Workouts' }).click(); await m.waitForURL(/\/client\/workouts/);
    await m.screenshot({ path: require('path').join(process.argv[2] || '.', 'mobile_client.png') });
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok('I mobile navigation', !overflow && !dashOverflow, `overflow client=${overflow} dashboard=${dashOverflow}`);
    await m.close();
  });

  await step('J reset demo data', async () => {
    await p.goto(URL + '/settings');
    await p.getByRole('button', { name: 'Reset Demo Data' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Reset demo data' }).click();
    await p.waitForURL(URL + '/');
    await p.reload(); await p.waitForTimeout(400);
    const st = await S(p);
    ok('J reset demo data', !st.clients.some(c => c.name === 'Test Client') && st.clients.filter(c => c.status === 'active').length === 8 && !st.customExercises.length && !st.programs.some(x => x.name.startsWith('Test')),
      `clients=${st.clients.length}`);
  });

  console.log(results.join('\n'));
  console.log('page errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
