import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  Download,
  Printer,
  RefreshCw,
  Loader2,
  AlertCircle,
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  PackageX,
  FileStack,
  Users,
  Repeat,
  TrendingUp,
  TrendingDown,
  PanelRightClose,
  PanelRightOpen,
  Eye,
  ArrowRightLeft,
  PackagePlus,
  FileDown,
  Clock3,
} from "lucide-react";
import { useProjects } from "../../projects/hooks/useProjects";
import { useWorkspaceInventoryQuery } from "../../inventory/hooks/useInventory";
import { useWorkspaceProcurementQuery } from "../../procurement/hooks/useProcurement";
import { useWorkspaceWarehousesQuery, useWorkspaceVendorsQuery } from "../../inventory/hooks/useInventory";
import {
  useReportSummaryQuery,
  useReportActivityQuery,
  useLogReportActivityMutation,
} from "../hooks/useReports";
import { ReportFilters } from "../api/reports.api";
import { formatCost, toNumber } from "../../procurement/api/procurement.api";
import { getErrorMessage } from "../../../lib/errors";
import { useAuth } from "../../../context/AuthProvider";
import Sparkline from "../../../components/charts/Sparkline";
import LineChart from "../../../components/charts/LineChart";
import DonutChart from "../../../components/charts/DonutChart";
import HorizontalBarChart from "../../../components/charts/HorizontalBarChart";
import StackedBarChart from "../../../components/charts/StackedBarChart";
import ScatterChart from "../../../components/charts/ScatterChart";
import ReportDrawer, { ReportDrawerColumn } from "../components/ReportDrawer";
import InventoryItemDrawer from "../../inventory/components/InventoryItemDrawer";

const CATEGORY_COLORS: Record<string, string> = { hardware: "#3730A3", software: "#7E22CE", service: "#0F766E" };
const CATEGORY_LABELS: Record<string, string> = { hardware: "Hardware", software: "Software", service: "Service" };
const STATUS_COLORS: Record<string, string> = { pending: "#B45309", approved: "#6D28D9", ordered: "#1E3A8A", delivered: "#15803D" };
const STATUS_LABELS: Record<string, string> = { pending: "Pending", approved: "Approved", ordered: "Ordered", delivered: "Delivered" };
const MOVEMENT_SERIES = [
  { key: "receipt", label: "Received", color: "#15803D" },
  { key: "issue", label: "Issued", color: "#B91C1C" },
  { key: "adjustment", label: "Adjusted", color: "#B45309" },
  { key: "transferred", label: "Transferred", color: "#1E3A8A" },
];
const DEAD_STOCK_STYLES: Record<string, { bg: string; fg: string }> = {
  Healthy: { bg: "#DCFCE7", fg: "#15803D" },
  "Slow Moving": { bg: "#FEF3C7", fg: "#B45309" },
  "Dead Stock": { bg: "#FFEDD5", fg: "#C2410C" },
  Critical: { bg: "#FEE2E2", fg: "#B91C1C" },
};

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const CardHeader: React.FC<{ icon: React.ElementType; title: string; subtitle?: string }> = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200">
    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100">
      <Icon className="w-4 h-4 text-slate-600" />
    </div>
    <div className="min-w-0">
      <div className="font-semibold text-[14px] text-slate-900">{title}</div>
      {subtitle && <div className="text-[11px] text-slate-500">{subtitle}</div>}
    </div>
  </div>
);

const ClickableCard: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="w-full text-left transition-shadow rounded-xl hover:shadow-md">
    {children}
  </button>
);

