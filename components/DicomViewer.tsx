import React, { useEffect, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import { FileImage } from 'lucide-react';
import { MedicalImage } from '../types';

cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneWADOImageLoader.configure({ useWebWorkers: false });

interface DicomViewerProps {
  image: MedicalImage;
}

export const DicomViewer: React.FC<DicomViewerProps> = ({ image }) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    cornerstone.enable(element);
    setError(null);

    let imageId: string | null = null;
    const loadImage = async () => {
      try {
        if (image.file) {
          imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(image.file);
        } else {
          const absoluteUrl = image.url.startsWith('http')
            ? image.url
            : `${window.location.origin}${image.url}`;
          imageId = `wadouri:${absoluteUrl}`;
        }

        const loadedImage = await cornerstone.loadAndCacheImage(imageId);
        const viewport = cornerstone.getDefaultViewportForImage(element, loadedImage);
        cornerstone.displayImage(element, loadedImage, viewport);
      } catch (err) {
        console.error('Erreur lors du rendu DICOM', err);
        setError("Impossible d'afficher l'aperçu DICOM.");
      }
    };

    loadImage();

    return () => {
      if (imageId && image.file) {
        cornerstoneWADOImageLoader.wadouri.fileManager.remove(imageId);
      }
      cornerstone.disable(element);
    };
  }, [image]);

  if (error) {
    return (
      <div className="flex flex-col items-center text-slate-100 p-6 gap-3">
        <FileImage size={40} className="opacity-70" />
        <p className="text-sm font-semibold text-center">{image.id}</p>
        <p className="text-xs text-slate-300 text-center max-w-xs">{error}</p>
        <a
          href={image.url}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-xs font-medium text-white"
        >
          Ouvrir l'image
        </a>
      </div>
    );
  }

  return <div ref={elementRef} className="w-full h-full bg-slate-800" />;
};
