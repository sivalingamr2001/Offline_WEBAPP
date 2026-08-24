import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeQuartz,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const styles = `
:root {
  --bg: #f2f3f7;
  --surface: #ffffff;
  --ink: #111827;
  --muted: #6b7280;
  --accent: #4f46e5;
  --accent-dark: #4338ca;
  --accent-soft: #eef0ff;
  --danger: #dc2626;
  --danger-soft: #fee2e2;
  --border: #e3e5ea;
  --radius: 10px;
}

:root {
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  color: #1c2430;
  background: #f6f7f9;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
  
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--ink);
  overflow: hidden;
}
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}
.app-header {
  padding: 18px 24px 14px;
  background: linear-gradient(135deg, #111827 0%, #1f2540 100%);
  color: #fff;
  flex: 0 0 auto;
}
.app-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.app-title {
  min-width: 260px;
  flex: 1 1 360px;
}
.app-header h1 {
  margin: 0 0 4px;
  font-size: 21px;
  font-weight: 700;
}
.app-header p {
  margin: 0;
  font-size: 13px;
  color: #c7cbe0;
  max-width: 640px;
  line-height: 1.5;
}
.header-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 2 1 720px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.header-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.search-box {
  position: relative;
  flex: 1 1 320px;
  min-width: 250px;
  max-width: 520px;
}
.search-box input {
  width: 100%;
  padding: 9px 12px 9px 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  background: #f8f9fb;
  transition: border-color .15s, background .15s;
}
.search-box input:focus { border-color: var(--accent); background: #fff; }
.search-box svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: .45; }
.app-header .search-box input {
  background: rgba(255, 255, 255, .08);
  border-color: rgba(255, 255, 255, .18);
  color: #fff;
}
.app-header .search-box input::placeholder {
  color: rgba(255, 255, 255, .58);
}
.app-header .search-box input:focus {
  background: rgba(255, 255, 255, .12);
  border-color: rgba(255, 255, 255, .42);
}
.app-header .search-box svg {
  color: #fff;
  opacity: .58;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s, border-color .12s, transform .05s;
  white-space: nowrap;
}
.btn:hover { background: #f5f6f9; }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-dark); }
.btn-danger { background: #fff; border-color: var(--danger); color: var(--danger); }
.btn-danger:hover { background: var(--danger-soft); }
.app-header .btn-danger:disabled {
  background: rgba(255, 255, 255, .08);
  border-color: rgba(255, 255, 255, .2);
  color: rgba(255, 255, 255, .56);
  opacity: 1;
}
.app-header .icon-tool {
  background: rgba(255, 255, 255, .08);
  border-color: rgba(255, 255, 255, .2);
  color: #fff;
}
.app-header .icon-tool:hover {
  background: rgba(255, 255, 255, .14);
}
.btn-ghost { background: transparent; border-color: transparent; color: var(--muted); }
.btn-ghost:hover { background: #f2f3f7; }
.icon-tool {
  width: 40px;
  height: 40px;
  padding: 0;
  justify-content: center;
}
.icon-tool svg {
  width: 17px;
  height: 17px;
}
.segmented { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.segmented button {
  border: none;
  background: #fff;
  padding: 8px 11px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  border-right: 1px solid var(--border);
}
.segmented button:last-child { border-right: none; }
.segmented button.active { background: var(--accent-soft); color: var(--accent); }
.menu-wrap { position: relative; }
.menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(17, 24, 39, .14);
  padding: 8px;
  min-width: 200px;
  z-index: 50;
}
.menu-panel.wide {
  min-width: 280px;
}
.menu-panel label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.menu-panel label:hover { background: #f5f6f9; }
.filter-field {
  display: grid;
  grid-template-columns: 92px 1fr;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
}
.filter-field span {
  color: #374151;
  font-size: 12.5px;
  font-weight: 600;
}
.filter-field input,
.filter-field select {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  outline: none;
}
.filter-field input:focus,
.filter-field select:focus {
  border-color: var(--accent);
}
.menu-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 8px 4px;
  border-top: 1px solid var(--border);
  margin-top: 6px;
}
.menu-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--muted);
  padding: 4px 8px 6px;
  font-weight: 700;
}
.grid-wrap { flex: 1 1 auto; min-height: 0; padding: 14px 24px 20px; }
#ag-grid-container {
  height: 100%;
  width: 100%;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(17, 24, 39, .06);
}
.mono-cell {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 12.5px;
  color: #374151;
}
.actions-cell { padding: 0 !important; }
.grid-action-btn {
  border: none;
  background: #f3f4f6;
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
}
.grid-action-btn.edit:hover { background: var(--accent-soft); }
.grid-action-btn.delete:hover { background: var(--danger-soft); }
.row-inactive { background: #fff7f7 !important; }
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, .45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal-card {
  background: #fff;
  border-radius: 14px;
  width: 560px;
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(17, 24, 39, .28);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.modal-header h2 { margin: 0; font-size: 16px; }
.icon-btn {
  border: none;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
  color: var(--muted);
  padding: 4px 8px;
  border-radius: 6px;
}
.icon-btn:hover { background: #f2f3f7; }
.modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.modal-body label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: #374151;
}
.modal-body label.full { grid-column: 1 / -1; }
.modal-body input,
.modal-body select {
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  font-size: 13.5px;
  font-weight: 400;
  outline: none;
  font-family: inherit;
}
.modal-body input:focus,
.modal-body select:focus { border-color: var(--accent); }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #111827;
  color: #fff;
  padding: 11px 18px;
  border-radius: 8px;
  font-size: 13px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, .25);
  z-index: 200;
}
`;

type EmployeeStatus = "Active" | "On Leave" | "Inactive";

type Employee = {
  id: number;
  empId: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  location: string;
  status: EmployeeStatus;
  joinDate: string;
  salary: number;
  rating: number;
};

type EmployeeForm = Omit<Employee, "id" | "empId"> & Partial<Pick<Employee, "id" | "empId">>;

type ModalState = {
  mode: "create" | "edit";
  fields: EmployeeForm;
};

type FilterColumn = {
  field: string;
  label: string;
  type: "text" | "select" | "date";
  values?: string[];
};

const FIRST_NAMES = [
  "Arun", "Priya", "Karthik", "Divya", "Suresh", "Meena", "Rajesh", "Lakshmi", "Vignesh", "Anitha",
  "Senthil", "Kavya", "Manoj", "Deepa", "Prakash", "Swathi", "Ganesh", "Nithya", "Ramesh", "Sowmya",
  "Vijay", "Pooja", "Naveen", "Sneha", "Balaji", "Revathi", "Karthikeyan", "Aishwarya", "Dinesh", "Bhavani",
  "Mohan", "Yamuna", "Sathish", "Radha", "Arjun", "Gayathri", "Selvam", "Preethi", "Ashok", "Hema",
];
const LAST_NAMES = [
  "Kumar", "Raj", "Murthy", "Iyer", "Pillai", "Nair", "Gupta", "Sharma", "Reddy", "Rao",
  "Subramaniam", "Krishnan", "Venkatesh", "Chandran", "Natarajan", "Balasubramanian", "Mani", "Elango", "Shanmugam", "Velu",
];
const DEPARTMENTS = [
  "Production", "Quality Assurance", "Maintenance", "Logistics", "R&D", "Human Resources",
  "Finance", "Information Technology", "Procurement", "Design Engineering",
];
const DESIGNATIONS = [
  "Engineer", "Senior Engineer", "Executive", "Manager", "Team Lead",
  "Associate", "Analyst", "Supervisor", "Technician", "Specialist",
];
const CITIES = ["Coimbatore", "Chennai", "Bengaluru", "Hyderabad", "Pune", "Mumbai", "Delhi", "Ahmedabad", "Kochi", "Vadodara"];
const STATUSES: EmployeeStatus[] = ["Active", "Active", "Active", "Active", "On Leave", "Inactive"];

const TOGGLE_COLUMNS = [
  { field: "empId", label: "Employee ID" },
  { field: "name", label: "Employee Name" },
  { field: "department", label: "Department" },
  { field: "designation", label: "Designation" },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
  { field: "location", label: "Location" },
  { field: "status", label: "Status" },
  { field: "joinDate", label: "Join Date" },
  { field: "salary", label: "Salary" },
  { field: "rating", label: "Rating" },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { field: "empId", label: "Employee ID", type: "text" },
  { field: "name", label: "Name", type: "text" },
  { field: "department", label: "Department", type: "select", values: DEPARTMENTS },
  { field: "designation", label: "Designation", type: "select", values: DESIGNATIONS },
  { field: "location", label: "Location", type: "select", values: CITIES },
  { field: "status", label: "Status", type: "select", values: ["Active", "On Leave", "Inactive"] },
  { field: "joinDate", label: "Join Date", type: "date" },
];

