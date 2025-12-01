# Preview-DICOM

Preview-DICOM est une plateforme web moderne et sécurisée dédiée à la gestion, l'archivage et la visualisation d'images médicales (DICOM). Elle est conçue pour faciliter la collaboration entre chercheurs et cliniciens au sein de l'Institut Imagine.

![Status](https://img.shields.io/badge/Status-Production%20Ready-green)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-Proprietary-red)

## 🚀 Fonctionnalités Clés

*   **Gestion des Patients** : Import/Export facile de dossiers patients (Support ZIP & DICOM natif).
*   **Visualisation Avancée** : Intégration complète du visualiseur **OHIF** pour une analyse radiologique fine.
*   **PACS Intégré** : Utilise **Orthanc** comme cœur de stockage DICOM robuste et standardisé.
*   **Sécurité** : Authentification JWT, protection CSRF, gestion fine des rôles (Admin/Chercheur).
*   **Audit** : Traçabilité complète des actions (Upload, Export, Suppression).
*   **Architecture Microservices** : Déploiement conteneurisé via Docker Compose.

## 📚 Documentation

La documentation complète est disponible dans le dossier `docs/` :

*   [**Architecture**](docs/architecture.md) : Vue d'ensemble technique, diagrammes et interaction des conteneurs.
*   [**Guide de Déploiement**](docs/deployment.md) : Installation, configuration Docker et mise en production.
*   [**Backend API**](docs/backend.md) : Détails sur l'API FastAPI, le schéma de base de données et la sécurité.
*   [**Frontend**](docs/frontend.md) : Structure de l'application React, gestion d'état et composants.
*   [**Guide Utilisateur**](docs/user_guide.md) : Manuel d'utilisation pour les chercheurs et administrateurs.

## 🛠 Stack Technique

| Composant | Technologie | Description |
|-----------|-------------|-------------|
| **Frontend** | React, TypeScript, Vite | Interface utilisateur réactive et moderne. |
| **Backend** | Python, FastAPI | API REST performante et asynchrone. |
| **Database** | PostgreSQL | Stockage relationnel des métadonnées. |
| **PACS** | Orthanc | Serveur DICOM standard. |
| **Viewer** | OHIF | Visualiseur d'images médicales web. |
| **Cache** | Redis | Gestion des sessions et cache. |
| **Gateway** | Nginx | Reverse proxy et terminaison SSL. |

## ⚡️ Démarrage Rapide

1.  **Prérequis** : Docker et Docker Compose installés.
2.  **Configuration** :
    ```bash
    cp .env.example .env
    # Éditez .env avec vos paramètres sécurisés
    ```
3.  **Lancement** :
    ```bash
    docker compose up -d --build
    ```
4.  **Accès** :
    *   Application : `https://localhost`
    *   Identifiants par défaut (si seedé) : `admin@imagine.fr` / `Admin123!`

## 🧪 Tests

Pour lancer les tests de vérification (API, Export, Auth) :

```bash
# Script de vérification complet
python3 verify_export.py
```

## 👥 Auteurs

Développé pour l'Institut Imagine.

---
*Pour plus de détails techniques, veuillez consulter le dossier [docs/](docs/).*
