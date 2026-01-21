
export interface AudioConfig {
  sampleRate: number;
  numChannels: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface Message {
  role: 'user' | 'siren';
  text: string;
}
