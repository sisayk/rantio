const { chromium } = require('playwright');
const [,, mode, fps = '30', secs = '6'] = process.argv;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2400, height: 800 } });
  await p.goto('file://' + __dirname + '/aurora.html');
  await p.evaluate(() => document.getElementById('scene').pauseAnimations());
  const at = async (t, file) => { await p.evaluate((t) => document.getElementById('scene').setCurrentTime(t), t); await p.screenshot({ path: file, type: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: file.endsWith('.jpg') ? 92 : undefined }); };
  if (mode === 'stills') { for (const t of [0, 1.5, 3, 4.5]) await at(t, `still-${t}.png`); }
  else { const n = +fps * +secs; for (let i = 0; i < n; i++) await at(i / +fps, `frames/f${String(i).padStart(4, '0')}.png`); }
  await b.close();
})();
