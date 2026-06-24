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
  Briefcase,
  Calendar,
  Shield,
  MapPin,
  Lock,
  X,
  Loader2,
  Filter,
  User as UserIcon,
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

const initialTree: TreeNode = {
  id: "root",
  label: "kuber",
  children: [],
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedUser, setDraggedUser] = useState<User | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const generateId = () => `node-${Date.now()}-${Math.random()}`;

  const findNode = (
    node: TreeNode,
    nodeId: string
  ): TreeNode | null => {
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
    newNode: TreeNode
  ): TreeNode => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, newNode] };
    }
    return {
      ...node,
      children: node.children.map((child) =>
        addChildToNode(child, parentId, newNode)
      ),
    };
  };

  const removeNodeFromTree = (
    node: TreeNode,
    nodeId: string
  ): TreeNode => {
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
        err?.response?.data?.message || err.message || "Unable to load users."
      );
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

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
    value: string
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
        if (!payload.password) {
          delete payload.password;
        }
        await api.put(`/api/users/${editingUser.id}`, payload);
      } else {
        await api.post("/api/users", payload);
      }
      await loadUsers();
      setShowUserForm(false);
      resetUserForm();
    } catch (err: any) {
      setUserFormError(
        err?.response?.data?.message || err.message || "Unable to save user."
      );
    } finally {
      setUserFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("Delete this user?")) {
      return;
    }
    try {
      await api.delete(`/api/users/${id}`);
      setUsers((prev) => prev.filter((user) => user.id !== id));
    } catch (err: any) {
      setUsersError(
        err?.response?.data?.message || err.message || "Unable to delete user."
      );
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const user = users.find((u) => `user-${u.id}` === event.active.id);
    if (user) {
      setDraggedUser(user);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedUser(null);

    if (over && draggedUser) {
      const newNode: TreeNode = {
        id: generateId(),
        label: draggedUser.fullName,
        children: [],
      };
      setTree((prev) => addChildToNode(prev, over.id as string, newNode));
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    setTree((prev) => removeNodeFromTree(prev, nodeId));
  };

  const filteredUsers = users.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.jobPosition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-12 space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 justify-between md:flex-row md:items-center">
        <div className="relative flex-1 max-w-md group">
          <div className="flex absolute inset-y-0 left-0 items-center pl-4 pointer-events-none">
            <Search className="w-5 h-5 transition-colors text-slate-400 group-focus-within:text-indigo-500" />
          </div>
          <input
            type="text"
            placeholder="Search users by name, email or position..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block py-3 pr-4 pl-11 w-full text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-3 items-center">
          <button className="flex gap-2 items-center px-4 py-3 text-sm font-semibold bg-white rounded-2xl border shadow-sm transition-all border-slate-200 text-slate-600 hover:bg-slate-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          {currentUser?.role === "admin" && (
            <button
              onClick={() => {
                if (showUserForm) resetUserForm();
                setShowUserForm(!showUserForm);
              }}
              className="flex gap-2 items-center px-5 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl shadow-lg transition-all hover:bg-indigo-700 shadow-indigo-200"
            >
              <UserPlus className="w-4 h-4" />
              {editingUser ? "Edit User" : "Add New User"}
            </button>
          )}
        </div>
      </div>

      {/* User Form Modal */}
      {showUserForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl overflow-hidden bg-white rounded-3xl border shadow-2xl duration-200 border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingUser
                    ? "Update User Information"
                    : "Create New User Account"}
                </h3>
                <p className="text-sm text-slate-500">
                  Fill in the details below to{" "}
                  {editingUser ? "update" : "create"} the employee profile.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUserForm(false);
                  resetUserForm();
                }}
                className="p-2 rounded-xl shadow-sm transition-all hover:bg-white text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUser} className="p-6 space-y-8 lg:p-8">
              {userFormError && (
                <div className="flex gap-3 items-center p-4 text-sm font-medium text-rose-700 bg-rose-50 rounded-2xl border border-rose-100">
                  <AlertCircle className="w-5 h-5" />
                  {userFormError}
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={userForm.fullName}
                      onChange={(e) =>
                        handleUserFieldChange("fullName", e.target.value)
                      }
                      required
                      className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) =>
                        handleUserFieldChange("email", e.target.value)
                      }
                      required
                      className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={userForm.phoneNumber}
                      onChange={(e) =>
                        handleUserFieldChange("phoneNumber", e.target.value)
                      }
                      required
                      className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">
                    Job Position
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={userForm.jobPosition}
                      onChange={(e) =>
                        handleUserFieldChange("jobPosition", e.target.value)
                      }
                      required
                      className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Senior Developer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">
                    Join Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={userForm.joinDate}
                      onChange={(e) =>
                        handleUserFieldChange("joinDate", e.target.value)
                      }
                      required
                      className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-sm font-semibold text-slate-700">
                    User Role
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={userForm.role}
                      onChange={(e) =>
                        handleUserFieldChange("role", e.target.value)
                      }
                      className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all appearance-none bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="user">Standard User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-sm font-semibold text-slate-700">
                  Residential Address
                </label>
                <div className="relative">
                  <MapPin className="absolute top-4 left-4 w-4 h-4 text-slate-400" />
                  <textarea
                    value={userForm.address}
                    onChange={(e) =>
                      handleUserFieldChange("address", e.target.value)
                    }
                    required
                    rows={2}
                    className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="123 Street Name, City, Country"
                  />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <label className="ml-1 text-sm font-semibold text-slate-700">
                  Account Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) =>
                      handleUserFieldChange("password", e.target.value)
                    }
                    className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder={
                      editingUser
                        ? "Leave empty to keep current"
                        : "Set a secure password"
                    }
                    {...(!editingUser ? { required: true } : {})}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserForm(false);
                    resetUserForm();
                  }}
                  className="px-6 py-3 text-sm font-bold bg-white rounded-2xl border transition-all border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userFormSubmitting}
                  className="flex gap-2 items-center px-8 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl shadow-lg transition-all hover:bg-indigo-700 shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {userFormSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {editingUser ? "Update Profile" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-hidden bg-white rounded-3xl border shadow-sm border-slate-200">
        {usersLoading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 font-medium text-slate-500">
              Loading user database...
            </p>
          </div>
        ) : usersError ? (
          <div className="flex gap-4 items-center p-6 m-8 text-rose-700 bg-rose-50 rounded-2xl border border-rose-100">
            <AlertCircle className="w-6 h-6" />
            <p className="font-medium">{usersError}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col justify-center items-center px-4 py-20 text-center">
            <div className="flex justify-center items-center mb-6 w-20 h-20 rounded-full bg-slate-50">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">
              No users found
            </h3>
            <p className="max-w-xs text-slate-500">
              We couldn't find any users matching your search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50/50 border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold tracking-widest uppercase text-slate-500">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-widest uppercase text-slate-500">
                    Position
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-widest uppercase text-slate-500">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-widest uppercase text-slate-500">
                    Role
                  </th>
                  {currentUser?.role === "admin" && (
                    <th className="px-6 py-4 text-xs font-bold tracking-widest text-right uppercase text-slate-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((userItem) => (
                  <tr
                    key={userItem.id}
                    className="transition-colors group hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex gap-3 items-center">
                        <div className="flex justify-center items-center w-10 h-10 font-bold text-indigo-700 bg-indigo-100 rounded-full border-2 border-white shadow-sm">
                          {userItem.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {userItem.fullName}
                          </p>
                          <p className="text-xs font-medium text-slate-500">
                            Joined {formatDate(userItem.joinDate)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 items-center">
                        <span className="px-3 py-1 text-xs font-bold rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                          {userItem.jobPosition}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex gap-2 items-center text-xs text-slate-600">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {userItem.email}
                        </div>
                        <div className="flex gap-2 items-center text-xs text-slate-600">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {userItem.phoneNumber}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${
                          userItem.role === "admin"
                            ? "bg-purple-50 text-purple-700 border-purple-100"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}
                      >
                        {userItem.role}
                      </span>
                    </td>
                    {currentUser?.role === "admin" && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end items-center transition-opacity">
                          <button
                            onClick={() => handleStartEditUser(userItem)}
                            className="p-2 rounded-xl transition-all text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(userItem.id)}
                            className="p-2 rounded-xl transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Hierarchy Tree Builder */}
      <div className="mt-8">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Hierarchy Tree Builder</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-6 md:grid-cols-3">
            {/* Tree Container (Left) */}
            <div className="md:col-span-2">
              <div className="overflow-hidden bg-white rounded-3xl border shadow-sm border-slate-200">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-900">Organization Hierarchy</h3>
                  <p className="text-sm text-slate-500">Drag users from the right to build your tree</p>
                </div>
                <div className="p-8 overflow-x-auto">
                  <TreeItem node={tree} onDeleteNode={handleDeleteNode} />
                </div>
              </div>
            </div>

            {/* Users List (Right) */}
            <div>
              <div className="overflow-hidden bg-white rounded-3xl border shadow-sm border-slate-200">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-900">Available Users</h3>
                  <p className="text-sm text-slate-500">Drag and drop to add to tree</p>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                  {users.map((user) => (
                    <DraggableUser key={`user-${user.id}`} user={user} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeId && draggedUser ? (
              <div className="flex gap-3 items-center p-3 bg-white rounded-xl border border-indigo-200 shadow-xl cursor-grabbing">
                <div className="flex justify-center items-center w-8 h-8 font-bold text-indigo-700 bg-indigo-100 rounded-full border-2 border-white shadow-sm">
                  {draggedUser.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">
                    {draggedUser.fullName}
                  </p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default Users;
