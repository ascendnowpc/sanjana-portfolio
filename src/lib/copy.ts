/**
 * Slot filling for editable strings.
 *
 * Copy that used to be written in the JSX could interpolate directly —
 * `` `Listen — ${venue}` ``. Copy that is edited in a panel cannot, so the
 * templates carry named slots and this puts the values in.
 *
 * Deliberately forgiving: an unknown slot is left standing rather than
 * replaced with `undefined`, and a template that has lost its slot entirely
 * still renders. Somebody editing `'{title} — still {n}'` down to `'Still {n}'`
 * should get exactly that, not an error page.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}
