#!/bin/bash
# Script de déploiement des améliorations

echo "================================"
echo "PREVIEW DICOM - DÉPLOIEMENT"
echo "================================"

# 1. Arrêter les conteneurs existants
echo "1. Arrêt des conteneurs..."
docker-compose down -v

# 2. Générer les secrets si nécessaire
if [ ! -f .env ]; then
    echo "2. Génération des secrets..."
    cp .env.example .env
    
    # Générer des secrets aléatoires
    SECRET_KEY=$(openssl rand -hex 32)
    POSTGRES_PASS=$(openssl rand -hex 16)
    ORTHANC_PASS=$(openssl rand -hex 16)
    
    # Remplacer dans .env
    sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASS/" .env
    sed -i "s/ORTHANC_PASSWORD=.*/ORTHANC_PASSWORD=$ORTHANC_PASS/" .env
    
    echo "✅ Fichier .env créé avec secrets générés"
else
    echo "2. Fichier .env existe déjà"
fi

# 3. Reconstruire les images
echo "3. Reconstruction des images Docker..."
docker-compose build --no-cache

# 4. Démarrer les services
echo "4. Démarrage des services..."
docker-compose up -d

# 5. Attendre que la DB soit prête
echo "5. Attente de la base de données..."
sleep 10

# 6. Appliquer les migrations
echo "6. Application des migrations Alembic..."
docker-compose exec -T backend alembic upgrade head

# 7. Vérifier les services
echo ""
echo "================================"
echo "VÉRIFICATION DES SERVICES"
echo "================================"
docker-compose ps

echo ""
echo "✅ Déploiement terminé!"
echo "📝 Consultez le walkthrough.md pour plus de détails"
echo ""
echo "URLs:"
echo "  - Frontend: https://localhost/"
echo "  - API: https://localhost/api/docs"
echo "  - OHIF Viewer: https://localhost/viewer"
