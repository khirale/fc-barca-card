const SENSOR_DEFAULTS = {
  next:       'sensor.fc_barcelona_prochain_adversaire',
  kickoff:    'sensor.fc_barcelona_prochain_coup_d_envoi',
  venue:      'sensor.fc_barcelona_prochain_stade',
  comp:       'sensor.fc_barcelona_prochaine_competition',
  homeAway:   'sensor.fc_barcelona_domicile_exterieur',
  lastResult: 'sensor.fc_barcelona_dernier_resultat',
  lastDate:   'sensor.fc_barcelona_date_du_dernier_match',
  position:   'sensor.fc_barcelona_position_laliga',
  points:     'sensor.fc_barcelona_points_laliga',
  roster:     'sensor.fc_barcelona_effectif',
  summary:    'sensor.fc_barcelona_resume_du_match',
};

const BARCA_LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png';


function s(hass, id)       { return hass.states[id]?.state ?? ''; }
function a(hass, id, attr) { return hass.states[id]?.attributes?.[attr] ?? null; }


let _resolvedSensors = null;

function getSensors(hass) {
  if (_resolvedSensors) return _resolvedSensors;
  const r = { ...SENSOR_DEFAULTS };
  for (const [id, ent] of Object.entries(hass.states)) {
    if (!id.startsWith('sensor.')) continue;
    const at = ent.attributes ?? {};
    const st = ent.state ?? '';
    if (at.gardiens && at.milieux) r.roster = id;
    if (Array.isArray(at.full_table)) r.position = id;
    if (at.goals_barca !== undefined) r.summary = id;
    if (at.barca_logo && 'home_away' in at) {
      if (/^[VND]\s+\d/.test(st)) r.lastResult = id; 
      else                         r.next       = id;
    }
  
    if (at.device_class === 'timestamp' && st && st !== 'unknown' && st !== 'unavailable') {
      try {
        const d = new Date(st);
        if (!isNaN(d)) (d > Date.now() ? (r.kickoff = id) : (r.lastDate = id));
      } catch {}
    }

    if (at.unit_of_measurement === 'pts') r.points = id;
  }

  if (r.roster !== SENSOR_DEFAULTS.roster) _resolvedSensors = r;
  return r;
}

