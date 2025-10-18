import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import EntryEditor from './components/EntryEditor';
import AiModal from './components/AiModal';
import ScheduleView from './components/ScheduleView';
import ChatView from './components/ChatView';
import DashboardView from './components/DashboardView';
import DailyReminderToast from './components/DailyReminderToast'; // Import the new component
import { Entry, Mood, HourData, ImportantDate, ScheduleData } from './types';
import { getRecommendationForEntry } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { playNewEntrySound } from './utils/soundUtils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


// PDF Generation Logic
const addEntryToPdf = (doc: jsPDF, entry: Entry) => {
    doc.setFontSize(18);
    doc.text(entry.title, 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    const entryDate = new Date(entry.date + 'T12:00:00Z').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Fecha: ${entryDate} | Estado de ánimo: ${entry.mood}`, 14, 30);

    const tableColumn = ["Hora", "Anotación", "Imagen"];
    const tableRows: (string | null)[][] = [];
    const imageRows: { row: number; image: string }[] = [];

    const sortedHours = Object.keys(entry.content).sort();
    sortedHours.forEach((hour) => {
        const hourData: HourData = entry.content[hour];
        if (hourData.text || hourData.imageUrl) {
            const rowData = [
                hour.substring(0, 5),
                hourData.text || '(Sin texto)',
                hourData.imageUrl ? '' : null
            ];
            tableRows.push(rowData);
            if (hourData.imageUrl) {
                imageRows.push({ row: tableRows.length - 1, image: hourData.imageUrl });
            }
        }
    });

    if (tableRows.length === 0) {
        doc.text("No se registraron anotaciones para este día.", 14, 40);
        return;
    }

    autoTable(doc, {
        startY: 35,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94] },
        didDrawCell: (data) => {
            const imageInfo = imageRows.find(img => img.row === data.row.index);
            if (data.column.dataKey === 2 && imageInfo) {
                try {
                    const imgProps = doc.getImageProperties(imageInfo.image);
                    const cellWidth = data.cell.width - 2;
                    const cellHeight = data.cell.height - 2;
                    const aspectRatio = imgProps.width / imgProps.height;
                    let imgWidth = cellWidth;
                    let imgHeight = imgWidth / aspectRatio;
                    if (imgHeight > cellHeight) {
                        imgHeight = cellHeight;
                        imgWidth = imgHeight * aspectRatio;
                    }
                    const x = data.cell.x + (cellWidth - imgWidth) / 2 + 1;
                    const y = data.cell.y + (cellHeight - imgHeight) / 2 + 1;
                    doc.addImage(imageInfo.image, 'JPEG', x, y, imgWidth, imgHeight);
                } catch (e) {
                    console.error("Error adding image to PDF:", e);
                    doc.text("Error img", data.cell.x + 2, data.cell.y + 10);
                }
            }
        },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 40, minCellHeight: 40 }
        }
    });
};

const exportEntriesToPdf = (entries: Entry[]) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    entries.forEach((entry, index) => {
        if (index > 0) doc.addPage();
        addEntryToPdf(doc, entry);
    });
    doc.save('mi_diario_completo.pdf');
};

const exportSingleEntryToPdf = (entry: Entry) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    addEntryToPdf(doc, entry);
    doc.save(`entrada_${entry.date}.pdf`);
};

// Helper to create a new blank entry for the current day
const createNewEntry = (): Entry => {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    const content: Record<string, HourData> = {};
    for (let i = 0; i <= 23; i++) {
        const hour = i.toString().padStart(2, '0') + ":00";
        content[hour] = { text: '' };
    }

    return {
        id: uuidv4(),
        date: dateString,
        title: `Entrada del ${today.toLocaleDateString('es-ES')}`,
        content,
        mood: 'Normal' as Mood,
    };
};

// Helper to calculate difference in days between two dates, ignoring time
const differenceInDays = (date1: Date, date2: Date): number => {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

const App: React.FC = () => {
    // STATE MANAGEMENT
    const [entries, setEntries] = useState<Entry[]>(() => {
        try {
            const savedEntries = localStorage.getItem('journalEntries');
            return savedEntries ? JSON.parse(savedEntries) : [];
        } catch (error) {
            console.error("Failed to parse entries from localStorage", error);
            return [];
        }
    });

    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    
    const [importantDates, setImportantDates] = useState<ImportantDate[]>(() => {
         try {
            const savedDates = localStorage.getItem('importantDates');
            return savedDates ? JSON.parse(savedDates) : [];
        } catch (error) {
            console.error("Failed to parse important dates from localStorage", error);
            return [];
        }
    });

    const [schedule, setSchedule] = useState<ScheduleData>(() => {
        try {
            const savedSchedule = localStorage.getItem('scheduleData');
            return savedSchedule ? JSON.parse(savedSchedule) : {};
        } catch (error) {
            console.error("Failed to parse schedule from localStorage", error);
            return {};
        }
    });
    
    const [streak, setStreak] = useState<{ count: number; lives: number; lastEntryDate: string | null; }>(() => {
        try {
            const savedStreak = localStorage.getItem('journalStreak');
            const defaultStreak = { count: 0, lives: 3, lastEntryDate: null };
            if (!savedStreak) return defaultStreak;

            const parsed = JSON.parse(savedStreak);
            // Basic validation to prevent app crash on corrupted data
            if (typeof parsed.count === 'number' && typeof parsed.lives === 'number') {
                return parsed;
            }
            return defaultStreak;
        } catch (error) {
            console.error("Failed to parse streak from localStorage", error);
            return { count: 0, lives: 3, lastEntryDate: null };
        }
    });

    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiRecommendation, setAiRecommendation] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [currentView, setCurrentView] = useState<'editor' | 'schedule' | 'chat' | 'dashboard'>('editor');
    const [isReminderToastOpen, setIsReminderToastOpen] = useState(false);

    // PERSISTENCE
    useEffect(() => {
        localStorage.setItem('journalEntries', JSON.stringify(entries));
    }, [entries]);

    useEffect(() => {
        localStorage.setItem('importantDates', JSON.stringify(importantDates));
    }, [importantDates]);
    
    useEffect(() => {
        localStorage.setItem('scheduleData', JSON.stringify(schedule));
    }, [schedule]);
    
    useEffect(() => {
        localStorage.setItem('journalStreak', JSON.stringify(streak));
    }, [streak]);

    // DERIVED STATE
    const selectedEntry = useMemo(() => {
        return entries.find(e => e.id === selectedEntryId) || null;
    }, [entries, selectedEntryId]);
    
    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [entries]);

    const isNewEntryAllowed = useMemo(() => {
        const todayDateString = new Date().toISOString().split('T')[0];
        return !entries.some(e => e.date === todayDateString);
    }, [entries]);

    // STREAK LOGIC ON LOAD
    useEffect(() => {
        const checkStreakOnLoad = () => {
            const { lastEntryDate, lives } = streak;
            if (!lastEntryDate) return; // No entries yet, nothing to do.

            const today = new Date();
            const lastEntry = new Date(lastEntryDate);
            const daysMissed = differenceInDays(today, lastEntry);
            
            const livesToLose = daysMissed -1;

            if (lives - livesToLose < 0) {
                // Streak is broken
                setStreak(prev => ({ ...prev, count: 0, lives: 3 }));
            }
        };
        checkStreakOnLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on app load


    // Daily Reminder Logic
    useEffect(() => {
        const checkTimeAndEntry = () => {
            const now = new Date();
            // Show reminder after 7 PM (19:00) if no entry has been made for today.
            if (now.getHours() >= 19 && isNewEntryAllowed) {
                setIsReminderToastOpen(true);
            }
        };
        
        // Check after a short delay on app load
        const timer = setTimeout(checkTimeAndEntry, 3000); // 3-second delay

        return () => clearTimeout(timer); // Cleanup timer on unmount
    }, [isNewEntryAllowed]);


    // HANDLERS
    const handleSelectEntry = (id: string) => {
        setSelectedEntryId(id);
        setCurrentView('editor');
    };

    const handleNewEntry = useCallback(() => {
        const todayDateString = new Date().toISOString().split('T')[0];
        const existingTodayEntry = entries.find(e => e.date === todayDateString);

        if (existingTodayEntry) {
            alert("Ya has creado una entrada para hoy. Solo se permite una entrada por día. Abriendo la entrada de hoy.");
            setSelectedEntryId(existingTodayEntry.id);
        } else {
            const newEntry = createNewEntry();
            setEntries(prev => [newEntry, ...prev]);
            setSelectedEntryId(newEntry.id);
            playNewEntrySound();

            // --- STREAK UPDATE LOGIC ---
            const today = new Date(todayDateString);
            
            if (!streak.lastEntryDate) { // First entry ever
                setStreak({ count: 1, lives: 3, lastEntryDate: todayDateString });
            } else {
                const lastEntry = new Date(streak.lastEntryDate);
                const daysSinceLast = differenceInDays(today, lastEntry);

                if (daysSinceLast === 1) { // Consecutive day
                    setStreak(prev => ({
                        count: prev.count + 1,
                        lives: 3, // Reset lives on consecutive entry
                        lastEntryDate: todayDateString
                    }));
                } else if (daysSinceLast > 1) { // Gap since last entry
                    const livesUsed = daysSinceLast - 1;
                    if (streak.lives - livesUsed >= 0) { // Had enough lives
                        setStreak(prev => ({
                            count: prev.count + 1,
                            lives: prev.lives - livesUsed,
                            lastEntryDate: todayDateString
                        }));
                    } else { // Not enough lives, streak breaks
                        setStreak({ count: 1, lives: 3, lastEntryDate: todayDateString });
                    }
                }
                // If daysSinceLast is 0, do nothing (shouldn't happen due to isNewEntryAllowed check)
            }
        }
        setCurrentView('editor');
    }, [entries, streak]);
    
    const handleSaveEntry = (updatedEntry: Entry) => {
        setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
    };

    const handleDeleteEntry = (id: string) => {
        setEntries(prev => prev.filter(e => e.id !== id));
        if (selectedEntryId === id) {
            setSelectedEntryId(null);
        }
        // Note: Deleting an entry does not affect streak logic for simplicity.
        // The streak is based on the last *creation* date.
    };
    
    const handleGetAiRecommendation = async () => {
        if (!selectedEntry) return;
        setIsAiModalOpen(true);
        setIsAiLoading(true);
        setAiRecommendation('');
        try {
            const recommendation = await getRecommendationForEntry(selectedEntry);
            setAiRecommendation(recommendation);
        } catch (error) {
            console.error("AI recommendation failed:", error);
            setAiRecommendation("Hubo un error al obtener la recomendación. Inténtalo de nuevo.");
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleExportJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sortedEntries, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "mi_diario_export.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleExportAllPdf = () => {
        if (sortedEntries.length > 0) {
            exportEntriesToPdf(sortedEntries);
        } else {
            alert("No hay entradas para exportar.");
        }
    };
    
    const handleExportSinglePdf = (id: string) => {
        const entryToExport = entries.find(e => e.id === id);
        if (entryToExport) {
            exportSingleEntryToPdf(entryToExport);
        } else {
            alert("No se pudo encontrar la entrada seleccionada para exportar.");
        }
    };

    const handleSaveDate = (date: string, title: string, description: string) => {
        setImportantDates(prev => {
            const existingIndex = prev.findIndex(d => d.date === date);
            const newDate: ImportantDate = { id: existingIndex !== -1 ? prev[existingIndex].id : uuidv4(), date, title, description };
            if (existingIndex !== -1) {
                const updatedDates = [...prev];
                updatedDates[existingIndex] = newDate;
                return updatedDates;
            }
            return [...prev, newDate];
        });
    };

    const handleDeleteMarkedDate = (id: string) => {
        setImportantDates(prev => prev.filter(d => d.id !== id));
    };

    const handleSaveSchedule = (newSchedule: ScheduleData) => {
        setSchedule(newSchedule);
    };

    const handleToggleView = (view: 'editor' | 'schedule' | 'chat' | 'dashboard') => {
        setCurrentView(currentView === view ? 'editor' : view);
    };

    const handleCreateEntryFromReminder = () => {
        setIsReminderToastOpen(false);
        handleNewEntry();
    };

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
            <Sidebar 
                entries={sortedEntries}
                onSelectEntry={handleSelectEntry}
                onNewEntry={handleNewEntry}
                selectedEntryId={selectedEntryId}
                streakCount={streak.count}
                streakLives={streak.lives}
                isNewEntryAllowed={isNewEntryAllowed}
                importantDates={importantDates}
                onSaveDate={handleSaveDate}
                onDeleteMarkedDate={handleDeleteMarkedDate}
                onToggleSchedule={() => handleToggleView('schedule')}
                onToggleChat={() => handleToggleView('chat')}
                onToggleDashboard={() => handleToggleView('dashboard')}
                onExportJson={handleExportJson}
                onExportAllPdf={handleExportAllPdf}
            />
            
            <main className="flex-1 flex flex-col">
                {currentView === 'editor' && (
                    <EntryEditor 
                        entry={selectedEntry} 
                        onSave={handleSaveEntry}
                        onDelete={handleDeleteEntry}
                        onGetAiRecommendation={handleGetAiRecommendation}
                        onExportJson={handleExportJson}
                        onExportAllPdf={handleExportAllPdf}
                        onExportSinglePdf={handleExportSinglePdf}
                    />
                )}
                {currentView === 'schedule' && (
                    <ScheduleView 
                        schedule={schedule}
                        onSave={handleSaveSchedule}
                        onClose={() => setCurrentView('editor')}
                    />
                )}
                 {currentView === 'chat' && (
                    <ChatView 
                        entries={entries}
                        onClose={() => setCurrentView('editor')}
                    />
                )}
                 {currentView === 'dashboard' && (
                    <DashboardView 
                        entries={entries}
                        onClose={() => setCurrentView('editor')}
                    />
                )}
            </main>

            <AiModal 
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                recommendation={aiRecommendation}
                isLoading={isAiLoading}
            />

            <DailyReminderToast 
                isOpen={isReminderToastOpen}
                onClose={() => setIsReminderToastOpen(false)}
                onNewEntry={handleCreateEntryFromReminder}
            />
        </div>
    );
};

export default App;
