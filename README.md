# Preview DICOM – Stack de démonstration

## Titre
Portail de prévisualisation DICOM complet (frontend React, backend FastAPI, Orthanc + OHIF, orchestration Docker).

## Description
Cette base fournit une maquette d'infrastructure pour tester rapidement un portail DICOM. Elle rassemble un frontend React/Vite, un backend FastAPI connecté à PostgreSQL, un Orthanc exposé en DICOMweb, un viewer OHIF déjà configuré et un reverse-proxy Nginx pour rassembler le tout sur un seul point d'entrée.

## Objectif
Offrir une stack clé en main pour :
- Explorer une architecture DICOM moderne sans repartir de zéro.
- Développer une UI patient/admin branchée sur une API minimale.
- Vérifier l'intégration DICOMweb entre Orthanc et OHIF.

## Fonctionnalités principales
- **Frontend React/Vite** : écrans de connexion, tableau de bord patient et interfaces d'administration (maquettes).  
- **API FastAPI** : CRUD basique sur patients, utilisateurs et groupes, connexion PostgreSQL via SQLAlchemy.  
- **Stockage DICOM** : Orthanc avec DICOMweb activé et listener DICOM (4242).  
- **Visualisation** : Viewer OHIF pré-configuré pour interroger Orthanc.  
- **Proxy unifié** : Nginx sert le frontend, relaye l'API (`/api`) et expose le viewer (`/viewer`).

## Technologies
- **Frontend** : React 18, Vite.  
- **Backend** : FastAPI, SQLAlchemy, PostgreSQL.  
- **DICOM** : Orthanc (DICOMweb), OHIF Viewer.  
- **Infra** : Docker, docker-compose, Nginx.

## Architecture générale
```
Utilisateur → Nginx (port 80)
  ├─ /           → Frontend React (Vite)
  ├─ /api        → Backend FastAPI + PostgreSQL
  └─ /viewer     → OHIF Viewer → Orthanc (REST/DICOMweb, port 8042)
                         └─ Listener DICOM C-STORE (port 4242)
```

## Installation et lancement
1. **Prérequis** : Docker et docker-compose installés.  
2. **Configurer l'environnement** : 
   - Copier `.env.example` en `.env` si besoin et ajuster les variables Postgres/ports.  
3. **Démarrer la stack** :
   ```bash
   docker-compose up --build
   ```
4. **Accéder aux services** :
   - Frontend : http://localhost  
   - API FastAPI : http://localhost/api (ou http://localhost:8000 en direct)  
   - OHIF Viewer : http://localhost/viewer (ou http://localhost:3000 en direct)  
   - Orthanc : http://localhost:8042 (REST/DICOMweb), listener DICOM C-STORE : 4242

## Structure du dépôt
```
.
├─ App.tsx / components/     # UI React (login, dashboard patient/admin)
├─ backend/
│  ├─ app/
│  │  ├─ main.py             # FastAPI + routes CRUD basiques
│  │  ├─ database.py         # Connexion Postgres via SQLAlchemy
│  │  ├─ models.py           # Patients, Users, Groups
│  │  └─ schemas.py          # Schémas Pydantic
│  └─ Dockerfile             # Image backend
├─ Dockerfile.frontend       # Build + preview Vite
├─ docker-compose.yml        # Orchestration frontend/backend/db/orthanc/ohif/nginx
├─ infra/
│  ├─ nginx.conf             # Reverse-proxy Nginx
│  └─ ohif-config.js         # Ciblage Orthanc via DICOMweb
└─ .env.example              # Variables Postgres
```

## Explications supplémentaires
- **Initialisation des tables** : les modèles SQLAlchemy sont créés au démarrage du backend (voir `backend/app/main.py`).
- **API minimale** : les routes `/patients`, `/users`, `/groups` exposent un CRUD simple basé sur les schémas Pydantic (`backend/app/schemas.py`).
- **Connexion OHIF → Orthanc** : le viewer pointe sur Orthanc via DICOMweb configuré dans `infra/ohif-config.js`.
- **Personnalisation Nginx** : adaptez les hôtes ou chemins dans `infra/nginx.conf` si vous déployez derrière un autre reverse-proxy.

## Prochaines étapes proposées
- Brancher le frontend sur `/api` pour l'authentification, l'import DICOM et la gestion fine des permissions. ✅
- Sécuriser Orthanc (auth Basic ou JWT) et ajouter du stockage persistant dédié. ✅
- Ajouter un module d'import DICOM vers Orthanc (REST ou DICOM C-STORE) côté backend. ✅

## Mises en œuvre récentes
- **Frontend relié à l'API** : les écrans de connexion, d'administration et d'import utilisent désormais `/api` avec un jeton Bearer stocké côté client pour toutes les requêtes.
- **Orthanc protégé et persistant** : l'authentification Basic est activée (variables `ORTHANC_USER` / `ORTHANC_PASSWORD` dans `docker-compose.yml`) et le volume Docker `orthanc-storage` préserve les données DICOM.
- **Import DICOM intégré** : le backend expose `/patients/import` (upload REST) et le frontend gère les lots ZIP ou répertoires contenant JSON + fichiers `.dcm`, automatiquement routés vers Orthanc et persistés en base.
- **Compatibilité base de données** : le backend applique au démarrage une migration idempotente pour ajouter la colonne `status` aux patients et éviter les erreurs de démarrage sur des volumes Postgres existants.
