import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { TreeItem, DraggableUser } from "../components/tree";
import { User, TreeNode } from "../types";
import UserFormModal from "../components/UserFormModal";
import ConfirmationModal from "../components/ConfirmationModal";

const initialTree: TreeNode = {
  id: "root",
  label: "Organization",
  children: [],
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Capitalizes the first letter of each word, leaving the rest untouched. */
const capitalizeWords = (value: string) =>
  value
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");

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

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");

  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
    address: "",
    jobPosition: "",
    joinDate: "",
    role: "user",
  });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);

  const [tree, setTree] = useState<TreeNode>(initialTree);
  const [treeLoading, setTreeLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedUser, setDraggedUser] = useState<User | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    userId: number | null;
  }>({ isOpen: false, userId: null });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  const generateId = () => `node-${Date.now()}-${Math.random()}`;

  const findNode = (node: TreeNode, nodeId: string): TreeNode | null => {
    if (node.id === nodeId) return node;
    for (const child of node.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
    return null;
  };

  const addChildToNode = (
    node: TreeNode,
    parentId: string,
    newNode: TreeNode,
  ): TreeNode => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, newNode] };
    }
    return {
      ...node,
      children: node.children.map((child) =>
        addChildToNode(child, parentId, newNode),
      ),
    };
  };

  const removeNodeFromTree = (node: TreeNode, nodeId: string): TreeNode => {
    return {
      ...node,
      children: node.children
        .filter((child) => child.id !== nodeId)
        .map((child) => removeNodeFromTree(child, nodeId)),
    };
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const response = await api.get<User[]>("/api/users");
      setUsers(response.data);
    } catch (err: any) {
      setUsersError(
        err?.response?.data?.message || err.message || "Unable to load users.",
      );
    } finally {
      setUsersLoading(false);
    }
  };

  const loadHierarchy = async () => {
    setTreeLoading(true);
    try {
      const response = await api.get<TreeNode>("/api/hierarchy");
      if (response.data) {
        setTree(response.data);
      }
    } catch (err) {
      console.error("Failed to load hierarchy", err);
    } finally {
      setTreeLoading(false);
    }
  };

  const saveHierarchy = async (newTree: TreeNode) => {
    try {
      const response = await api.put<TreeNode>("/api/hierarchy", {
        tree: newTree,
      });
      if (response.data) {
        setTree(response.data);
      }
    } catch (err) {
      console.error("Failed to save hierarchy", err);
    }
  };

  const { workspace } = useAuth();

  useEffect(() => {
    loadUsers();
    loadHierarchy();
  }, [workspace?.id]);

  const resetUserForm = () => {
    setUserForm({
      fullName: "",
      email: "",
      password: "",
      phoneNumber: "",
      address: "",
      jobPosition: "",
      joinDate: "",
      role: "user",
    });
    setEditingUser(null);
    setUserFormError(null);
  };

  const handleUserFieldChange = (
    field: keyof typeof userForm,
    value: string,
  ) => {
    setUserForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStartEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserForm(true);
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      phoneNumber: user.phoneNumber,
      address: user.address,
      jobPosition: user.jobPosition,
      joinDate: user.joinDate.slice(0, 10),
      role: user.role,
    });
  };

  const handleSubmitUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setUserFormError(null);
    setUserFormSubmitting(true);

    const payload: Record<string, unknown> = {
      fullName: userForm.fullName,
      email: userForm.email,
      password: userForm.password,
      phoneNumber: userForm.phoneNumber,
      address: userForm.address,
      jobPosition: userForm.jobPosition,
      joinDate: userForm.joinDate,
      role: userForm.role,
    };

    try {
      if (editingUser) {
        if (!payload.password) delete payload.password;
        await api.put(`/api/users/${editingUser.id}`, payload);
      } else {
        await api.post("/api/users", payload);
      }
      await loadUsers();
      setShowUserForm(false);
      resetUserForm();
    } catch (err: any) {
      setUserFormError(
        err?.response?.data?.message || err.message || "Unable to save user.",
      );
    } finally {
      setUserFormSubmitting(false);
    }
  };

  const handleDeleteUser = (id: number) => {
    setConfirmModal({ isOpen: true, userId: id });
  };

  const confirmDeleteUser = async () => {
    if (!confirmModal.userId) return;
    try {
      await api.delete(`/api/users/${confirmModal.userId}`);
      setUsers((prev) =>
        prev.filter((user) => user.id !== confirmModal.userId),
      );
      setConfirmModal({ isOpen: false, userId: null });
    } catch (err: any) {
      setUsersError(
        err?.response?.data?.message || err.message || "Unable to delete user.",
      );
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const user = users.find((u) => `user-${u.id}` === event.active.id);
    if (user) setDraggedUser(user);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedUser(null);

    if (over && draggedUser) {
      const newNode: TreeNode = {
        id: generateId(),
        label: draggedUser.fullName,
        userId: draggedUser.id,
        children: [],
      };
      const newTree = addChildToNode(tree, over.id as string, newNode);
      setTree(newTree);
      saveHierarchy(newTree);
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    const newTree = removeNodeFromTree(tree, nodeId);
    setTree(newTree);
    saveHierarchy(newTree);
  };

  const filteredUsers = users
    .filter(
      (user) =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.jobPosition.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const isAdminOrSuperAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const roleStyles: Record<string, { bg: string; fg: string }> = {
    admin: { bg: "#EDE9FE", fg: "#6D28D9" },
    super_admin: { bg: "#FEE2E2", fg: "#B91C1C" },
    user: { bg: "#DBEAFE", fg: "#1E3A8A" },
  };

  // Cycled, deterministic (by id) avatar colors so the list reads with the
  // same varied-but-consistent look row to row instead of one flat color.
  const AVATAR_COLORS = [
    "#4338CA", // indigo
    "#047857", // emerald
    "#BE123C", // rose
    "#7C3AED", // violet
    "#1D4ED8", // blue
    "#475569", // slate
    "#B45309", // amber
  ];
  const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

  return (
    <div className="px-6 py-8 w-full lg:px-8 lg:py-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 mb-6 md:flex-row md:items-center">
        <div>
          <Eyebrow>Team Management</Eyebrow>
          <h2 className="font-semibold mt-1 text-[28px] tracking-tight text-slate-900">
            People
          </h2>
          <p className="text-slate-500 text-[14px] mt-1">
            Manage your organization's members and hierarchy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-[#EEF1F5] rounded p-0.5 border border-slate-200">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${viewMode === "tree" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Tree
            </button>
          </div>

          {isAdminOrSuperAdmin && (
            <button
              onClick={() => {
                if (showUserForm) resetUserForm();
                setShowUserForm(!showUserForm);
              }}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email or position..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded pl-9 outline-none focus:border-blue-900 transition-colors"
        />
      </div>

      {/* User Form Modal */}
      <UserFormModal
        isOpen={showUserForm}
        editingUser={editingUser}
        userForm={userForm}
        userFormError={userFormError}
        userFormSubmitting={userFormSubmitting}
        currentUserRole={currentUser?.role}
        onClose={() => {
          setShowUserForm(false);
          resetUserForm();
        }}
        onSubmit={handleSubmitUser}
        onFieldChange={handleUserFieldChange}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, userId: null })}
        onConfirm={confirmDeleteUser}
        message="Are you sure you want to delete this user?"
      />

      {/* Content based on View Mode */}
      {viewMode === "list" ? (
        <div className="overflow-hidden bg-white border rounded-md border-slate-200">
          {usersLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
              <div
                className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Loading users
              </div>
            </div>
          ) : usersError ? (
            <div className="m-6 p-4 bg-red-50 border border-red-100 rounded flex items-center gap-3 text-red-700 text-[13px]">
              <AlertCircle className="flex-shrink-0 w-4 h-4" />
              <span>{usersError}</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                No users found
              </h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                We couldn't find any users matching your search criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Position
                    </th>
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Role
                    </th>
                    {isAdminOrSuperAdmin && (
                      <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-right text-slate-400 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((userItem) => {
                    const rStyle = roleStyles[userItem.role] || {
                      bg: "#EEF1F5",
                      fg: "#475569",
                    };
                    return (
                      <tr
                        key={userItem.id}
                        className="transition-colors border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[11px] font-semibold text-white rounded-full"
                              style={{ background: avatarColor(userItem.id) }}
                            >
                              {getInitials(userItem.fullName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-[13.5px] text-slate-900 truncate">
                                {capitalizeWords(userItem.fullName)}
                              </div>
                              <div className="text-slate-400 text-[12px] truncate">
                                {userItem.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-[13px]">
                          {capitalizeWords(userItem.jobPosition)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-500 text-[12.5px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {userItem.email}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-[12.5px]">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {userItem.phoneNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] tracking-[0.05em] uppercase font-semibold"
                            style={{
                              background: rStyle.bg,
                              color: rStyle.fg,
                            }}
                          >
                            {userItem.role}
                          </span>
                        </td>
                        {isAdminOrSuperAdmin && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleStartEditUser(userItem)}
                                className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                title="Edit User"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(userItem.id)}
                                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Tree Container */}
            <div className="flex flex-col overflow-hidden bg-white border rounded-md lg:col-span-2 border-slate-200">
              <div className="p-4 border-b border-slate-200 bg-[#EEF1F5]/30">
                <Eyebrow>Organization Hierarchy</Eyebrow>
                <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
                  Drag users to build your tree
                </div>
              </div>
              <div
                className="flex-1 overflow-auto p-8 min-h-[500px]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, #E2E8F0 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              >
                <TreeItem node={tree} onDeleteNode={handleDeleteNode} />
              </div>
            </div>

            {/* Available Users */}
            <div className="flex flex-col overflow-hidden bg-white border rounded-md border-slate-200">
              <div className="p-4 border-b border-slate-200 bg-[#EEF1F5]/30">
                <Eyebrow>Available Users</Eyebrow>
                <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
                  Drag to add to tree
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[600px]">
                {users.map((user) => (
                  <DraggableUser key={`user-${user.id}`} user={user} />
                ))}
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeId && draggedUser ? (
              <div className="flex items-center gap-3 p-3 bg-white border rounded-md shadow-lg border-slate-200">
                <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
                  {getInitials(draggedUser.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900 truncate">
                    {draggedUser.fullName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {draggedUser.jobPosition}
                  </p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default Users;
