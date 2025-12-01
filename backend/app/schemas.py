from __future__ import annotations

from datetime import date
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

SAFE_TEXT_PATTERN = r"^[^<>]+$"


class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    can_edit_patients: bool = False
    can_export_data: bool = False
    can_manage_users: bool = False
    can_view_images: bool = True


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    can_edit_patients: Optional[bool] = None
    can_export_data: Optional[bool] = None
    can_manage_users: Optional[bool] = None
    can_view_images: Optional[bool] = None


class GroupRead(GroupBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, pattern=SAFE_TEXT_PATTERN)
    role: str = "user"
    status: str = "active"
    expiration_date: Optional[date] = None
    group_id: Optional[int] = None


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    expiration_date: Optional[date] = None
    group_id: Optional[int] = None
    password: Optional[str] = Field(default=None, min_length=8)


class UserProfileUpdate(BaseModel):
    """Schema for users updating their own profile"""
    full_name: Optional[str] = Field(default=None, min_length=1)
    email: Optional[EmailStr] = None
    current_password: str = Field(min_length=1)
    new_password: Optional[str] = Field(default=None, min_length=8)



class UserRead(UserBase):
    id: int
    group: Optional[GroupRead] = None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: int


class AuthResponse(Token):
    user: UserRead
    csrf_token: str


class PatientBase(BaseModel):
    external_id: str = Field(min_length=1, pattern=SAFE_TEXT_PATTERN)
    first_name: str = Field(min_length=1, pattern=SAFE_TEXT_PATTERN)
    last_name: str = Field(min_length=1, pattern=SAFE_TEXT_PATTERN)
    condition: Optional[str] = None
    date_of_birth: Optional[str] = None
    last_visit: Optional[str] = None
    dicom_study_uid: Optional[str] = None
    orthanc_patient_id: Optional[str] = None

    @field_validator(
        "condition", "date_of_birth", "last_visit", "dicom_study_uid", "orthanc_patient_id"
    )
    @classmethod
    def sanitize_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if any(symbol in str(value) for symbol in ("<", ">")):
            raise ValueError("Caractères HTML interdits dans les champs patients")
        return str(value).strip()


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    condition: Optional[str] = None
    date_of_birth: Optional[str] = None
    last_visit: Optional[str] = None
    status: Optional[str] = None


class PatientRead(PatientBase):
    id: int
    status: str = "À interpréter"
    has_images: bool = False
    image_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PatientSearchParams(BaseModel):
    """Parameters for patient search"""
    query: Optional[str] = Field(default=None, description="Search in name or external_id")
    condition: Optional[str] = Field(default=None, description="Filter by condition")
    status: Optional[str] = Field(default=None, description="Filter by status")
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)


class DicomImage(BaseModel):
    id: str
    url: str
    description: Optional[str] = None
    date: Optional[str] = None


class PatientExportRequest(BaseModel):
    patient_ids: List[int] = Field(min_length=1)


class StatsResponse(BaseModel):
    """System statistics response"""
    total_patients: int
    total_instances: int
    total_users: int
    active_users: int
