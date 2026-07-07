export type User = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  jobPosition: string;
  joinDate: string;
  role: string;
  createdAt: string;
};

export type TreeNode = {
  id: string;
  dbId?: number;
  label: string;
  userId?: number;
  children: TreeNode[];
};

export type ProjectTask = {
  id: number;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
  status?: "pending" | "in_progress" | "completed" | "on_hold";
  progress?: number;
  assignedUsers?: Array<{ id: number; fullName: string }>;
};

export type ProjectHeading = {
  id: number;
  name: string;
  tasks: ProjectTask[];
  subHeadings: ProjectHeading[];
};

export type ProjectFile = {
  id: number;
  name: string;
  isFolder: boolean;
  type?: string;
  parentId?: number | null;
  size?: number | null;
  path?: string | null;
  version: string;
  uploadedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type Project = {
  id: number;
  name: string;
  description?: string;
  progress: number;
  tasksCount: number;
  membersCount: number;
  dueDate?: string;
  status: string;
  assignees?: Array<{
    id: number;
    fullName: string;
    email?: string;
    role?: string;
    jobPosition?: string;
    phoneNumber?: string;
  }>;
  headings: ProjectHeading[];
  files: ProjectFile[];
  projectTasks?: ProjectTask[];
};
