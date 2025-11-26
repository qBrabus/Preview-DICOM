import httpx
from fastapi import HTTPException

from ..core.config import settings


class OrthancClient:
    def __init__(self) -> None:
        auth = None
        if settings.orthanc_username and settings.orthanc_password:
            auth = (settings.orthanc_username, settings.orthanc_password)
        self._client = httpx.AsyncClient(base_url=settings.orthanc_url, auth=auth, timeout=30)

    async def list_instances(self, patient_id: str) -> list[str]:
        try:
            response = await self._client.get(f"/patients/{patient_id}/instances")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Orthanc indisponible")

    async def instance_metadata(self, instance_id: str) -> dict:
        try:
            response = await self._client.get(f"/instances/{instance_id}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Impossible de récupérer les métadonnées")

    async def stream_instance(self, instance_id: str) -> bytes:
        try:
            response = await self._client.get(f"/instances/{instance_id}/file")
            response.raise_for_status()
            return response.content
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Impossible de récupérer le fichier DICOM")

    async def upload_stream(self, file_stream) -> dict:
        try:
            response = await self._client.post("/instances", content=file_stream, headers={"Content-Type": "application/dicom"})
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Échec de l'envoi à Orthanc")

    async def delete_patient(self, patient_id: str) -> None:
        try:
            response = await self._client.delete(f"/patients/{patient_id}")
            response.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Impossible de supprimer le patient Orthanc")

    async def close(self):
        await self._client.aclose()


async def get_orthanc_client():
    client = OrthancClient()
    try:
        yield client
    finally:
        await client.close()
