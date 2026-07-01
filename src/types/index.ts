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
