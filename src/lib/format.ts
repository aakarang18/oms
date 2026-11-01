export const TBA = 'To be announced';

export function inr(paise: number | null | undefined) {
  if (paise === null || paise === undefined) return null;
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: rupees % 1 ? 2 : 0 });
}

export function inrShort(paise: number) {
  const r = paise / 100;
  if (r >= 1e7) return '₹' + (r / 1e7).toFixed(2) + ' Cr';
  if (r >= 1e5) return '₹' + (r / 1e5).toFixed(2) + ' L';
  return '₹' + r.toLocaleString('en-IN');
}

export function eventDate(date: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return null;
  const d = new Date(date + (date.length === 10 ? 'T00:00:00+05:30' : ''));
  return d.toLocaleDateString('en-IN', opts ?? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function ageOn(dob: string, on: Date) {
  const b = new Date(dob + 'T00:00:00+05:30');
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

export function maskMobile(m: string) {
  const d = m.replace(/\s/g, '');
  return d.length > 6 ? d.slice(0, 5) + 'XXXX' + d.slice(-2) : d;
}
