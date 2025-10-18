
import React, { useState, useEffect, useRef } from 'react';
import { Entry, Mood, Moods, HourData } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { playSaveSound, playDeleteSound } from '../utils/soundUtils';

// FIX: Define types for the Web Speech API to avoid TypeScript errors.
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    lang: string;
    interimResults: boolean;
    onresult: (event: any) => void;
    onend: () => void;
    onerror: (event: any) => void;
    start: () => void;
    stop: () => void;
    abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

interface EntryEditorProps {
    entry: Entry | null;
    onSave: (entry: Entry) => void;
    onDelete: (id: string) => void;
    onGetAiRecommendation: () => void;
    onExportJson: () => void;
    onExportAllPdf: () => void;
    onExportSinglePdf: (id: string) => void;
}

const TimelineEditor: React.FC<{ content: Record<string, HourData>; onChange: (hour: string, data: HourData) => void }> = ({ content, onChange }) => {
    const [expandedHour, setExpandedHour] = useState<string | null>(() => {
         const currentHour = new Date().getHours().toString().padStart(2, '0') + ":00";
         return currentHour;
    });
    const [focusedHour, setFocusedHour] = useState<string | null>(null);
    const [recordingHour, setRecordingHour] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const manualStopRef = useRef(false);

    // Create a ref to hold props and state that our callbacks need to avoid stale closures.
    const callbackPropsRef = useRef({ content, onChange, recordingHour });
    useEffect(() => {
        callbackPropsRef.current = { content, onChange, recordingHour };
    });

    // Setup Speech Recognition - run only once on mount
    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
            // Build the transcript from the new results
            let newTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                newTranscript += event.results[i][0].transcript;
            }

            if (newTranscript) {
                const { content, onChange, recordingHour: currentRecordingHour } = callbackPropsRef.current;
                if (currentRecordingHour) {
                    const existingText = content[currentRecordingHour]?.text || '';
                    const updatedText = existingText ? `${existingText.trim()} ${newTranscript.trim()}` : newTranscript.trim();
                    onChange(currentRecordingHour, { ...content[currentRecordingHour], text: updatedText });
                }
            }
        };
        
        recognition.onend = () => {
            const { recordingHour: currentRecordingHour } = callbackPropsRef.current;
            if (!manualStopRef.current && currentRecordingHour) {
                // Restart recognition if it stopped automatically
                try {
                    recognitionRef.current?.start();
                } catch (e) {
                    console.error("Speech recognition restart failed", e);
                    setRecordingHour(null);
                }
            } else {
                // It was a manual stop, so update state to reflect that.
                setRecordingHour(null);
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setRecordingHour(null);
        };

        // Cleanup on unmount
        return () => {
            recognitionRef.current?.abort();
        };
    }, []); // Empty dependency array: run only once on component mount.


    const handleToggleRecording = (hour: string) => {
        if (recordingHour === hour) {
            // Stop recording
            manualStopRef.current = true;
            recognitionRef.current?.stop();
        } else {
            // Start recording
            if (recognitionRef.current) {
                if (recordingHour) { // Stop previous recording if any
                    manualStopRef.current = true;
                    recognitionRef.current.stop();
                }
                manualStopRef.current = false;
                setRecordingHour(hour);
                try {
                    recognitionRef.current.start();
                } catch(e) {
                    console.error("Could not start recognition:", e);
                }
            } else {
                alert("La transcripción de voz no es compatible con tu navegador.");
            }
        }
    };


    const formatHour12 = (hour24: string) => {
        const [hour] = hour24.split(':');
        const h = parseInt(hour, 10);
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12} ${suffix}`;
    };

    const handleImageChange = async (hour: string, file: File) => {
        try {
            const base64Image = await fileToBase64(file);
            onChange(hour, { ...content[hour], imageUrl: base64Image });
        } catch (error) {
            console.error("Error converting image for hour", hour, error);
        }
    };
    
    const handleTextChange = (hour: string, text: string) => {
        onChange(hour, { ...content[hour], text });
    }

    return (
        <div className="space-y-1">
            {Object.keys(content).sort().map(hour => {
                const hourData = content[hour];
                const fileInputId = `file-input-${hour}`;
                const isFocused = focusedHour === hour;
                const isRecording = recordingHour === hour;

                return (
                    <div key={hour} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden transition-all duration-300">
                        <button
                            onClick={() => setExpandedHour(expandedHour === hour ? null : hour)}
                            className="w-full text-left p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            aria-expanded={expandedHour === hour}
                        >
                            <div className="flex items-center">
                               <span className="font-mono font-semibold text-sm text-teal-600 dark:text-teal-400 w-16">{formatHour12(hour)}</span>
                               {!hourData?.imageUrl && <span className="text-xs text-slate-400 dark:text-slate-500 truncate pr-2">{hourData?.text || 'Sin anotaciones'}</span>}
                               {hourData?.imageUrl && <i className="fas fa-camera text-teal-500 ml-2"></i>}
                            </div>
                            <i className={`fas fa-chevron-down transition-transform duration-200 ${expandedHour === hour ? 'rotate-180' : ''}`}></i>
                        </button>
                        {expandedHour === hour && (
                            <div className={`p-3 bg-white dark:bg-slate-800 relative group flex flex-col md:flex-row gap-4 transition-all duration-300 ${isFocused ? 'md:h-48' : 'md:h-28'}`}>
                                <div
                                    onFocus={() => setFocusedHour(hour)}
                                    onBlur={(e) => { handleTextChange(hour, e.currentTarget.innerText); setFocusedHour(null); }}
                                    contentEditable
                                    suppressContentEditableWarning
                                    className={`w-full p-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-md leading-relaxed transition-all duration-300 ${isFocused ? 'h-full' : 'h-20'} overflow-y-auto`}
                                    dangerouslySetInnerHTML={{ __html: hourData?.text || '' }}
                                />
                                
                                <div className="md:w-32 flex-shrink-0 flex items-center justify-center gap-2">
                                     <button 
                                        onClick={() => handleToggleRecording(hour)} 
                                        disabled={!!recordingHour && !isRecording}
                                        title={isRecording ? "Detener grabación" : "Iniciar grabación"}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
                                            ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}
                                            ${!!recordingHour && !isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fas fa-microphone"></i>
                                    </button>
                                    {hourData?.imageUrl ? (
                                        <div className="relative group/img">
                                            <img src={hourData.imageUrl} alt={`Imagen de las ${hour}`} className="h-20 w-20 object-cover rounded-md shadow-sm"/>
                                            <button 
                                                onClick={() => onChange(hour, {...hourData, imageUrl: undefined})}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white h-5 w-5 rounded-full text-xs flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <input type="file" id={fileInputId} accept="image/*" className="hidden" onChange={(e) => e.target.files && handleImageChange(hour, e.target.files[0])} />
                                            <label htmlFor={fileInputId} className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-md flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                                <i className="fas fa-plus"></i>
                                                <span className="text-xs mt-1">Foto</span>
                                            </label>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    );
};


const EntryEditor: React.FC<EntryEditorProps> = ({ entry, onSave, onDelete, onGetAiRecommendation, onExportJson, onExportAllPdf, onExportSinglePdf }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState<Record<string, HourData>>({});
    const [mood, setMood] = useState<Mood>('Normal');
    const [isSaved, setIsSaved] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (entry) {
            setTitle(entry.title);
            setContent(entry.content || {});
            setMood(entry.mood);
        }
    }, [entry]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleContentChange = (hour: string, data: HourData) => {
        setContent(prev => ({ ...prev, [hour]: data }));
    };

    const handleSave = () => {
        if (entry) {
            onSave({ ...entry, title, content, mood });
            playSaveSound();
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        }
    };
    
    const handleDelete = () => {
      if (entry && window.confirm('¿Estás seguro de que quieres eliminar esta entrada? Esta acción no se puede deshacer.')) {
        playDeleteSound();
        onDelete(entry.id);
      }
    };
    
    if (!entry) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                <div className="text-center">
                    <i className="fas fa-feather-alt fa-4x mb-4"></i>
                    <h2 className="text-2xl font-semibold">Selecciona una entrada o crea una nueva</h2>
                    <p>Tu lienzo digital te espera.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 animate-fade-in" key={entry.id}>
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Título de tu entrada"
                        className="text-2xl font-bold bg-transparent focus:outline-none focus:border-b-2 focus:border-teal-500 text-slate-800 dark:text-white w-full md:w-auto"
                    />
                    <div className="flex items-center space-x-2">
                        <div className="relative" ref={exportMenuRef}>
                            <button onClick={() => setIsExportMenuOpen(prev => !prev)} title="Exportar entradas" className="px-4 py-2 text-sm font-medium text-slate-600 bg-white rounded-lg shadow-sm hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-all duration-200 flex items-center">
                                <i className="fas fa-file-export mr-2"></i>Exportar <i className="fas fa-chevron-down ml-2 text-xs"></i>
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 shadow-lg rounded-md border border-slate-200 dark:border-slate-700 z-10 p-2 animate-fade-in">
                                    <button onClick={() => { onExportSinglePdf(entry.id); setIsExportMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                                        <i className="fas fa-file-pdf mr-2 text-red-500 w-4"></i> Exportar esta entrada (PDF)
                                    </button>
                                     <button onClick={() => { onExportAllPdf(); setIsExportMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                                        <i className="fas fa-file-archive mr-2 text-red-500 w-4"></i> Exportar todo (PDF)
                                    </button>
                                    <button onClick={() => { onExportJson(); setIsExportMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                                       <i className="fas fa-file-code mr-2 text-blue-500 w-4"></i> Exportar todo (JSON)
                                    </button>
                                </div>
                            )}
                        </div>
                        <button onClick={onGetAiRecommendation} title="Obtener recomendación de la IA para hoy" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg shadow-sm hover:from-violet-600 hover:to-purple-700 transition-all duration-200 flex items-center transform hover:scale-105">
                            <i className="fas fa-brain mr-2"></i>Recomendación IA
                        </button>
                    </div>
                </header>

                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-lg shadow-xl">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">¿Cómo te sientes hoy?</label>
                        <select
                            value={mood}
                            onChange={e => setMood(e.target.value as Mood)}
                            className="w-full p-3 border border-slate-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 dark:bg-slate-700 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white"
                        >
                            {Moods.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    
                    <TimelineEditor content={content} onChange={handleContentChange} />

                    <div className="mt-8 flex justify-between items-center">
                        <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors flex items-center">
                            <i className="fas fa-trash-alt mr-2"></i>Eliminar Entrada
                        </button>
                        <button
                            onClick={handleSave}
                            className={`px-6 py-3 font-bold text-white rounded-lg shadow-md transition-all duration-300 flex items-center transform ${isSaved ? 'bg-green-500 scale-105' : 'bg-gradient-to-r from-teal-400 to-blue-500 hover:from-teal-500 hover:to-blue-600 hover:-translate-y-0.5'}`}
                        >
                            <i className={`fas ${isSaved ? 'fa-check' : 'fa-save'} mr-2`}></i>
                            {isSaved ? 'Guardado' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EntryEditor;