
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { SIREN_SYSTEM_INSTRUCTION, AUDIO_CONFIG } from '../constants';
import { decode, decodeAudioData, createPcmBlob } from './audioUtils';

export class SirenSession {
  private ai: any;
  private session: any;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private microphoneStream: MediaStream | null = null;

  constructor(
    private onMessage: (msg: string, isUser: boolean) => void,
    private onError: (err: string) => void,
    private onStatusChange: (status: 'connected' | 'disconnected' | 'error') => void
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async start() {
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.inputSampleRate,
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.outputSampleRate,
      });

      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            this.onStatusChange('connected');
            this.setupMicrophone(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleServerMessage(message);
          },
          onerror: (e: any) => {
            console.error('Siren Live Error:', e);
            this.onError('Connection error. Siren is unavailable.');
            this.onStatusChange('error');
          },
          onclose: () => {
            this.onStatusChange('disconnected');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SIREN_SYSTEM_INSTRUCTION,
        },
      });

      this.session = await sessionPromise;
    } catch (err) {
      console.error('Failed to start Siren:', err);
      this.onError('Could not access microphone or connect.');
      this.onStatusChange('error');
    }
  }

  private setupMicrophone(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.microphoneStream) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.microphoneStream);
    const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromise.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage) {
    // Audio Output
    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (audioData && this.outputAudioContext) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      const buffer = await decodeAudioData(
        decode(audioData),
        this.outputAudioContext,
        AUDIO_CONFIG.outputSampleRate,
        AUDIO_CONFIG.numChannels
      );

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioContext.destination);
      source.addEventListener('ended', () => {
        this.activeSources.delete(source);
      });

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.activeSources.add(source);
    }

    // Transcription
    if (message.serverContent?.outputTranscription) {
       this.onMessage(message.serverContent.outputTranscription.text, false);
    } else if (message.serverContent?.inputTranscription) {
       this.onMessage(message.serverContent.inputTranscription.text, true);
    }

    // Interruption
    if (message.serverContent?.interrupted) {
      this.stopAllAudio();
    }
  }

  private stopAllAudio() {
    this.activeSources.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }

  stop() {
    if (this.session) {
      this.session.close();
    }
    this.stopAllAudio();
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
    }
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.outputAudioContext) this.outputAudioContext.close();
  }
}