const KpiCard: React.FC<{
  label: string;
  value: string;
  icon: React.ElementType;
  trendPct: number;
  sparkline: { value: number }[];
}> = ({ label, value, icon: Icon, trendPct, sparkline }) => (
  <div className="p-4 bg-white border rounded-lg border-slate-200">
    <div className="flex items-start justify-between mb-2">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 bg-blue-50">
        <Icon className="w-4 h-4 text-blue-700" />
      </div>
    </div>
    <div className="text-[20px] font-bold leading-none tracking-tight text-slate-900 mb-2">{value}</div>
    <div className="flex items-center justify-between">
      <span className={`flex items-center gap-1 text-[11px] font-medium ${trendPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
        {trendPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(trendPct)}%
      </span>
      <Sparkline data={sparkline} color={trendPct >= 0 ? "#15803D" : "#B91C1C"} />
    </div>
  </div>
);

type DrawerConfig = {
  title: string;
  summary: { label: string; value: string }[];
  records: Record<string, any>[];
  columns: ReportDrawerColumn[];
  timeline?: { label: string; date: string }[];
  exportFileName: string;
};

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: projects = [] } = useProjects();
  const warehousesQuery = useWorkspaceWarehousesQuery();
  const vendorsQuery = useWorkspaceVendorsQuery();
  const warehouses = warehousesQuery.data ?? [];
  const vendors = vendorsQuery.data ?? [];

  const inventoryQuery = useWorkspaceInventoryQuery();
  const procurementQuery = useWorkspaceProcurementQuery();
  const inventoryItems = inventoryQuery.data ?? [];
  const procurementItems = procurementQuery.data ?? [];

  const [range, setRange] = useState<ReportFilters["range"]>("30d");
  const [projectId, setProjectId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [vendorId, setVendorId] = useState<number | "">("");
  const [category, setCategory] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [deadStockSearch, setDeadStockSearch] = useState("");
  const [inventoryDrawerItemId, setInventoryDrawerItemId] = useState<number | null>(null);

  const filters: ReportFilters = useMemo(
    () => ({
      range,
      ...(projectId ? { projectId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(category ? { category } : {}),
    }),
    [range, projectId, warehouseId, vendorId, category],
  );

  const summaryQuery = useReportSummaryQuery(filters);
  const summary = summaryQuery.data;

  const exportedActivityQuery = useReportActivityQuery("exported");
  const viewedActivityQuery = useReportActivityQuery("viewed");
  const logActivityMutation = useLogReportActivityMutation();

  const loggedView = useRef(false);
  useEffect(() => {
    if (!loggedView.current) {
      loggedView.current = true;
      logActivityMutation.mutate({ reportType: "dashboard", action: "viewed" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invRecords = useMemo(
    () => inventoryItems.map((i) => ({ ...i, value: i.quantity * toNumber(i.averageCost) })),
    [inventoryItems],
  );
  const procRecords = useMemo(
    () =>
      procurementItems.map((p) => ({
        ...p,
        vendorLabel: p.vendor?.name || p.vendorName || "--",
        cost: p.quantity * toNumber(p.unitCost ?? p.estimatedCost),
      })),
    [procurementItems],
  );

  const INV_COLUMNS: ReportDrawerColumn[] = [
    { key: "itemName", label: "Item" },
    { key: "category", label: "Category", format: (v) => CATEGORY_LABELS[v] || v },
    { key: "quantity", label: "Quantity" },
    { key: "value", label: "Value", format: (v) => formatCost(v) },
    { key: "projectName", label: "Project" },
    { key: "status", label: "Status" },
  ];
  const PROC_COLUMNS: ReportDrawerColumn[] = [
    { key: "itemName", label: "Item" },
    { key: "poNumber", label: "PO #" },
    { key: "vendorLabel", label: "Vendor" },
    { key: "quantity", label: "Qty" },
    { key: "cost", label: "Cost", format: (v) => formatCost(v) },
    { key: "status", label: "Status", format: (v) => STATUS_LABELS[v] || v },
  ];

  const drawerConfigs = useMemo<Record<string, DrawerConfig>>(() => {
    if (!summary) return {} as Record<string, DrawerConfig>;
    return {
      "procurement-cost-trend": {
        title: "Procurement Cost Trend",
        summary: summary.procurementCostTrend.map((m) => ({ label: m.month, value: formatCost(m.value) })),
        records: procRecords,
        columns: PROC_COLUMNS,
        exportFileName: "procurement-cost-trend",
      },
      "spend-by-category": {
        title: "Procurement Spend by Category",
        summary: summary.spendByCategory.map((c) => ({ label: CATEGORY_LABELS[c.category], value: formatCost(c.value) })),
        records: procRecords,
        columns: PROC_COLUMNS,
        exportFileName: "spend-by-category",
      },
      "inventory-value-by-category": {
        title: "Inventory Value by Category",
        summary: summary.inventoryValueByCategory.map((c) => ({ label: CATEGORY_LABELS[c.category], value: formatCost(c.value) })),
        records: invRecords,
        columns: INV_COLUMNS,
        exportFileName: "inventory-value-by-category",
      },
      "po-status": {
        title: "Purchase Order Status",
        summary: summary.poStatusBreakdown.map((s) => ({ label: STATUS_LABELS[s.status], value: String(s.count) })),
        records: procRecords,
        columns: PROC_COLUMNS,
        exportFileName: "po-status",
      },
      "warehouse-utilization": {
        title: "Warehouse Utilization",
        summary: summary.warehouseUtilization.map((w) => ({
          label: w.name,
          value: `${w.used} / ${w.capacity || "--"}`,
        })),
        records: invRecords.filter((i) => i.warehouse),
        columns: INV_COLUMNS,
        exportFileName: "warehouse-utilization",
      },
      "stock-movement": {
        title: "Stock Movement Trend",
        summary: [],
        records: invRecords,
        columns: INV_COLUMNS,
        timeline: summary.stockMovementTrend.map((m) => ({
          label: `Received ${m.receipt} · Issued ${m.issue} · Adjusted ${m.adjustment} · Transferred ${m.transferred}`,
          date: `${m.month}-01`,
        })),
        exportFileName: "stock-movement",
      },
      "top-purchased-items": {
        title: "Top Purchased Items",
        summary: summary.topPurchasedItems.map((p) => ({ label: p.itemName, value: formatCost(p.value) })),
        records: procRecords,
        columns: PROC_COLUMNS,
        exportFileName: "top-purchased-items",
      },
      "project-consumption": {
        title: "Project Material Consumption",
        summary: summary.projectMaterialConsumption.map((p) => ({ label: p.projectName, value: formatCost(p.value) })),
        records: invRecords,
        columns: INV_COLUMNS,
        exportFileName: "project-consumption",
      },
      "inventory-aging": {
        title: "Inventory Aging",
        summary: [],
        records: invRecords,
        columns: INV_COLUMNS,
        exportFileName: "inventory-aging",
      },
      "vendor-performance": {
        title: "Vendor Performance",
        summary: summary.vendorPerformance.map((v) => ({
          label: v.name,
          value: `${v.rating ?? "--"}★ · ${v.avgDeliveryDays ?? "--"}d · ${formatCost(v.purchaseVolume)}`,
        })),
        records: procRecords.filter((p) => p.vendor),
        columns: PROC_COLUMNS,
        exportFileName: "vendor-performance",
      },
    };
  }, [summary, invRecords, procRecords]);

  const filteredDeadStock = useMemo(() => {
    if (!summary) return [];
    const q = deadStockSearch.trim().toLowerCase();
    if (!q) return summary.deadStock;
    return summary.deadStock.filter((d) => d.itemName.toLowerCase().includes(q) || (d.sku || "").toLowerCase().includes(q));
  }, [summary, deadStockSearch]);

  const refresh = async () => {
    await Promise.all([summaryQuery.refetch(), inventoryQuery.refetch(), procurementQuery.refetch()]);
  };

  const handleExportExcel = async () => {
    if (!summary) return;
    const workbook = XLSX.utils.book_new();
    const deadStockSheet = XLSX.utils.json_to_sheet(
      summary.deadStock.map((d) => ({
        Item: d.itemName,
        SKU: d.sku || "",
        Warehouse: d.warehouse || "",
        Quantity: d.quantity,
        Value: d.value,
        "Days Since Movement": d.daysSinceMovement,
        Category: d.category,
        Status: d.status,
        "Suggested Action": d.suggestedAction,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, deadStockSheet, "Dead Stock");
    const vendorSheet = XLSX.utils.json_to_sheet(
      summary.vendorPerformance.map((v) => ({
        Vendor: v.name,
        Rating: v.rating ?? "",
        "Avg Delivery Days": v.avgDeliveryDays ?? "",
        "Purchase Volume": v.purchaseVolume,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, vendorSheet, "Vendor Performance");
    XLSX.writeFile(workbook, "reports-export.xlsx");
    await logActivityMutation.mutateAsync({ reportType: "dashboard", action: "exported", format: "xlsx" });
  };

  const handleQuickGenerate = async (
    reportType: string,
    label: string,
    build: () => Record<string, any>[],
  ) => {
    const rows = build();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, label.slice(0, 31));
    XLSX.writeFile(workbook, `${reportType}-report.xlsx`);
    await logActivityMutation.mutateAsync({ reportType, action: "exported", format: "xlsx" });
  };

  const loading = summaryQuery.isLoading || inventoryQuery.isLoading || procurementQuery.isLoading;
  const error = summaryQuery.isError ? getErrorMessage(summaryQuery.error, "Failed to load reports.") : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading reports…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{error || "No data available."}</p>
      </div>
    );
  }

  const k = summary.kpis;

  return (
    <div className="w-full p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-400 mb-1">Dashboard / Reports</div>
          <h1 className="text-[20px] font-bold text-slate-900">Reports &amp; Analytics</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as ReportFilters["range"])}
              className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900"
            >
              <option value="30d">Last 30 days</option>
              <option value="month">This month</option>
              <option value="3m">Last 3 months</option>
              <option value="12m">Last 12 months</option>
              <option value="year">This year</option>
            </select>
            <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 max-w-[140px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : "")}
              className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 max-w-[140px]"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : "")}
              className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 max-w-[140px]"
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900"
            >
              <option value="">All Categories</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="service">Service</option>
            </select>
            <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
          </div>
          <button onClick={refresh} className="flex items-center justify-center w-8 h-8 border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50" title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50">
            <Download size={13} /> Export Excel
          </button>
          <button
            onClick={async () => {
              window.print();
              await logActivityMutation.mutateAsync({ reportType: "dashboard", action: "exported", format: "pdf" });
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <Printer size={13} /> Export PDF
          </button>
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="flex items-center justify-center w-8 h-8 border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Inventory Value" value={formatCost(k.totalInventoryValue.value)} icon={DollarSign} trendPct={k.totalInventoryValue.trendPct} sparkline={k.totalInventoryValue.sparkline} />
        <KpiCard label="Monthly Procurement Cost" value={formatCost(k.monthlyProcurementCost.value)} icon={ShoppingCart} trendPct={k.monthlyProcurementCost.trendPct} sparkline={k.monthlyProcurementCost.sparkline} />
        <KpiCard label="Total Inventory Items" value={String(k.totalInventoryItems.value)} icon={Package} trendPct={k.totalInventoryItems.trendPct} sparkline={k.totalInventoryItems.sparkline} />
        <KpiCard label="Low Stock Items" value={String(k.lowStockItems.value)} icon={AlertTriangle} trendPct={k.lowStockItems.trendPct} sparkline={k.lowStockItems.sparkline} />
        <KpiCard label="Out of Stock Items" value={String(k.outOfStockItems.value)} icon={PackageX} trendPct={k.outOfStockItems.trendPct} sparkline={k.outOfStockItems.sparkline} />
        <KpiCard label="Active Purchase Orders" value={String(k.activePurchaseOrders.value)} icon={FileStack} trendPct={k.activePurchaseOrders.trendPct} sparkline={k.activePurchaseOrders.sparkline} />
        <KpiCard label="Active Vendors" value={String(k.activeVendors.value)} icon={Users} trendPct={k.activeVendors.trendPct} sparkline={k.activeVendors.sparkline} />
        <KpiCard label="Inventory Turnover" value={k.inventoryTurnover.value.toFixed(2)} icon={Repeat} trendPct={k.inventoryTurnover.trendPct} sparkline={k.inventoryTurnover.sparkline} />
      </div>

      <div className={`grid grid-cols-1 gap-4 ${sidebarOpen ? "xl:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
        <div className="flex flex-col min-w-0 gap-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={TrendingUp} title="Procurement Cost Trend" subtitle="Monthly spending" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("procurement-cost-trend")}>
                  <LineChart data={summary.procurementCostTrend.map((m) => ({ label: m.month.slice(5), value: m.value }))} formatValue={formatCost} />
                </ClickableCard>
              </div>
            </Card>
            <Card>
              <CardHeader icon={ShoppingCart} title="Procurement Spend by Category" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("spend-by-category")}>
                  <DonutChart
                    data={summary.spendByCategory.map((c) => ({ label: CATEGORY_LABELS[c.category], value: c.value, color: CATEGORY_COLORS[c.category] }))}
                    formatValue={formatCost}
                  />
                </ClickableCard>
              </div>
            </Card>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Package} title="Inventory Value by Category" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("inventory-value-by-category")}>
                  <HorizontalBarChart
                    data={summary.inventoryValueByCategory.map((c) => ({ label: CATEGORY_LABELS[c.category], value: c.value, color: CATEGORY_COLORS[c.category] }))}
                    formatValue={formatCost}
                  />
                </ClickableCard>
              </div>
            </Card>
            <Card>
              <CardHeader icon={FileStack} title="Purchase Order Status" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("po-status")}>
                  <DonutChart
                    data={summary.poStatusBreakdown.map((s) => ({ label: STATUS_LABELS[s.status], value: s.count, color: STATUS_COLORS[s.status] }))}
                    formatValue={(v) => String(v)}
                  />
                </ClickableCard>
              </div>
            </Card>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Package} title="Warehouse Utilization" />
              <div className="p-5 space-y-3">
                {summary.warehouseUtilization.length === 0 ? (
                  <p className="text-[12px] text-slate-400">No warehouses yet.</p>
                ) : (
                  summary.warehouseUtilization.map((w) => {
                    const pct = w.capacity > 0 ? Math.min(100, Math.round((w.used / w.capacity) * 100)) : 0;
                    return (
                      <button key={w.id} onClick={() => setDrawerKey("warehouse-utilization")} className="block w-full text-left">
                        <div className="flex items-center justify-between mb-1 text-[12px]">
                          <span className="font-medium text-slate-700">{w.name}</span>
                          <span className="text-slate-500">
                            {w.used} / {w.capacity || "--"} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-blue-700 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>
            <Card>
              <CardHeader icon={ArrowRightLeft} title="Stock Movement Trend" subtitle="Monthly comparison" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("stock-movement")}>
                  <StackedBarChart
                    data={summary.stockMovementTrend.map((m) => ({ group: m.month.slice(5), values: { receipt: m.receipt, issue: m.issue, adjustment: m.adjustment, transferred: m.transferred } }))}
                    series={MOVEMENT_SERIES}
                  />
                </ClickableCard>
              </div>
            </Card>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={ShoppingCart} title="Top Purchased Items" subtitle="This year" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("top-purchased-items")}>
                  <HorizontalBarChart data={summary.topPurchasedItems.map((p) => ({ label: p.itemName, value: p.value }))} formatValue={formatCost} />
                </ClickableCard>
              </div>
            </Card>
            <Card>
              <CardHeader icon={Package} title="Project Material Consumption" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("project-consumption")}>
                  <HorizontalBarChart data={summary.projectMaterialConsumption.map((p) => ({ label: p.projectName, value: p.value }))} formatValue={formatCost} color="#0F766E" />
                </ClickableCard>
              </div>
            </Card>
          </div>

          {/* Row 5 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Clock3} title="Inventory Aging" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("inventory-aging")}>
                  <StackedBarChart
                    data={summary.inventoryAging.map((row: any) => ({
                      group: CATEGORY_LABELS[row.category] || row.category,
                      values: {
                        "0-30": Number(row["0-30 Days"]) || 0,
                        "31-90": Number(row["31-90 Days"]) || 0,
                        "91-180": Number(row["91-180 Days"]) || 0,
                        "180+": Number(row["180+ Days"]) || 0,
                      },
                    }))}
                    series={[
                      { key: "0-30", label: "0-30 Days", color: "#15803D" },
                      { key: "31-90", label: "31-90 Days", color: "#B45309" },
                      { key: "91-180", label: "91-180 Days", color: "#C2410C" },
                      { key: "180+", label: "180+ Days", color: "#B91C1C" },
                    ]}
                    formatValue={formatCost}
                  />
                </ClickableCard>
              </div>
            </Card>
            <Card>
              <CardHeader icon={Users} title="Vendor Performance" subtitle="Delivery time vs. rating" />
              <div className="p-5">
                <ClickableCard onClick={() => setDrawerKey("vendor-performance")}>
                  <ScatterChart
                    data={summary.vendorPerformance
                      .filter((v) => v.avgDeliveryDays !== null && v.rating !== null)
                      .map((v) => ({ label: v.name, x: v.avgDeliveryDays as number, y: v.rating as number, size: v.purchaseVolume }))}
                    xLabel="Avg delivery days"
                    yLabel="Rating"
                    formatSize={formatCost}
                  />
                </ClickableCard>
              </div>
            </Card>
          </div>

          {/* Dead stock table */}
          <Card>
            <CardHeader icon={PackageX} title="Dead Stock &amp; Slow Moving Inventory" />
            <div className="p-4">
              <input
                value={deadStockSearch}
                onChange={(e) => setDeadStockSearch(e.target.value)}
                placeholder="Search items, SKU..."
                className="mb-3 w-64 px-3 py-2 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
              <div className="overflow-x-auto border rounded-lg border-slate-200">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">Item</th>
                      <th className="px-3 py-2 font-medium text-left">SKU</th>
                      <th className="px-3 py-2 font-medium text-left">Warehouse</th>
                      <th className="px-3 py-2 font-medium text-left">Stock</th>
                      <th className="px-3 py-2 font-medium text-left">Value</th>
                      <th className="px-3 py-2 font-medium text-left">Days Since Movement</th>
                      <th className="px-3 py-2 font-medium text-left">Category</th>
                      <th className="px-3 py-2 font-medium text-left">Status</th>
                      <th className="px-3 py-2 font-medium text-left">Suggested Action</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeadStock.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                          No inventory items match.
                        </td>
                      </tr>
                    ) : (
                      filteredDeadStock.map((d) => {
                        const style = DEAD_STOCK_STYLES[d.status];
                        return (
                          <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-800">{d.itemName}</td>
                            <td className="px-3 py-2 text-slate-500">{d.sku || "--"}</td>
                            <td className="px-3 py-2 text-slate-600">{d.warehouse || "--"}</td>
                            <td className="px-3 py-2 text-slate-600">{d.quantity}</td>
                            <td className="px-3 py-2 text-slate-600">{formatCost(d.value)}</td>
                            <td className="px-3 py-2 text-slate-600">{d.daysSinceMovement}</td>
                            <td className="px-3 py-2 text-slate-600">{CATEGORY_LABELS[d.category] || d.category}</td>
                            <td className="px-3 py-2">
                              <span
                                className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium"
                                style={{ background: style.bg, color: style.fg }}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{d.suggestedAction}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => setInventoryDrawerItemId(d.id)} className="flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-100" title="View">
                                  <Eye size={13} />
                                </button>
                                <button onClick={() => setInventoryDrawerItemId(d.id)} className="flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-100" title="Transfer">
                                  <ArrowRightLeft size={13} />
                                </button>
                                <button onClick={() => setInventoryDrawerItemId(d.id)} className="flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-100" title="Adjust">
                                  <PackagePlus size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Footer */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader icon={FileDown} title="Recent Report Exports" />
              <div className="p-4">
                {(exportedActivityQuery.data ?? []).length === 0 ? (
                  <p className="text-[12px] text-slate-400">No exports yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(exportedActivityQuery.data ?? []).slice(0, 6).map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-600 capitalize">{a.reportType.replace("_", " ")}</span>
                        <span className="text-slate-400">{new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader icon={Eye} title="Recently Viewed Reports" />
              <div className="p-4">
                {(viewedActivityQuery.data ?? []).length === 0 ? (
                  <p className="text-[12px] text-slate-400">No views recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(viewedActivityQuery.data ?? []).slice(0, 6).map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-600 capitalize">{a.reportType.replace("_", " ")}</span>
                        <span className="text-slate-400">{new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader icon={Clock3} title="Scheduled Reports" />
              <div className="p-4">
                <p className="text-[12px] text-slate-400">Scheduling isn't set up yet. Use Quick Generate below for an on-demand export.</p>
              </div>
            </Card>
            <Card>
              <CardHeader icon={Download} title="Quick Generate Report" />
              <div className="flex flex-wrap gap-2 p-4">
                <button onClick={() => handleQuickGenerate("inventory", "Inventory", () => invRecords)} className="px-3 py-1.5 text-[11px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50">
                  Inventory
                </button>
                <button onClick={() => handleQuickGenerate("procurement", "Procurement", () => procRecords)} className="px-3 py-1.5 text-[11px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50">
                  Procurement
                </button>
                <button
                  onClick={() =>
                    handleQuickGenerate("vendor", "Vendor", () =>
                      summary.vendorPerformance.map((v) => ({ Vendor: v.name, Rating: v.rating ?? "", "Avg Delivery Days": v.avgDeliveryDays ?? "", "Purchase Volume": v.purchaseVolume })),
                    )
                  }
                  className="px-3 py-1.5 text-[11px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  Vendor
                </button>
                <button
                  onClick={() =>
                    handleQuickGenerate("warehouse", "Warehouse", () =>
                      summary.warehouseUtilization.map((w) => ({ Warehouse: w.name, Used: w.used, Capacity: w.capacity })),
                    )
                  }
                  className="px-3 py-1.5 text-[11px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  Warehouse
                </button>
                <button
                  onClick={() =>
                    handleQuickGenerate("project_consumption", "Project Consumption", () =>
                      summary.projectMaterialConsumption.map((p) => ({ Project: p.projectName, Value: p.value })),
                    )
                  }
                  className="px-3 py-1.5 text-[11px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  Project Consumption
                </button>
                <button
                  onClick={() =>
                    handleQuickGenerate("financial_summary", "Financial Summary", () => [
                      { Metric: "Total Inventory Value", Value: k.totalInventoryValue.value },
                      { Metric: "Monthly Procurement Cost", Value: k.monthlyProcurementCost.value },
                      { Metric: "Inventory Value Trend %", Value: summary.insights.inventoryValueTrendPct },
                      { Metric: "Procurement Cost Trend %", Value: summary.insights.procurementCostTrendPct },
                    ])
                  }
                  className="px-3 py-1.5 text-[11px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  Financial Summary
                </button>
              </div>
            </Card>
          </div>
        </div>

        {/* Right sidebar */}
        {sidebarOpen && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader icon={AlertTriangle} title="Recent Alerts" />
              <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
                {summary.alerts.delayedPOs.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold tracking-wide uppercase text-slate-400">Delayed Purchase Orders</div>
                    {summary.alerts.delayedPOs.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11.5px] py-0.5">
                        <span className="text-slate-600 truncate">{p.itemName}</span>
                        <span className="text-red-600">{new Date(p.neededByDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </div>
                    ))}
                  </div>
                )}
                {summary.alerts.vendorDelays.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold tracking-wide uppercase text-slate-400">Vendor Delays</div>
                    {summary.alerts.vendorDelays.slice(0, 5).map((v, i) => (
                      <div key={i} className="flex items-center justify-between text-[11.5px] py-0.5">
                        <span className="text-slate-600 truncate">{v.vendorName}</span>
                        <span className="text-red-600 truncate">{v.itemName}</span>
                      </div>
                    ))}
                  </div>
                )}
                {summary.alerts.contractsExpiring.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold tracking-wide uppercase text-slate-400">Contracts Expiring Soon</div>
                    {summary.alerts.contractsExpiring.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-[11.5px] py-0.5">
                        <span className="text-slate-600 truncate">{c.name}</span>
                        <span className="text-amber-700">{new Date(c.contractExpiryDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div className="mb-1 text-[10px] font-semibold tracking-wide uppercase text-slate-400">Pending Inventory Audit</div>
                  <p className="text-[11.5px] text-slate-400">No audit workflow set up yet.</p>
                </div>
                {summary.alerts.delayedPOs.length === 0 &&
                  summary.alerts.vendorDelays.length === 0 &&
                  summary.alerts.contractsExpiring.length === 0 && (
                    <p className="text-[12px] text-slate-400">Nothing needs attention right now.</p>
                  )}
              </div>
            </Card>
            <Card>
              <CardHeader icon={TrendingUp} title="Quick Insights" />
              <div className="p-4 space-y-2 text-[12px]">
                <p className="text-slate-600">
                  Inventory value {summary.insights.inventoryValueTrendPct >= 0 ? "increased" : "decreased"}{" "}
                  <span className="font-semibold">{Math.abs(summary.insights.inventoryValueTrendPct)}%</span>
                </p>
                <p className="text-slate-600">
                  Procurement cost {summary.insights.procurementCostTrendPct >= 0 ? "increased" : "decreased"}{" "}
                  <span className="font-semibold">{Math.abs(summary.insights.procurementCostTrendPct)}%</span>
                </p>
                <p className="text-slate-600">
                  Top vendor this month: <span className="font-semibold">{summary.insights.topVendorThisMonth || "--"}</span>
                </p>
                <p className="text-slate-600">
                  Highest consuming project: <span className="font-semibold">{summary.insights.highestConsumingProject || "--"}</span>
                </p>
                <p className="text-slate-600">
                  Lowest stock category:{" "}
                  <span className="font-semibold">
                    {summary.insights.lowestStockCategory ? CATEGORY_LABELS[summary.insights.lowestStockCategory] : "--"}
                  </span>
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>

      {drawerKey && drawerConfigs[drawerKey] && (
        <ReportDrawer
          reportKey={drawerKey}
          title={drawerConfigs[drawerKey].title}
          onClose={() => setDrawerKey(null)}
          summary={drawerConfigs[drawerKey].summary}
          records={drawerConfigs[drawerKey].records}
          columns={drawerConfigs[drawerKey].columns}
          timeline={drawerConfigs[drawerKey].timeline}
          exportFileName={drawerConfigs[drawerKey].exportFileName}
        />
      )}

      <InventoryItemDrawer
        itemId={inventoryDrawerItemId}
        onClose={() => setInventoryDrawerItemId(null)}
        isAdmin={isAdmin}
        warehouses={warehouses}
        onChanged={() => inventoryQuery.refetch()}
      />
    </div>
  );
};

export default ReportsPage;
