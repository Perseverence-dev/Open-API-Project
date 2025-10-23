// Weather App Open API Project

const placeEl = document.querySelector('#place');
const statusEl = document.querySelector('#status');

const state = { lat: null, lon: null, name: '' };

function setStatus(m = '') { statusEl.textContent = m; }
function card(title, rows) {
  return `<div class="card"><h3>${title}</h3>${
    rows.map(([k,v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join('')
  }</div>`;
}

/* 1) Geocoding */
async function geocode(city) {
  setStatus('Finding city…');
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  );
  if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status})`);
  const data = await res.json();
  if (!data.results?.length) throw new Error('City not found');
  const r = data.results[0];
  const full = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
  return { lat: r.latitude, lon: r.longitude, name: full };
}

/* 2) Temperature only */
async function loadTemperature() {
  if (state.lat == null) return;
  setStatus('Loading temperature…');

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}` +
    `&current_weather=true` +
    `&hourly=temperature_2m` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=auto`;

  const j = await fetch(url).then(res => res.json());
  setStatus('');

  const cur = j.current_weather;
  const d = j.daily;
  const h = j.hourly;

  const picks = [0, 6, 12, 18].filter(i => h?.temperature_2m?.[i] != null);

  const target = document.querySelector('#temp-output');
  target.innerHTML = [
    `<div class="card">
       <h3>Now</h3>
       <div class="big">${cur?.temperature != null ? cur.temperature : '—'} °C</div>
     </div>`,
    card('Daily', [
      ['Max (today)', d?.temperature_2m_max?.[0] != null ? `${d.temperature_2m_max[0]} °C` : '—'],
      ['Min (today)', d?.temperature_2m_min?.[0] != null ? `${d.temperature_2m_min[0]} °C` : '—'],
    ]),
    card('Hourly snapshots', picks.map(i => [
      `Hour +${i}`, `${h.temperature_2m[i]} °C`
    ]))
  ].join('');
}

/* 3) Rain */
async function loadRain() {
  if (state.lat == null) return;
  setStatus('Loading rain…');

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}` +
    `&hourly=precipitation,precipitation_probability` +
    `&daily=precipitation_sum` +
    `&timezone=auto`;

  const j = await fetch(url).then(r => r.json());
  setStatus('');

  const out = document.querySelector('#rain-output');
  const h = j.hourly ?? {};
  const d = j.daily ?? {};

  const i = 0; // first hour snapshot
  out.innerHTML = [
    card('Hourly', [
      ['Precipitation', h.precipitation?.[i] != null ? `${h.precipitation[i]} mm` : '—'],
      ['Probability', h.precipitation_probability?.[i] != null ? `${h.precipitation_probability[i]} %` : '—'],
    ]),
    card('Daily', [
      ['Total (today)', d.precipitation_sum?.[0] != null ? `${d.precipitation_sum[0]} mm` : '—'],
    ])
  ].join('');
}

/* 4) Humidity */
async function loadHumidity() {
  if (state.lat == null) return;
  setStatus('Loading humidity…');

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}` +
    `&hourly=relative_humidity_2m` +
    `&timezone=auto`;

  const j = await fetch(url).then(r => r.json());
  setStatus('');

  const out = document.querySelector('#humidity-output');
  const h = j.hourly ?? {};
  const picks = [0, 6, 12, 18].filter(i => h.relative_humidity_2m?.[i] != null);

  out.innerHTML = [
    card('Samples', picks.map(i => [`Hour +${i}`, `${h.relative_humidity_2m[i]} %`]))
  ].join('');
}

/* 5) Air Quality */
async function loadAir() {
  if (state.lat == null) return;
  setStatus('Loading air quality…');

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${state.lat}&longitude=${state.lon}` +
    `&hourly=pm10,pm2_5,ozone,carbon_monoxide` +
    `&timezone=auto`;

  const j = await fetch(url).then(r => r.json());
  setStatus('');

  const i = 0;
  const out = document.querySelector('#air-quality-output');
  out.innerHTML = [
    card('Particulates', [
      ['PM2.5', j.hourly?.pm2_5?.[i] ?? '—'],
      ['PM10',  j.hourly?.pm10?.[i]  ?? '—'],
    ]),
    card('Gases', [
      ['Ozone (O₃)', j.hourly?.ozone?.[i] ?? '—'],
      ['CO',         j.hourly?.carbon_monoxide?.[i] ?? '—'],
    ])
  ].join('');
}

/* ---- Loadig different weather parameters ---- */
async function renderActive() {
  const active = document.querySelector('.tab.active')?.dataset.tab;
  if (active === 'rain') return loadRain();
  if (active === 'humidity') return loadHumidity();
  if (active === 'air') return loadAir();
  // default:
  return loadTemperature();
}

/* --- City value wiring --- */
document.querySelector('#update').addEventListener('click', async () => {
  const city = document.querySelector('#city').value.trim();
  if (!city) { setStatus('Please enter a city name.'); return; }
  try {
    const geo = await geocode(city);
    Object.assign(state, geo);
    placeEl.textContent = geo.name;
    setStatus('');
    await renderActive(); // <- reload currently selected tab
  } catch (err) {
    setStatus(err.message);
  }
});

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    // visual active state
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');

    // show/hide panels
    const id = btn.dataset.tab; // "temp" | "rain" | "humidity" | "air"
    document.querySelector('#temp').classList.toggle('hidden', id !== 'temp');
    document.querySelector('#rain').classList.toggle('hidden', id !== 'rain');
    document.querySelector('#humidity').classList.toggle('hidden', id !== 'humidity');
    document.querySelector('#air-quality').classList.toggle('hidden', id !== 'air');

    // fetch for this tab
    await renderActive();
  });
});

// Default city on first load
(async () => {
  try {
    const geo = await geocode('Merit');
    Object.assign(state, geo);
    placeEl.textContent = geo.name;
    await loadTemperature();  // default panel
  } catch (_) {}
})();
