import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Entry, MoodColors, ImportantDate } from '../types';
import CalendarView from './CalendarView';

interface SidebarProps {
    entries: Entry[];
    onSelectEntry: (id: string) => void;
    onNewEntry: () => void;
    selectedEntryId: string | null;
    streakCount: number;
    streakLives: number;
    isNewEntryAllowed: boolean;
    importantDates: ImportantDate[];
    onSaveDate: (date: string, title: string, description: string) => void;
    onDeleteMarkedDate: (id: string) => void;
    onToggleSchedule: () => void;
    onToggleChat: () => void;
    onToggleDashboard: () => void;
    onExportJson: () => void;
    onExportAllPdf: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    entries, 
    onSelectEntry, 
    onNewEntry, 
    selectedEntryId, 
    streakCount,
    streakLives,
    isNewEntryAllowed,
    importantDates,
    onSaveDate,
    onDeleteMarkedDate,
    onToggleSchedule,
    onToggleChat,
    onToggleDashboard,
    onExportJson,
    onExportAllPdf
}) => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(true);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    const archivedEntries = useMemo(() => {
        const grouped: Record<string, Record<string, Entry[]>> = {};
        entries.forEach(entry => {
            const date = new Date(entry.date + 'T12:00:00Z');
            const year = date.getFullYear().toString();
            const month = date.toLocaleString('es-ES', { month: 'long' });
            const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);

            if (!grouped[year]) {
                grouped[year] = {};
            }
            if (!grouped[year][capitalizedMonth]) {
                grouped[year][capitalizedMonth] = [];
            }
            grouped[year][capitalizedMonth].push(entry);
        });
        return grouped;
    }, [entries]);

    useEffect(() => {
        const currentYear = new Date().getFullYear().toString();
        const currentMonth = new Date().toLocaleString('es-ES', { month: 'long' });
        const capitalizedCurrentMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
        const monthKey = `${currentYear}-${capitalizedCurrentMonth}`;
        
        setExpandedItems(prev => ({
            ...prev,
            [currentYear]: true,
            [monthKey]: true
        }));
    }, []);

    const toggleExpanded = (key: string) => {
        setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

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
    
    const entryHasImages = (entry: Entry): boolean => {
        return Object.values(entry.content).some(hourData => hourData.imageUrl);
    }
    
    const years = Object.keys(archivedEntries).sort((a, b) => parseInt(b) - parseInt(a));

    return (
        <aside className="w-1/3 max-w-sm bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full shadow-lg">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <i className="fas fa-book-sparkles text-2xl bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-violet-500"></i>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Mi Diario</h1>
                </div>
                <div className="flex items-center space-x-3">
                    {streakCount > 0 && (
                        <div className="flex items-center space-x-2 text-orange-500 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-400 px-3 py-1 rounded-full" title={`Racha actual: ${streakCount} días`}>
                            <i className="fas fa-fire"></i>
                            <span className="font-bold text-sm">{streakCount} {streakCount === 1 ? 'Día' : 'Días'}</span>
                        </div>
                    )}
                    {streakCount > 0 && (
                        <div className="flex items-center space-x-1 text-red-400 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-full" title="Vidas de racha restantes">
                             {Array.from({ length: streakLives }).map((_, i) => <i key={`life-${i}`} className="fas fa-heart text-sm"></i>)}
                             {Array.from({ length: 3 - streakLives }).map((_, i) => <i key={`empty-${i}`} className="fas fa-heart text-sm text-slate-300 dark:text-slate-600"></i>)}
                        </div>
                    )}
                </div>
            </div>
             <div className="p-4">
                <button
                    onClick={onNewEntry}
                    disabled={!isNewEntryAllowed}
                    title={!isNewEntryAllowed ? "Solo se puede crear una entrada por día" : "Crear una nueva entrada para hoy"}
                    className="w-full bg-gradient-to-r from-teal-400 to-violet-500 hover:from-teal-500 hover:to-violet-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-teal-400 disabled:hover:to-violet-500 disabled:transform-none"
                >
                    <i className="fas fa-plus mr-2"></i>
                    Nueva Entrada (Hoy)
                </button>
            </div>
            
            <div className="border-t border-b border-slate-200 dark:border-slate-700">
                 <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="w-full flex justify-between items-center px-4 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50">
                    <span><i className="fas fa-calendar-alt mr-2 text-violet-500"></i>Calendario</span>
                    <i className={`fas fa-chevron-down transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`}></i>
                 </button>
                 {isCalendarOpen && (
                     <CalendarView 
                        importantDates={importantDates}
                        onSaveDate={onSaveDate}
                        onDeleteMarkedDate={onDeleteMarkedDate}
                     />
                 )}
            </div>
             <div className="border-b border-slate-200 dark:border-slate-700">
                 <button onClick={onToggleSchedule} className="w-full flex justify-between items-center px-4 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50">
                    <span><i className="fas fa-clock mr-2 text-teal-500"></i>Horario</span>
                    <i className={`fas fa-external-link-alt`}></i>
                 </button>
            </div>
            <div className="border-b border-slate-200 dark:border-slate-700">
                 <button onClick={onToggleChat} className="w-full flex justify-between items-center px-4 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50">
                    <span><i className="fas fa-comments mr-2 text-purple-500"></i>Chat con IA</span>
                    <i className={`fas fa-external-link-alt`}></i>
                 </button>
            </div>
            <div className="border-b border-slate-200 dark:border-slate-700">
                 <button onClick={onToggleDashboard} className="w-full flex justify-between items-center px-4 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50">
                    <span><i className="fas fa-chart-line mr-2 text-orange-500"></i>Dashboard</span>
                    <i className={`fas fa-external-link-alt`}></i>
                 </button>
            </div>
             <div className="border-b border-slate-200 dark:border-slate-700 relative" ref={exportMenuRef}>
                 <button onClick={() => setIsExportMenuOpen(prev => !prev)} className="w-full flex justify-between items-center px-4 py-2 text-left font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50">
                    <span><i className="fas fa-file-export mr-2 text-green-500"></i>Exportar Entradas</span>
                    <i className={`fas fa-chevron-down transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`}></i>
                 </button>
                 {isExportMenuOpen && (
                     <div className="absolute bottom-full mb-1 w-[calc(100%-2rem)] left-4 bg-white dark:bg-slate-800 shadow-lg rounded-md border border-slate-200 dark:border-slate-700 z-10 p-2 animate-fade-in">
                        <button onClick={() => { onExportAllPdf(); setIsExportMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                           <i className="fas fa-file-pdf mr-2 text-red-500 w-4"></i> Exportar todo (PDF)
                        </button>
                        <button onClick={() => { onExportJson(); setIsExportMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center">
                           <i className="fas fa-file-code mr-2 text-blue-500 w-4"></i> Exportar todo (JSON)
                        </button>
                     </div>
                 )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <h3 className="px-1 font-semibold text-slate-600 dark:text-slate-300 text-sm">Archivo de Entradas</h3>
                {years.length > 0 ? (
                    years.map(year => (
                        <div key={year}>
                            <button onClick={() => toggleExpanded(year)} className="w-full text-left px-1 py-2 flex justify-between items-center">
                                <span className="font-bold text-slate-700 dark:text-slate-200">{year}</span>
                                <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${expandedItems[year] ? 'rotate-180' : ''}`}></i>
                            </button>
                            {expandedItems[year] && (
                                <div className="pl-2">
                                    {Object.keys(archivedEntries[year]).map(month => {
                                        const monthKey = `${year}-${month}`;
                                        return (
                                            <div key={monthKey}>
                                                <button onClick={() => toggleExpanded(monthKey)} className="w-full text-left px-2 py-1 flex justify-between items-center">
                                                    <span className="font-semibold text-sm text-slate-600 dark:text-slate-300">{month}</span>
                                                    <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform duration-200 ${expandedItems[monthKey] ? 'rotate-180' : ''}`}></i>
                                                </button>
                                                {expandedItems[monthKey] && (
                                                    <div className="pl-4 space-y-1 py-1">
                                                        {archivedEntries[year][month].map(entry => (
                                                            <button
                                                                key={entry.id}
                                                                onClick={() => onSelectEntry(entry.id)}
                                                                className={`w-full text-left p-3 rounded-lg transition-all duration-200 border-l-4 ${selectedEntryId === entry.id ? 'bg-slate-100 dark:bg-slate-700/50 border-teal-500' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                                                            >
                                                                <div className="flex justify-between items-start">
                                                                    <p className="font-semibold text-slate-700 dark:text-slate-200 truncate pr-2 text-sm">{entry.title}</p>
                                                                    {entryHasImages(entry) && <i className="fas fa-paperclip text-slate-400 text-xs"></i>}
                                                                </div>
                                                                <div className="flex items-center justify-between mt-1">
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(entry.date + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</p>
                                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${MoodColors[entry.mood]}`}>{entry.mood}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center text-slate-500 dark:text-slate-400 mt-10 p-4">
                        <i className="fas fa-archive fa-3x mb-4 text-slate-400"></i>
                        <h3 className="font-semibold text-lg">Tu archivo está vacío</h3>
                        <p className="text-sm">Crea una nueva entrada para comenzar a construir tu historia.</p>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
