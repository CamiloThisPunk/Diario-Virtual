import { GoogleGenAI, Chat, Type } from "@google/genai";
import { Entry, DashboardInsights } from '../types';

// FIX: Initialize GoogleGenAI with API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a prompt from a diary entry for the Gemini model.
 * @param entry The diary entry for today.
 * @returns A formatted string prompt.
 */
const createPromptFromEntry = (entry: Entry): string => {
    let prompt = `Soy una persona que lleva un diario. Aquí está mi entrada de hoy (${entry.date}), titulada "${entry.title}". Mi estado de ánimo general es "${entry.mood}".\n\nResumen del día:\n`;

    const sortedHours = Object.keys(entry.content).sort();

    if (sortedHours.length === 0 || sortedHours.every(h => !entry.content[h].text)) {
        prompt += `Hoy no he escrito nada específico en mi diario por horas, pero mi estado de ánimo es "${entry.mood}".`;
    } else {
        for (const hour of sortedHours) {
            const hourData = entry.content[hour];
            if (hourData.text) {
                prompt += `- A las ${hour}: ${hourData.text}\n`;
            }
        }
    }

    prompt += `\nBasado en mi día y mi estado de ánimo, ¿qué consejo o reflexión empática y constructiva me puedes dar? Sé breve (2-3 frases), amable y motivador. Si ves algo positivo, resáltalo. Si parece un día difícil, ofrece consuelo y una perspectiva esperanzadora.`;
    return prompt;
};

/**
 * Gets an AI-powered recommendation based on a diary entry.
 * @param entry The diary entry.
 * @returns A promise that resolves to the AI's recommendation text.
 */
export const getRecommendationForEntry = async (entry: Entry): Promise<string> => {
    try {
        const model = 'gemini-2.5-flash';
        const prompt = createPromptFromEntry(entry);

        // FIX: Use ai.models.generateContent to get a response from the model.
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        
        // FIX: Extract text directly from the response object.
        return response.text;
    } catch (error) {
        console.error("Error getting AI recommendation:", error);
        return "Lo siento, no he podido conectar con la IA en este momento. Por favor, inténtalo de nuevo más tarde.";
    }
};


const createChatHistoryPrompt = (entries: Entry[]): string => {
    // Take the most recent 15 entries to avoid a huge prompt
    const recentEntries = [...entries]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 15);

    let history = "Aquí hay un resumen de las entradas recientes del diario del usuario:\n\n";

    if (recentEntries.length === 0) {
        history += "El usuario aún no ha escrito ninguna entrada.\n";
    } else {
        history += recentEntries.map(entry => {
            const contentSummary = Object.values(entry.content)
                .map(c => c.text)
                .filter(Boolean)
                .join(' ')
                .substring(0, 150); // Keep it brief
            return `Fecha: ${entry.date}, Estado de ánimo: ${entry.mood}, Título: "${entry.title}". Resumen: ${contentSummary.trim()}...`;
        }).join('\n---\n');
    }

    const systemInstruction = `
Eres un asistente de diario amigable, empático y perspicaz. Tu objetivo es ayudar al usuario a reflexionar sobre sus días, pensamientos y emociones.
Se te ha proporcionado el historial de entradas recientes del diario del usuario para darte contexto.

**Tus directivas:**
1.  **Usa el contexto:** Inicia la conversación haciendo referencia a algo específico e interesante de sus entradas pasadas. Demuestra que recuerdas lo que han compartido. Por ejemplo, podrías preguntar cómo continuó algo que mencionaron o cómo se sienten acerca de un tema recurrente.
2.  **Sé proactivo y curioso:** No esperes a que el usuario dirija. Haz preguntas abiertas que fomenten la introspección.
3.  **Mantén un tono positivo y alentador:** Ofrece apoyo y mantén un tono conversacional y cercano.
4.  **No seas un terapeuta:** Eres un compañero de conversación, no un profesional de la salud mental.
5.  **Sé conciso:** Mantén tus respuestas relativamente cortas.

Aquí está el historial del usuario:
${history}

Ahora, inicia la conversación con el usuario. Salúdalo amablemente y haz una pregunta o comentario basado en su historial.
`;
    return systemInstruction;
};


/**
 * Starts a new chat session with a specific system instruction based on user's entry history.
 * @param entries The user's journal entries.
 * @returns An object containing the Chat instance and the AI's first message.
 */
export const startChat = async (entries: Entry[]): Promise<{ chat: Chat, firstMessage: string }> => {
    const systemInstruction = createChatHistoryPrompt(entries);
    const model = 'gemini-2.5-flash';

    const chat = ai.chats.create({
        model: model,
        config: {
            systemInstruction: systemInstruction,
        },
    });

    // The system prompt instructs the AI to start the conversation.
    // We send a simple prompt to get its first, context-aware message.
    try {
        const initialResponse = await chat.sendMessage("Hola, por favor, inicia la conversación.");
        return { chat, firstMessage: initialResponse.text };
    } catch (error) {
         console.error("Error getting initial chat message:", error);
         return { chat, firstMessage: "¡Hola! He tenido un problema al cargar tu historial, pero estoy aquí para charlar. ¿Cómo estás hoy?" };
    }
};

/**
 * Analyzes recent diary entries to generate dashboard insights.
 * @param entries An array of recent diary entries.
 * @returns A promise that resolves to an object with dashboard insights.
 */
export const getDashboardInsights = async (entries: Entry[]): Promise<DashboardInsights> => {
    const prompt = `
        Analiza las siguientes entradas de diario de un estudiante universitario de los últimos 30 días.
        
        Entradas:
        ${entries.map(e => `Fecha: ${e.date}, Estado de ánimo: ${e.mood}, Título: ${e.title}\nContenido: ${Object.values(e.content).map(c => c.text).filter(Boolean).join('. ')}\n`).join('\n---\n')}

        Basado en estas entradas, proporciona un análisis en formato JSON. Debes estimar un "nivel de motivación semanal" en una escala de 1 a 10.
        Identifica los 2-3 "temas clave" más recurrentes. Finalmente, ofrece un "consejo personalizado" breve y accionable.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            weeklyMotivationScore: {
                type: Type.NUMBER,
                description: "Un número del 1 al 10 que representa el nivel de motivación del usuario esta semana."
            },
            motivationReasoning: {
                type: Type.STRING,
                description: "Una frase corta que justifica la puntuación de motivación."
            },
            keyThemes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Una lista de 2 o 3 temas clave recurrentes en las entradas."
            },
            personalizedInsight: {
                type: Type.STRING,
                description: "Un consejo corto, personalizado y accionable para el usuario."
            }
        },
        required: ["weeklyMotivationScore", "motivationReasoning", "keyThemes", "personalizedInsight"]
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as DashboardInsights;
    } catch (error) {
        console.error("Error getting dashboard insights:", error);
        throw new Error("No se pudieron generar los insights del dashboard.");
    }
};