const ROW_COUNT = 100000;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRows(count: number): Employee[] {
  const rows = new Array<Employee>(count);
  const start = new Date(2015, 0, 1).getTime();
  const end = new Date(2026, 7, 1).getTime();

  for (let i = 0; i < count; i += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const joinDate = new Date(start + Math.random() * (end - start)).toISOString().slice(0, 10);

    rows[i] = {
      id: i + 1,
      empId: `EMP${100000 + i}`,
      name: `${firstName} ${lastName}`,
      department: pick(DEPARTMENTS),
      designation: pick(DESIGNATIONS),
      email: `${firstName}.${lastName}${i}`.toLowerCase() + "@janatics-demo.com",
      phone: "9" + Math.floor(100000000 + Math.random() * 899999999),
      location: pick(CITIES),
      status: pick(STATUSES),
      joinDate,
      salary: Math.round((25000 + Math.random() * 175000) / 500) * 500,
      rating: 1 + Math.floor(Math.random() * 5),
    };
  }

  return rows;
}

function statusCellRenderer(params: any) {
  const el = document.createElement("span");
  const colors: Record<string, { bg: string; fg: string }> = {
    Active: { bg: "#dcfce7", fg: "#166534" },
    "On Leave": { bg: "#fef9c3", fg: "#854d0e" },
    Inactive: { bg: "#fee2e2", fg: "#991b1b" },
  };
  const color = colors[params.value] ?? { bg: "#e5e7eb", fg: "#374151" };
  el.textContent = params.value;
  el.style.cssText = `background:${color.bg};color:${color.fg};padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;display:inline-block;`;
  return el;
}

function ratingCellRenderer(params: any) {
  const el = document.createElement("span");
  const value = params.value || 0;
  el.textContent = "★".repeat(value) + "☆".repeat(5 - value);
  el.style.cssText = "color:#f59e0b;letter-spacing:1px;font-size:13px;";
  el.title = `${value} / 5`;
  return el;
}

function salaryFormatter(params: any) {
  if (params.value == null) return "";
  return "₹" + Number(params.value).toLocaleString("en-IN");
}

function dateComparator(filterDate: Date, cellValue: string) {
  if (!cellValue) return -1;
  const cellDate = new Date(cellValue);
  if (cellDate < filterDate) return -1;
  if (cellDate > filterDate) return 1;
  return 0;
}

function actionsCellRenderer(params: any) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;gap:6px;height:100%;align-items:center;padding-left:10px;";

  const editBtn = document.createElement("button");
  editBtn.innerHTML = "✎";
  editBtn.title = "Edit record";
  editBtn.className = "grid-action-btn edit";
  editBtn.onclick = () => params.context.onEdit(params.data);

  const deleteBtn = document.createElement("button");
  deleteBtn.innerHTML = "🗑";
  deleteBtn.title = "Delete record";
  deleteBtn.className = "grid-action-btn delete";
  deleteBtn.onclick = () => params.context.onDelete(params.data);

  wrap.appendChild(editBtn);
  wrap.appendChild(deleteBtn);
  return wrap;
}

function emptyForm(): EmployeeForm {
  return {
    name: "",
    department: DEPARTMENTS[0],
    designation: DESIGNATIONS[0],
    email: "",
    phone: "",
    location: CITIES[0],
    status: "Active",
    joinDate: new Date().toISOString().slice(0, 10),
    salary: 30000,
    rating: 3,
  };
}

