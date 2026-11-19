// Partner app: running bonus campaigns + monthly contest card and leaderboard sheet.
import { sb, $, esc, money, fmtDate, modal } from './common.js';

const METRIC = { hires: ['مناديب اتعيّنوا', 'تعيين'], nominations: ['مناديب رشّحتهم', 'ترشيح'], completed: ['مناديب كمّلوا 26 يوم', 'مندوب كمّل'] };
const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d + 'T23:59:59') - new Date()) / 86400000));
const MEDAL = ['🥇', '🥈', '🥉'];

export async function loadGrowth() {
  const [c, k] = await Promise.all([
    sb.rpc('my_campaigns').then((r) => r.data || [], () => []),
    sb.rpc('my_contests').then((r) => r.data || [], () => []),
  ]);
  return { campaigns: Array.isArray(c) ? c : [], contests: Array.isArray(k) ? k : [] };
}

function campaignLine(k) {
  const where = k.scope === 'company' ? `مناديب ${esc(k.scope_label || '')}` : k.scope === 'gov' ? `مناديب ${esc(k.scope_label || '')}` : k.scope === 'partner' ? 'ليك إنت مخصوص' : 'كل المناديب';
  const when = k.trigger_kind === 'paper' ? 'أول ما يخلّص ورقه' : `لما يكمّل ${k.min_days} يوم شغل`;
  return `<b>+${money(k.amount)}</b> زيادة على كل مندوب (${where}) ترشّحه لحد ${fmtDate(k.ends_on)} — ${when}`;
}

export function growthCards(G) {
  if (!G) return '';
  const out = [];
  if (G.campaigns.length) {
    const k = G.campaigns[0];
    out.push(`<button class="gcamp rise" style="--i:2" data-gcamp>
      <span class="gc-ic">🎯</span>
      <span class="grow"><span class="gc-t">${esc(k.name)}${G.campaigns.length > 1 ? ` <em>+${G.campaigns.length - 1}</em>` : ''}</span>
        <span class="gc-s">${campaignLine(k)}</span></span>
      <span class="gc-left">${daysLeft(k.ends_on)}<small>يوم</small></span>
    </button>`);
  }
  const c = G.contests.find((x) => x.state === 'live' || x.state === 'upcoming') || G.contests[0];
  if (c) {
    const m = METRIC[c.metric] || METRIC.hires, prize1 = (c.prizes || []).find((p) => Number(p.rank) === 1);
    const sub = c.state === 'upcoming' ? `بتبدأ ${fmtDate(c.starts_on)}`
      : c.state === 'live' ? (c.mine ? `إنت في المركز <b>${c.mine.rank}</b> بـ ${c.mine.score} ${m[1]}` : `لسه ملكش ${m[1]} — ابدأ دلوقتي`)
      : c.award ? `🎉 كسبت المركز ${c.award.rank} — ${money(c.award.amount)}` : c.state === 'awarded' ? 'النتيجة اتعلنت' : 'المسابقة خلصت — النتيجة قريب';
    out.push(`<button class="gcont rise" style="--i:2" data-gcont="${esc(c.id)}">
      <span class="gk-ic">🏆</span>
      <span class="grow"><span class="gk-t">${esc(c.title)}</span><span class="gk-s">${sub}</span></span>
      <span class="gk-end">${prize1 ? `<b>${money(prize1.amount)}</b><small>للأول</small>` : ''}${c.state === 'live' ? `<small>فاضل ${daysLeft(c.ends_on)} يوم</small>` : ''}</span>
    </button>`);
  }
  return out.join('');
}

function campaignsSheet(G) {
  modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:var(--orange)">🎯</div><div><h2>حملات البونص الشغالة</h2><p>فلوس زيادة فوق البونص العادي</p></div></div>
    <div class="glist">${G.campaigns.map((k) => `<div class="gitem"><b>${esc(k.name)}</b><span>${campaignLine(k)}</span>${k.note ? `<span class="muted">${esc(k.note)}</span>` : ''}<span class="muted">من ${fmtDate(k.starts_on)} لحد ${fmtDate(k.ends_on)}</span></div>`).join('')}</div>`);
}

function contestSheet(c) {
  const m = METRIC[c.metric] || METRIC.hires;
  const prizes = (c.prizes || []).filter((p) => Number(p.amount) > 0).sort((a, b) => a.rank - b.rank);
  const meIn = (c.board || []).some((r) => r.me);
  const rows = (c.board || []).map((r) => `<div class="lb-row ${r.me ? 'me' : ''}"><span class="lb-rk">${MEDAL[r.rank - 1] || r.rank}</span><span class="grow">${esc(r.name)}${r.me ? ' <em>(إنت)</em>' : ''}</span><b>${r.score}</b></div>`).join('');
  modal(`<div class="sheet-h"><div class="sheet-ic" style="--c:#d98a00">🏆</div><div><h2>${esc(c.title)}</h2><p>${m[0]} من ${fmtDate(c.starts_on)} لحد ${fmtDate(c.ends_on)}${c.scope_gov ? ` · ${esc(c.scope_gov)}` : ''}${c.scope_company ? ` · ${esc(c.scope_company)}` : ''}</p></div></div>
    ${prizes.length ? `<div class="lb-prizes">${prizes.map((p) => `<span>${MEDAL[p.rank - 1] || '#' + p.rank} ${money(p.amount)}</span>`).join('')}</div>` : ''}
    ${c.award ? `<div class="lb-win">🎉 مبروك! كسبت المركز ${c.award.rank} و${money(c.award.amount)} اتضافوا لمحفظتك</div>` : ''}
    <div class="lb">${rows || '<div class="muted" style="text-align:center;padding:14px">لسه محدش سجّل — كن الأول! 💪</div>'}</div>
    ${c.mine && !meIn ? `<div class="lb-row me"><span class="lb-rk">${c.mine.rank}</span><span class="grow">إنت</span><b>${c.mine.score}</b></div>` : ''}
    ${c.note ? `<p class="muted small" style="margin:10px 0 0">${esc(c.note)}</p>` : ''}
    <p class="muted small" style="margin:8px 0 0">الترتيب بيتحدّث أول بأول. التعادل بيكسبه اللي وصل للرقم الأول. الإدارة بتراجع النتيجة قبل ما الجوايز تتضاف.</p>`);
}

export function bindGrowth(root, G) {
  if (!G) return;
  const a = $('[data-gcamp]', root); if (a) a.onclick = () => campaignsSheet(G);
  const b = $('[data-gcont]', root); if (b) b.onclick = () => contestSheet(G.contests.find((x) => x.id === b.dataset.gcont));
}

// Ledger row labels for the new kinds (wallet history).
export const growthKind = (x) => x.kind === 'campaign' ? { t: `🎯 بونص حملة: ${x.note || ''}` }
  : x.kind === 'contest' ? { t: `🏆 ${x.note || 'جايزة مسابقة'}` } : null;
