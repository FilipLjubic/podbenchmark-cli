import { visibleWidth } from "../style";

export interface Column {
  header: string;
  align?: "left" | "right";
  /** Longest this column may grow; longer text is cut with an ellipsis. */
  maxWidth?: number;
}

export interface TableRow {
  cells: readonly string[];
  /** Wraps the finished line, for highlighting. */
  paint?: (line: string) => string;
  /** Draw a rule below this row. */
  ruleAfter?: boolean;
}

const GAP = "  ";

export function truncate(text: string, width: number) {
  const chars = [...text];
  return chars.length <= width
    ? text
    : `${chars.slice(0, width - 1).join("")}…`;
}

const pad = (text: string, width: number, align: "left" | "right") => {
  const fill = " ".repeat(Math.max(0, width - visibleWidth(text)));
  return align === "right" ? fill + text : text + fill;
};

/** Plain fixed-width table. `headerPaint` styles the header line. */
export function renderTable(
  columns: readonly Column[],
  rows: readonly TableRow[],
  headerPaint: (line: string) => string = line => line
) {
  const widths = columns.map((column, index) => {
    const natural = Math.max(
      visibleWidth(column.header),
      ...rows.map(row => visibleWidth(row.cells[index] ?? ""))
    );
    return Math.min(natural, column.maxWidth ?? natural);
  });
  const format = (cells: readonly string[]) =>
    columns
      .map((column, index) => {
        const raw = cells[index] ?? "";
        const fitted =
          visibleWidth(raw) > (widths[index] ?? 0)
            ? truncate(raw, widths[index] ?? 0)
            : raw;
        const align = column.align ?? "left";
        const cell = pad(fitted, widths[index] ?? 0, align);
        return index === columns.length - 1 && align === "left"
          ? cell.trimEnd()
          : cell;
      })
      .join(GAP)
      .trimEnd();
  const header = format(columns.map(column => column.header));
  const total = visibleWidth(header);
  const lines = [headerPaint(header)];
  for (const row of rows) {
    const line = format(row.cells);
    lines.push(row.paint ? row.paint(line) : line);
    if (row.ruleAfter) lines.push("─".repeat(total));
  }
  return lines.join("\n");
}

/** Word-wraps `items` joined by `separator` into lines of at most `width`. */
export function wrapList(
  items: readonly string[],
  width: number,
  separator = ", ",
  indent = ""
) {
  const lines: string[] = [];
  let current = "";
  for (const item of items) {
    const next = current === "" ? item : `${current}${separator}${item}`;
    if (current !== "" && visibleWidth(indent + next) > width) {
      lines.push(indent + current + separator.trimEnd());
      current = item;
    } else {
      current = next;
    }
  }
  if (current !== "") lines.push(indent + current);
  return lines.join("\n");
}
