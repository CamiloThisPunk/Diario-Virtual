import React, { useState, useMemo } from 'react';
import { ImportantDate } from '../types';
import { playSaveSound, playDeleteSound } from '../utils/soundUtils';

interface CalendarViewProps {
    importantDates: ImportantDate[];
    onSaveDate: (date: string, title: string, description: string) => void;
    onDeleteMarkedDate: (id: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ importantDates, onSaveDate, onDeleteMarkedDate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteDescription, setNoteDescription] = useState('');
    
    const importantDatesMap = useMemo(() => {
        const map = new Map<string, ImportantDate>();
        importantDates.forEach(d => {
            map.set(d.date, d);
        });
        return map;
    }, [importantDates]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleSelectDateForNote = (dateISO: string) => {
        setSelectedDate(dateISO);
        const existingNote = importantDatesMap.get(dateISO);
        if (existingNote) {
            setNoteTitle(existingNote.title);
            setNoteDescription(existingNote.description);
        } else {
            setNoteTitle('');
            setNoteDescription('');
        }
    };

    const handleSaveNote = () => {
        if (selectedDate && noteTitle.trim()) {
            onSaveDate(selectedDate, noteTitle, noteDescription);
            playSaveSound();
        }
    };

    const handleDeleteNote = () => {
        if (selectedDate) {
            const noteToDelete = importantDatesMap.get(selectedDate);
            if (noteToDelete) {
                playDeleteSound();
                onDeleteMarkedDate(noteToDelete.id);
                setNoteTitle('');
                setNoteDescription('');
                setSelectedDate(null);
            }
        }
    };

    const renderHeader = () => {
        const dateFormat = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
        return (
            <div className="flex justify-between items-center py-2 px-1">
                <button onClick={handlePrevMonth} className="text-slate-500 hover:text-teal-500 transition-colors"><i className="fas fa-chevron-left"></i></button>
                <span className="font-bold text-lg capitalize">{dateFormat.format(currentDate)}</span>
                <button onClick={handleNextMonth} className="text-slate-500 hover:text-teal-500 transition-colors"><i className="fas fa-chevron-right"></i></button>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        return (
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                {days.map(day => <div key={day}>{day}</div>)}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const startDate = new Date(monthStart);
        startDate.setDate(startDate.getDate() - monthStart.getDay()); // Start from Sunday of the first week
        const endDate = new Date(monthEnd);
        if (monthEnd.getDay() !== 6) { // if month doesn't end on Saturday
            endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay()));
        }

        const rows = [];
        let days = [];
        let day = new Date(startDate);
        const today = new Date().toISOString().split('T')[0];

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const dayISO = day.toISOString().split('T')[0];
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = dayISO === today;
                const hasImportantDate = importantDatesMap.has(dayISO);
                const isSelected = dayISO === selectedDate;

                days.push(
                    <div
                        key={day.toString()}
                        className={`h-9 w-9 flex items-center justify-center text-sm rounded-full relative cursor-pointer transition-colors ${!isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'} ${isToday ? 'bg-teal-500 text-white font-bold' : ''} ${isSelected ? 'bg-violet-200 dark:bg-violet-800' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        onClick={() => { if(isCurrentMonth) { handleSelectDateForNote(dayISO); } }}
                    >
                        <span>{day.getDate()}</span>
                        {hasImportantDate && isCurrentMonth && (
                             <div className="absolute bottom-1 flex space-x-0.5">
                                <div className="h-1.5 w-1.5 bg-amber-500 rounded-full"></div>
                            </div>
                        )}
                    </div>
                );
                day.setDate(day.getDate() + 1);
            }
            rows.push(
                <div className="grid grid-cols-7 place-items-center" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div>{rows}</div>;
    };
    
    const renderNoteEditor = () => {
        if (!selectedDate) {
            return (
                <div className="mt-4 p-3 text-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p>Selecciona una fecha para añadir o ver una nota.</p>
                </div>
            );
        }

        const formattedDate = new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
        const existingNote = importantDatesMap.get(selectedDate);

        return (
            <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-inner animate-fade-in-down">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-md text-slate-800 dark:text-slate-200">
                        Nota para el {formattedDate}
                    </h4>
                    <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xl">&times;</button>
                </div>
                <div className="space-y-3">
                    <input 
                        type="text" 
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Título del evento"
                        className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 dark:bg-slate-700 dark:border-slate-600"
                    />
                    <textarea
                        value={noteDescription}
                        onChange={(e) => setNoteDescription(e.target.value)}
                        placeholder="Añade una descripción..."
                        rows={3}
                        className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-teal-500 focus:border-teal-500 dark:bg-slate-700 dark:border-slate-600 resize-none"
                    />
                </div>
                <div className="flex justify-end items-center gap-2 mt-4">
                    {existingNote && (
                        <button onClick={handleDeleteNote} className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors">
                           Borrar
                        </button>
                    )}
                    <button onClick={handleSaveNote} disabled={!noteTitle.trim()} className="px-4 py-1.5 bg-teal-500 text-white rounded-md disabled:bg-slate-300 dark:disabled:bg-slate-600 transition-colors font-semibold text-sm">
                       {existingNote ? 'Actualizar' : 'Guardar'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            {renderHeader()}
            {renderDays()}
            {renderCells()}
            {renderNoteEditor()}
        </div>
    );
};

export default CalendarView;