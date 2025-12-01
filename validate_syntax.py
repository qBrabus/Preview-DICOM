#!/usr/bin/env python3
"""
Script de validation pour vérifier la syntaxe de tous les fichiers Python  
avant le build Docker
"""
import ast
import sys
from pathlib import Path

def validate_python_file(filepath):
    """Validate Python syntax"""
    try:
        with open(filepath, 'r') as f:
            ast.parse(f.read())
        return True, None
    except SyntaxError as e:
        return False, str(e)

def main():
    backend_dir = Path('backend/app')
    errors = []
    
    # Files to check
    files_to_check = [
        backend_dir / 'main.py',
        backend_dir / 'schemas.py',
        backend_dir / 'models.py',
        backend_dir / 'dependencies.py',
        backend_dir / 'core/config.py',
        backend_dir / 'core/security.py',
        backend_dir / 'core/cache.py',
        backend_dir / 'core/exceptions.py',
        backend_dir / 'core/dicom_validator.py',
        backend_dir / 'services/audit_service.py',
        backend_dir / 'services/patient_service.py',
        backend_dir / 'services/user_service.py',
        backend_dir / 'routers/auth.py',
        backend_dir / 'routers/users.py',
        backend_dir / 'routers/groups.py',
        backend_dir / 'routers/patients.py',
        backend_dir / 'routers/stats.py',
    ]
    
    print("🔍 Validation de la syntaxe Python...")
    print("=" * 60)
    
    for filepath in files_to_check:
        if not filepath.exists():
            errors.append(f"❌ Fichier manquant: {filepath}")
            continue
            
        valid, error = validate_python_file(filepath)
        if valid:
            print(f"✅ {filepath.relative_to('backend/app')}")
        else:
            errors.append(f"❌ {filepath}: {error}")
            print(f"❌ {filepath.relative_to('backend/app')}: {error}")
    
    print("=" * 60)
    
    if errors:
        print(f"\n❌ {len(errors)} erreur(s) trouvée(s):")
        for error in errors:
            print(f"  {error}")
        return 1
    else:
        print("\n✅ Tous les fichiers Python sont valides!")
        return 0

if __name__ == '__main__':
    sys.exit(main())
