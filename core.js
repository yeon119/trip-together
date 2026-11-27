export function dateRange(start, end) {
  const parse = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('날짜를 정확히 입력해주세요.');
    const d = new Date(s + 'T00:00:00Z');
    if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== s) throw new Error('유효하지 않은 날짜예요.');
    return +d;
  };
  const a = parse(start), b = parse(end), count = (b - a) / 86400000 + 1;
  if (count < 1 || count > 120) throw new Error('후보 기간은 시작일부터 최대 120일까지 선택해주세요.');
  return Array.from({ length: count }, (_, i) => new Date(a + i * 86400000).toISOString().slice(0, 10));
}
export function rankTrips(room, members) {
  const n = room.tripDays;
  return room.dates.slice(0, room.dates.length - n + 1).map((start, i) => {
    const dates = room.dates.slice(i, i + n);
    const available = members.filter(m => dates.every(d => m.dates.includes(d)));
    return { start, end: dates.at(-1), available, count: available.length,
      everyone: members.length >= room.expected && available.length === members.length };
  }).sort((a, b) => b.count - a.count || a.start.localeCompare(b.start));
}
export function validateRoom(input) {
  const title = input.title.trim();
  if (!title || title.length > 60) throw new Error('여행 이름은 1~60자로 입력해주세요.');
  const dates = dateRange(input.start, input.end);
  const tripDays = Number(input.tripDays), expected = Number(input.expected);
  if (!Number.isInteger(tripDays) || tripDays < 1 || tripDays > 14 || tripDays > dates.length) throw new Error('여행 일수는 후보 기간 안에서 1~14일로 선택해주세요.');
  if (!Number.isInteger(expected) || expected < 2 || expected > 30) throw new Error('예정 인원은 2~30명으로 입력해주세요.');
  return { title, dates, tripDays, expected };
}
export const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function formatDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {month:'long', day:'numeric', weekday:'short', timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
}
export const durationLabel = days => days === 1 ? '당일치기' : `${days - 1}박 ${days}일`;
