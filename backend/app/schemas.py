from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, constr, validator

SAFE_TEXT_PATTERN = r"^[^<>]+$"


class GroupBase(BaseModel):
    name: str
    description: Optional[str]
    can_edit_patients: bool = False
    can_export_data: bool = False
    can_manage_users: bool = False
    can_view_images: bool = True


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str]
    description: Optional[str]
    can_edit_patients: Optional[bool]
    can_export_data: Optional[bool]
    can_manage_users: Optional[bool]
    can_view_images: Optional[bool]


class GroupRead(GroupBase):
    id: int

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    email: EmailStr
    full_name: constr(strip_whitespace=True, min_length=1, regex=SAFE_TEXT_PATTERN)
    role: str = "user"
    status: str = "active"
    expiration_date: Optional[date]
    group_id: Optional[int]


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr]
    full_name: Optional[str]
    role: Optional[str]
    status: Optional[str]
    expiration_date: Optional[date]
    group_id: Optional[int]
    password: Optional[str]


class UserRead(UserBase):
    id: int
    group: Optional[GroupRead]

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: int


class AuthResponse(Token):
    user: "UserRead"
    csrf_token: str


class PatientBase(BaseModel):
    external_id: constr(strip_whitespace=True, min_length=1, regex=SAFE_TEXT_PATTERN)
    first_name: constr(strip_whitespace=True, min_length=1, regex=SAFE_TEXT_PATTERN)
    last_name: constr(strip_whitespace=True, min_length=1, regex=SAFE_TEXT_PATTERN)
    condition: Optional[str]
    date_of_birth: Optional[str]
    last_visit: Optional[str]
    dicom_study_uid: Optional[str]
    orthanc_patient_id: Optional[str]

    @validator(
        "condition", "date_of_birth", "last_visit", "dicom_study_uid", "orthanc_patient_id"
    )
    def sanitize_optional(cls, value: Optional[str]):
        if value is None:
            return value
        if any(symbol in str(value) for symbol in ("<", ">")):
            raise ValueError("Caractères HTML interdits dans les champs patients")
        return str(value).strip()


class PatientCreate(PatientBase):
    pass


class PatientRead(PatientBase):
    id: int
    has_images: bool = False
    image_count: int = 0

    class Config:
        orm_mode = True


class DicomImage(BaseModel):
    id: str
    url: str
    description: Optional[str] = None
    date: Optional[str] = None
