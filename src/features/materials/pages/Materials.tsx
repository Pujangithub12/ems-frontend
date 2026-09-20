import React, { useMemo, useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Minus,
  Boxes,
  Wallet,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  Trash2,
  Download,
  Pencil,
  Settings2,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { useOrganizationVendorsQuery } from "../../inventory/hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";
import { formatCost } from "../../../lib/currency";
import ErrorBanner from "../../../components/ErrorBanner";
import ConfirmationModal from "../../../components/ConfirmationModal";
import {
  useMaterialsQuery,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  useAddMaterialTransaction,
  useDeleteMaterialTransaction,
} from "../hooks/useMaterials";
import type { Material, MaterialCustomFieldValue, MaterialTransaction, MaterialTransactionType } from "../api/material.api";
import {
  useMaterialFieldsQuery,
  useCreateMaterialField,
  useUpdateMaterialField,
  useDeleteMaterialField,
} from "../hooks/useMaterialFields";
import type { MaterialField, MaterialFieldDataType } from "../api/materialField.api";
import {
  useMaterialCustomTables,
  useMaterialCustomTableDetail,
  useCreateMaterialCustomTable,
  useUpdateMaterialCustomTable,
  useDeleteMaterialCustomTable,
  useCreateMaterialCustomColumn,
  useUpdateMaterialCustomColumn,
  useDeleteMaterialCustomColumn,
  useCreateMaterialCustomRow,
  useUpdateMaterialCustomRow,
  useDeleteMaterialCustomRow,
  useImportMaterialCustomSheet,
} from "../hooks/useMaterialCustomTables";
import type { MaterialCustomTable } from "../api/materialCustomTable.api";
import { TableSheet, TableNameModal } from "../../customTables/components/TableSheet";

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-colors";

type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

/** Everything about one material that's never stored, always derived from
 * its transaction list — same "compute, don't store" split as the backend. */
type MaterialStock = {
  received: number;
  used: number;
  current: number;
  /** Most recent "received" transaction's unit price — used for both
   * display and current-stock valuation. */
  unitPrice: number;
  value: number;
  status: StockStatus;
  lastUpdated: string | null;
};

function computeStock(material: Material): MaterialStock {
  let received = 0;
  let used = 0;
  let unitPrice = 0;
  let unitPriceDate = "";
  let lastUpdated: string | null = null;
  for (const t of material.transactions) {
    if (t.type === "received") {
      received += t.quantity;
      if (t.unitPrice != null && t.date >= unitPriceDate) {
        unitPrice = t.unitPrice;
        unitPriceDate = t.date;
      }
    } else {
      used += t.quantity;
    }
    if (!lastUpdated || t.date > lastUpdated) lastUpdated = t.date;
  }
  const current = received - used;
  const status: StockStatus = current <= 0 ? "Out of Stock" : material.minStock > 0 && current <= material.minStock ? "Low Stock" : "In Stock";
  return { received, used, current, unitPrice, value: current * unitPrice, status, lastUpdated };
}

const STATUS_STYLES: Record<StockStatus, string> = {
  "In Stock": "bg-emerald-50 text-emerald-700",
  "Low Stock": "bg-amber-50 text-amber-700",
  "Out of Stock": "bg-red-50 text-red-700",
};

function thisMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Renders one custom field's input, keyed by field id — used by both
 * MaterialFormModal and (indirectly) the Material Stock table's extra
 * columns, which just display these same values read-only. */
const CustomFieldInput: React.FC<{
  field: MaterialField;
  value: MaterialCustomFieldValue;
  onChange: (value: MaterialCustomFieldValue) => void;
}> = ({ field, value, onChange }) => {
  if (field.dataType === "boolean") {
    return (
      <label className="flex items-center gap-2 px-3 py-2 text-[12.5px] bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="rounded accent-blue-800" />
        {field.name}
      </label>
    );
  }
  return (
    <input
      className={inputCls}
      type={field.dataType === "number" ? "number" : field.dataType === "date" ? "date" : "text"}
      placeholder={field.name}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

/** Add / Edit Material modal — the material master row (name/code/category/
 * unit/reorder threshold) plus one input per project-defined custom field. */
const MaterialFormModal: React.FC<{
  material: Material | null;
  fields: MaterialField[];
  onSave: (payload: {
    name: string;
    code: string;
    category: string;
    unit: string;
    minStock: string;
    customFields: Record<string, MaterialCustomFieldValue>;
  }) => Promise<void>;
  onClose: () => void;
}> = ({ material, fields, onSave, onClose }) => {
  const [name, setName] = useState(material?.name ?? "");
  const [code, setCode] = useState(material?.code ?? "");
  const [category, setCategory] = useState(material?.category ?? "");
  const [unit, setUnit] = useState(material?.unit ?? "");
  const [minStock, setMinStock] = useState(material?.minStock ? String(material.minStock) : "");
  const [customFields, setCustomFields] = useState<Record<string, MaterialCustomFieldValue>>(material?.customFields ?? {});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!material;

  const handleSave = async () => {
    if (!name.trim()) return setError("Material name is required.");
    if (!unit.trim()) return setError("Unit is required.");
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, code, category, unit, minStock, customFields });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save material."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div className="font-semibold text-[14px] text-slate-900">{isEdit ? "Edit Material" : "Add Material"}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto">
          <input autoFocus className={inputCls} placeholder="Material name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} />
            <input className={inputCls} placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Unit (bags, kg, m³...)" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <input
              className={inputCls}
              type="number"
              min="0"
              placeholder="Reorder level (optional)"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </div>

          {fields.length > 0 && (
            <>
              <div className="pt-1 text-[11px] font-medium text-slate-400 uppercase tracking-wide">Custom Fields</div>
              <div className="grid grid-cols-2 gap-2">
                {fields.map((field) => (
                  <CustomFieldInput
                    key={field.id}
                    field={field}
                    value={customFields[String(field.id)] ?? null}
                    onChange={(value) => setCustomFields((prev) => ({ ...prev, [String(field.id)]: value }))}
                  />
                ))}
              </div>
            </>
          )}

          {error && <p className="text-[11.5px] text-red-600">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center w-full gap-1.5 px-3 py-2 mt-1 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {isEdit ? "Save Changes" : "Add Material"}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Admin modal for managing this project's Material custom field
 * definitions (add / rename / change type / delete) — shown as extra
 * columns on the Material Stock table. */
const ManageFieldsModal: React.FC<{
  fields: MaterialField[];
  onCreate: (payload: { name: string; dataType: MaterialFieldDataType }) => Promise<unknown>;
  onUpdate: (id: number, payload: { name: string; dataType: MaterialFieldDataType }) => Promise<unknown>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
}> = ({ fields, onCreate, onUpdate, onDelete, onClose }) => {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<MaterialFieldDataType>("text");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingType, setEditingType] = useState<MaterialFieldDataType>("text");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const typeOptions: { value: MaterialFieldDataType; label: string }[] = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "boolean", label: "Yes / No" },
  ];

  const handleAdd = async () => {
    if (!newName.trim()) return setError("Field name is required.");
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: newName.trim(), dataType: newType });
      setNewName("");
      setNewType("text");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add field."));
    } finally {
      setBusy(false);
    }
  };

  const startEditing = (field: MaterialField) => {
    setEditingId(field.id);
    setEditingName(field.name);
    setEditingType(field.dataType);
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    if (!editingName.trim()) return setError("Field name is required.");
    setBusy(true);
    setError(null);
    try {
      await onUpdate(editingId, { name: editingName.trim(), dataType: editingType });
      setEditingId(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save field."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div className="font-semibold text-[14px] text-slate-900">Custom Fields</div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto">
          {fields.length === 0 && <p className="text-[12.5px] text-slate-400">No custom fields yet.</p>}
          {fields.map((field) =>
            editingId === field.id ? (
              <div key={field.id} className="flex items-center gap-1.5 p-2 border rounded-lg border-blue-200 bg-blue-50/40">
                <input className={inputCls} value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                <select className={inputCls} style={{ width: 110 }} value={editingType} onChange={(e) => setEditingType(e.target.value as MaterialFieldDataType)}>
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button onClick={handleSaveEdit} disabled={busy} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50">
                  <Plus size={14} className="rotate-45" />
                </button>
              </div>
            ) : (
              <div key={field.id} className="flex items-center justify-between px-3 py-2 border rounded-lg border-slate-200">
                <div>
                  <div className="text-[12.5px] font-medium text-black">{field.name}</div>
                  <div className="text-[11px] text-slate-400 capitalize">{field.dataType}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEditing(field)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(field.id).catch((err) => setError(getErrorMessage(err, "Failed to delete field.")))}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ),
          )}

          <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-slate-100">
            <input className={inputCls} placeholder="New field name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <select className={inputCls} style={{ width: 110 }} value={newType} onChange={(e) => setNewType(e.target.value as MaterialFieldDataType)}>
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button onClick={handleAdd} disabled={busy} className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-60">
              <Plus size={14} />
            </button>
          </div>
          {error && <p className="text-[11.5px] text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
};

/** Receive Material / Record Usage modal — one form, fields swap by type. */
const TransactionModal: React.FC<{
  initialType: MaterialTransactionType;
  materials: Material[];
  vendors: { id: number; name: string }[];
  defaultMaterialId: number | null;
  onSave: (materialId: number, payload: {
    type: MaterialTransactionType;
    quantity: string;
    date: string;
    vendorId: string;
    unitPrice: string;
    workArea: string;
    issuedTo: string;
    reference: string;
    remarks: string;
  }) => Promise<void>;
  onClose: () => void;
}> = ({ initialType, materials, vendors, defaultMaterialId, onSave, onClose }) => {
  const [type, setType] = useState<MaterialTransactionType>(initialType);
  const [materialId, setMaterialId] = useState<number | "">(defaultMaterialId ?? materials[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [quantity, setQuantity] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedMaterial = materials.find((m) => m.id === materialId) ?? null;
  const stock = selectedMaterial ? computeStock(selectedMaterial) : null;
  const purchaseTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  const handleSave = async () => {
    if (!materialId) return setError("Select a material.");
    if (!quantity || Number(quantity) <= 0) return setError("Enter a valid quantity.");
    setSaving(true);
    setError(null);
    try {
      await onSave(materialId, { type, quantity, date, vendorId, unitPrice, workArea, issuedTo, reference, remarks });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save transaction."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div className="font-semibold text-[14px] text-slate-900">
            {type === "received" ? "Receive Material" : "Record Material Usage"}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2.5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Transaction Type</label>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as MaterialTransactionType)}>
                <option value="received">Material Received</option>
                <option value="used">Material Used / Issued</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Date</label>
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Material</label>
              <select className={inputCls} value={materialId} onChange={(e) => setMaterialId(Number(e.target.value))}>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">
                Quantity {stock && type === "used" ? `(${stock.current} ${selectedMaterial?.unit} available)` : ""}
              </label>
              <input className={inputCls} type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>

          {type === "received" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">Vendor</label>
                <select className={inputCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">Unit Price</label>
                <input className={inputCls} type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">Used For / Work Area</label>
                <input className={inputCls} value={workArea} onChange={(e) => setWorkArea(e.target.value)} />
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">Issued To</label>
                <input className={inputCls} value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-500">Reference / Challan / Invoice No.</label>
            <input className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-500">Remarks</label>
            <input className={inputCls} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          {type === "received" && (
            <div className="flex items-center justify-between px-3 py-2.5 mt-1 border rounded-lg bg-slate-50 border-slate-200">
              <span className="text-[12.5px] text-slate-500">Purchase Total</span>
              <strong className="text-[13px] text-black">{formatCost(purchaseTotal)}</strong>
            </div>
          )}

          {error && <p className="text-[11.5px] text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Transaction
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; note: string; icon: React.ReactNode; tint: string }> = ({
  label,
  value,
  note,
  icon,
  tint,
}) => (
  <div className="px-4 py-3 bg-white border rounded-xl shadow-sm border-slate-200">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${tint}`}>{icon}</div>
    </div>
    <div className="text-[19px] font-bold text-black">{value}</div>
    <div className="mt-0.5 text-[11px] text-slate-400">{note}</div>
  </div>
);

/** A built-in fixed tab, or the id of a user-created custom spreadsheet tab
 * (see the customTables mechanic shared with Plant Report). */
type Tab = "stock" | "transactions" | "vendors" | number;

const Materials: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState<number | "">("");

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const materialsQuery = useMaterialsQuery(projectId || null);
  const vendorsQuery = useOrganizationVendorsQuery();
  const materials = useMemo(() => materialsQuery.data ?? [], [materialsQuery.data]);
  const vendors = vendorsQuery.data ?? [];

  const createMaterialMutation = useCreateMaterial();
  const updateMaterialMutation = useUpdateMaterial();
  const deleteMaterialMutation = useDeleteMaterial();
  const addTransactionMutation = useAddMaterialTransaction();
  const deleteTransactionMutation = useDeleteMaterialTransaction();

  const { data: materialFields = [] } = useMaterialFieldsQuery(projectId || null);
  const createFieldMutation = useCreateMaterialField();
  const updateFieldMutation = useUpdateMaterialField();
  const deleteFieldMutation = useDeleteMaterialField();

  const [activeTab, setActiveTab] = useState<Tab>("stock");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [txModal, setTxModal] = useState<{ type: MaterialTransactionType; materialId: number | null } | null>(null);
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState<Material | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<MaterialTransaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Custom spreadsheet tabs — same generic mechanic Plant Report uses (see
  // ../../customTables/components/TableSheet), an additional freeform set of
  // user-defined tables alongside the fixed stock/transactions/vendors tabs.
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [renamingTable, setRenamingTable] = useState<MaterialCustomTable | null>(null);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState<MaterialCustomTable | null>(null);

  const { data: customTables = [], isLoading: customTablesLoading } = useMaterialCustomTables(projectId || null);
  const createTableMutation = useCreateMaterialCustomTable();
  const updateTableMutation = useUpdateMaterialCustomTable();
  const deleteTableMutation = useDeleteMaterialCustomTable();

  const activeCustomTableId = typeof activeTab === "number" ? activeTab : null;
  const activeCustomTable = activeCustomTableId != null ? customTables.find((t) => t.id === activeCustomTableId) ?? null : null;
  const tableDetailQuery = useMaterialCustomTableDetail(activeCustomTableId);
  const createColumnMutation = useCreateMaterialCustomColumn();
  const updateColumnMutation = useUpdateMaterialCustomColumn();
  const deleteColumnMutation = useDeleteMaterialCustomColumn();
  const createRowMutation = useCreateMaterialCustomRow();
  const updateRowMutation = useUpdateMaterialCustomRow();
  const deleteRowMutation = useDeleteMaterialCustomRow();
  const importSheetMutation = useImportMaterialCustomSheet();

  const rows = useMemo(() => materials.map((m) => ({ material: m, stock: computeStock(m) })), [materials]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ material, stock }) => {
      if (statusFilter !== "all" && stock.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${material.name} ${material.code ?? ""} ${material.category ?? ""} ${material.vendor?.name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const monthKey = thisMonthKey();
    let stockValue = 0;
    let receivedThisMonth = 0;
    let lowStockCount = 0;
    for (const { material, stock } of rows) {
      stockValue += stock.value;
      if (stock.status !== "In Stock") lowStockCount++;
      for (const t of material.transactions) {
        if (t.type === "received" && t.date.slice(0, 7) === monthKey) {
          receivedThisMonth += t.quantity * (t.unitPrice ?? 0);
        }
      }
    }
    return { totalMaterials: materials.length, stockValue, receivedThisMonth, lowStockCount };
  }, [rows, materials.length]);

  const allTransactions = useMemo(() => {
    const flat: { material: Material; tx: MaterialTransaction }[] = [];
    for (const material of materials) {
      for (const tx of material.transactions) flat.push({ material, tx });
    }
    return flat.sort((a, b) => (a.tx.date === b.tx.date ? b.tx.createdAt.localeCompare(a.tx.createdAt) : b.tx.date.localeCompare(a.tx.date)));
  }, [materials]);

  const vendorSpend = useMemo(() => {
    const totals = new Map<string, number>();
    for (const { tx } of allTransactions) {
      if (tx.type !== "received" || !tx.vendor) continue;
      const amount = tx.quantity * (tx.unitPrice ?? 0);
      totals.set(tx.vendor.name, (totals.get(tx.vendor.name) ?? 0) + amount);
    }
    return [...totals.entries()].map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend);
  }, [allTransactions]);

  const currentProject = projects.find((p) => p.id === projectId) ?? null;

  const handleSaveMaterial = async (payload: {
    name: string;
    code: string;
    category: string;
    unit: string;
    minStock: string;
    customFields: Record<string, MaterialCustomFieldValue>;
  }) => {
    if (!projectId) return;
    const body = {
      name: payload.name.trim(),
      code: payload.code.trim() || null,
      category: payload.category.trim() || null,
      unit: payload.unit.trim(),
      minStock: payload.minStock.trim() ? Number(payload.minStock) : null,
      customFields: payload.customFields,
    };
    if (editingMaterial) {
      await updateMaterialMutation.mutateAsync({ id: editingMaterial.id, projectId, payload: body });
    } else {
      await createMaterialMutation.mutateAsync({ projectId, payload: body });
    }
  };

  const handleSaveTransaction = async (
    materialId: number,
    payload: {
      type: MaterialTransactionType;
      quantity: string;
      date: string;
      vendorId: string;
      unitPrice: string;
      workArea: string;
      issuedTo: string;
      reference: string;
      remarks: string;
    },
  ) => {
    if (!projectId) return;
    await addTransactionMutation.mutateAsync({
      materialId,
      projectId,
      payload: {
        type: payload.type,
        quantity: Number(payload.quantity),
        date: payload.date,
        vendorId: payload.vendorId ? Number(payload.vendorId) : null,
        unitPrice: payload.unitPrice.trim() ? Number(payload.unitPrice) : null,
        workArea: payload.workArea.trim() || null,
        issuedTo: payload.issuedTo.trim() || null,
        reference: payload.reference.trim() || null,
        remarks: payload.remarks.trim() || null,
      },
    });
  };

  const exportCsv = () => {
    const header = ["Material", "Vendor", "Received", "Used", "Current Stock", "Unit Price", "Stock Value", "Status", "Last Updated"];
    const lines = filteredRows.map(({ material, stock }) =>
      [
        material.name,
        material.vendor?.name ?? "",
        stock.received,
        stock.used,
        stock.current,
        stock.unitPrice,
        stock.value,
        stock.status,
        stock.lastUpdated ?? "",
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `materials-${currentProject?.name || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
          <Boxes className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-[13px] text-slate-400">No projects yet — create a project to start tracking here.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full px-6 py-5 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-slate-600 whitespace-nowrap">Project:</span>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(Number(e.target.value));
              setActiveTab("stock");
            }}
            className={`${inputCls} bg-white border-2`}
            style={{ width: 200 }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTxModal({ type: "received", materialId: null })}
            disabled={materials.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium border rounded-lg text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus size={14} /> Receive Material
          </button>
          <button
            onClick={() => setTxModal({ type: "used", materialId: null })}
            disabled={materials.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50"
          >
            <Minus size={14} /> Record Usage
          </button>
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-4" />}

      <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Materials"
          value={String(stats.totalMaterials)}
          note="Tracked in this project"
          icon={<Boxes size={17} className="text-blue-600" />}
          tint="bg-blue-50"
        />
        <StatCard
          label="Current Stock Value"
          value={formatCost(stats.stockValue)}
          note="Estimated from latest purchase price"
          icon={<Wallet size={17} className="text-emerald-600" />}
          tint="bg-emerald-50"
        />
        <StatCard
          label="Received This Month"
          value={formatCost(stats.receivedThisMonth)}
          note="Sum of this month's receipts"
          icon={<ArrowDownCircle size={17} className="text-emerald-600" />}
          tint="bg-emerald-50"
        />
        <StatCard
          label="Low Stock Items"
          value={String(stats.lowStockCount)}
          note="Below minimum or out of stock"
          icon={<AlertTriangle size={17} className="text-amber-600" />}
          tint="bg-amber-50"
        />
      </div>

      {materialsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div>
          <section className="bg-white border shadow-sm rounded-xl border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-200">
              <div className="flex flex-wrap flex-1 gap-2 min-w-[260px]">
                <input
                  className={`${inputCls} flex-1 min-w-[200px]`}
                  placeholder="Search material, vendor, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className={inputCls} style={{ width: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | StockStatus)}>
                  <option value="all">All stock status</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingMaterial(null);
                      setMaterialFormOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border rounded-lg text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    <Plus size={13} /> Add Material
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setManageFieldsOpen(true)}
                    title="Manage custom fields"
                    className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border rounded-lg text-slate-700 border-slate-200 hover:bg-slate-50"
                  >
                    <Settings2 size={13} /> Custom Fields
                  </button>
                )}
                <button
                  onClick={exportCsv}
                  disabled={filteredRows.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border rounded-lg text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 px-4 pt-3">
              {([
                ["stock", "Material Stock"],
                ["transactions", "Transactions"],
                ["vendors", "Vendor Purchases"],
              ] as [Tab, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-colors ${
                    activeTab === id ? "bg-blue-50 text-blue-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}

              <div className="w-px h-5 mx-1 bg-slate-200" />

              {customTablesLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              ) : (
                customTables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setActiveTab(table.id)}
                    onDoubleClick={() => isAdmin && setRenamingTable(table)}
                    className={`group flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-colors ${
                      activeTab === table.id ? "bg-blue-50 text-blue-900" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {table.name}
                    {isAdmin && activeTab === table.id && (
                      <span className="flex items-center gap-1">
                        <Pencil
                          size={11}
                          className="text-slate-400 hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingTable(table);
                          }}
                        />
                        <Trash2
                          size={11}
                          className="text-slate-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteTable(table);
                          }}
                        />
                      </span>
                    )}
                  </button>
                ))
              )}

              {isAdmin && (
                <button
                  onClick={() => setAddTableOpen(true)}
                  title="Add custom tab"
                  className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            {activeTab === "stock" && (
              <div className="overflow-x-auto">
                {materials.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <Boxes className="w-8 h-8 text-slate-300" />
                    <p className="text-[13px] text-slate-400">No materials yet for this project.</p>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingMaterial(null);
                          setMaterialFormOpen(true);
                        }}
                        className="text-[12.5px] font-medium text-blue-700 hover:underline"
                      >
                        Add your first material
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/60">
                        {["Material", "Vendor", ...materialFields.map((f) => f.name), "Received", "Used", "Current Stock", "Unit Price", "Stock Value", "Status", "Last Updated", ""].map(
                          (h, idx) => (
                            <th key={`${h}-${idx}`} className="py-2.5 px-3 text-[11px] font-medium text-blue-900 uppercase tracking-wide whitespace-nowrap">
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={10 + materialFields.length} className="py-10 text-[12.5px] text-center text-slate-400">
                            No materials match your search.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map(({ material, stock }, i) => (
                          <tr key={material.id} className={`border-b border-slate-100 last:border-0 hover:bg-blue-50/60 ${i % 2 === 1 ? "bg-slate-200/60" : "bg-white"}`}>
                            <td className="px-3 py-2.5">
                              <div className="text-[13px] font-semibold text-black">{material.name}</div>
                              <div className="text-[11px] text-slate-400">{[material.code, material.category].filter(Boolean).join(" • ")}</div>
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] text-black">{material.vendor?.name ?? "—"}</td>
                            {materialFields.map((field) => {
                              const raw = material.customFields[String(field.id)] ?? null;
                              return (
                                <td key={field.id} className="px-3 py-2.5 text-[12.5px] text-black whitespace-nowrap">
                                  {raw == null || raw === "" ? (
                                    <span className="text-slate-300">—</span>
                                  ) : field.dataType === "boolean" ? (
                                    raw ? "Yes" : "No"
                                  ) : (
                                    String(raw)
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">
                              <span className="font-semibold text-emerald-600">+{stock.received.toLocaleString()}</span>{" "}
                              <span className="text-slate-400">{material.unit}</span>
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">
                              <span className="font-semibold text-red-600">-{stock.used.toLocaleString()}</span>{" "}
                              <span className="text-slate-400">{material.unit}</span>
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] font-bold text-black whitespace-nowrap">
                              {stock.current.toLocaleString()} {material.unit}
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] text-black whitespace-nowrap">
                              {formatCost(stock.unitPrice)} / {material.unit}
                            </td>
                            <td className="px-3 py-2.5 text-[12.5px] font-semibold text-black whitespace-nowrap">{formatCost(stock.value)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex px-2 py-1 rounded-full text-[10.5px] font-bold ${STATUS_STYLES[stock.status]}`}>
                                {stock.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">{stock.lastUpdated ?? "—"}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              {isAdmin && (
                                <span className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingMaterial(material);
                                      setMaterialFormOpen(true);
                                    }}
                                    title="Edit material"
                                    className="p-1 rounded text-slate-300 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteMaterial(material)}
                                    title="Delete material"
                                    className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "transactions" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      {["Date", "Material", "Type", "Quantity", "Vendor / Work Area", "Amount", "Reference", ""].map((h) => (
                        <th key={h} className="py-2.5 px-3 text-[11px] font-medium text-blue-900 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-[12.5px] text-center text-slate-400">
                          No transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      allTransactions.map(({ material, tx }, i) => (
                        <tr key={tx.id} className={`border-b border-slate-100 last:border-0 hover:bg-blue-50/60 ${i % 2 === 1 ? "bg-slate-200/60" : "bg-white"}`}>
                          <td className="px-3 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">{tx.date}</td>
                          <td className="px-3 py-2.5 text-[12.5px] font-medium text-black whitespace-nowrap">{material.name}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`text-[11.5px] font-bold ${tx.type === "received" ? "text-emerald-600" : "text-red-600"}`}>
                              {tx.type === "received" ? "Received" : "Used"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-black whitespace-nowrap">
                            {tx.quantity.toLocaleString()} {material.unit}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-black whitespace-nowrap">
                            {tx.type === "received" ? tx.vendor?.name ?? "—" : tx.workArea || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[12.5px] text-black whitespace-nowrap">
                            {tx.type === "received" && tx.unitPrice != null ? formatCost(tx.quantity * tx.unitPrice) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">{tx.reference || "—"}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            {isAdmin && (
                              <button
                                onClick={() => setConfirmDeleteTx(tx)}
                                title="Delete transaction"
                                className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "vendors" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      {["Vendor", "Total Spend"].map((h) => (
                        <th key={h} className="py-2.5 px-3 text-[11px] font-medium text-blue-900 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendorSpend.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-10 text-[12.5px] text-center text-slate-400">
                          No vendor purchases recorded yet.
                        </td>
                      </tr>
                    ) : (
                      vendorSpend.map((v, i) => (
                        <tr key={v.name} className={`border-b border-slate-100 last:border-0 hover:bg-blue-50/60 ${i % 2 === 1 ? "bg-slate-200/60" : "bg-white"}`}>
                          <td className="px-3 py-2.5 text-[12.5px] font-medium text-black">{v.name}</td>
                          <td className="px-3 py-2.5 text-[12.5px] font-semibold text-black">{formatCost(v.spend)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeCustomTable && (
              <TableSheet
                key={activeCustomTable.id}
                tableId={activeCustomTable.id}
                isAdmin={isAdmin}
                tableName={activeCustomTable.name}
                detail={tableDetailQuery.data}
                isLoading={tableDetailQuery.isLoading}
                isError={tableDetailQuery.isError}
                errorMessage={getErrorMessage(tableDetailQuery.error, "Failed to load table.")}
                onCreateColumn={(payload) => createColumnMutation.mutateAsync({ tableId: activeCustomTable.id, payload })}
                onUpdateColumn={(id, payload) => updateColumnMutation.mutateAsync({ id, tableId: activeCustomTable.id, payload })}
                onDeleteColumn={(id) => deleteColumnMutation.mutateAsync({ id, tableId: activeCustomTable.id })}
                onCreateRow={(payload) => createRowMutation.mutateAsync({ tableId: activeCustomTable.id, payload })}
                onUpdateRow={(id, payload) => updateRowMutation.mutateAsync({ id, tableId: activeCustomTable.id, payload })}
                onDeleteRow={(id) => deleteRowMutation.mutateAsync({ id, tableId: activeCustomTable.id })}
                onImportSheet={(payload) => importSheetMutation.mutateAsync({ tableId: activeCustomTable.id, payload })}
              />
            )}
          </section>

        </div>
      )}

      {materialFormOpen && (
        <MaterialFormModal
          material={editingMaterial}
          fields={materialFields}
          onSave={handleSaveMaterial}
          onClose={() => {
            setMaterialFormOpen(false);
            setEditingMaterial(null);
          }}
        />
      )}

      {manageFieldsOpen && projectId && (
        <ManageFieldsModal
          fields={materialFields}
          onCreate={(payload) => createFieldMutation.mutateAsync({ projectId, payload })}
          onUpdate={(id, payload) => updateFieldMutation.mutateAsync({ id, projectId, payload })}
          onDelete={(id) => deleteFieldMutation.mutateAsync({ id, projectId })}
          onClose={() => setManageFieldsOpen(false)}
        />
      )}

      {addTableOpen && projectId && (
        <TableNameModal
          title="Add Tab"
          confirmLabel="Add Tab"
          onSave={async (name) => {
            const created = await createTableMutation.mutateAsync({ projectId, payload: { name } });
            setActiveTab(created.id);
          }}
          onClose={() => setAddTableOpen(false)}
        />
      )}

      {renamingTable && projectId && (
        <TableNameModal
          title="Rename Tab"
          initialName={renamingTable.name}
          confirmLabel="Save"
          onSave={async (name) => {
            await updateTableMutation.mutateAsync({ id: renamingTable.id, projectId, payload: { name } });
          }}
          onClose={() => setRenamingTable(null)}
        />
      )}

      <ConfirmationModal
        isOpen={!!confirmDeleteTable}
        onClose={() => setConfirmDeleteTable(null)}
        onConfirm={async () => {
          if (!confirmDeleteTable || !projectId) return;
          await deleteTableMutation.mutateAsync({ id: confirmDeleteTable.id, projectId });
          if (activeTab === confirmDeleteTable.id) setActiveTab("stock");
          setConfirmDeleteTable(null);
        }}
        title="Delete Tab"
        message={`Delete "${confirmDeleteTable?.name}"? All its columns and rows will be deleted too.`}
        confirmText="Delete"
        isLoading={deleteTableMutation.isPending}
      />

      {txModal && (
        <TransactionModal
          initialType={txModal.type}
          materials={materials}
          vendors={vendors}
          defaultMaterialId={txModal.materialId}
          onSave={handleSaveTransaction}
          onClose={() => setTxModal(null)}
        />
      )}

      <ConfirmationModal
        isOpen={!!confirmDeleteMaterial}
        onClose={() => setConfirmDeleteMaterial(null)}
        onConfirm={async () => {
          if (!confirmDeleteMaterial || !projectId) return;
          try {
            await deleteMaterialMutation.mutateAsync({ id: confirmDeleteMaterial.id, projectId });
            setConfirmDeleteMaterial(null);
          } catch (err) {
            setActionError(getErrorMessage(err, "Failed to delete material."));
            setConfirmDeleteMaterial(null);
          }
        }}
        title="Delete Material"
        message={`Delete "${confirmDeleteMaterial?.name}"? Its entire transaction history will be deleted too.`}
        confirmText="Delete"
        isLoading={deleteMaterialMutation.isPending}
      />

      <ConfirmationModal
        isOpen={!!confirmDeleteTx}
        onClose={() => setConfirmDeleteTx(null)}
        onConfirm={async () => {
          if (!confirmDeleteTx || !projectId) return;
          try {
            await deleteTransactionMutation.mutateAsync({ id: confirmDeleteTx.id, projectId });
            setConfirmDeleteTx(null);
          } catch (err) {
            setActionError(getErrorMessage(err, "Failed to delete transaction."));
            setConfirmDeleteTx(null);
          }
        }}
        title="Delete Transaction"
        message="Delete this transaction? This can't be undone."
        confirmText="Delete"
        isLoading={deleteTransactionMutation.isPending}
      />
    </div>
  );
};

export default Materials;
