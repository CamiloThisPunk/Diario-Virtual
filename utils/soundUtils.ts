// Using the Web Audio API to generate sounds without needing audio files.

// A single AudioContext is created and reused to be efficient.
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
    // Ensure this runs only in the browser
    if (typeof window !== 'undefined') {
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContext;
    }
    return null;
};

// A soft, rising chime for successful save operations.
export const playSaveSound = () => {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === 'suspended') {
        context.resume();
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, context.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(1046.50, context.currentTime + 0.1); // C6

    gainNode.gain.setValueAtTime(0.2, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.2);
};

// A lower, falling tone for deletion.
export const playDeleteSound = () => {
    const context = getAudioContext();
    if (!context) return;
    
    if (context.state === 'suspended') {
        context.resume();
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(440, context.currentTime); // A4
    oscillator.frequency.exponentialRampToValueAtTime(220, context.currentTime + 0.15); // A3

    gainNode.gain.setValueAtTime(0.15, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.2);
};


// A quick, higher-pitched sound for creating something new.
export const playNewEntrySound = () => {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === 'suspended') {
        context.resume();
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(698.46, context.currentTime); // F5
    oscillator.frequency.exponentialRampToValueAtTime(1396.91, context.currentTime + 0.08); // F6

    gainNode.gain.setValueAtTime(0.2, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.15);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.15);
};
