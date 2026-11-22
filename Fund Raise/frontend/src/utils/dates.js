export function toEndOfDayISO(dateString) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T23:59:59`);
  return Number.isNaN(date.getTime()) ? dateString : date.toISOString();
}

export function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
