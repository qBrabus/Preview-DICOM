# Documentation Backend

Le backend est une application **FastAPI** (Python 3.11) structurée de manière modulaire.

## Structure du Code (`backend/app/`)

*   `main.py` : Point d'entrée, configuration CORS, inclusion des routeurs.
*   `models.py` : Définitions des modèles de base de données (SQLAlchemy).
*   `schemas.py` : Schémas Pydantic pour la validation des données (Request/Response).
*   `routers/` : Contrôleurs divisés par domaine (`auth.py`, `users.py`, `patients.py`, `stats.py`).
*   `services/` : Logique métier (`user_service.py`, `patient_service.py`, `audit_service.py`).
*   `core/` : Configuration, sécurité, gestion des erreurs.
*   `utils/` : Utilitaires (client Orthanc).

## Base de Données (PostgreSQL)

### Schéma Relationnel

#### `users`
*   `id` (PK): Identifiant unique.
*   `email` (Unique): Email de connexion.
*   `hashed_password`: Hash bcrypt du mot de passe.
*   `role`: 'admin' ou 'user'.
*   `status`: 'active', 'inactive', etc.
*   `group_id` (FK): Lien vers un groupe de recherche.

#### `patients`
*   `id` (PK): Identifiant interne.
*   `external_id` (Unique): Identifiant hôpital/étude (IPP).
*   `orthanc_patient_id`: ID interne Orthanc (lien vers les fichiers DICOM).
*   `dicom_study_uid`: UID de l'étude DICOM.
*   `status`: État du dossier ('À interpréter', 'Validé', etc.).
*   `first_name`, `last_name`, `date_of_birth`: Données démographiques.

#### `audit_logs`
*   Trace toutes les actions critiques (LOGIN, CREATE, DELETE, EXPORT).
*   Lié à `user_id`.

#### `user_sessions`
*   Gère les sessions actives pour supporter le multi-device et la révocation.

## API Endpoints

### Authentification (`/api/auth`)
*   `POST /login` : Authentification email/password. Retourne Access + Refresh tokens (Cookies).
*   `POST /refresh` : Renouvelle l'Access token via le Refresh token.
*   `POST /logout` : Invalide les tokens et supprime la session.

### Utilisateurs (`/api/users`)
*   `GET /` : Liste les utilisateurs (Admin seulement).
*   `POST /` : Crée un utilisateur (Admin seulement).
*   `PUT /me/profile` : Mise à jour du profil par l'utilisateur lui-même (Nom, Email, Password).
*   `DELETE /{id}` : Supprime un utilisateur et ses données associées (Logs, Sessions).

### Patients (`/api/patients`)
*   `GET /` : Liste les patients avec pagination et recherche.
*   `POST /import` : Importe un ZIP ou des fichiers DICOM.
*   `GET /{id}/export` : Télécharge un ZIP (JSON + DICOM) pour un patient.
*   `POST /export` : Export en masse (Bulk) de plusieurs patients.
*   `GET /images/{instance_id}` : Proxy pour récupérer une image DICOM brute.

## Sécurité

### Authentification JWT
L'application utilise une stratégie de double token :
1.  **Access Token** (Durée courte, ex: 15min) : Utilisé pour autoriser les requêtes API.
2.  **Refresh Token** (Durée longue, ex: 7 jours) : Utilisé uniquement pour obtenir un nouvel Access Token.

**Stockage** : Les tokens sont stockés dans des cookies `HttpOnly` et `Secure` (en prod) pour empêcher les attaques XSS.

### Protection CSRF
Un token CSRF est généré à la connexion et doit être envoyé dans le header `X-CSRF-Token` pour toutes les requêtes mutantes (POST, PUT, DELETE).

### Mots de Passe
*   Algorithme : **bcrypt**.
*   Vérification stricte lors des mises à jour de profil.

### Audit
Toute action sensible est loggée dans la table `audit_logs` avec l'ID de l'utilisateur, l'action, et la ressource concernée.
