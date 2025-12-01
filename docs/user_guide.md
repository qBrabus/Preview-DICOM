# Guide Utilisateur

Bienvenue dans l'application Preview-DICOM. Ce guide décrit les fonctionnalités disponibles pour les différents types d'utilisateurs.

## Accès à l'application

1.  Ouvrez votre navigateur web (Chrome, Firefox, Edge recommandés).
2.  Naviguez vers l'URL fournie par votre administrateur (ex: `https://localhost`).
3.  Connectez-vous avec votre email et votre mot de passe.

---

## Pour les Chercheurs (Utilisateurs)

### Tableau de Bord Patient
Une fois connecté, vous accédez à la liste des patients.

*   **Recherche** : Utilisez la barre de recherche en haut pour filtrer par nom ou identifiant.
*   **Pagination** : Naviguez entre les pages en bas de la liste.

### Importer des Images
1.  Cliquez sur le bouton **"Importer"** en haut à droite.
2.  Glissez-déposez vos fichiers DICOM (`.dcm`) ou une archive ZIP contenant des fichiers DICOM.
3.  Attendez la fin du chargement. Les patients apparaîtront automatiquement dans la liste.

### Visualiser des Images
1.  Cliquez sur la ligne d'un patient.
2.  Le visualiseur OHIF s'ouvrira.
3.  Vous pouvez utiliser les outils de mesure, de zoom et de fenêtrage (windowing) disponibles dans la barre d'outils.

### Exporter des Données
Vous pouvez récupérer les données (Métadonnées JSON + Fichiers DICOM) pour vos recherches.

**Export Unique :**
1.  Sur la ligne d'un patient, cliquez sur le bouton **"Exporter"**.
2.  Un fichier ZIP sera téléchargé.

**Export Multiple (Bulk) :**
1.  Cochez les cases à gauche des patients que vous souhaitez exporter.
2.  Cliquez sur le bouton **"Exporter la sélection"** qui apparaît en haut.
3.  Une archive ZIP contenant un dossier par patient sera téléchargée.

### Gérer son Profil
1.  Cliquez sur votre avatar (cercle avec vos initiales) en haut à droite.
2.  Vous pouvez modifier :
    *   Votre nom complet.
    *   Votre adresse email.
    *   Votre mot de passe (le mot de passe actuel est requis).
3.  Cliquez sur "Sauvegarder".

---

## Pour les Administrateurs

En tant qu'administrateur, vous avez accès à un tableau de bord spécifique.

### Gestion des Utilisateurs
1.  Allez dans l'onglet **"Utilisateurs"**.
2.  **Créer** : Cliquez sur "Nouvel Utilisateur", remplissez le formulaire (Email, Nom, Rôle, Groupe).
3.  **Modifier** : Cliquez sur l'icône crayon pour modifier un utilisateur existant.
4.  **Supprimer** : Cliquez sur l'icône poubelle. **Attention** : Cette action est irréversible et supprimera également l'historique d'activité de cet utilisateur.

### Surveillance du Système
L'onglet **"Vue d'ensemble"** vous donne des indicateurs clés :
*   État des services (Base de données, Stockage, etc.).
*   Nombre total de patients et d'images.
*   Espace disque utilisé.

### Logs d'Audit
L'onglet **"Logs"** (si activé) permet de tracer les actions sensibles effectuées sur la plateforme (qui a exporté quoi, qui s'est connecté, etc.).
