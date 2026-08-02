import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Plus, Loader2, Search } from "lucide-react";
import { useAuth, Organization } from "../context/AuthProvider";

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

type SwitchOrganizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SwitchOrganizationModal: React.FC<SwitchOrganizationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrganizationName, setNewOrganizationName] = useState("");
  const [newOrganizationDescription, setNewOrganizationDescription] = useState("");
  const [newOrganizationAddress, setNewOrganizationAddress] = useState("");
  const [newOrganizationContact, setNewOrganizationContact] = useState("");
  const [newOrganizationEmail, setNewOrganizationEmail] = useState("");
  const [newOrganizationWebsite, setNewOrganizationWebsite] = useState("");
  const [creating, setCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const { organization, organizations, createOrganization } = useAuth();

  const sortedOrganizations = useMemo(
    () =>
      organizations
        .filter((w): w is Organization => w !== null && w !== undefined)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [organizations],
  );

  const filteredOrganizations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sortedOrganizations;
    return sortedOrganizations.filter((w) => w.name.toLowerCase().includes(q));
  }, [sortedOrganizations, searchTerm]);

  if (!isOpen) return null;

  const handleClose = () => {
    setShowCreateForm(false);
    setNewOrganizationName("");
    setNewOrganizationDescription("");
    setNewOrganizationAddress("");
    setNewOrganizationContact("");
    setNewOrganizationEmail("");
    setNewOrganizationWebsite("");
    setSwitchingId(null);
    setSearchTerm("");
    onClose();
  };

  const handleSwitch = (organizationId: number) => {
    if (switchingId !== null) return;
    setSwitchingId(organizationId);
    // The route change is what actually drives the switch — DashboardLayout
    // picks up the new :organizationId param and syncs everything else. Keep the
    // modal open with a spinner for a beat so a slow connection doesn't look
    // like a dead click, instead of closing before anything's visibly done.
    navigate(`/${organizationId}/dashboard`);
    window.setTimeout(() => {
      handleClose();
    }, 450);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrganizationName.trim()) return;
    setCreating(true);
    try {
      const created = await createOrganization(newOrganizationName, newOrganizationDescription, {
        address: newOrganizationAddress.trim() || undefined,
        contact: newOrganizationContact.trim() || undefined,
        email: newOrganizationEmail.trim() || undefined,
        website: newOrganizationWebsite.trim() || undefined,
      });
      if (created) {
        handleClose();
        navigate(`/${created.id}/dashboard`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45">
      <div className="w-full max-w-md overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <Eyebrow>Organizations</Eyebrow>
            <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
              Switch Organization
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!showCreateForm ? (
          <>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search organizations..."
                  autoFocus
                  className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded pl-9 outline-none focus:border-blue-900 transition-colors"
                />
              </div>
            </div>
            <div className="p-3 space-y-1 max-h-[50vh] overflow-y-auto">
              {filteredOrganizations.length === 0 ? (
                <p className="py-6 text-center text-slate-400 text-[12.5px]">
                  No organizations match "{searchTerm}".
                </p>
              ) : (
                filteredOrganizations.map((ws) => {
                  const isCurrent = organization?.id === ws.id;
                  const isSwitchingTo = switchingId === ws.id;
                  const disabled = switchingId !== null;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => !isCurrent && !disabled && handleSwitch(ws.id)}
                      disabled={disabled}
                      className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                        isCurrent ? "bg-blue-50" : "hover:bg-slate-50"
                      } ${disabled && !isSwitchingTo ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[12px] font-bold text-white rounded bg-blue-900">
                        {isSwitchingTo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          ws.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-slate-900 truncate">
                          {ws.name}
                        </div>
                        {isSwitchingTo ? (
                          <div className="text-[11px] text-blue-700">Switching…</div>
                        ) : (
                          isCurrent && (
                            <div className="text-[11px] text-slate-500">
                              Current organization
                            </div>
                          )
                        )}
                      </div>
                      {isCurrent && !isSwitchingTo && (
                        <Check className="flex-shrink-0 w-4 h-4 text-emerald-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-slate-200">
              <button
                onClick={() => setShowCreateForm(true)}
                disabled={switchingId !== null}
                className="flex items-center w-full gap-3 px-3 py-2.5 text-left transition-colors rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded bg-slate-100 text-slate-500">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="text-[13px] font-medium text-slate-900">
                  Add organization
                </div>
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCreateOrganization} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-600">
                Name
              </label>
              <input
                type="text"
                value={newOrganizationName}
                onChange={(e) => setNewOrganizationName(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                placeholder="My New Organization"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-600">
                Description (optional)
              </label>
              <textarea
                value={newOrganizationDescription}
                onChange={(e) => setNewOrganizationDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                placeholder="This is a new organization"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-600">
                Address (optional)
              </label>
              <textarea
                value={newOrganizationAddress}
                onChange={(e) => setNewOrganizationAddress(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                placeholder="Postal address"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600">
                  Contact (optional)
                </label>
                <input
                  type="tel"
                  value={newOrganizationContact}
                  onChange={(e) => setNewOrganizationContact(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={newOrganizationEmail}
                  onChange={(e) => setNewOrganizationEmail(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="info@example.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-600">
                Website (optional)
              </label>
              <input
                type="text"
                value={newOrganizationWebsite}
                onChange={(e) => setNewOrganizationWebsite(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                placeholder="www.example.com"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SwitchOrganizationModal;
