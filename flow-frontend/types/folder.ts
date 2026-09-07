export type FolderColor = 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' | 'cyan' | 'indigo';

// A dashboard-level grouping for a user's own diagrams — purely organizational,
// carries no access control of its own (a diagram's `users`/`isPublic` still
// govern who can see it; a folder is just a label owners can filter by).
export interface Folder {
  id: string;
  name: string;
  color?: FolderColor;
  userId: string; // owner — folders are never shared/shown across users
  createdAt: string;
  updatedAt: string;
}
