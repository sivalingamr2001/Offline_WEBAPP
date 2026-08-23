import { apiFetch } from "../auth/apiClient";

export interface GridColumnConfig {
  columnName: string;
  displayLabel: string;
  dataType: "string" | "number" | "boolean" | "date";
  isVisible: boolean;
  isEditable: boolean;
  displayOrder: number;
  width?: number;
}

export async function fetchGridColumns(syncTableId: string): Promise<GridColumnConfig[]> {
  const res = await apiFetch(`/api/admin/grid-columns/${syncTableId}`);
  if (!res.ok) return [];
  return res.json();
}
