# Documentation Frontend

Le frontend est une Single Page Application (SPA) construite avec **React** et **TypeScript**, utilisant **Vite** comme bundler.

## Stack Technique

*   **Framework** : React 18
*   **Langage** : TypeScript
*   **Build Tool** : Vite
*   **State Management (Server)** : TanStack Query (React Query)
*   **State Management (Auth)** : React Context (`AuthContext`)
*   **Styling** : TailwindCSS
*   **Icônes** : Lucide React

## Structure du Projet (`/`)

*   `App.tsx` : Composant racine, gère le routage conditionnel (Login vs Dashboard).
*   `components/` : Composants UI réutilisables et vues principales.
    *   `Login.tsx` : Formulaire de connexion.
    *   `AdminDashboard.tsx` : Vue principale pour les administrateurs (Gestion utilisateurs, stats).
    *   `PatientDashboard.tsx` : Vue principale pour les chercheurs (Liste patients, viewer).
    *   `ProfileSettingsModal.tsx` : Modale d'édition de profil.
    *   `DicomViewer.tsx` : Intégration (iframe) du viewer OHIF.
*   `contexts/` :
    *   `AuthContext.tsx` : Gère l'état de l'utilisateur, les tokens, le login/logout et le refresh automatique.
*   `types.ts` : Définitions des interfaces TypeScript partagées (User, Patient, etc.).

## Gestion de l'État

### Authentification (`AuthContext`)
Le contexte d'authentification est le cœur de la sécurité frontend.
*   **Initialisation** : Au chargement, tente de rafraîchir le token (`/api/auth/refresh`) pour restaurer la session.
*   **Login** : Appelle l'API, stocke l'utilisateur en mémoire (les tokens sont dans les cookies).
*   **Intercepteurs** : Configure `axios` ou `fetch` pour inclure le header CSRF si nécessaire (bien que les cookies soient gérés par le navigateur).

### Données (`TanStack Query`)
Utilisé pour toutes les requêtes serveur (Patients, Users, Stats).
*   **Caching** : Les données sont mises en cache pour éviter les requêtes redondantes.
*   **Invalidation** : Après une mutation (ex: Création utilisateur), le cache est invalidé pour forcer un rafraîchissement.

## Flux Utilisateur

### 1. Connexion
L'utilisateur arrive sur la page. `AuthContext` vérifie la session. Si échec -> Affiche `Login`. Si succès -> Affiche le Dashboard approprié selon le rôle (`admin` ou `user`).

### 2. Dashboard Patient (Chercheur)
*   Affiche une liste de patients avec pagination.
*   Barre de recherche (Nom, IPP).
*   **Import** : Drag & drop de fichiers ZIP/DCM.
*   **Export** : Sélection multiple -> Bouton "Exporter" -> Téléchargement ZIP.
*   **Visualisation** : Clic sur un patient -> Ouvre le visualiseur DICOM.

### 3. Dashboard Admin
*   Gestion des utilisateurs (Création, Suppression, Modification).
*   Vue d'ensemble des statistiques (Nombre de patients, stockage utilisé).
*   Logs système (si implémenté).

## Composants Clés

### `ProfileSettingsModal`
Permet à l'utilisateur de modifier ses informations.
*   Gère la validation des mots de passe (actuel vs nouveau).
*   Met à jour le contexte d'authentification après succès.

### `DicomViewer`
Intègre OHIF Viewer.
*   Utilise une `iframe` pointant vers `/viewer`.
*   Passe l'ID de l'étude DICOM via l'URL.
