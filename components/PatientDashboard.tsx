import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  ChevronRight, 
  Edit, 
  Download, 
  Upload, 
  ChevronLeft, 
  Shield, 
  LogOut,
  Search,
  FileImage,
  Calendar,
  Save,
  X,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { Logo } from './Logo';
import { User, Patient, ViewState } from '../types';
import { DicomViewer } from './DicomViewer';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  '/api';

interface PatientDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: ViewState) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ user, onLogout, onNavigate }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Patient | null>(null);

  useEffect(() => {
    if (fileInputRef.current) {
      const input = fileInputRef.current as HTMLInputElement & {
        webkitdirectory?: boolean;
        mozdirectory?: boolean;
        directory?: boolean;
      };
      input.webkitdirectory = true;
      input.mozdirectory = true;
      input.directory = true;
      input.multiple = true;
    }
  }, []);

  const mapApiPatientToState = (patient: any, images: Patient['images'] = []): Patient => ({
    id: patient.external_id || patient.id?.toString(),
    recordId: patient.id,
    firstName: patient.first_name,
    lastName: patient.last_name,
    dob: patient.date_of_birth || '',
    condition: patient.condition || '',
    lastVisit: patient.last_visit || '',
    dicomStudyUid: patient.dicom_study_uid || '',
    orthancPatientId: patient.orthanc_patient_id || '',
    images,
  });

  // Derived state for searching
  const filteredPatients = patients.filter(p => 
    p.lastName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE}/patients`);
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des patients');
        }

        const data = await response.json();
        const mappedPatients: Patient[] = data.map((patient: any) => mapApiPatientToState(patient));

        const patientsWithImages = await Promise.all(
          mappedPatients.map(async (patient) => {
            if (!patient.recordId) return patient;

            try {
              const imagesResponse = await fetch(`${API_BASE}/patients/${patient.recordId}/images`);
              if (!imagesResponse.ok) {
                throw new Error('Impossible de récupérer les images DICOM');
              }

              const images = await imagesResponse.json();
              return { ...patient, images };
            } catch (imageError) {
              console.error(imageError);
              return patient;
            }
          })
        );

        setPatients(patientsWithImages);
        if (patientsWithImages.length > 0) {
          setSelectedPatientId(patientsWithImages[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Impossible de récupérer les patients.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatients();
  }, []);

  useEffect(() => {
    // Reset edit mode when changing patient
    setIsEditing(false);
    setEditForm(null);
    setCurrentImageIndex(0);
  }, [selectedPatientId]);

  // -- Handlers --

  const handleNextImage = () => {
    if (!selectedPatient || !selectedPatient.images.length) return;
    setCurrentImageIndex((prev) => (prev + 1) % selectedPatient.images.length);
  };

  const handlePrevImage = () => {
    if (!selectedPatient || !selectedPatient.images.length) return;
    setCurrentImageIndex((prev) => (prev - 1 + selectedPatient.images.length) % selectedPatient.images.length);
  };

  const handlePatientSelect = (id: string) => {
    setSelectedPatientId(id);
    setCurrentImageIndex(0);
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredPatients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map(p => p.id)));
    }
  };

  // Export Logic (Single or Multi)
  const handleExport = () => {
    const idsToExport = selectedIds.size > 0 ? Array.from(selectedIds) : selectedPatientId ? [selectedPatientId] : [];

    if (idsToExport.length === 0) return;

    const patientsToExport = patients.filter(p => idsToExport.includes(p.id));
    
    const dataStr = JSON.stringify(patientsToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = idsToExport.length === 1 
      ? `${patientsToExport[0].lastName}_${patientsToExport[0].firstName}_dossier.json`
      : `export_patients_imagine_${idsToExport.length}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import Logic
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsLoading(true);
    setError('');
    const groupedFiles: Record<string, { jsonFile?: File; dicomFiles: File[] }> = {};

    Array.from(e.target.files).forEach((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const pathParts = relativePath.split('/').filter(Boolean);

      // Identify the patient folder name even if the user selected a parent directory
      // that contains multiple patient folders.
      const directories = pathParts.slice(0, -1); // remove file name
      const folderName =
        directories.find((part) => /^patient[-_]?/i.test(part)) ||
        directories[directories.length - 1] ||
        pathParts[0];

      if (!groupedFiles[folderName]) {
        groupedFiles[folderName] = { dicomFiles: [] };
      }

      if (file.name.toLowerCase().endsWith('.json')) {
        groupedFiles[folderName].jsonFile = file;
      } else if (file.name.toLowerCase().endsWith('.dcm')) {
        groupedFiles[folderName].dicomFiles.push(file);
      }
    });

    const currentIds = new Set(patients.map((p) => p.id));
    const importedPatients: Patient[] = [];

    for (const folder of Object.keys(groupedFiles)) {
      const { jsonFile, dicomFiles } = groupedFiles[folder];
      if (!jsonFile) continue;

      try {
        const content = await jsonFile.text();
        const parsed = JSON.parse(content);
        const parsedPatients: Patient[] = Array.isArray(parsed) ? parsed : [parsed];

        for (const patientData of parsedPatients) {
          if (!patientData.id || !patientData.lastName) continue;
          if (currentIds.has(patientData.id)) continue;

          const dicomImages = dicomFiles.map((file) => ({
            id: file.name,
            url: URL.createObjectURL(file),
            description: 'Image DICOM importée',
            date: new Date().toISOString().split('T')[0],
            file,
          }));

          const payload = {
            external_id: patientData.id,
            first_name: patientData.firstName,
            last_name: patientData.lastName,
            condition: patientData.condition || '',
            date_of_birth: patientData.dob || '',
            last_visit: patientData.lastVisit || '',
            dicom_study_uid: (patientData as any).dicomStudyUid || '',
            orthanc_patient_id: (patientData as any).orthancPatientId || '',
          };

          const formData = new FormData();
          formData.append('patient', JSON.stringify(payload));
          dicomFiles.forEach((file) => formData.append('dicom_files', file));

          const response = await fetch(`${API_BASE}/patients/import`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Import patient ${patientData.id} failed: ${response.status}`);
          }

          const savedPatient = await response.json();
          importedPatients.push(mapApiPatientToState(savedPatient, dicomImages));
          currentIds.add(patientData.id);
        }
      } catch (err) {
        console.error(`Erreur lors de la lecture du dossier ${folder}`, err);
        setError('Impossible d\'importer tous les dossiers. Consultez la console pour plus de détails.');
      }
    }

    if (importedPatients.length > 0) {
      setPatients((prev) => [...prev, ...importedPatients]);
      alert(`${importedPatients.length} patient(s) importé(s) avec succès depuis ${Object.keys(groupedFiles).length} dossier(s).`);
    } else {
      alert('Aucun nouveau patient importé. Vérifiez les dossiers ou les IDs existants.');
    }

    e.target.value = '';
    setIsLoading(false);
  };

  // Delete Logic
  const handleDelete = () => {
    const idsToDelete = selectedIds.size > 0 ? Array.from(selectedIds) : selectedPatientId ? [selectedPatientId] : [];

    if (idsToDelete.length === 0) return;

    if (confirm(`Êtes-vous sûr de vouloir supprimer ${idsToDelete.length} patient(s) ? Cette action est irréversible.`)) {
        const requests = idsToDelete.map((patientId) => {
            const patient = patients.find((p) => p.id === patientId);
            if (!patient?.recordId) return Promise.resolve({ ok: false });
            return fetch(`${API_BASE}/patients/${patient.recordId}`, { method: 'DELETE' });
        });

        Promise.all(requests).then((responses) => {
            const failed = responses.filter((res) => !res.ok).length;
            if (failed > 0) {
                setError('Certaines suppressions n\'ont pas pu être effectuées.');
            }

            const remainingPatients = patients.filter(p => !idsToDelete.includes(p.id));
            setPatients(remainingPatients);
            setSelectedIds(new Set());
            // Select first available if current was deleted
            if (remainingPatients.length > 0) {
                setSelectedPatientId(remainingPatients[0].id);
            } else {
                setSelectedPatientId('');
            }
        }).catch(() => {
            setError('Erreur lors de la suppression des patients.');
        });
    }
  };

  // Edit Logic
  const handleEdit = () => {
    if (!selectedPatient) return;
    setEditForm({ ...selectedPatient });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      const updatedPatients = patients.map(p => p.id === editForm.id ? editForm : p);
      setPatients(updatedPatients);
      setIsEditing(false);
      setEditForm(null);
    }
  };

  const handleInputChange = (field: keyof Patient, value: string) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  useEffect(() => {
    if (!selectedPatient) return;
    if (currentImageIndex >= selectedPatient.images.length) {
      setCurrentImageIndex(0);
    }
  }, [selectedPatient, currentImageIndex]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
        <Logo iconSize={24} />
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-500">{user.role === 'admin' ? 'Administrateur' : 'Médecin Chercheur'}</p>
          </div>
          <div className="h-8 w-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <button onClick={onLogout} className="text-slate-400 hover:text-red-500 transition-colors p-2" title="Déconnexion">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content - Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT COLUMN: Patient List & Global Actions */}
        <aside className="w-1/3 min-w-[350px] max-w-md bg-white border-r border-slate-200 flex flex-col z-0">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Users size={20} className="text-indigo-600" />
              Liste des Patients
            </h2>
            <div className="relative mb-2">
              <input 
                type="text" 
                placeholder="Rechercher (Nom, ID)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
            
            {/* Batch Selection Header */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 mt-2">
                <button onClick={handleSelectAll} className="flex items-center gap-1 hover:text-indigo-600">
                    {selectedIds.size > 0 && selectedIds.size === filteredPatients.length ? <CheckSquare size={14}/> : <Square size={14}/>}
                    Tout sélectionner
                </button>
                <span>{filteredPatients.length} patients</span>
            </div>
            {isLoading && (
              <div className="mt-3 text-xs text-slate-500">Chargement des patients...</div>
            )}
            {error && (
              <div className="mt-3 p-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg">{error}</div>
            )}
          </div>

          {/* Scrollable Patient List */}
          <div className="flex-1 overflow-y-auto">
            {filteredPatients.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                    Aucun patient trouvé.
                </div>
            ) : (
                filteredPatients.map((patient) => (
                <div 
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient.id)}
                    className={`p-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 flex items-start gap-3 ${selectedPatientId === patient.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}
                >
                    {/* Checkbox for batch actions */}
                    <div onClick={(e) => toggleSelection(e, patient.id)} className="mt-1 text-slate-400 hover:text-indigo-600">
                         {selectedIds.has(patient.id) ? <CheckSquare size={18} className="text-indigo-600"/> : <Square size={18}/>}
                    </div>

                    <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                        <h3 className={`font-semibold text-sm ${selectedPatientId === patient.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {patient.lastName.toUpperCase()} {patient.firstName}
                        </h3>
                        <p className="text-xs text-slate-500">ID: {patient.id}</p>
                        </div>
                        {selectedPatientId === patient.id && <ChevronRight size={16} className="text-indigo-500 mt-1" />}
                    </div>
                    </div>
                </div>
                ))
            )}
          </div>

          {/* Action Buttons Area */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
             <div className="flex flex-col gap-2">
                {selectedIds.size > 0 && (
                    <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded text-xs font-medium text-center mb-2">
                        {selectedIds.size} patient(s) sélectionné(s)
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                   <button 
                    onClick={handleEdit}
                    disabled={isEditing || selectedIds.size > 1}
                    className={`flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg transition-all shadow-sm group ${isEditing || selectedIds.size > 1 ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-500 hover:text-indigo-600'}`}
                    title="Éditer le patient actif"
                  >
                    <Edit size={18} className="mb-1 text-slate-400 group-hover:text-indigo-600" />
                    <span className="text-[10px] font-medium uppercase">Éditer</span>
                  </button>

                  <button 
                    onClick={handleExport}
                    className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group"
                    title={selectedIds.size > 0 ? "Exporter la sélection" : "Exporter le patient actif"}
                  >
                    <Download size={18} className="mb-1 text-slate-400 group-hover:text-indigo-600" />
                    <span className="text-[10px] font-medium uppercase">Exporter</span>
                  </button>

                  <button 
                    onClick={handleDelete}
                    className="flex flex-col items-center justify-center p-2 bg-white border border-slate-200 rounded-lg hover:border-red-500 hover:text-red-600 transition-all shadow-sm group"
                    title="Supprimer la sélection ou le patient actif"
                  >
                    <Trash2 size={18} className="mb-1 text-slate-400 group-hover:text-red-600" />
                    <span className="text-[10px] font-medium uppercase">Supprimer</span>
                  </button>
                </div>

                <div className="flex gap-2">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      // @ts-ignore – required to allow folder selection with multiple directories
                      webkitdirectory="true"
                      // @ts-ignore
                      mozdirectory="true"
                      // @ts-ignore
                      directory="true"
                      accept=".json,.dcm"
                    />
                    <button 
                        onClick={handleImportClick}
                        className="flex-1 flex items-center justify-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm group"
                    >
                        <Upload size={16} className="text-slate-400 group-hover:text-indigo-600" />
                        <span className="text-xs font-medium">Importer</span>
                    </button>
                    
                    <button 
                    onClick={() => onNavigate(ViewState.ADMIN_DASHBOARD)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all shadow-md"
                    >
                    <Shield size={16} />
                    <span className="text-xs font-medium">Admin</span>
                    </button>
                </div>

             </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Preview & Carousel */}
        <main className="flex-1 p-6 overflow-y-auto bg-slate-50 flex flex-col">
          {selectedPatient ? (
            <>
                {/* Patient Header Info */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    {!isEditing ? (
                    // VIEW MODE
                    <>
                        <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{selectedPatient.firstName} {selectedPatient.lastName}</h1>
                            <p className="text-indigo-600 font-medium">{selectedPatient.condition}</p>
                        </div>
                        <div className="text-right text-sm text-slate-500">
                            <p>ID: <span className="font-mono text-slate-700">{selectedPatient.id}</span></p>
                            <p>Dernière visite: {selectedPatient.lastVisit}</p>
                        </div>
                        </div>
                        
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={18} /></div>
                            <div>
                            <p className="text-xs text-slate-500">Date de naissance</p>
                            <p className="text-sm font-medium text-slate-800">{selectedPatient.dob}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><FileImage size={18} /></div>
                            <div>
                            <p className="text-xs text-slate-500">Images</p>
                            <p className="text-sm font-medium text-slate-800">{selectedPatient.images.length} fichiers</p>
                            </div>
                        </div>
                        </div>
                    </>
                    ) : (
                    // EDIT MODE
                    <div className="animate-in fade-in duration-300">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800">Édition du dossier</h2>
                        <div className="flex gap-2">
                            <button onClick={handleCancelEdit} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
                            <button onClick={handleSaveEdit} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Save size={16} /> Enregistrer</button>
                        </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase">Prénom</label>
                            <input 
                            type="text" 
                            value={editForm?.firstName} 
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase">Nom</label>
                            <input 
                            type="text" 
                            value={editForm?.lastName} 
                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 uppercase">Pathologie / Condition</label>
                            <input 
                            type="text" 
                            value={editForm?.condition} 
                            onChange={(e) => handleInputChange('condition', e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase">Date de naissance</label>
                            <input 
                            type="text" 
                            value={editForm?.dob} 
                            onChange={(e) => handleInputChange('dob', e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase">Dernière visite</label>
                            <input 
                            type="date" 
                            value={editForm?.lastVisit} 
                            onChange={(e) => handleInputChange('lastVisit', e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        </div>
                    </div>
                    )}
                </div>

                {/* Carousel Section */}
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h3 className="font-semibold text-slate-800">Imagerie Médicale</h3>
                    {selectedPatient.images.length > 0 && (
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                        Image {currentImageIndex + 1} / {selectedPatient.images.length}
                        </span>
                    )}
                    </div>

                    <div className="flex-1 bg-slate-900 relative flex flex-col overflow-hidden group">
                      {selectedPatient.images.length > 0 ? (
                        <>
                          <div className="relative flex-1 w-full h-full overflow-hidden">
                            <div
                              className="absolute inset-0 flex transition-transform duration-500"
                              style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                            >
                              {selectedPatient.images.map((image, index) => (
                                <div
                                  key={image.id || index}
                                  className="min-w-full h-full flex items-center justify-center p-6"
                                >
                                  <div className="w-full h-full bg-slate-800 rounded-lg border border-slate-700 flex flex-col items-center justify-center overflow-hidden">
                                    <DicomViewer image={image} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Overlay Info */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-4 text-white flex items-center justify-between">
                            <div>
                              <p className="font-medium">{selectedPatient.images[currentImageIndex].description}</p>
                              <p className="text-xs text-slate-300">{selectedPatient.images[currentImageIndex].date}</p>
                            </div>
                            <span className="text-xs bg-white/10 px-3 py-1 rounded-full">
                              {currentImageIndex + 1} / {selectedPatient.images.length}
                            </span>
                          </div>

                          {/* Controls */}
                          {selectedPatient.images.length > 1 && (
                            <>
                              <button
                                onClick={handlePrevImage}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-all"
                                aria-label="Image précédente"
                              >
                                <ChevronLeft size={24} />
                              </button>
                              <button
                                onClick={handleNextImage}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-all"
                                aria-label="Image suivante"
                              >
                                <ChevronRight size={24} />
                              </button>
                            </>
                          )}

                          {/* Thumbnail rail */}
                          {selectedPatient.images.length > 1 && (
                            <div className="bg-slate-800 border-t border-slate-700 px-3 py-2 flex items-center gap-2 overflow-x-auto">
                              {selectedPatient.images.map((image, index) => (
                                <button
                                  key={`thumb-${image.id || index}`}
                                  onClick={() => setCurrentImageIndex(index)}
                                  className={`px-3 py-2 rounded-md text-xs font-medium border transition-all whitespace-nowrap ${
                                    index === currentImageIndex
                                      ? 'bg-indigo-600 text-white border-indigo-500'
                                      : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'
                                  }`}
                                >
                                  {image.id || `Image ${index + 1}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-slate-500 flex flex-col items-center justify-center flex-1">
                          <FileImage size={48} className="mb-4 opacity-50" />
                          <p>Aucune image disponible pour ce patient.</p>
                        </div>
                      )}
                    </div>
                </div>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Users size={64} className="mb-4 opacity-20" />
                <p>Sélectionnez un patient pour voir les détails.</p>
             </div>
          )}
        </main>
      </div>
    </div>
  );
};