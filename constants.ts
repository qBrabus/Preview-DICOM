
import { Patient, Group, User } from './types';

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'P001',
    firstName: 'Thomas',
    lastName: 'Dubois',
    dob: '12/05/2015',
    condition: 'Syndrome génétique rare A',
    lastVisit: '2023-10-15',
    images: [
      { id: 'img1', url: 'https://picsum.photos/id/10/800/600', description: 'IRM Cérébrale - Coupe Sagittale', date: '2023-10-15' },
      { id: 'img2', url: 'https://picsum.photos/id/11/800/600', description: 'Scanner Thoracique', date: '2023-09-01' },
      { id: 'img3', url: 'https://picsum.photos/id/12/800/600', description: 'Radio Simple', date: '2023-08-20' },
    ]
  },
  {
    id: 'P002',
    firstName: 'Sophie',
    lastName: 'Martin',
    dob: '23/11/2012',
    condition: 'Anomalie Chromosomique X',
    lastVisit: '2023-11-02',
    images: [
      { id: 'img4', url: 'https://picsum.photos/id/13/800/600', description: 'Échographie Cardiaque', date: '2023-11-02' },
      { id: 'img5', url: 'https://picsum.photos/id/14/800/600', description: 'IRM Fonctionnelle', date: '2023-10-10' },
    ]
  },
  {
    id: 'P003',
    firstName: 'Lucas',
    lastName: 'Bernard',
    dob: '05/03/2018',
    condition: 'Surveillance post-opératoire',
    lastVisit: '2023-12-01',
    images: [
      { id: 'img6', url: 'https://picsum.photos/id/15/800/600', description: 'Radio Rachis', date: '2023-12-01' },
    ]
  },
  {
    id: 'P004',
    firstName: 'Emma',
    lastName: 'Petit',
    dob: '19/07/2016',
    condition: 'Maladie métabolique',
    lastVisit: '2023-11-20',
    images: [] // No images test
  },
];

export const MOCK_GROUPS: Group[] = [
  {
    id: 'g1',
    name: 'Administrateurs',
    description: 'Accès complet au système et gestion des utilisateurs',
    permissions: { canEditPatients: true, canExportData: true, canManageUsers: true, canViewImages: true }
  },
  {
    id: 'g2',
    name: 'Médecins Seniors',
    description: 'Gestion des patients et imagerie',
    permissions: { canEditPatients: true, canExportData: true, canManageUsers: false, canViewImages: true }
  },
  {
    id: 'g3',
    name: 'Internes / Stagiaires',
    description: 'Accès limité en lecture seule et durée limitée',
    permissions: { canEditPatients: false, canExportData: false, canManageUsers: false, canViewImages: true }
  }
];

export const MOCK_USERS: User[] = [
  { id: 'u1', username: 'admin', name: 'Dr. Administrateur', email: 'admin@imagine.fr', role: 'admin', group: 'Administrateurs', status: 'active' },
  { id: 'u2', username: 'dr.martin', name: 'Dr. Sophie Martin', email: 's.martin@imagine.fr', role: 'user', group: 'Médecins Seniors', status: 'active' },
  { id: 'u3', username: 'interne.lucas', name: 'Lucas (Interne)', email: 'l.lucas@student.imagine.fr', role: 'user', group: 'Internes / Stagiaires', status: 'active', expirationDate: '2024-06-30' },
  { id: 'u4', username: 'visiteur.temp', name: 'Consultant Externe', email: 'ext.consultant@gmail.com', role: 'user', group: 'Internes / Stagiaires', status: 'expired', expirationDate: '2023-01-01' },
  { id: 'u5', username: 'dr.inactive', name: 'Dr. Ancien', email: 'ancien@imagine.fr', role: 'user', group: 'Médecins Seniors', status: 'inactive' },
];

export const ADMIN_STATS_DATA = [
  { name: 'Jan', consultations: 40, nouveaux: 24 },
  { name: 'Fév', consultations: 30, nouveaux: 13 },
  { name: 'Mar', consultations: 20, nouveaux: 58 },
  { name: 'Avr', consultations: 27, nouveaux: 39 },
  { name: 'Mai', consultations: 18, nouveaux: 48 },
  { name: 'Juin', consultations: 23, nouveaux: 38 },
  { name: 'Juil', consultations: 34, nouveaux: 43 },
];