export interface DatasetSheet {
  sheetName: string;
  columns: string[];
  rowCount: number;
  rows: DatasetRow[];
}

export type DatasetRow = Record<string, unknown>;

export type FilterOperator =
  | "equals"
  | "contains"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export interface RowFilter {
  column: string;
  operator: FilterOperator;
  value: string | number;
}
