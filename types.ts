export type Mood = 'Feliz' | 'Triste' | 'Estresado' | 'Productivo' | 'Normal';

export const Moods: Mood[] = ['Feliz', 'Triste', 'Estresado', 'Productivo', 'Normal'];

export const MoodColors: Record<Mood, string> = {
    Feliz: 'bg-yellow-200 text-yellow-800',
    Triste: 'bg-blue-200 text-blue-800',
    Estresado: 'bg-red-200 text-red-800',
    Productivo: 'bg-green-200 text-green-800',
    Normal: 'bg-gray-200 text-gray-800',
};

export interface HourData {
    text: string;
    imageUrl?: string; // Base64 encoded image
}

export interface Entry {
    id: string;
    date: string;
    title:string;
    content: Record<string, HourData>; // Maps hour string "HH:00" to its data
    mood: Mood;
}

export interface ImportantDate {
    id: string;
    date: string; // YYYY-MM-DD
    title: string;
    description: string;
}

// Maps day string to an object mapping time string to subject string
export type ScheduleData = Record<string, Record<string, string>>;

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export interface DashboardInsights {
    weeklyMotivationScore: number;
    motivationReasoning: string;
    keyThemes: string[];
    personalizedInsight: string;
}