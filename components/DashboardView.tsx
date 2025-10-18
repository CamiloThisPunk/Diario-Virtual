import React, { useState, useMemo } from 'react';
import { Entry, Mood, DashboardInsights, Moods } from '../types';
import { getDashboardInsights } from '../services/geminiService';

interface DashboardViewProps {
    entries: Entry[];
    onClose: () => void;
}

const MOOD_VALUE_MAP: Record<Mood, number> = {
    'Feliz': 5,
    'Productivo': 4,
    'Normal': 3,
    'Estresado': 2,
    'Triste': 1,
};
const MOOD_COLOR_MAP: Record<Mood, string> = {
    'Feliz': '#FBBF24', // amber-400
    'Productivo': '#34D399', // emerald-400
    'Normal': '#9CA3AF', // gray-400
    'Estresado': '#F87171', // red-400
    'Triste': '#60A5FA', // blue-400
};

// --- CHART COMPONENTS ---

const MoodTrendChart: React.FC<{ data: { date: Date; mood: Mood }[] }> = ({ data }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

    if (data.length < 2) {
        return <div className="h-64 flex items-center justify-center text-slate-500">Datos insuficientes para la gráfica de tendencias.</div>;
    }

    const width = 500;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 30 };

    const xRange = width - padding.left - padding.right;
    const yRange = height - padding.top - padding.bottom;

    const minDate = data[0].date;
    const maxDate = data[data.length - 1].date;
    const dateDiff = maxDate.getTime() - minDate.getTime();

    const points = data.map(d => {
        const x = ((d.date.getTime() - minDate.getTime()) / dateDiff) * xRange + padding.left;
        const y = height - padding.bottom - ((MOOD_VALUE_MAP[d.mood] - 1) / 4) * yRange;
        return { x, y, date: d.date, mood: d.mood };
    });

    const pathD = "M" + points.map(p => `${p.x},${p.y}`).join(" L");

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        const svgRect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - svgRect.left;
        const closestPoint = points.reduce((prev, curr) => Math.abs(curr.x - mouseX) < Math.abs(prev.x - mouseX) ? curr : prev);
        setTooltip({ x: closestPoint.x, y: closestPoint.y, content: `${closestPoint.mood} - ${closestPoint.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` });
    };

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} className="w-full h-auto">
                {/* Y-Axis Labels */}
                {Object.entries(MOOD_VALUE_MAP).map(([mood, value]) => (
                    <text key={mood} x={padding.left - 5} y={height - padding.bottom - ((value - 1) / 4) * yRange} dy="0.3em" textAnchor="end" className="text-xs fill-current text-slate-400">{mood}</text>
                ))}
                
                {/* Line */}
                <path d={pathD} fill="none" stroke="#34D399" strokeWidth="2" />
                
                 {/* Gradient under the line */}
                <path d={`${pathD} L ${points[points.length-1].x},${height - padding.bottom} L ${points[0].x},${height - padding.bottom} Z`} fill="url(#gradient)" />
                <defs>
                    <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Data Points and Tooltip line */}
                {tooltip && (
                    <>
                        <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke="#9CA3AF" strokeDasharray="4" />
                        <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="#34D399" stroke="white" strokeWidth="2" />
                    </>
                )}
            </svg>
            {tooltip && (
                <div className="absolute p-2 text-xs text-white bg-slate-800 rounded-md pointer-events-none" style={{ top: tooltip.y-35, left: tooltip.x, transform: `translateX(-50%)` }}>
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

const MoodDistributionChart: React.FC<{ data: Record<Mood, number> }> = ({ data }) => {
    // FIX: Added explicit type annotations to the reduce callback to ensure 'total' is correctly typed as a number.
    const total = Object.values(data).reduce((sum: number, val: number) => sum + val, 0);
    if (total === 0) {
        return <div className="h-48 flex items-center justify-center text-slate-500">Sin datos de ánimo para mostrar.</div>;
    }

    const radius = 80;
    const strokeWidth = 25;
    const circumference = 2 * Math.PI * (radius - strokeWidth / 2);
    let offset = 0;

    const segments = Moods.map(mood => {
        const count = data[mood] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        const dasharray = (percentage / 100) * circumference;
        const segment = {
            mood,
            percentage,
            color: MOOD_COLOR_MAP[mood],
            dasharray: `${dasharray} ${circumference - dasharray}`,
            offset: -offset,
        };
        offset += dasharray;
        return segment;
    }).filter(s => s.percentage > 0);

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative w-48 h-48">
                <svg viewBox="0 0 200 200" className="-rotate-90">
                    {segments.map(s => (
                        <circle
                            key={s.mood}
                            cx="100" cy="100"
                            r={radius - strokeWidth / 2}
                            fill="transparent"
                            stroke={s.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={s.dasharray}
                            strokeDashoffset={s.offset}
                        />
                    ))}
                </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">{total}</span>
                    <span className="text-sm text-slate-500">Entradas</span>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                {segments.map(s => (
                     <div key={s.mood} className="flex items-center text-sm">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: s.color }}></span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 w-24">{s.mood}</span>
                        <span className="text-slate-500 dark:text-slate-400">{s.percentage.toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- MAIN DASHBOARD COMPONENT ---

const DashboardView: React.FC<DashboardViewProps> = ({ entries, onClose }) => {
    const [insights, setInsights] = useState<DashboardInsights | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isClosing, setIsClosing] = useState(false);

    const last30DaysEntries = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return entries
            .filter(e => new Date(e.date) >= thirtyDaysAgo)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [entries]);

    const fetchInsights = async () => {
        if (last30DaysEntries.length < 3) {
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const result = await getDashboardInsights(last30DaysEntries);
            setInsights(result);
        } catch (e) {
            setError("No se pudieron cargar los análisis de la IA. Inténtalo de nuevo más tarde.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const moodDistribution = useMemo(() => {
        return last30DaysEntries.reduce((acc, entry) => {
            acc[entry.mood] = (acc[entry.mood] || 0) + 1;
            return acc;
        }, {} as Record<Mood, number>);
    }, [last30DaysEntries]);

    const moodTrendData = useMemo(() => {
        return last30DaysEntries.map(e => ({ date: new Date(e.date + "T12:00:00Z"), mood: e.mood }));
    }, [last30DaysEntries]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // Animation duration
    };
    
    if (last30DaysEntries.length < 3) {
        return (
             <div className={`flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
                 <i className="fas fa-chart-pie fa-4x text-slate-400 mb-4"></i>
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Tu Dashboard Emocional está casi listo.</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Escribe al menos 3 entradas en tu diario para desbloquear tus análisis y gráficos personalizados.</p>
                <button onClick={handleClose} className="mt-6 px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors flex items-center shadow-sm">
                    Volver al Editor
                </button>
            </div>
        )
    }

    return (
        <div className={`flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
            <div className="max-w-7xl mx-auto">
                 <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center">
                        <i className="fas fa-chart-line mr-3 text-orange-500"></i>
                        Dashboard Emocional
                    </h2>
                    <button onClick={handleClose} className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center shadow-sm">
                        <i className="fas fa-times mr-2"></i>Cerrar
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* AI Insights Column */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg min-h-[300px] flex flex-col justify-center">
                           <h3 className="font-bold text-lg mb-4 flex items-center text-slate-700 dark:text-slate-200"><i className="fas fa-brain mr-2 text-violet-500"></i>Análisis de IA</h3>
                            
                            {!insights && !isLoading && !error && (
                                <div className="text-center flex-1 flex flex-col justify-center">
                                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                                        Haz clic para que la IA analice tus entradas recientes y te ofrezca información personalizada.
                                    </p>
                                    <button
                                        onClick={fetchInsights}
                                        className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg shadow-sm hover:from-violet-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center transform hover:scale-105 mx-auto"
                                    >
                                        <i className="fas fa-wand-magic-sparkles mr-2"></i>Generar Análisis
                                    </button>
                                </div>
                            )}

                            {isLoading && (
                                <div className="space-y-4">
                                    {Array.from({length: 3}).map((_, i) => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse"></div>)}
                                </div>
                            )}
                            
                            {error && (
                                <div className="text-center text-red-500 text-sm">
                                    <p>{error}</p>
                                     <button
                                        onClick={fetchInsights}
                                        className="mt-4 px-3 py-1 text-xs font-medium text-white bg-violet-500 rounded-md hover:bg-violet-600"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            )}
                            
                            {insights && !isLoading && (
                                <div className="space-y-4 animate-fade-in">
                                     <div>
                                        <label className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nivel de Motivación Semanal</label>
                                        <div className="flex items-baseline space-x-2 mt-1">
                                            <p className="text-3xl font-bold text-teal-500">{insights.weeklyMotivationScore}<span className="text-lg text-slate-400">/10</span></p>
                                        </div>
                                        <p className="text-xs text-slate-500 italic">"{insights.motivationReasoning}"</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-slate-500 dark:text-slate-400">Temas Clave</label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {insights.keyThemes.map(theme => (
                                                <span key={theme} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-xs font-medium rounded-full text-slate-600 dark:text-slate-300">{theme}</span>
                                            ))}
                                        </div>
                                    </div>
                                     <div>
                                        <label className="text-sm font-semibold text-slate-500 dark:text-slate-400">Consejo Personalizado</label>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 p-3 bg-teal-50 dark:bg-teal-900/50 rounded-lg border-l-4 border-teal-400">
                                           {insights.personalizedInsight}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Charts Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                            <h3 className="font-bold text-lg mb-4 text-slate-700 dark:text-slate-200">Tendencia de Ánimo (Últimos 30 días)</h3>
                             <MoodTrendChart data={moodTrendData} />
                        </div>
                         <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                            <h3 className="font-bold text-lg mb-4 text-slate-700 dark:text-slate-200">Distribución de Emociones</h3>
                             <MoodDistributionChart data={moodDistribution} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
};

export default DashboardView;