from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr


class GroupBase(BaseModel):
    name: str
    description: Optional[str]
    can_edit_patients: bool = False
    can_export_data: bool = False
    can_manage_users: bool = False
    can_view_images: bool = True


class GroupCreate(GroupBase):
    pass


class GroupRead(GroupBase):
    id: int

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "user"
    status: str = "active"
    expiration_date: Optional[date]
    group_id: Optional[int]


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PatientBase(BaseModel):
    external_id: str
    first_name: str
    last_name: str
    condition: Optional[str]
    date_of_birth: Optional[str]
    last_visit: Optional[str]
    dicom_study_uid: Optional[str]
    orthanc_patient_id: Optional[str]


class PatientCreate(PatientBase):
    pass


class PatientRead(PatientBase):
    id: int

    class Config:
        orm_mode = True
