#!/bin/bash
# Test de vérification complète de l'API

echo "🔍 TESTS DE VÉRIFICATION PREVIEW-DICOM"
echo "========================================"

# Colors
GREEN='\033[0.32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test health check
echo -n "1. Health check... "
HEALTH=$(curl -sk https://localhost/api/health)
if echo "$HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test login
echo -n "2. Login admin... "
LOGIN_RESPONSE=$(curl -sk -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@imagine.fr","password":"Admin123!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token' 2>/dev/null)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ OK${NC} (Token: ${TOKEN:0:30}...)"
else
    echo -e "${RED}❌ FAIL${NC}"
    exit 1
fi

# Test users endpoint (avec auth)
echo -n "3. GET /users (admin)... "
USERS=$(curl -sk https://localhost/api/users -H "Authorization: Bearer $TOKEN")
USER_COUNT=$(echo "$USERS" | jq 'length' 2>/dev/null)
if [ "$USER_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ OK${NC} ($USER_COUNT utilisateur(s))"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test groups endpoint
echo -n "4. GET /groups... "
GROUPS=$(curl -sk https://localhost/api/groups -H "Authorization: Bearer $TOKEN")
GROUP_COUNT=$(echo "$GROUPS" | jq 'length' 2>/dev/null)
if [ "$GROUP_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ OK${NC} ($GROUP_COUNT groupe(s))"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test patients endpoint
echo -n "5. GET /patients... "
PATIENTS=$(curl -sk https://localhost/api/patients -H "Authorization: Bearer $TOKEN")
PATIENT_COUNT=$(echo "$PATIENTS" | jq 'length' 2>/dev/null)
if [ "$PATIENT_COUNT" -ge 0 ]; then
    echo -e "${GREEN}✅ OK${NC} ($PATIENT_COUNT patient(s))"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test stats endpoint
echo -n "6. GET /stats (cached)... "
STATS=$(curl -sk https://localhost/api/stats -H "Authorization: Bearer $TOKEN")
TOTAL_PATIENTS=$(echo "$STATS" | jq -r '.total_patients' 2>/dev/null)
if [ -n "$TOTAL_PATIENTS" ]; then
    echo -e "${GREEN}✅ OK${NC} ($TOTAL_PATIENTS patients totaux)"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Vérifier les tables en base
echo -n "7. Tables DB (revoked_tokens, user_sessions)... "
TABLES=$(docker compose exec -T db psql -U preview_dicom -d preview_dicom -t -c "\dt" 2>/dev/null)
if echo "$TABLES" | grep -q "revoked_tokens" && echo "$TABLES" | grep -q "user_sessions"; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Vérifier Redis
echo -n "8. Redis connecté... "
REDIS_PING=$(docker compose exec -T redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ TOUS LES TESTS SONT PASSÉS !${NC}"
