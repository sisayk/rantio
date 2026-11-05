// Dates of birth are written day first, the European way: 02-07-1983. The dashes come by themselves
// as the digits are typed; the server reads this form (and the ISO form it sends back).

/** Digits typed so far, shown as DD-MM-YYYY. Deleting works naturally: a dash only follows more digits. */
export function typeDob(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "-" + d.slice(2, 4);
  if (d.length > 4) out += "-" + d.slice(4, 8);
  return out;
}

/** The server's 1983-07-02 as 02-07-1983; anything else is shown as it is. */
export function showDob(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value || "";
}
