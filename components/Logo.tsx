import React from 'react';
import { Dna } from 'lucide-react';

interface LogoProps {
  className?: string;
  iconSize?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", iconSize = 32 }) => {
  return (
    <div className={`flex items-center gap-2 font-bold text-indigo-900 ${className}`}>
      <div className="bg-indigo-600 p-2 rounded-lg text-white">
        <Dna size={iconSize} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm uppercase tracking-widest text-indigo-500">Institut</span>
        <span className="text-xl">Imagine</span>
      </div>
    </div>
  );
};
