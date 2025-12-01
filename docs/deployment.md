# Guide de Déploiement

Ce guide explique comment déployer, configurer et maintenir l'application Preview-DICOM.

## Prérequis

*   **Docker** (v20.10+)
*   **Docker Compose** (v2.0+)
*   **Git**

## Installation Rapide

1.  **Cloner le dépôt** :
    ```bash
    git clone <repository-url>
    cd Preview-DICOM
    ```

2.  **Configuration** :
    Copiez le fichier d'exemple et ajustez les valeurs.
    ```bash
    cp .env.example .env
    ```

3.  **Lancement** :
    ```bash
    docker compose up -d --build
    ```

4.  **Accès** :
    Ouvrez `https://localhost` (Acceptez le certificat auto-signé).

## Configuration (`.env`)

Voici les variables essentielles à configurer dans le fichier `.env` :

### Base de Données
*   `POSTGRES_USER` : Utilisateur de la DB (ex: `preview_dicom`).
*   `POSTGRES_PASSWORD` : Mot de passe fort.
*   `POSTGRES_DB` : Nom de la base.

### Orthanc (PACS)
*   `ORTHANC_USER` : Utilisateur admin pour Orthanc.
*   `ORTHANC_PASSWORD` : Mot de passe pour Orthanc.
*   `ORTHANC_URL` : URL interne (généralement `http://orthanc:8042`).

### Sécurité Backend
*   `SECRET_KEY` : Clé secrète pour la signature JWT (Générez une chaîne aléatoire longue).
*   `COOKIE_SECURE` : `True` en production (HTTPS), `False` en dev local.

### Frontend
*   `VITE_API_BASE` : URL de base de l'API (ex: `/api`).

## Architecture Docker

Le fichier `docker-compose.yml` orchestre 6 services :

| Service | Image | Description | Dépendances |
|---------|-------|-------------|-------------|
| `nginx` | `nginx:1.25-alpine` | Gateway, SSL, Proxy | frontend, backend, ohif |
| `frontend` | Custom (`Dockerfile.frontend`) | Serveur statique React | backend |
| `backend` | Custom (`backend/Dockerfile`) | API FastAPI | db, redis, orthanc |
| `db` | `postgres:15` | Base de données principale | - |
| `redis` | `redis:7-alpine` | Cache et Sessions | - |
| `orthanc` | `osimis/orthanc:22.11.2` | Serveur DICOM | - |
| `ohif` | `ohif/viewer:latest` | Visualiseur DICOM | orthanc |

## Volumes (Persistance)

*   `pgdata` : Stocke les données PostgreSQL.
*   `orthanc-storage` : Stocke les fichiers DICOM bruts.

**Note** : Pour une sauvegarde complète, vous devez sauvegarder ces deux volumes.

## Maintenance

### Logs
Pour voir les logs d'un service spécifique :
```bash
docker compose logs -f backend
```

### Mise à jour
Pour mettre à jour l'application après un `git pull` :
```bash
docker compose down
docker compose up -d --build
```

### Certificats SSL
Par défaut, le projet utilise des certificats auto-signés dans `infra/certs/`. Pour la production, remplacez `selfsigned.crt` et `selfsigned.key` par des certificats valides (ex: Let's Encrypt).

## Dépannage Courant

*   **Erreur 502 Bad Gateway** : Le backend n'est pas encore prêt. Attendez quelques secondes ou vérifiez les logs (`docker compose logs backend`).
*   **Erreur de connexion DB** : Vérifiez que les identifiants dans `.env` correspondent à ceux du service `db`.
*   **Problème d'upload DICOM** : Vérifiez la directive `client_max_body_size` dans `infra/nginx.conf` (par défaut 500g).
