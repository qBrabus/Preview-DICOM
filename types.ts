
export interface MedicalImage {
  id: string;
  url: string;
  description: string;
  date: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  condition: string;
  lastVisit: string;
  images: MedicalImage[];
}

export type UserStatus = 'active' | 'inactive' | 'expired';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  name: string;
  email?: string;
  group?: string; // e.g., 'Researchers', 'Interns'
  status?: UserStatus;
  expirationDate?: string | null; // ISO Date string for temporary access
}

export interface Group {
  id: string;
  name: string;
  description: string;
  permissions: {
    canEditPatients: boolean;
    canExportData: boolean;
    canManageUsers: boolean;
    canViewImages: boolean;
  };
}

export enum ViewState {
  LOGIN = 'LOGIN',
  USER_DASHBOARD = 'USER_DASHBOARD',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
}