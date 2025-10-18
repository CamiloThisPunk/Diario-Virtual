import React, { useState, useEffect } from 'react';
import { ScheduleData } from '../types';
import { produce } from 'immer';
import { playSaveSound } from '../utils/soundUtils';

interface ScheduleViewProps {
    schedule: ScheduleData;
    onSave: (schedule: ScheduleData) => void;
    onClose: () => void;
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TIMES = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 7 AM to 6 PM

const ScheduleView: React.FC<ScheduleViewProps> = ({ schedule, onSave, onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localSchedule, setLocalSchedule] = useState<ScheduleData>(schedule);
    const [justSaved, setJustSaved] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        // Sync with parent component's state if not in editing mode
        if (!isEditing) {
            setLocalSchedule(schedule);
        }
    }, [schedule, isEditing]);

    const handleCellChange = (day: string, time: string, value: string) => {
        const nextState = produce(localSchedule, draft => {
            if (!draft[day]) {
                draft[day] = {};
            }
            draft[day][time] = value;
        });
        setLocalSchedule(nextState);
    };

    const handleSave = () => {
        onSave(localSchedule);
        setIsEditing(false);
        playSaveSound();
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
    };
    
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // Animation duration
    };

    return (
        <div className={`flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Mi Horario de Clases</h2>
                    <div className="flex items-center space-x-2">
                        {isEditing ? (
                            <button onClick={handleSave} className="px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors flex items-center shadow-sm">
                                <i className="fas fa-save mr-2"></i>Guardar Cambios
                            </button>
                        ) : (
                             <button onClick={() => setIsEditing(true)} className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center shadow-sm ${justSaved ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
                                <i className={`fas ${justSaved ? 'fa-check' : 'fa-pencil-alt'} mr-2`}></i>{justSaved ? 'Guardado' : 'Editar Horario'}
                            </button>
                        )}
                         <button onClick={handleClose} className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center shadow-sm">
                            <i className="fas fa-times mr-2"></i>Cerrar
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-8 gap-px bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-lg text-sm">
                    {/* Header */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-2 text-center font-bold">Hora</div>
                    {DAYS.map(day => (
                        <div key={day} className="bg-slate-100 dark:bg-slate-800 p-2 text-center font-bold truncate">{day}</div>
                    ))}

                    {/* Body */}
                    {TIMES.map(time => (
                        <React.Fragment key={time}>
                            <div className="bg-slate-100 dark:bg-slate-800 p-2 text-center font-bold flex items-center justify-center">{time}</div>
                            {DAYS.map(day => {
                                const cellContent = localSchedule?.[day]?.[time] || '';
                                return (
                                    <div
                                        key={`${day}-${time}`}
                                        contentEditable={isEditing}
                                        suppressContentEditableWarning
                                        onBlur={e => handleCellChange(day, time, e.currentTarget.innerText)}
                                        className={`p-2 h-12 flex items-center justify-center text-center transition-colors
                                            ${cellContent ? 'bg-teal-50 dark:bg-teal-900/50 font-medium' : 'bg-white dark:bg-slate-800'} 
                                            ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white dark:focus:bg-slate-900 cursor-text' : 'cursor-default'}
                                        `}
                                    >
                                        {cellContent}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ScheduleView;