/** ANSI styling that collapses to plain text when color is off. */
export interface Style {
  bold: (text: string) => string;
  dim: (text: string) => string;
  green: (text: string) => string;
  red: (text: string) => string;
  yellow: (text: string) => string;
  cyan: (text: string) => string;
}

const wrap = (on: boolean, open: number, close: number) => (text: string) =>
  on ? `\u001b[${open}m${text}\u001b[${close}m` : text;

export const makeStyle = (on: boolean): Style => ({
  bold: wrap(on, 1, 22),
  dim: wrap(on, 2, 22),
  green: wrap(on, 32, 39),
  red: wrap(on, 31, 39),
  yellow: wrap(on, 33, 39),
  cyan: wrap(on, 36, 39),
});

const ANSI = /\u001b\[[0-9;]*m/g;
export const stripAnsi = (text: string) => text.replace(ANSI, "");
/** Width on screen: ANSI codes take no room. */
export const visibleWidth = (text: string) => [...stripAnsi(text)].length;