function formatDate(isoStr) {
  if (!isoStr || isoStr === 'unknown') return '';
  const d = new Date(isoStr);
  const days  = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const months= ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · <strong>${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}</strong>`;
}

class FcBarcaMatchCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  setConfig(config) { this._config = config; }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    const hass = this._hass;
    if (!hass) return;
    const S = getSensors(hass);

    const opp      = s(hass, S.next);
    const noNext   = ['unknown', 'unavailable', ''].includes(opp);
    const mState   = a(hass, S.next, 'state') ?? '';
    const isLive   = mState === 'in';

    let bLogo  = a(hass, S.next, 'barca_logo')    ?? BARCA_LOGO;
    let oLogo  = a(hass, S.next, 'opponent_logo') ?? '';
    let bs     = a(hass, S.next, 'barca_score')   ?? '';
    let os     = a(hass, S.next, 'opponent_score')?? '';
    let venue  = s(hass, S.venue);
    let comp   = s(hass, S.comp);
    let oppName= opp;
    let homeAway = a(hass, S.next, 'home_away') ?? '';

    if (noNext) {
      oppName  = a(hass, S.lastResult, 'opponent') ?? '—';
      bLogo    = a(hass, S.lastResult, 'barca_logo')    ?? BARCA_LOGO;
      oLogo    = a(hass, S.lastResult, 'opponent_logo') ?? '';
      bs       = a(hass, S.lastResult, 'barca_score')   ?? '';
      os       = a(hass, S.lastResult, 'opponent_score')?? '';
      venue    = a(hass, S.lastResult, 'venue')         ?? '';
      comp     = a(hass, S.lastResult, 'competition')   ?? '';
    }

    let badges = `<span class="badge comp">${(comp||'').toUpperCase()}</span>`;
    if (isLive)               badges += `<span class="badge live">⬤ LIVE</span>`;
    else if (noNext)          badges += `<span class="badge last">DERNIER MATCH</span>`;
    else if (homeAway==='home') badges += `<span class="badge home">⌂ DOMICILE</span>`;
    else if (homeAway==='away') badges += `<span class="badge away">✈ EXTÉRIEUR</span>`;

    let center;
    if (isLive || noNext) {
      center = `<div class="score">${bs}&thinsp;–&thinsp;${os}</div>
                ${isLive ? '<div class="live-lbl">⬤ EN DIRECT</div>' : ''}`;
    } else {
      const dateStr = formatDate(s(hass, S.kickoff));
      center = `<div class="vs">VS</div>${dateStr ? `<div class="date">${dateStr}</div>` : ''}`;
    }

    let liveEventsHtml = '';
    if (isLive || noNext) {
      const goalsBarca = a(hass, S.summary, 'goals_barca')    ?? [];
      const goalsOpp   = a(hass, S.summary, 'goals_opponent') ?? [];
      const cardsBarca = a(hass, S.summary, 'cards_barca')    ?? [];
      const cardsOpp   = a(hass, S.summary, 'cards_opponent') ?? [];

      const renderGoals = (list) => list.map(g =>
        `<span class="evt">⚽ <b>${g.player}</b> <em>${g.minute}</em></span>`).join('');
      const renderCards = (list) => list.map(c =>
        `<span class="evt">${c.type === 'red' ? '🟥' : '🟨'} <b>${c.player}</b> <em>${c.minute}</em></span>`).join('');

      const hasEvents = goalsBarca.length || goalsOpp.length || cardsBarca.length || cardsOpp.length;
      if (hasEvents) {
        liveEventsHtml = `
          <div class="events">
            <div class="evts-col left">
              ${renderGoals(goalsBarca)}
              ${renderCards(cardsBarca)}
            </div>
            <div class="evts-sep">|</div>
            <div class="evts-col right">
              ${renderGoals(goalsOpp)}
              ${renderCards(cardsOpp)}
            </div>
          </div>`;
      }
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        .hero{
          position:relative;
          background:linear-gradient(135deg,#0c1a2e 0%,#172f4d 45%,#0c1a2e 100%);
          border-radius:16px;overflow:hidden;padding:26px 20px 18px;
          font-family:var(--primary-font-family,sans-serif);color:#fff;
        }
        .bg{position:absolute;top:50%;transform:translateY(-50%);height:270px;
            opacity:.07;pointer-events:none;filter:blur(3px)}
        .bg.l{left:-45px} .bg.r{right:-45px}
        .badges{text-align:center;margin-bottom:14px;position:relative;z-index:1;
                display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
        .badge{font-size:11px;font-weight:700;letter-spacing:1px;padding:3px 12px;border-radius:999px}
        .badge.comp{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
        .badge.live{background:#dc2626;color:#fff;animation:blink 1.4s ease-in-out infinite}
        .badge.last{background:rgba(255,255,255,.08);color:rgba(255,255,255,.45)}
        .badge.home{background:rgba(59,130,246,.35);color:#93c5fd}
        .badge.away{background:rgba(245,158,11,.25);color:#fcd34d}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
        .teams{display:flex;align-items:center;justify-content:space-between;
               position:relative;z-index:1;gap:8px}
        .team{flex:1;text-align:center}
        .logo{height:82px;filter:drop-shadow(0 4px 18px rgba(0,0,0,.65))}
        .no-logo{height:82px;width:82px;border-radius:50%;background:rgba(255,255,255,.08);
                 margin:auto;display:flex;align-items:center;justify-content:center;font-size:34px}
        .name{font-size:15px;font-weight:700;margin-top:10px;white-space:nowrap}
        .center{flex:0 0 auto;text-align:center;min-width:130px}
        .score{font-size:60px;font-weight:900;line-height:1;letter-spacing:-3px}
        .live-lbl{color:#ef4444;font-size:12px;font-weight:700;margin-top:6px;letter-spacing:1px}
        .vs{font-size:26px;font-weight:800;color:rgba(255,255,255,.28);letter-spacing:3px}
        .date{font-size:13px;color:rgba(255,255,255,.65);margin-top:8px;line-height:1.5}
        .footer{text-align:center;margin-top:16px;color:rgba(255,255,255,.38);
                font-size:12px;position:relative;z-index:1;letter-spacing:.4px}
        .events{display:flex;align-items:flex-start;justify-content:center;gap:0;
                margin-top:16px;position:relative;z-index:1;
                border-top:1px solid rgba(255,255,255,.1);padding-top:14px}
        .evts-col{flex:1;display:flex;flex-direction:column;gap:5px;font-size:12px;
                  color:rgba(255,255,255,.85)}
        .evts-col.left{text-align:right;padding-right:12px}
        .evts-col.right{text-align:left;padding-left:12px}
        .evts-sep{color:rgba(255,255,255,.15);font-size:18px;line-height:1;padding-top:2px}
        .evt{display:block}
        .evt em{color:rgba(255,255,255,.45);font-style:normal;font-size:11px;margin-left:4px}
      </style>
      <div class="hero">
        <img class="bg l" src="${bLogo}">
        ${oLogo ? `<img class="bg r" src="${oLogo}">` : ''}
        <div class="badges">${badges}</div>
        <div class="teams">
          <div class="team">
            <img class="logo" src="${bLogo}">
            <div class="name">Barcelona</div>
          </div>
          <div class="center">${center}</div>
          <div class="team">
            ${oLogo ? `<img class="logo" src="${oLogo}">` : '<div class="no-logo">⚽</div>'}
            <div class="name">${oppName}</div>
          </div>
        </div>
        ${liveEventsHtml}
        ${venue ? `<div class="footer">📍 ${venue}</div>` : ''}
      </div>`;
  }

  getCardSize() { return 3; }
}
customElements.define('fc-barca-match-card', FcBarcaMatchCard);

class FcBarcaStandingsCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  setConfig(config) { this._config = config; }

  set hass(hass) { this._hass = hass; this._render(); }

  _render() {
    const S     = getSensors(this._hass);
    const table = a(this._hass, S.position, 'full_table') ?? [];

    const rows = table.map((row, i) => {
      const pos    = i + 1;
      const isFcb  = row.team.toLowerCase().includes('barcelona');
      const isTop4 = pos <= 4;
      const isRel  = pos >= table.length - 2;
      const cls    = isFcb ? 'fcb' : (isTop4 ? 'top4' : (isRel ? 'rel' : ''));
      const gd     = row.goal_diff ?? 0;
      const gdCls  = gd > 0 ? 'gp' : (gd < 0 ? 'gn' : '');
      return `<tr class="${cls}">
        <td class="pos">${pos}</td>
        <td class="nm">${row.team}${isFcb ? ' ★' : ''}</td>
        <td class="r pt">${row.points}</td>
        <td class="r">${row.played}</td>
        <td class="r">${row.wins}</td>
        <td class="r">${row.draws}</td>
        <td class="r">${row.losses}</td>
        <td class="r ${gdCls}">${gd > 0 ? '+' : ''}${gd}</td>
      </tr>`;
    }).join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{padding:14px 10px}
        h3{margin:0 0 10px;font-size:13px;font-weight:700;opacity:.6;letter-spacing:1px;text-transform:uppercase}
        table{width:100%;border-collapse:collapse;font-size:12.5px}
        th{padding:5px 5px;font-weight:700;text-align:left;
           border-bottom:1px solid rgba(var(--rgb-primary-text-color,128,128,128),.12);
           color:rgba(var(--rgb-primary-text-color,128,128,128),.55);font-size:11px}
        td{padding:5px 5px;border-bottom:1px solid rgba(var(--rgb-primary-text-color,128,128,128),.05)}
        .r{text-align:right}
        .pos{width:1.8em;opacity:.45;font-size:11px}
        .pt{font-weight:700}
        tr.fcb{background:rgba(59,130,246,.18);font-weight:700}
        tr.top4{background:rgba(34,197,94,.07)}
        tr.rel{background:rgba(239,68,68,.08)}
        .gp{color:#6ee7a8}.gn{color:#fca5a5}
        .empty{text-align:center;padding:20px;opacity:.45;font-size:13px}
      </style>
      <ha-card>
        <h3>LaLiga 2025-26</h3>
        ${table.length === 0
          ? '<div class="empty">Chargement…</div>'
          : `<table>
              <thead><tr>
                <th class="pos">#</th><th>Équipe</th>
                <th class="r">Pts</th><th class="r">PJ</th>
                <th class="r">V</th><th class="r">N</th><th class="r">D</th>
                <th class="r">Diff</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>`
        }
      </ha-card>`;
  }

  getCardSize() { return 9; }
}
customElements.define('fc-barca-standings-card', FcBarcaStandingsCard);


const ESPN_OVERVIEW = 'https://site.web.api.espn.com/apis/common/v3/sports/soccer/esp.1/athletes';

const STAT_LABELS = {
  G: { GA:'Buts encaissés', SV:'Arrêts', SAVES_PCT:'% arrêts', STRT:'Titularisations', MIN:'Minutes' },
  D: { G:'Buts', A:'Passes D', SHTS:'Tirs', FC:'Fautes', YC:'🟨', RC:'🟥', STRT:'Titularisations', MIN:'Minutes' },
  M: { G:'Buts', A:'Passes D', SHTS:'Tirs', KP:'Passes clés', FC:'Fautes', YC:'🟨', RC:'🟥', STRT:'Titularisations', MIN:'Minutes' },
  F: { G:'Buts', A:'Passes D', SHTS:'Tirs', SOG:'Tirs cadrés', FC:'Fautes', YC:'🟨', RC:'🟥', STRT:'Titularisations', MIN:'Minutes' },
};
const PRIORITY = {
  G: ['GA','SV','STRT','MIN'],
  D: ['G','A','SHTS','FC','YC','RC','STRT','MIN'],
  M: ['G','A','KP','SHTS','FC','YC','RC','STRT','MIN'],
  F: ['G','A','SOG','SHTS','FC','YC','RC','STRT','MIN'],
};
const POS_COLOR = { G:'#2196F3', D:'#4CAF50', M:'#FFC107', F:'#E91E63' };

const _playerCache = {};

async function fetchPlayerData(playerId) {
  if (_playerCache[playerId]) return _playerCache[playerId];
  try {
    const res = await fetch(`${ESPN_OVERVIEW}/${playerId}/overview`);
    if (!res.ok) return null;
    const data = await res.json();
    // Stats: aggregate across all competitions
    const labels = data?.statistics?.labels ?? [];
    const splits = data?.statistics?.splits ?? [];
    const stats  = {};
    for (const split of splits) {
      split.stats?.forEach((v, i) => {
        const lbl = labels[i] ?? `s${i}`;
        stats[lbl] = (parseFloat(stats[lbl] ?? 0) + parseFloat(v || 0));
      });
    }
    const photo = data?.athlete?.headshot?.href ?? null;
    const result = { stats, photo };
    _playerCache[playerId] = result;
    return result;
  } catch { return null; }
}

function renderStatsHTML(stats, posAbbr) {
  if (!stats) return '<div class="stats-loading">Chargement des stats…</div>';
  const priority = PRIORITY[posAbbr] ?? PRIORITY.F;
  const labels   = STAT_LABELS[posAbbr] ?? STAT_LABELS.F;
  const rows = priority
    .filter(k => stats[k] !== undefined && parseFloat(stats[k]) !== 0)
    .map(k => {
      const val  = parseFloat(stats[k] ?? 0);
      const disp = Number.isInteger(val) ? val : val.toFixed(0);
      return `<div class="stat-row">
        <span class="stat-lbl">${labels[k] ?? k}</span>
        <span class="stat-val">${disp}</span>
      </div>`;
    });
  if (!rows.length) return '<div class="stats-loading" style="opacity:.5">Aucune stat disponible</div>';
  return `<div class="stats-grid">${rows.join('')}</div>`;
}

function renderPlayerDetailHTML(player, stats, livePhoto) {
  const colPos   = POS_COLOR[player.pos_abbr] ?? '#888';
  const photoSrc = livePhoto || player.photo;
  return `
    <div class="detail-header" style="border-top:4px solid ${colPos}">
      <div class="photo-wrap" style="background:${colPos}22">
        <span class="photo-initial" style="color:${colPos}">${player.jersey || player.pos_abbr}</span>
        ${photoSrc ? `<img class="detail-photo" src="${photoSrc}" onerror="this.style.opacity='0'" alt="">` : ''}
      </div>
      </div>
      <div class="detail-bio">
        <div class="detail-name">
          <span class="detail-fn">${player.first_name}</span>
          <span class="detail-ln">${player.last_name}</span>
        </div>
        <div class="detail-meta">
          <span class="badge-pos" style="background:${colPos}">${player.position || player.pos_abbr}</span>
          <span class="meta-item">🎽 #${player.jersey}</span>
        </div>
        <div class="bio-grid">
          ${player.age       ? `<div class="bio-item"><div class="bio-lbl">Âge</div><div class="bio-val">${player.age} ans</div></div>` : ''}
          ${player.dob       ? `<div class="bio-item"><div class="bio-lbl">Naissance</div><div class="bio-val">${new Date(player.dob).toLocaleDateString('fr-FR')}</div></div>` : ''}
          ${player.height_cm ? `<div class="bio-item"><div class="bio-lbl">Taille</div><div class="bio-val">${player.height_cm} cm</div></div>` : ''}
          ${player.weight_kg ? `<div class="bio-item"><div class="bio-lbl">Poids</div><div class="bio-val">${player.weight_kg} kg</div></div>` : ''}
          <div class="bio-item">
            <div class="bio-lbl">Nationalité</div>
            <div class="bio-val">
              ${player.flag ? `<img src="${player.flag}" style="height:14px;vertical-align:middle;margin-right:4px;border-radius:2px">` : ''}
              ${player.nationality}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="stats-section">
      <div class="stats-title">Stats 2025-26 (toutes compétitions)</div>
      ${renderStatsHTML(stats, player.pos_abbr)}
    </div>`;
}





const DETAIL_CSS = `
  .detail-header{display:flex;gap:16px;padding:16px;background:rgba(var(--rgb-primary-text-color,128,128,128),.03)}
  .photo-wrap{flex-shrink:0;width:90px;height:90px;border-radius:12px;overflow:hidden;
              position:relative;display:flex;align-items:center;justify-content:center}
  .photo-initial{font-size:28px;font-weight:900;opacity:.5;position:absolute;z-index:0;user-select:none}
  .detail-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
                object-position:top center;z-index:1;transition:opacity .25s}
  .detail-bio{flex:1;min-width:0}
  .detail-name{font-size:18px;font-weight:700;line-height:1.2;margin-bottom:8px}
  .detail-fn{opacity:.7;margin-right:4px}
  .detail-ln{font-weight:900}
  .detail-meta{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
  .badge-pos{font-size:11px;font-weight:700;color:#fff;padding:2px 10px;border-radius:999px;letter-spacing:.5px}
  .meta-item{font-size:12px;opacity:.6}
  .bio-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .bio-item{background:rgba(var(--rgb-primary-text-color,128,128,128),.05);border-radius:8px;padding:6px 8px}
  .bio-lbl{font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
  .bio-val{font-size:13px;font-weight:600}
  .stats-section{padding:14px 16px}
  .stats-title{font-size:11px;font-weight:700;opacity:.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .stat-row{background:rgba(var(--rgb-primary-text-color,128,128,128),.05);border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center}
  .stat-lbl{font-size:12px;opacity:.65}
  .stat-val{font-size:16px;font-weight:700}
  .stats-loading{text-align:center;padding:20px;opacity:.4;font-size:13px}
`;

const POS_CFG = {
  G: { label:'Gardiens',   key:'gardiens',   color:'#2196F3', text:'#fff' },
  D: { label:'Défenseurs', key:'defenseurs', color:'#4CAF50', text:'#fff' },
  M: { label:'Milieux',    key:'milieux',    color:'#FFC107', text:'#000' },
  F: { label:'Attaquants', key:'attaquants', color:'#E91E63', text:'#fff' },
};

class FcBarcaRosterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._positions  = ['G','D','M','F'];
    this._playerById = {};
    this._keyHandler = e => { if (e.key === 'Escape') this._closePopup(); };
    this._initDOM();
  }

  _initDOM() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{padding:14px 10px;position:relative}
        .chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.8px;
              padding:3px 12px;border-radius:999px;margin:10px 0 6px}
        .chip:first-child{margin-top:0}
        table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:2px}
        thead tr{background:var(--hdr,rgba(128,128,128,.1))}
        th{padding:5px 7px;font-weight:700;text-align:left;opacity:.8;font-size:11.5px}
        td{padding:5px 7px;border-bottom:1px solid rgba(var(--rgb-primary-text-color,128,128,128),.05)}
        tr[data-pid]{cursor:pointer}
        tr[data-pid]:hover td{background:rgba(var(--rgb-primary-text-color,128,128,128),.06)}
        tr:nth-child(even) td{background:rgba(var(--rgb-primary-text-color,128,128,128),.025)}
        tr[data-pid]:hover td{background:rgba(var(--rgb-primary-text-color,128,128,128),.07) !important}
        .num{text-align:right;width:2.4em;opacity:.55}
        .age{text-align:center;width:2.8em;opacity:.7}
        .nat{white-space:nowrap}
        .flag{height:13px;vertical-align:middle;margin-right:5px;border-radius:2px}
        .empty{text-align:center;padding:20px;opacity:.45;font-size:13px}
        /* ── Popup overlay ── */
        .popup-overlay{
          position:fixed;inset:0;z-index:9999;
          background:rgba(0,0,0,.7);backdrop-filter:blur(5px);
          display:flex;align-items:center;justify-content:center;
          opacity:0;pointer-events:none;transition:opacity .2s ease;
        }
        .popup-overlay.open{opacity:1;pointer-events:auto}
        .popup-box{
          background:var(--ha-card-background,#1c1c1e);
          border-radius:16px;width:min(480px,92vw);max-height:82vh;
          overflow-y:auto;position:relative;
          box-shadow:0 24px 64px rgba(0,0,0,.75);
          transform:translateY(18px) scale(.97);
          transition:transform .2s ease;
        }
        .popup-overlay.open .popup-box{transform:translateY(0) scale(1)}
        .popup-close{
          position:absolute;top:12px;right:12px;z-index:2;
          background:rgba(0,0,0,.35);border:none;border-radius:50%;
          width:30px;height:30px;font-size:15px;line-height:1;cursor:pointer;
          color:#fff;display:flex;align-items:center;justify-content:center;
        }
        .popup-close:hover{background:rgba(0,0,0,.55)}
        .popup-body .detail-header{padding-right:48px}
        ${DETAIL_CSS}
      </style>
      <ha-card>
        <div class="roster-content"></div>
        <div class="popup-overlay">
          <div class="popup-box">
            <button class="popup-close" aria-label="Fermer">✕</button>
            <div class="popup-body"></div>
          </div>
        </div>
      </ha-card>`;

    const overlay = this.shadowRoot.querySelector('.popup-overlay');
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this._closePopup();
    });
    this.shadowRoot.querySelector('.popup-close').addEventListener('click', () => this._closePopup());
  }

  connectedCallback()    { document.addEventListener('keydown', this._keyHandler); }
  disconnectedCallback() { document.removeEventListener('keydown', this._keyHandler); }

  setConfig(config) {
    this._config    = config;
    this._positions = config.positions ?? ['G','D','M','F'];
  }

  set hass(hass) { this._hass = hass; this._render(); }

  _table(players, cfg) {
    if (!players?.length) return '';
    const rows = players.map(p => {
      this._playerById[p.id] = p;
      return `<tr data-pid="${p.id}">
        <td class="num">${p.jersey ?? '—'}</td>
        <td>${p.name ?? ''}</td>
        <td class="age">${p.age ?? '—'}</td>
        <td class="nat">
          ${p.flag ? `<img class="flag" src="${p.flag}">` : ''}
          ${p.nationality ?? ''}
        </td>
      </tr>`;
    }).join('');
    return `
      <div class="chip" style="background:${cfg.color};color:${cfg.text}">${cfg.label}</div>
      <table>
        <thead style="--hdr:${cfg.color}20">
          <tr><th class="num">#</th><th>Nom</th><th class="age">Âge</th><th class="nat">Nation</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  _render() {
    const content = this.shadowRoot.querySelector('.roster-content');
    if (!content) return;
    this._playerById = {};
    const S     = getSensors(this._hass);
    const attrs = this._hass?.states[S.roster]?.attributes ?? {};
    content.innerHTML = this._positions
      .map(p => this._table(attrs[POS_CFG[p]?.key] ?? [], POS_CFG[p] ?? {}))
      .join('') || '<div class="empty">Chargement…</div>';

    content.querySelectorAll('tr[data-pid]').forEach(tr => {
      tr.addEventListener('click', () => {
        const p = this._playerById[tr.dataset.pid];
        if (p) this._openPopup(p);
      });
    });
  }

  async _openPopup(player) {
    const overlay = this.shadowRoot.querySelector('.popup-overlay');
    const body    = this.shadowRoot.querySelector('.popup-body');
    body.innerHTML = renderPlayerDetailHTML(player, null, null);
    overlay.classList.add('open');
    const pdata = await fetchPlayerData(player.id);
    if (overlay.classList.contains('open')) {
      body.innerHTML = renderPlayerDetailHTML(player, pdata?.stats, pdata?.photo);
    }
  }

  _closePopup() {
    this.shadowRoot.querySelector('.popup-overlay')?.classList.remove('open');
  }

  getCardSize() { return this._positions.length * 3; }
}
customElements.define('fc-barca-roster-card', FcBarcaRosterCard);

class FcBarcaPlayerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._selected   = null;
    this._playerData = null;
  }

  setConfig(config) { this._config = config; }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _allPlayers() {
    const S     = getSensors(this._hass);
    const attrs = this._hass?.states[S.roster]?.attributes ?? {};
    return [
      ...(attrs.gardiens   ?? []).map(p => ({...p, pos_abbr: p.pos_abbr || 'G'})),
      ...(attrs.defenseurs ?? []).map(p => ({...p, pos_abbr: p.pos_abbr || 'D'})),
      ...(attrs.milieux    ?? []).map(p => ({...p, pos_abbr: p.pos_abbr || 'M'})),
      ...(attrs.attaquants ?? []).map(p => ({...p, pos_abbr: p.pos_abbr || 'F'})),
    ];
  }

  async _selectPlayer(player) {
    this._selected   = player;
    this._playerData = null;
    this._render();
    if (player?.id) {
      this._playerData = await fetchPlayerData(player.id);
      this._render();
    }
  }

  _render() {
    const players  = this._allPlayers();
    const selected = this._selected;

    const list = players.map(p => {
      const isSel = selected?.id === p.id;
      const col   = POS_COLOR[p.pos_abbr] ?? '#888';
      return `<div class="player-item ${isSel ? 'active' : ''}" data-id="${p.id}"
                   style="${isSel ? `border-left:3px solid ${col};background:rgba(255,255,255,.06)` : 'border-left:3px solid transparent'}">
        <span class="p-jersey">${p.jersey}</span>
        <span class="p-name">${p.name}</span>
        <span class="p-pos" style="color:${col}">${p.pos_abbr}</span>
      </div>`;
    }).join('');

    const detail = selected
      ? renderPlayerDetailHTML(selected, this._playerData?.stats, this._playerData?.photo)
      : '<div class="placeholder">← Sélectionne un joueur</div>';

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block}
        ha-card{display:flex;height:520px;overflow:hidden;border-radius:12px}
        .sidebar{width:200px;flex-shrink:0;overflow-y:auto;
                 border-right:1px solid rgba(var(--rgb-primary-text-color,128,128,128),.1);
                 background:rgba(var(--rgb-primary-text-color,128,128,128),.02)}
        .player-item{display:flex;align-items:center;gap:8px;padding:8px 10px;
                     cursor:pointer;transition:background .15s;font-size:12.5px}
        .player-item:hover{background:rgba(255,255,255,.04)}
        .p-jersey{width:2em;text-align:right;opacity:.5;font-size:11px;flex-shrink:0}
        .p-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .p-pos{font-size:10px;font-weight:700;flex-shrink:0}
        .detail-col{flex:1;overflow-y:auto;padding:0}
        .placeholder{display:flex;align-items:center;justify-content:center;
                     height:100%;opacity:.4;font-size:14px}
        ${DETAIL_CSS}
      </style>
      <ha-card>
        <div class="sidebar">${list}</div>
        <div class="detail-col">${detail}</div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll('.player-item').forEach(el => {
      el.addEventListener('click', () => {
        const player = players.find(p => p.id === el.dataset.id);
        if (player) this._selectPlayer(player);
      });
    });
  }

  getCardSize() { return 6; }
}
customElements.define('fc-barca-player-card', FcBarcaPlayerCard);

window.customCards = window.customCards || [];
window.customCards.push(
  { type:'fc-barca-match-card',     name:'FC Barcelona – Match',      description:'Prochain match / score live' },
  { type:'fc-barca-standings-card', name:'FC Barcelona – Classement', description:'Classement LaLiga' },
  { type:'fc-barca-roster-card',    name:'FC Barcelona – Effectif',   description:'Effectif par poste avec popup joueur' },
  { type:'fc-barca-player-card',    name:'FC Barcelona – Joueurs',    description:'Fiches joueurs avec stats (vue dédiée)' },
);
