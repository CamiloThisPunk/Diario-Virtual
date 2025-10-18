import React, { useState, useEffect, useRef } from 'react';

interface AiModalProps {
    isOpen: boolean;
    onClose: () => void;
    recommendation: string;
    isLoading: boolean;
}

const AiModal: React.FC<AiModalProps> = ({ isOpen, onClose, recommendation, isLoading }) => {
    const [isTtsEnabled, setIsTtsEnabled] = useState(false);
    const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

    const speak = (text: string) => {
        if ('speechSynthesis' in window && text && text.trim()) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 1.2;

            const spanishVoices = voicesRef.current.filter(v => v.lang.startsWith('es-'));
            const selectedVoice = 
                spanishVoices.find(v => v.lang === 'es-ES' && v.localService && v.name.includes('Google')) ||
                spanishVoices.find(v => v.lang === 'es-ES' && v.localService) ||
                spanishVoices.find(v => v.lang === 'es-ES') ||
                spanishVoices[0];

            if (selectedVoice) {
                utterance.voice = selectedVoice;
            } else {
                 console.warn('No Spanish voice found, using browser default.');
            }

            window.speechSynthesis.speak(utterance);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            window.speechSynthesis.cancel();
            return;
        }

        const loadVoices = () => {
            voicesRef.current = window.speechSynthesis.getVoices();
        };

        if ('speechSynthesis' in window) {
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && !isLoading && recommendation && isTtsEnabled) {
            speak(recommendation);
        }
    }, [isOpen, isLoading, recommendation, isTtsEnabled]);
    
    const handleClose = () => {
        window.speechSynthesis.cancel();
        onClose();
    };
    
    const toggleTts = () => {
        const turningOn = !isTtsEnabled;
        setIsTtsEnabled(turningOn);
        if (turningOn && !isLoading && recommendation) {
            speak(recommendation);
        } else {
            window.speechSynthesis.cancel();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 transition-opacity duration-300" onClick={handleClose}>
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full transform transition-all duration-300 scale-95 hover:scale-100" onClick={e => e.stopPropagation()}>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gradient-to-br from-teal-400 to-violet-500 h-16 w-16 rounded-full flex items-center justify-center shadow-lg">
                    <i className="fas fa-brain text-white text-2xl"></i>
                </div>
                <div className="flex justify-end">
                     <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>
                <div className="mt-4 text-center flex justify-center items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                       Mensaje de tu IA Empática
                    </h2>
                     <button
                        onClick={toggleTts}
                        title={isTtsEnabled ? "Desactivar voz" : "Activar voz"}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 shadow-sm
                            ${isTtsEnabled ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}
                        `}
                    >
                        <i className={`fas ${isTtsEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                    </button>
                </div>
                <div className="mt-6 text-slate-600 dark:text-slate-300 min-h-[150px] flex items-center justify-center">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
                            <p className="text-lg">Analizando tus pensamientos y emociones...</p>
                        </div>
                    ) : (
                        <p className="whitespace-pre-wrap leading-relaxed text-lg text-center">{recommendation}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiModal;