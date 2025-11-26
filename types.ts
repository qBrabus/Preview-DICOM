
export interface MedicalImage {
  id: string;
  url: string;
  description: string;
  date: string;
  file?: File | null;
}

export interface Patient {
  id: string;
  recordId?: number;
  firstName: string;
  lastName: string;
  dob: string;
  condition: string;
  lastVisit: string;
  dicomStudyUid?: string;
  orthancPatientId?: string;
  hasImages?: boolean;
  imageCount?: number;
  images: MedicalImage[];
}

export type UserStatus = 'active' | 'inactive' | 'expired' | 'disabled';

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  name: string;
  email: string;
  groupId?: number | null;
  groupName?: string;
  status: UserStatus;
  expirationDate?: string | null; // ISO Date string for temporary access
}

export interface GroupPermissions {
  canEditPatients: boolean;
  canExportData: boolean;
  canManageUsers: boolean;
  canViewImages: boolean;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  permissions: GroupPermissions;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  USER_DASHBOARD = 'USER_DASHBOARD',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
}