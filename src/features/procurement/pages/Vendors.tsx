import React, { useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  MapPin,
  CalendarClock,
  Hash,
  Phone,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { Vendor } from "../../../types";
import { useOrganizationVendorsQuery, useDeleteVendorMutation } from "../../inventory/hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";
import ConfirmationModal from "../../../components/ConfirmationModal";
import VendorFormModal from "../../inventory/components/VendorFormModal";

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "--";

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; iconBg: string }> = ({ label, value, icon, iconBg }) => (
  <div className="p-3 bg-white border rounded-xl shadow-md border-slate-200">
    <div className="flex items-start justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 ring-1 ring-black/5 ${iconBg}`}>{icon}</div>
    </div>
    <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
  </div>
);

/**
 * Organization-wide vendor directory (under the Procurement group). Backed by the
 * same vendor CRUD the inventory/procurement "Add vendor" pickers use, so a
 * vendor added here shows up in every vendor dropdown and vice-versa.
 */
const VendorsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const vendorsQuery = useOrganizationVendorsQuery();
  const vendors = vendorsQuery.data ?? [];
  const loading = vendorsQuery.isLoading;
  const error = vendorsQuery.isError
    ? getErrorMessage(vendorsQuery.error, "Failed to load vendors.")
    : null;
  const [refreshing, setRefreshing] = useState(false);

  const deleteMutation = useDeleteVendorMutation();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await vendorsQuery.refetch();
    setRefreshing(false);
  };

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? vendors.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            (v.contactPerson || "").toLowerCase().includes(q) ||
            (v.code || "").toLowerCase().includes(q) ||
            (v.location || "").toLowerCase().includes(q) ||
            (v.contact || "").toLowerCase().includes(q) ||
            (v.email || "").toLowerCase().includes(q),
        )
      : vendors;
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, search]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const soon = now + 30 * 24 * 60 * 60 * 1000;
    const expiringSoon = vendors.filter(
      (v) => v.contractExpiryDate && new Date(v.contractExpiryDate).getTime() <= soon,
    ).length;
    return {
      total: vendors.length,
      withContact: vendors.filter((v) => !!v.contact).length,
      expiringSoon,
    };
  }, [vendors]);

  const openCreateForm = () => {
    setEditingVendor(null);
    setShowForm(true);
  };

  const openEditForm = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingVendor(null);
  };

  const handleSaved = async () => {
    await vendorsQuery.refetch();
    closeForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      await vendorsQuery.refetch();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete vendor."));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading vendors…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{error}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Total Vendors" value={String(kpis.total)} icon={<Building2 className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="With Phone Number" value={String(kpis.withContact)} icon={<Phone className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" />
            <KpiCard label="Contracts Expiring (30d)" value={String(kpis.expiringSoon)} icon={<CalendarClock className="w-4 h-4 text-red-700" />} iconBg="bg-red-50" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors, code, location, phone, email..."
                className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              {isAdmin && (
                <button
                  onClick={openCreateForm}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors shadow-sm"
                >
                  <Plus size={14} /> Add Vendor
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {filteredVendors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                  <Building2 className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                  No vendors{search ? " match your search" : " yet"}
                </h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  {isAdmin && !search
                    ? "Add a vendor to start tracking suppliers."
                    : "Try adjusting your search."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">Company Name</th>
                      <th className="px-3 py-2 font-medium text-left">Code</th>
                      <th className="px-3 py-2 font-medium text-left">Location</th>
                      <th className="px-3 py-2 font-medium text-left">Phone</th>
                      <th className="px-3 py-2 font-medium text-left">Email</th>
                      <th className="px-3 py-2 font-medium text-left">Contract Expiry</th>
                      <th className="px-3 py-2 font-medium text-left">Added</th>
                      {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.map((v) => (
                      <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 text-[11px] font-semibold text-blue-900 rounded-full bg-blue-50">
                              {v.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-800">{v.name}</div>
                              {v.contactPerson && <div className="text-slate-400 text-[11px]">{v.contactPerson}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {v.code ? (
                            <span className="inline-flex items-center gap-1">
                              <Hash size={11} className="text-slate-400" />
                              {v.code}
                            </span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {v.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} className="text-slate-400" />
                              {v.location}
                            </span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {v.contact ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" />
                              {v.contact}
                            </span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{v.email || "--"}</td>
                        <td className="px-3 py-2 text-slate-600">{formatDate(v.contractExpiryDate)}</td>
                        <td className="px-3 py-2 text-slate-500">{formatDate(v.createdAt)}</td>
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditForm(v)}
                                title="Edit"
                                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(v)}
                                title="Delete"
                                className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit vendor modal — shared with VendorField's "Add vendor" shortcut elsewhere in the app. */}
      {showForm && <VendorFormModal editingVendor={editingVendor} onClose={closeForm} onSaved={handleSaved} />}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Vendor"
        message={`Delete "${deleteTarget?.name}"? Items and purchases referencing this vendor will keep their records but lose the vendor link. This cannot be undone.`}
      />
    </div>
  );
};

export default VendorsPage;
