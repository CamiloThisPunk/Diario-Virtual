import React, { useState, useEffect } from 'react';

interface DailyReminderToastProps {
    isOpen: boolean;
    onClose: () => void;
    onNewEntry: () => void;
}

const DailyReminderToast: React.FC<DailyReminderToastProps> = ({ isOpen, onClose, onNewEntry }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setIsExiting(false);
        }
    }, [isOpen]);
    
    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            onClose();
        }, 300); // Corresponds to animation duration
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed bottom-5 right-5 w-full max-w-sm z-50 ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}`}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-teal-400 to-violet-500 rounded-full flex items-center justify-center">
                         <i className="fas fa-feather-alt text-white"></i>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 dark:text-white">👋 ¿Qué tal tu día?</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                            No olvides registrar tus pensamientos. ¡Crear una entrada solo toma un momento!
                        </p>
                         <div className="mt-4 flex gap-2">
                            <button 
                                onClick={onNewEntry}
                                className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                Crear Entrada
                            </button>
                             <button 
                                onClick={handleClose}
                                className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                     <button onClick={handleClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyReminderToast;
