import React from 'react';

// Simple CSS spinner component
const Spinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex justify-center items-center">
      <div
        className={`animate-spin rounded-full border-t-transparent border-solid ${sizeClasses[size]} border-blue-500`}
        role="status"
        aria-label="loading"
      ></div>
    </div>
  );
};

export default Spinner;