# Architecture du Projet Preview-DICOM

Ce document décrit l'architecture technique de haut niveau de l'application Preview-DICOM.

## Vue d'ensemble

Preview-DICOM est une application web conteneurisée conçue pour la gestion et la visualisation d'images médicales (DICOM). Elle utilise une architecture microservices orchestrée par Docker Compose.

### Diagramme de l'Infrastructure

```mermaid
graph TD
    Client[Navigateur Client]
    
    subgraph "Docker Host"
        Nginx[Nginx Reverse Proxy\n(Port 80/443)]
        
        subgraph "Réseau Public"
            Frontend[Frontend React\n(Vite Server)]
            OHIF[OHIF Viewer\n(Visualiseur DICOM)]
        end
        
        subgraph "Réseau Privé"
            Backend[Backend FastAPI\n(Python)]
            Orthanc[Orthanc PACS\n(Serveur DICOM)]
            Postgres[PostgreSQL\n(Base de Données)]
            Redis[Redis\n(Cache & Sessions)]
        end
    end

    Client -->|HTTPS| Nginx
    
    Nginx -->|/| Frontend
    Nginx -->|/api| Backend
    Nginx -->|/viewer| OHIF
    Nginx -->|/orthanc-proxy| Orthanc

    Backend -->|SQL| Postgres
    Backend -->|Cache| Redis
    Backend -->|DICOMWeb| Orthanc
    
    OHIF -->|DICOMWeb| Orthanc
```

## Composants du Système

### 1. Nginx (Gateway)
*   **Rôle** : Point d'entrée unique, terminaison SSL, Reverse Proxy.
*   **Configuration** : `infra/nginx.conf`
*   **Ports** : 80 (Redirection HTTPS), 443 (SSL).
*   **Routes** :
    *   `/` -> Frontend
    *   `/api/` -> Backend
    *   `/viewer/` -> OHIF Viewer
    *   `/orthanc-proxy/` -> Orthanc (avec injection d'authentification Basic)

### 2. Backend (API)
*   **Technologie** : Python 3.11, FastAPI.
*   **Rôle** : Logique métier, gestion des utilisateurs, orchestration des données patients.
*   **Interaction** :
    *   Communique avec **PostgreSQL** pour les métadonnées (Utilisateurs, Patients, Logs).
    *   Communique avec **Orthanc** via HTTP pour manipuler les fichiers DICOM.
    *   Communique avec **Redis** pour la gestion des sessions.

### 3. Frontend (UI)
*   **Technologie** : React, TypeScript, Vite.
*   **Rôle** : Interface utilisateur pour les administrateurs et les chercheurs.
*   **Communication** : Appelle l'API Backend via REST.

### 4. Orthanc (PACS)
*   **Rôle** : Serveur DICOM (Picture Archiving and Communication System). Stocke les fichiers `.dcm`.
*   **Configuration** : Image officielle `osimis/orthanc`.
*   **Stockage** : Volume Docker `orthanc-storage`.

### 5. OHIF Viewer
*   **Rôle** : Visualiseur DICOM web avancé.
*   **Intégration** : Chargé via iframe ou redirection, il récupère les images directement depuis Orthanc via le protocole DICOMWeb.

### 6. Base de Données (PostgreSQL)
*   **Rôle** : Persistance des données relationnelles.
*   **Modèles** : Users, Groups, Patients, AuditLogs, UserSessions.

### 7. Redis
*   **Rôle** : Stockage rapide pour les sessions utilisateurs et cache éventuel.

## Flux de Données

### Authentification
1.  L'utilisateur envoie ses crédentials à `/api/auth/login`.
2.  Le Backend vérifie le hash du mot de passe (bcrypt).
3.  Si valide, le Backend génère un **Access Token** (court terme) et un **Refresh Token** (long terme).
4.  Ces tokens sont stockés dans des cookies `HttpOnly` sécurisés.
5.  Une session est créée dans Redis et PostgreSQL (`UserSession`).

### Import de Patient (DICOM)
1.  L'utilisateur upload un fichier ZIP ou des fichiers DCM via le Frontend.
2.  Le Frontend envoie les fichiers au Backend (`/api/patients/import`).
3.  Le Backend envoie les fichiers à Orthanc.
4.  Orthanc extrait les métadonnées DICOM.
5.  Le Backend récupère ces métadonnées et crée/met à jour l'entrée `Patient` dans PostgreSQL.

### Visualisation
1.  L'utilisateur clique sur "Voir" dans le dashboard.
2.  Le Frontend ouvre OHIF Viewer (`/viewer`) avec l'ID de l'étude.
3.  OHIF requête Orthanc (`/orthanc-proxy`) pour récupérer les images.

### Export
1.  L'utilisateur demande un export (`/api/patients/export`).
2.  Le Backend récupère les métadonnées depuis PostgreSQL.
3.  Le Backend télécharge les fichiers DICOM depuis Orthanc.
4.  Le Backend génère un ZIP à la volée contenant JSON + DCM.
5.  Le fichier est streamé au client.
