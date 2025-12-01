
import requests
import zipfile
import io
import json
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import UID
import datetime
import os

API_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@imagine.fr"
ADMIN_PASSWORD = "Admin123!"

def create_dummy_dicom(filename="test.dcm"):
    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = UID('1.2.840.10008.5.1.4.1.1.7')
    file_meta.MediaStorageSOPInstanceUID = UID("1.2.3")
    file_meta.ImplementationClassUID = UID("1.2.3.4")

    ds = FileDataset(filename, {}, file_meta=file_meta, preamble=b"\0" * 128)
    ds.PatientName = "Test^Patient"
    ds.PatientID = "123456"
    ds.StudyInstanceUID = UID("1.2.3.4.5")
    ds.SeriesInstanceUID = UID("1.2.3.4.5.6")
    ds.SOPInstanceUID = UID("1.2.3.4.5.6.7")
    ds.SOPClassUID = UID('1.2.840.10008.5.1.4.1.1.7')
    ds.SeriesDescription = "Test Series"
    ds.Modality = "OT"
    ds.SeriesNumber = 1
    ds.InstanceNumber = 1
    
    # Set creation date/time
    dt = datetime.datetime.now()
    ds.ContentDate = dt.strftime('%Y%m%d')
    ds.ContentTime = dt.strftime('%H%M%S.%f')[:6]

    ds.is_little_endian = True
    ds.is_implicit_VR = True
    
    ds.save_as(filename)
    return filename

def login():
    response = requests.post(f"{API_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        exit(1)
    return response.json()["access_token"]

def create_patient_with_dicom(token):
    dicom_file = create_dummy_dicom()
    
    patient_data = {
        "id": "EXPORT_TEST_001",
        "firstName": "Export",
        "lastName": "Test",
        "dob": "2000-01-01",
        "condition": "Testing"
    }
    
    files = {
        "patient": (None, json.dumps(patient_data)),
        "dicom_files": ("test.dcm", open(dicom_file, "rb"), "application/dicom")
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Importing patient with DICOM...")
    response = requests.post(f"{API_URL}/patients/import", headers=headers, files=files)
    
    if response.status_code != 200:
        print(f"Import failed: {response.text}")
        exit(1)
        
    patient = response.json()
    print(f"Patient created: {patient['id']}")
    
    # Clean up
    os.remove(dicom_file)
    
    return patient

def verify_export(token, patient_id):
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test Single Export
    print(f"Testing Single Export for patient {patient_id}...")
    response = requests.get(f"{API_URL}/patients/{patient_id}/export", headers=headers)
    
    if response.status_code != 200:
        print(f"Single export failed: {response.text}")
    else:
        try:
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                print("Single Export Zip Contents:")
                z.printdir()
                files = z.namelist()
                if any(f.endswith(".dcm") for f in files) and any(f.endswith(".json") for f in files):
                    print("SUCCESS: Single export contains both JSON and DICOM.")
                else:
                    print("FAILURE: Single export missing files.")
        except zipfile.BadZipFile:
            print("FAILURE: Single export returned invalid zip.")

    # Test Bulk Export
    print(f"Testing Bulk Export for patient {patient_id}...")
    response = requests.post(f"{API_URL}/patients/export", headers=headers, json={"patient_ids": [patient_id]})
    
    if response.status_code != 200:
        print(f"Bulk export failed: {response.text}")
    else:
        try:
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                print("Bulk Export Zip Contents:")
                z.printdir()
                files = z.namelist()
                # Check for folder structure
                if any(f.endswith(".dcm") for f in files) and any(f.endswith(".json") for f in files):
                     print("SUCCESS: Bulk export contains both JSON and DICOM.")
                else:
                     print("FAILURE: Bulk export missing files.")
        except zipfile.BadZipFile:
            print("FAILURE: Bulk export returned invalid zip.")

if __name__ == "__main__":
    try:
        token = login()
        patient = create_patient_with_dicom(token)
        verify_export(token, patient['id'])
    except Exception as e:
        print(f"An error occurred: {e}")
