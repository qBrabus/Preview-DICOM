from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)

    can_edit_patients = Column(Boolean, default=False)
    can_export_data = Column(Boolean, default=False)
    can_manage_users = Column(Boolean, default=False)
    can_view_images = Column(Boolean, default=True)

    users = relationship("User", back_populates="group")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    status = Column(String, default="active")
    expiration_date = Column(Date, nullable=True)

    group_id = Column(Integer, ForeignKey("groups.id"))
    group = relationship("Group", back_populates="users")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String, unique=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    condition = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)
    last_visit = Column(String, nullable=True)

    dicom_study_uid = Column(String, nullable=True)
    orthanc_patient_id = Column(String, nullable=True)
