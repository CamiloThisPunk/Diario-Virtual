import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Entry } from '../types';
import { startChat } from '../services/geminiService';
import { Chat, GenerateContentResponse } from '@google/genai';

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

interface ChatViewProps {
    entries: Entry[];
    onClose: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ entries, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTtsEnabled, setIsTtsEnabled] = useState(false);
    const chatRef = useRef<Chat | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const manualStopRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
    const [isClosing, setIsClosing] = useState(false);
    
    const speak = (text: string) => {
        if ('speechSynthesis' in window && text && text.trim()) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 1.2; // Aumentar la velocidad de la voz en un 20%

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
        // --- Initialize Chat and Speech APIs ---
        const initializeApis = async () => {
            setIsLoading(true);
            try {
                const { chat, firstMessage } = await startChat(entries);
                chatRef.current = chat;
                if (firstMessage) {
                    setMessages([{ role: 'model', text: firstMessage }]);
                    if (isTtsEnabled) { // Check if TTS should play the initial message
                        speak(firstMessage);
                    }
                }
            } catch (error) {
                console.error("Failed to initialize chat:", error);
                setMessages([{ role: 'model', text: 'Lo siento, hubo un error al iniciar el chat. Por favor, intenta de nuevo.' }]);
            } finally {
                setIsLoading(false);
            }
        };

        initializeApis();

        // --- Setup Speech Synthesis ---
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                voicesRef.current = availableVoices;
            }
        };
        if ('speechSynthesis' in window) {
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        // --- Setup Speech Recognition ---
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
            let newTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                newTranscript += event.results[i][0].transcript;
            }
            if (newTranscript) {
                setInput(prev => (prev ? prev.trim() + ' ' : '') + newTranscript.trim());
            }
        };

        recognition.onend = () => {
            if (!manualStopRef.current) {
                try {
                    recognitionRef.current?.start();
                } catch (e) {
                    console.error("Speech recognition restart failed", e);
                    setIsRecording(false);
                }
            } else {
                setIsRecording(false);
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setIsRecording(false);
        };
        
        return () => {
            manualStopRef.current = true;
            recognitionRef.current?.stop();
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    useEffect(() => {
        // Scroll to the bottom when new messages are added
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // Animation duration
    };

    const handleToggleRecording = () => {
        if (!recognitionRef.current) {
            alert("La transcripción de voz no es compatible con tu navegador.");
            return;
        }
        if (isRecording) {
            manualStopRef.current = true;
            recognitionRef.current.stop();
        } else {
            manualStopRef.current = false;
            try {
                recognitionRef.current.start();
                setIsRecording(true);
            } catch (e) {
                console.error("Could not start recognition:", e);
            }
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !chatRef.current) return;
        
        window.speechSynthesis.cancel();

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        if (isRecording) {
            manualStopRef.current = true;
            recognitionRef.current?.stop();
        }
        
        let modelResponse = '';
        try {
            const stream: AsyncGenerator<GenerateContentResponse> = await chatRef.current.sendMessageStream({ message: input });
            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of stream) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { role: 'model', text: modelResponse };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Error sending chat message:", error);
            const errorMessage = 'Lo siento, algo salió mal. Por favor, inténtalo de nuevo.';
            setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
            modelResponse = errorMessage;
        } finally {
            setIsLoading(false);
            if (isTtsEnabled) {
                speak(modelResponse);
            }
        }
    };

    return (
        <div className={`flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 flex flex-col h-full ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
            <div className="max-w-4xl mx-auto w-full flex flex-col flex-1">
                <header className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
                        <i className="fas fa-comments mr-3 text-purple-500"></i>
                        Chat con IA
                    </h2>
                    <div className="flex items-center space-x-2">
                         <button
                            onClick={() => {
                                const turningOn = !isTtsEnabled;
                                setIsTtsEnabled(turningOn);
                                if (!turningOn) { // If turning off
                                    window.speechSynthesis.cancel();
                                }
                            }}
                            title={isTtsEnabled ? "Desactivar voz de IA" : "Activar voz de IA"}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 shadow-sm
                                ${isTtsEnabled ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}
                            `}
                        >
                            <i className={`fas ${isTtsEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                        </button>
                        <button onClick={handleClose} className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center shadow-sm">
                            <i className="fas fa-times mr-2"></i>Cerrar
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl p-4 space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-lg px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-teal-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'}`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && messages.length === 0 && (
                         <div className="flex justify-start">
                             <div className="max-w-lg px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                <p className="text-sm italic">La IA está leyendo tu historial para iniciar la conversación...</p>
                            </div>
                        </div>
                    )}
                    {isLoading && messages.length > 0 && (
                        <div className="flex justify-start">
                             <div className="max-w-lg px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                <div className="flex items-center space-x-2">
                                    <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="mt-6">
                    <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg shadow-md p-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isRecording ? "Escuchando..." : "Escribe tu mensaje aquí..."}
                            disabled={isLoading}
                            className="w-full bg-transparent focus:outline-none px-3 text-slate-800 dark:text-white"
                        />
                         <button
                            type="button"
                            onClick={handleToggleRecording}
                            disabled={isLoading}
                            title={isRecording ? "Detener grabación" : "Iniciar grabación"}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0
                                ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}
                            `}
                        >
                            <i className="fas fa-microphone"></i>
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-600 transition-colors ml-2"
                        >
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatView;