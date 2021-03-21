/// <reference types="react-scripts" />

declare module 'react-speech-kit';

interface SDSContext {
    recResult: string;
    nluData: any;
    ttsAgenda: string;
    intentResult: string,
    cancel: string,
    counter: number,
    word: string,
    confirm: string,
    wordHistory: Array,
    historyLength: number,
}

type SDSEvent =
    | { type: 'CLICK' }
    | { type: 'RECOGNISED' }
    | { type: 'ASRRESULT', value: string }
    | { type: 'ENDSPEECH' }
    | { type: 'LISTEN' }
    | { type: 'SPEAK', value: string }
    | { type: 'NOINPUT' }
    | { type: 'MAXSPEECH' }
    | { type: 'RASA_DONE' };
