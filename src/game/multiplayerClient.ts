import { sanitizePlayerProfile, sanitizeRoomCode } from './kioscoLogic';
import type {
  OnlineChatMessage,
  OnlinePlayerState,
  PlayerProfile,
  ProductId,
  RoomStateSnapshot,
  WsClientMessage,
  WsServerMessage,
} from './types';

export type OnlineConnectionStatus = 'offline' | 'connecting' | 'connected' | 'error';

export interface OnlineStateView {
  status: OnlineConnectionStatus;
  roomCode: string;
  selfId: string | null;
  peers: OnlinePlayerState[];
  messages: OnlineChatMessage[];
  error: string | null;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private roomCode = '';
  private profile: PlayerProfile;
  private status: OnlineConnectionStatus = 'offline';
  private selfId: string | null = null;
  private peers = new Map<string, OnlinePlayerState>();
  private messages: OnlineChatMessage[] = [];
  private error: string | null = null;
  private reconnectTimer: number | null = null;
  private manualDisconnect = true;
  private listeners = new Set<(view: OnlineStateView) => void>();
  private serverHandlers = new Set<(msg: WsServerMessage) => void>();
  private lastPoseSentAt = 0;

  constructor(initialProfile: PlayerProfile) {
    this.profile = sanitizePlayerProfile(initialProfile);
  }

  public subscribe(fn: (view: OnlineStateView) => void): () => void {
    this.listeners.add(fn);
    fn(this.getView());
    return () => {
      this.listeners.delete(fn);
    };
  }

  public onServerMessage(fn: (msg: WsServerMessage) => void): () => void {
    this.serverHandlers.add(fn);
    return () => {
      this.serverHandlers.delete(fn);
    };
  }

  public getView(): OnlineStateView {
    return {
      status: this.status,
      roomCode: this.roomCode,
      selfId: this.selfId,
      peers: Array.from(this.peers.values()),
      messages: this.messages,
      error: this.error,
    };
  }

  private emit() {
    const view = this.getView();
    for (const fn of this.listeners) fn(view);
  }

  public updateProfile(profile: PlayerProfile) {
    this.profile = sanitizePlayerProfile(profile);
    this.send({ type: 'profile:update', profile: this.profile });
  }

  public connect(roomCode: string, profile?: PlayerProfile) {
    if (profile) {
      this.profile = sanitizePlayerProfile(profile);
    }
    const cleanCode = sanitizeRoomCode(roomCode);
    this.manualDisconnect = false;
    this.error = null;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.roomCode === cleanCode) {
      return;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close failure
      }
      this.ws = null;
    }

    this.roomCode = cleanCode;
    this.status = 'connecting';
    this.peers.clear();
    this.emit();

    if (typeof window === 'undefined') return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/kiosco`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.status = 'connected';
        this.error = null;
        this.send({ type: 'room:join', roomCode: cleanCode, profile: this.profile });
        this.emit();
      };

      ws.onmessage = (ev) => {
        if (this.ws !== ws) return;
        let msg: WsServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as WsServerMessage;
        } catch {
          return;
        }
        this.handleServerMessage(msg);
      };

      ws.onerror = () => {
        if (this.ws !== ws) return;
        this.status = 'error';
        this.error = 'No se pudo conectar a la sala online.';
        this.emit();
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (!this.manualDisconnect) {
          this.status = 'connecting';
          this.emit();
          this.reconnectTimer = window.setTimeout(() => {
            if (!this.manualDisconnect && this.roomCode) {
              this.connect(this.roomCode);
            }
          }, 1800);
        } else {
          this.status = 'offline';
          this.peers.clear();
          this.selfId = null;
          this.emit();
        }
      };
    } catch {
      this.status = 'error';
      this.error = 'WebSocket no disponible en este navegador.';
      this.emit();
    }
  }

  public disconnect() {
    this.manualDisconnect = true;
    this.roomCode = '';
    this.selfId = null;
    this.peers.clear();
    this.messages = [];
    this.error = null;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    this.status = 'offline';
    this.emit();
  }

  public send(msg: WsClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public sendPose(
    x: number,
    y: number,
    z: number,
    yaw: number,
    heldProductId: ProductId | null
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (now - this.lastPoseSentAt < 65) return; // ~15Hz throttle
    this.lastPoseSentAt = now;
    this.send({
      type: 'pose:update',
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      z: Number(z.toFixed(3)),
      yaw: Number(yaw.toFixed(3)),
      heldProductId,
    });
  }

  private applySnapshot(snapshot: RoomStateSnapshot) {
    this.selfId = snapshot.selfId;
    this.peers.clear();
    for (const p of snapshot.players) {
      if (p.id !== snapshot.selfId) {
        this.peers.set(p.id, p);
      }
    }
    this.emit();
  }

  private handleServerMessage(msg: WsServerMessage) {
    if (msg.type === 'room:snapshot' || msg.type === 'shift:reset') {
      this.applySnapshot(msg.snapshot);
    } else if (msg.type === 'peer:joined') {
      if (msg.player.id !== this.selfId) {
        this.peers.set(msg.player.id, msg.player);
        this.emit();
      }
    } else if (msg.type === 'peer:left') {
      this.peers.delete(msg.playerId);
      this.emit();
    } else if (msg.type === 'peer:pose') {
      if (msg.player.id !== this.selfId) {
        this.peers.set(msg.player.id, msg.player);
        this.emit();
      }
    } else if (msg.type === 'chat:message') {
      this.messages = [...this.messages.slice(-5), msg.message];
      this.emit();
    } else if (msg.type === 'error') {
      this.error = msg.message;
      this.emit();
    }

    for (const handler of this.serverHandlers) {
      handler(msg);
    }
  }
}
