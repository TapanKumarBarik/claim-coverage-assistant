import { Fragment, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { VisuallyHidden } from "./VisuallyHidden";
import "./DataTable.css";

export interface Column<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Right-align numbers. */
  numeric?: boolean;
}

interface Props<Row> {
  /** Names the table for assistive technology; not drawn. */
  caption: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, index: number) => string;
  /** Content for a full-width row under `row`, or nothing. The caller decides which rows are open. */
  detail?: (row: Row) => ReactNode;
}

/** A scrollable, captioned table. The wrapper is focusable so keyboard users can scroll it sideways. */
export function DataTable<Row>({ caption, columns, rows, rowKey, detail }: Props<Row>) {
  return (
    <div className="data-table" tabIndex={0}>
      <table>
        <caption>
          <VisuallyHidden>{caption}</VisuallyHidden>
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cx(column.numeric && "data-table__numeric")}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const extra = detail?.(row);
            return (
              <Fragment key={rowKey(row, index)}>
                <tr className={cx(Boolean(extra) && "data-table__row--open")}>
                  {columns.map((column) => (
                    <td key={column.key} className={cx(column.numeric && "data-table__numeric")}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
                {extra && (
                  <tr className="data-table__detail">
                    <td colSpan={columns.length}>{extra}</td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
