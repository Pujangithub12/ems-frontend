import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Plus } from "lucide-react";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { useOrganizationVendorsQuery } from "../hooks/useInventory";

interface VendorFieldProps {
  vendorId: number | null;
  /** Fires with the picked vendor's id (or null for "No vendor"). */
  onSelect: (vendorId: number | null) => void;
}

const VendorField: React.FC<VendorFieldProps> = ({ vendorId, onSelect }) => {
  const vendorsQuery = useOrganizationVendorsQuery();
  const vendors = vendorsQuery.data ?? [];
  const organizationId = useOrganizationId();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1 min-w-0">
        <select
          value={vendorId ?? ""}
          onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
          className={`w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-400 ${vendorId ? "" : "text-slate-400"}`}
        >
          <option value="">No vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
      </div>
      <button
        type="button"
        onClick={() => navigate(`/${organizationId}/vendors`)}
        className="flex items-center flex-shrink-0 gap-1 px-1 py-1 text-[11px] font-medium whitespace-nowrap text-blue-700 hover:text-blue-800 hover:underline"
      >
        <Plus size={11} /> Add vendor
      </button>
    </div>
  );
};

export default VendorField;
