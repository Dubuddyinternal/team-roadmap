/* CONFIG, the single source of truth for every number on the site.
   Nothing else hardcodes money, days or caps. */
export const CFG = {
  currency: '₹',
  base: 50, // per video, once approved and published
  basePayDays: 7, // days from the publishing date
  reviewDays: '2 to 4 days',
  bonusWindow: 30, // views counted over this many days from publishing
  bonusPayDays: 30, // bonus released within this many days of publishing

  /* bonus starts once a video crosses 1,500 views */
  viewFloor: 1500,
  slabs: [
    { min: 1500, max: 5000, bonus: 50, label: '1,500 to 5,000' },
    { min: 5000, max: 15000, bonus: 150, label: '5,000 to 15,000' },
    { min: 15000, max: 30000, bonus: 300, label: '15,000 to 30,000' },
    { min: 30000, max: 100000, bonus: 500, label: '30,000 and above' },
    { min: 100000, max: null, bonus: 1000, label: '1,00,000 and above' },
  ],

  maxResubmits: 1,
  supportHours: '24 to 48',
  supportEmail: 'support@dubuddy.in',
};

export function money(n) {
  return CFG.currency + Number(n || 0).toLocaleString('en-IN');
}

export function short(n) {
  if (n >= 100000) return n / 100000 + ' Lakh';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K';
  return String(n);
}

export function slabFor(v) {
  if (v < CFG.viewFloor) return { i: -1, bonus: 0, label: 'below ' + short(CFG.viewFloor) };
  for (let i = 0; i < CFG.slabs.length; i++) {
    const s = CFG.slabs[i];
    if (v >= s.min && (s.max === null || v < s.max)) return { i, bonus: s.bonus, label: s.label };
  }
  const last = CFG.slabs[CFG.slabs.length - 1];
  return { i: CFG.slabs.length - 1, bonus: last.bonus, label: last.label };
}

/* text tokens used across the pages */
export const T = {
  base: money(CFG.base),
  baseDays: CFG.basePayDays + ' days',
  bonusDays: CFG.bonusPayDays + ' days',
  reviewSLA: CFG.reviewDays,
  supportSLA: CFG.supportHours + ' hours',
  day30: String(CFG.bonusWindow),
  resub: String(CFG.maxResubmits),
  viewFloorN: CFG.viewFloor.toLocaleString('en-IN'),
};
CFG.slabs.forEach((s, i) => {
  T['slab' + (i + 1)] = s.label;
});

/* dates */
export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtShort(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