export default function App() {
  const gridDivRef = useRef<HTMLDivElement | null>(null);
  const gridApiRef = useRef<any>(null);
  const nextIdRef = useRef(ROW_COUNT + 1);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedCount, setSelectedCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [density, setDensity] = useState<"compact" | "standard" | "comfortable">("standard");
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>(() => {
    const visibility: Record<string, boolean> = {};
    TOGGLE_COLUMNS.forEach((column) => {
      visibility[column.field] = true;
    });
    return visibility;
  });
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const openModal = useCallback((mode: "create" | "edit", data?: Employee) => {
    setModal({ mode, fields: data ? { ...data } : emptyForm() });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const handleDeleteSingle = useCallback((data: Employee) => {
    if (!window.confirm(`Delete the record for ${data.name}? This cannot be undone.`)) return;
    gridApiRef.current?.applyTransaction({ remove: [data] });
    showToast("Record deleted");
  }, [showToast]);

  useEffect(() => {
    if (!gridDivRef.current) return;

    const rows = generateRows(ROW_COUNT);
    const columnDefs = [
      { field: "empId", headerName: "Employee ID", pinned: "left", width: 140, cellClass: "mono-cell", filter: "agTextColumnFilter" },
      { field: "name", headerName: "Employee Name", editable: true, minWidth: 180, flex: 1.3, filter: "agTextColumnFilter" },
      {
        field: "department",
        headerName: "Department",
        editable: true,
        minWidth: 170,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: DEPARTMENTS },
      },
      {
        field: "designation",
        headerName: "Designation",
        editable: true,
        minWidth: 160,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: DESIGNATIONS },
      },
      { field: "email", headerName: "Email", minWidth: 220, cellClass: "mono-cell", tooltipField: "email" },
      { field: "phone", headerName: "Phone", width: 130, filter: "agTextColumnFilter" },
      { field: "location", headerName: "Location", width: 140 },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["Active", "On Leave", "Inactive"] },
        cellRenderer: statusCellRenderer,
        filter: "agTextColumnFilter",
      },
      {
        field: "joinDate",
        headerName: "Join Date",
        width: 135,
        editable: true,
        filter: "agDateColumnFilter",
        filterParams: { comparator: dateComparator },
      },
      {
        field: "salary",
        headerName: "Salary (₹/mo)",
        width: 150,
        editable: true,
        type: "rightAligned",
        cellEditor: "agNumberCellEditor",
        valueFormatter: salaryFormatter,
        filter: "agNumberColumnFilter",
      },
      {
        field: "rating",
        headerName: "Rating",
        width: 130,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [1, 2, 3, 4, 5] },
        cellRenderer: ratingCellRenderer,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Actions",
        field: "actions",
        pinned: "right",
        width: 100,
        sortable: false,
        filter: false,
        editable: false,
        resizable: false,
        cellRenderer: actionsCellRenderer,
        cellClass: "actions-cell",
      },
    ];

    const api = createGrid(gridDivRef.current, {
      columnDefs,
      rowData: rows,
      theme: themeQuartz.withParams({
        accentColor: "#4f46e5",
        headerBackgroundColor: "#f8f9fc",
        headerTextColor: "#374151",
        headerFontWeight: 700,
        oddRowBackgroundColor: "#fbfbfd",
        borderColor: "#e3e5ea",
        wrapperBorderRadius: 10,
        rowHoverColor: "#f0f1ff",
      }),
      defaultColDef: {
        sortable: true,
        filter: true,
        floatingFilter: false,
        resizable: true,
        minWidth: 100,
        editable: false,
      },
      getRowId: (params: any) => String(params.data.id),
      rowSelection: { mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false },
      pagination: true,
      paginationPageSize: 50,
      paginationPageSizeSelector: [25, 50, 100, 200, 500, 1000],
      animateRows: true,
      rowBuffer: 20,
      undoRedoCellEditing: true,
      undoRedoCellEditingLimit: 20,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      tooltipShowDelay: 300,
      rowClassRules: { "row-inactive": (params: any) => params.data?.status === "Inactive" },
      context: {
        onEdit: (data: Employee) => openModal("edit", data),
        onDelete: (data: Employee) => handleDeleteSingle(data),
      },
      onSelectionChanged: () => setSelectedCount(gridApiRef.current?.getSelectedRows().length ?? 0),
      onCellValueChanged: (params: any) => {
        showToast(`${params.colDef.headerName} updated for ${params.data.name}`);
      },
    } as any);

    gridApiRef.current = api;

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      api.destroy();
      gridApiRef.current = null;
    };
  }, [handleDeleteSingle, openModal, showToast]);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchText(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      gridApiRef.current?.setGridOption("quickFilterText", value);
    }, 200);
  }

  function resetFilters() {
    setSearchText("");
    setColumnFilters({});
    gridApiRef.current?.setFilterModel(null);
    gridApiRef.current?.setGridOption("quickFilterText", "");
  }

  function handleColumnFilterChange(field: string, value: string) {
    const nextFilters = { ...columnFilters, [field]: value };
    if (!value) delete nextFilters[field];
    setColumnFilters(nextFilters);

    const filterModel = Object.fromEntries(
      Object.entries(nextFilters).map(([filterField, filterValue]) => {
        if (filterField === "joinDate") {
          return [filterField, { filterType: "date", type: "equals", dateFrom: filterValue }];
        }

        const type = FILTER_COLUMNS.find((column) => column.field === filterField)?.type === "select" ? "equals" : "contains";
        return [filterField, { filterType: "text", type, filter: filterValue }];
      }),
    );
    gridApiRef.current?.setFilterModel(filterModel);
  }

  function exportCsv() {
    gridApiRef.current?.exportDataAsCsv({ fileName: `employee-directory-${Date.now()}.csv` });
  }

  function applyDensity(mode: "compact" | "standard" | "comfortable") {
    setDensity(mode);
    const heights = { compact: 32, standard: 44, comfortable: 56 };
    gridApiRef.current?.setGridOption("rowHeight", heights[mode]);
    gridApiRef.current?.resetRowHeights();
  }

  function toggleColumn(field: string) {
    setColVisibility((previous) => {
      const next = { ...previous, [field]: !previous[field] };
      gridApiRef.current?.setColumnsVisible([field], next[field]);
      return next;
    });
  }

  function handleBulkDelete() {
    const api = gridApiRef.current;
    const selectedRows: Employee[] = api?.getSelectedRows() ?? [];
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Delete ${selectedRows.length} selected record(s)? This cannot be undone.`)) return;

    api.applyTransaction({ remove: selectedRows });
    setSelectedCount(0);
    showToast(`${selectedRows.length} record(s) deleted`);
  }

  function handleFieldChange(name: keyof EmployeeForm, value: string | number) {
    setModal((previous) => {
      if (!previous) return previous;
      return { ...previous, fields: { ...previous.fields, [name]: value } };
    });
  }

  function handleSave() {
    if (!modal) return;

    const api = gridApiRef.current;
    const fields = modal.fields;

    if (modal.mode === "create") {
      const newId = nextIdRef.current;
      nextIdRef.current += 1;
      const newRow: Employee = {
        ...fields,
        id: newId,
        empId: `EMP${100000 + newId}`,
        salary: Number(fields.salary) || 0,
        rating: Number(fields.rating) || 1,
      };
      api?.applyTransaction({ add: [newRow], addIndex: 0 });
      showToast("Record created");
    } else {
      api?.applyTransaction({
        update: [{ ...fields, salary: Number(fields.salary) || 0, rating: Number(fields.rating) || 1 }],
      });
      showToast("Record updated");
    }

    setModal(null);
  }

  return (
    <div className="app">
      <style>{styles}</style>

      <header className="app-header">
        <div className="app-header-top">
          <div className="app-title">
            <h1>Employee Directory</h1>
            <p>
              Manage workforce records across all plants records below.
            </p>
          </div>
          <div className="header-side">
            <div className="search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder={`Search ${ROW_COUNT.toLocaleString("en-IN")} records...`}
                value={searchText}
                onChange={handleSearchChange}
              />
            </div>

            <div className="header-tools">
              <div className="menu-wrap">
                <button className="btn icon-tool" aria-label="Filter table" title="Filter table" onClick={() => setFilterMenuOpen((open) => !open)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 5h18" />
                    <path d="M6 12h12" />
                    <path d="M10 19h4" />
                  </svg>
                </button>
                {filterMenuOpen && (
                  <div className="menu-panel wide" onMouseLeave={() => setFilterMenuOpen(false)}>
                    <div className="menu-title">Filter Columns</div>
                    {FILTER_COLUMNS.map((column) => (
                      <div className="filter-field" key={column.field}>
                        <span>{column.label}</span>
                        {column.type === "select" ? (
                          <select
                            value={columnFilters[column.field] || ""}
                            onChange={(event) => handleColumnFilterChange(column.field, event.target.value)}
                          >
                            <option value="">All</option>
                            {column.values?.map((value) => <option key={value} value={value}>{value}</option>)}
                          </select>
                        ) : (
                          <input
                            type={column.type === "date" ? "date" : "text"}
                            value={columnFilters[column.field] || ""}
                            onChange={(event) => handleColumnFilterChange(column.field, event.target.value)}
                          />
                        )}
                      </div>
                    ))}
                    <div className="menu-actions">
                      <button className="btn btn-ghost" onClick={resetFilters}>Clear</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="menu-wrap">
                <button className="btn icon-tool" aria-label="Show columns" title="Show columns" onClick={() => setColMenuOpen((open) => !open)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M9 4v16" />
                    <path d="M15 4v16" />
                  </svg>
                </button>
                {colMenuOpen && (
                  <div className="menu-panel" onMouseLeave={() => setColMenuOpen(false)}>
                    <div className="menu-title">Show Columns</div>
                    {TOGGLE_COLUMNS.map((column) => (
                      <label key={column.field}>
                        <input
                          type="checkbox"
                          checked={colVisibility[column.field]}
                          onChange={() => toggleColumn(column.field)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="menu-wrap">
                <button className="btn icon-tool" aria-label="Table settings" title="Table settings" onClick={() => setSettingsMenuOpen((open) => !open)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
                  </svg>
                </button>
                {settingsMenuOpen && (
                  <div className="menu-panel wide" onMouseLeave={() => setSettingsMenuOpen(false)}>
                    <div className="menu-title">Table Settings</div>
                    <div className="segmented">
                      <button className={density === "compact" ? "active" : ""} onClick={() => applyDensity("compact")}>Compact</button>
                      <button className={density === "standard" ? "active" : ""} onClick={() => applyDensity("standard")}>Standard</button>
                      <button className={density === "comfortable" ? "active" : ""} onClick={() => applyDensity("comfortable")}>Comfortable</button>
                    </div>
                    <div className="menu-actions">
                      <button className="btn btn-ghost" onClick={resetFilters}>Reset Filters</button>
                      <button className="btn" onClick={exportCsv}>Export CSV</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="header-actions">
              <button className="btn btn-primary" onClick={() => openModal("create")}>+ Create Record</button>
              <button className="btn btn-danger" disabled={selectedCount === 0} onClick={handleBulkDelete}>
                Delete Selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="grid-wrap">
        <div id="ag-grid-container" ref={gridDivRef} />
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal.mode === "create" ? "Create Employee Record" : `Edit Record — ${modal.fields.empId || ""}`}</h2>
              <button className="icon-btn" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <label className="full">Full Name
                <input value={modal.fields.name} onChange={(event) => handleFieldChange("name", event.target.value)} />
              </label>
              <label>Department
                <select value={modal.fields.department} onChange={(event) => handleFieldChange("department", event.target.value)}>
                  {DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </label>
              <label>Designation
                <select value={modal.fields.designation} onChange={(event) => handleFieldChange("designation", event.target.value)}>
                  {DESIGNATIONS.map((designation) => <option key={designation} value={designation}>{designation}</option>)}
                </select>
              </label>
              <label>Email
                <input type="email" value={modal.fields.email} onChange={(event) => handleFieldChange("email", event.target.value)} />
              </label>
              <label>Phone
                <input value={modal.fields.phone} onChange={(event) => handleFieldChange("phone", event.target.value)} />
              </label>
              <label>Location
                <select value={modal.fields.location} onChange={(event) => handleFieldChange("location", event.target.value)}>
                  {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
              <label>Status
                <select value={modal.fields.status} onChange={(event) => handleFieldChange("status", event.target.value)}>
                  {["Active", "On Leave", "Inactive"].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label>Join Date
                <input type="date" value={modal.fields.joinDate} onChange={(event) => handleFieldChange("joinDate", event.target.value)} />
              </label>
              <label>Salary (₹ / month)
                <input type="number" value={modal.fields.salary} onChange={(event) => handleFieldChange("salary", event.target.value)} />
              </label>
              <label>Rating
                <select value={modal.fields.rating} onChange={(event) => handleFieldChange("rating", event.target.value)}>
                  {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {modal.mode === "create" ? "Create Record" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
