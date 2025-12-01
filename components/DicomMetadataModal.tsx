import React, { useState, useEffect } from 'react';
import { X, AlertCircle, FileText, Search } from 'lucide-react';
import { MedicalImage } from '../types';

const API_BASE =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE ||
    '/api';

interface DicomMetadataModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: MedicalImage[];
    accessToken: string | null;
}

interface DicomTag {
    Name: string;
    Type: string;
    Value: any;
    PrivateCreator?: string;
}

interface DicomTagsResponse {
    [tag: string]: DicomTag;
}

export const DicomMetadataModal: React.FC<DicomMetadataModalProps> = ({
    isOpen,
    onClose,
    images,
    accessToken,
}) => {
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [tags, setTags] = useState<[string, DicomTag][]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const selectedImage = images[selectedImageIndex];

    useEffect(() => {
        if (!isOpen || !selectedImage) return;

        const fetchMetadata = async () => {
            setLoading(true);
            setError('');
            setTags([]);
            try {
                const response = await fetch(
                    `${API_BASE}/patients/instances/${selectedImage.id}/metadata`,
                    {
                        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                    }
                );

                if (!response.ok) {
                    throw new Error('Impossible de récupérer les métadonnées');
                }

                const data: DicomTagsResponse = await response.json();

                // Convert object to array and sort by tag
                const tagList = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
                setTags(tagList);

            } catch (err) {
                console.error(err);
                setError('Erreur lors du chargement des métadonnées DICOM');
            } finally {
                setLoading(false);
            }
        };

        fetchMetadata();
    }, [isOpen, selectedImage?.id, accessToken]);

    if (!isOpen) return null;

    const filteredTags = tags.filter(([tag, data]) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            tag.toLowerCase().includes(searchLower) ||
            data.Name.toLowerCase().includes(searchLower) ||
            String(data.Value).toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Métadonnées DICOM</h2>
                            <p className="text-sm text-slate-500">
                                {selectedImage?.description || 'Image DICOM'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Image Selector */}
                {images.length > 1 && (
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <label className="text-xs font-medium text-slate-600 uppercase mb-2 block">
                            Sélectionner une image ({images.length} disponibles)
                        </label>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {images.map((img, index) => (
                                <button
                                    key={img.id}
                                    onClick={() => setSelectedImageIndex(index)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${index === selectedImageIndex
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300'
                                        }`}
                                >
                                    Image {index + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher un tag, un nom ou une valeur..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-slate-500">Chargement des métadonnées...</div>
                        </div>
                    )}

                    {error && (
                        <div className="m-6 flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!loading && !error && (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Tag</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Nom</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">VR</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">Valeur</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredTags.map(([tag, data]) => (
                                    <tr key={tag} className="hover:bg-slate-50">
                                        <td className="px-6 py-2 text-sm font-mono text-slate-600 whitespace-nowrap">
                                            ({tag})
                                        </td>
                                        <td className="px-6 py-2 text-sm text-slate-900 font-medium">
                                            {data.Name}
                                        </td>
                                        <td className="px-6 py-2 text-sm font-mono text-slate-500">
                                            {data.Type}
                                        </td>
                                        <td className="px-6 py-2 text-sm text-slate-700 font-mono break-all">
                                            {typeof data.Value === 'object' ? JSON.stringify(data.Value) : String(data.Value)}
                                        </td>
                                    </tr>
                                ))}
                                {filteredTags.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            Aucun résultat trouvé
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};
