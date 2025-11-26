# Preview DICOM

Portail de prévisualisation DICOM conçu comme une stack de démonstration prête à l'emploi : frontend React/Vite, backend FastAPI, base PostgreSQL, serveur Orthanc exposé en DICOMweb, viewer OHIF et reverse-proxy Nginx pour fédérer l'ensemble.

## Sommaire
- [Objectifs](#objectifs)
- [Composition de la stack](#composition-de-la-stack)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Démarrage rapide (Docker)](#démarrage-rapide-docker)
- [Utilisation et URLs utiles](#utilisation-et-urls-utiles)
- [Identifiants et données d'exemple](#identifiants-et-données-dexemple)
- [Développement local](#développement-local)
- [Structure du dépôt](#structure-du-dépôt)
- [Personnalisation et points d'attention](#personnalisation-et-points-dattention)

## Objectifs
- Offrir une maquette complète pour explorer une architecture DICOM moderne sans repartir de zéro.
- Permettre le prototypage rapide d'écrans patients/admin branchés sur une API minimale.
- Vérifier l'intégration DICOMweb entre Orthanc et le viewer OHIF.
- Servir de base à des démonstrations ou POC (upload, visualisation, gestion utilisateur/groupe).

## Composition de la stack
| Composant   | Rôle principal | Ports exposés | Notes |
|-------------|----------------|---------------|-------|
| **Frontend (React/Vite)** | UI de connexion, dashboard patient/admin | 4173 (dev/preview), 80/443 via Nginx | VITE_API_BASE pointant sur `/api`.
| **Backend (FastAPI)** | API REST, authentification JWT, CRUD patients/utilisateurs/groupes | 8000 | Attente DB au démarrage + migrations minimales.
| **PostgreSQL** | Stockage relationnel | 5432 (interne) | Volume `pgdata`.
| **Orthanc** | Serveur DICOM + DICOMweb | Interne (4242/8042 sur réseau Docker uniquement) | Utilisateur `admin/changeme` par défaut, authentification injectée par Nginx.
| **OHIF Viewer** | Visualisation via DICOMweb | 3000 (direct), `/viewer` via Nginx | Configuré pour consommer `/orthanc-proxy` sans exposer les secrets dans le navigateur.
| **Nginx** | Point d'entrée unique HTTPS, reverse-proxy | 80 (redirection), 443 | Proxy `/`, `/api`, `/viewer` et `/orthanc-proxy`.

## Architecture
```
Utilisateur → Nginx (443)
  ├─ /            → Frontend React (4173)
  ├─ /api         → FastAPI (8000) → PostgreSQL (5432)
  └─ /viewer      → OHIF (3000) → /orthanc-proxy → Orthanc (REST/DICOMweb)
                          └─ Listener DICOM C-STORE (4242, interne)
```

## Prérequis
- Docker et Docker Compose installés.
- Ports 80/443 libres (ou à adapter dans `docker-compose.yml`).
- 4 Go de RAM recommandés pour l'ensemble des services.

## Démarrage rapide (Docker)
1. Cloner le dépôt puis se placer à la racine.
2. (Optionnel) Copier `.env.example` en `.env` et ajuster les variables si nécessaire.
3. Construire et lancer tous les services :
   ```bash
   docker-compose up --build
   ```
4. Attendre que PostgreSQL soit sain puis que FastAPI applique la création de schéma et le semis des données initiales.

Pour arrêter la stack :
```bash
docker-compose down
```

## Utilisation et URLs utiles
- **Frontend** : https://localhost/ (proxié par Nginx)
- **API FastAPI** : https://localhost/api (ou http://localhost:8000 en direct)
- **Documentation OpenAPI** : https://localhost/api/docs
- **Viewer OHIF** : https://localhost/viewer (ou http://localhost:3000 en direct)
- **DICOMweb proxifié** : https://localhost/orthanc-proxy (auth Basic injectée par Nginx)
- **Listener DICOM C-STORE** : interne au réseau Docker (`orthanc:4242`)

## Identifiants et données d'exemple
- **Administrateur par défaut** : `admin@imagine.fr` / `Admin123!`
- **Groupe créé** : `Administrateurs` (droits complets)
- **Patient de démonstration** : `Patient POC` (external_id `patient_test_poc`) afin d'éviter tout fallback de données en dur.

> Ces éléments sont créés au démarrage du backend (`backend/app/main.py`) et peuvent être modifiés ensuite via l'API ou directement en base.

## Développement local
### Installation des dépendances
- Frontend :
  ```bash
  npm install
  npm run dev
  ```
  L'API est attendue sur `VITE_API_BASE` (par défaut `/api`).

- Backend :
  ```bash
  pip install -r backend/requirements.txt
  uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
  ```
  Variables utiles : `POSTGRES_*`, `ORTHANC_USER`, `ORTHANC_PASSWORD` (voir `docker-compose.yml`).

### Migrations de base de données
Alembic est configuré pour suivre les évolutions du schéma SQLAlchemy :

```bash
cd backend
alembic upgrade head
```

Les URL de connexion sont dérivées des variables `POSTGRES_*`; la commande attend que la base soit accessible.

### Débogage et santé
- Endpoint de santé : `GET /health`
- Les tokens d'accès/refresh sont émis via `POST /auth/login` et `POST /auth/refresh`.
- Les droits des utilisateurs sont liés au groupe (voir modèles dans `backend/app/models.py`).

## Structure du dépôt
```
.
├─ App.tsx / components/      # UI React (login, dashboard patient/admin)
├─ backend/
│  ├─ app/
│  │  ├─ main.py              # FastAPI, CORS, semis initial, routes auth/groups
│  │  ├─ models.py            # Patients, Users, Groups avec droits
│  │  ├─ schemas.py           # Schémas Pydantic et réponses API
│  │  ├─ services/orthanc.py  # Client Orthanc
│  │  └─ dependencies.py      # Session DB, sécurité
│  └─ Dockerfile              # Image backend
├─ Dockerfile.frontend        # Build + preview Vite
├─ docker-compose.yml         # Orchestration frontend/backend/db/orthanc/ohif/nginx
├─ infra/
│  ├─ nginx.conf              # Reverse-proxy HTTPS + routage / /api /viewer
│  └─ ohif-config.js          # Configuration OHIF pointant sur Orthanc
├─ constants.ts / types.ts    # Types et constantes partagées frontend
└─ .env.example               # Variables d'environnement (Postgres, API)
```

## Personnalisation et points d'attention
- **SSL Nginx** : des certificats autosignés sont attendus dans `infra/certs` (`selfsigned.crt`/`selfsigned.key`). Remplacez-les pour un déploiement réel.
- **Sécurité Orthanc** : Orthanc n'est plus exposé publiquement ; les requêtes passent par `/orthanc-proxy` avec header Basic injecté. Changez les identifiants par défaut et régénérez la valeur encodée dans `infra/nginx.conf` si besoin.
- **Protection CSRF** : le refresh token HttpOnly est combiné à un cookie `csrf_token` (SameSite=Strict) à renvoyer dans l'en-tête `X-CSRF-Token` lors du refresh.
- **Limite d'upload** : `client_max_body_size 500g` dans `infra/nginx.conf` permet des lots volumineux ; adaptez selon vos besoins.
- **Migrations** : Alembic est fourni (`backend/alembic.ini`). Exécuter `alembic upgrade head` pour aligner le schéma sur les modèles SQLAlchemy.
- **Performances frontend** : la liste des patients ne déclenche plus de requêtes images systématiques ; le détail DICOM est chargé à la demande et mis en cache (React Query `staleTime`).
