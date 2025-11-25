# Preview DICOM – Stack de démonstration

Cette base propose une maquette d'infrastructure pour un portail DICOM :

- **Front** : React/Vite (ce dépôt) pour la connexion, le dashboard patient et l'admin UI.
- **Back** : FastAPI + SQLAlchemy, connecté à PostgreSQL (patients, utilisateurs, groupes/droits).
- **DICOM** : Orthanc avec DICOMweb activé, et un viewer OHIF pré-configuré via Docker.
- **Infra** : Docker / docker-compose, Nginx en frontal pour router /api (backend), /viewer (OHIF) et le site (frontend).

## Lancer la stack

```bash
docker-compose up --build
```

Endpoints :

- Frontend : http://localhost (via Nginx)
- API FastAPI : http://localhost/api (ou http://localhost:8000 en direct)
- OHIF Viewer : http://localhost/viewer (ou http://localhost:3000 en direct)
- Orthanc : REST/DICOMweb http://localhost:8042, DICOM listener : 4242

Les variables par défaut sont définies dans `.env.example` et injectées dans les services Docker. Vous pouvez les surcharger ou créer un fichier `.env`.

## Structure principale

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

## Notes d'exploitation

- La base crée automatiquement les tables au démarrage (voir `backend/app/main.py`).
- Les routes `/patients`, `/users`, `/groups` fournissent un CRUD minimal pour brancher rapidement l'UI (voir `backend/app/schemas.py`).
- Orthanc expose DICOMweb (`/dicom-web`), et OHIF est déjà pointé dessus via `infra/ohif-config.js`.
- Nginx reverse-proxy tout sur le port 80; vous pouvez adapter les hostnames dans `infra/nginx.conf` si déployé derrière un autre LB.

## Prochaines étapes possibles

- Connecter le frontend à l'API `/api` (auth réelle, upload DICOM, permissions groupe).
- Sécuriser Orthanc (auth Basic/ JWT) et ajouter du stockage persistant dédié.
- Ajouter un module d'import DICOM vers Orthanc (REST/DICOM C-STORE) côté backend.
