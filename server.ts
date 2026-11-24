import express from 'express';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  KIOSCO_UPGRADES,
  PRODUCT_CATALOG,
  SECRET_EVENTS,
  SHIFT_START_SECONDS,
  createInitialSoldRecords,
  createInitialStock,
  normalizeGeminiEncounter,
  recordSaleToInventory,
  sanitizePlayerProfile,
  sanitizeRoomCode,
} from './src/game/kioscoLogic';
import type {
  KioscoUpgradeId,
  OnlinePlayerState,
  OrderItem,
  ProductId,
  RoomStateSnapshot,
  WsClientMessage,
  WsServerMessage,
} from './src/game/types';

dotenv.config();

const PORT = 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY no está configurada en el servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/kiosco/encounter', async (req, res) => {
    try {
      const { playerName, friendName, shiftCount, mood } = req.body ?? {};
      const ai = getAiClient();

      const prompt = `Generá un visitante o entidad nueva para un supermercado argentino de terror donde dos trabajadores atienden turno completo hasta las 03:00 AM.
El jugador se llama ${playerName || 'Santi'}, y trabaja con ${friendName || 'El Tucu'} reponiendo heladeras y góndolas hasta las 3 AM.
Cliente actual #${Number(shiftCount || 1)}. Tono deseado: ${mood || 'terror nocturno inquietante en pasillos oscuros de supermercado'}.

Elegí entre 1 y 3 productos EXACTOS de estos IDs válidos:
- "carne" (Bandeja de Carne Fría)
- "leche" (Leche Entera 1L)
- "fideos" (Paquete de Fideos)
- "cafe" (Frasco de Café Negro)
- "gaseosa" (Gaseosa Cola 1.5L)
- "agua" (Agua Mineral Fría)
- "pan" (Pan Lactal de Molde)
- "galletitas" (Galletitas Dulces)

Elegí un arquetipo visual válido: "camionero", "paisano", "turista", "pibe", "sospechoso", "aparicion".
Si es "sospechoso" o "aparicion", podés marcar isSuspicious: true para generar tensión y miedo (si ataca, el jugador tiene escopeta debajo de la caja).
Escribí diálogos cortos, inquietantes y bien argentinos.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Sos el director de terror narrativo de un supermercado nocturno argentino abierto hasta las 3 AM. Devolvé únicamente JSON válido según el esquema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              npcName: { type: Type.STRING, description: 'Nombre, rol o apodo inquietante' },
              archetype: {
                type: Type.STRING,
                description: 'Uno de: camionero, paisano, turista, pibe, sospechoso, aparicion',
              },
              greeting: {
                type: Type.STRING,
                description: 'Frase de saludo y pedido al llegar al mostrador (max 140 caracteres)',
              },
              friendComment: {
                type: Type.STRING,
                description: 'Comentario corto del amigo que atiende con vos (max 100 caracteres)',
              },
              thanksLine: {
                type: Type.STRING,
                description: 'Frase al pagar e irse (max 110 caracteres)',
              },
              isSuspicious: {
                type: Type.BOOLEAN,
                description: 'Si el cliente parece sospechoso o peligroso en la ruta',
              },
              paymentMethod: {
                type: Type.STRING,
                description: 'Uno de: efectivo, qr',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                  },
                  required: ['productId', 'quantity'],
                },
              },
            },
            required: [
              'npcName',
              'archetype',
              'greeting',
              'friendComment',
              'thanksLine',
              'isSuspicious',
              'paymentMethod',
              'items',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({ encounter: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar encuentro con Gemini';
      res.status(500).json({ error: message });
    }
  });

  const ttsCache = new Map<string, string>();
  const ttsDiskDir = path.join(os.tmpdir(), 'kiosco-ruta157-tts-cache');
  try {
    fs.mkdirSync(ttsDiskDir, { recursive: true });
  } catch {
    // Ignore tmpdir creation failure
  }
  const ALLOWED_VOICES = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);

  app.post('/api/kiosco/tts', async (req, res) => {
    try {
      const { text, voiceName, style } = req.body ?? {};
      const cleanText = typeof text === 'string' ? text.trim().slice(0, 420) : '';
      if (!cleanText) {
        res.status(400).json({ error: 'Falta el texto para sintetizar la voz.' });
        return;
      }
      const chosenVoice = ALLOWED_VOICES.has(voiceName) ? String(voiceName) : 'Charon';
      const chosenStyle =
        typeof style === 'string' && style.trim()
          ? style.trim().slice(0, 220)
          : 'Natural warm Argentine Spanish conversational voice';

      const cacheKey = `${chosenVoice}::${chosenStyle}::${cleanText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({ audioBase64: cached, mimeType: 'audio/wav', cached: true });
        return;
      }
      const diskHash = crypto.createHash('sha256').update(cacheKey).digest('hex').slice(0, 32);
      const diskFile = path.join(ttsDiskDir, `${diskHash}.b64`);
      try {
        if (fs.existsSync(diskFile)) {
          const diskB64 = fs.readFileSync(diskFile, 'utf8');
          if (diskB64) {
            ttsCache.set(cacheKey, diskB64);
            res.json({ audioBase64: diskB64, mimeType: 'audio/wav', cached: true });
            return;
          }
        }
      } catch {
        // Ignore disk cache read errors
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        throw new Error('GEMINI_API_KEY no está configurada en el servidor.');
      }
      const aiTts = new GoogleGenAI({
        apiKey,
        apiVersion: 'v1beta',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let base64Audio: string | undefined;
      let mimeType = 'audio/wav';
      let lastErr: unknown;
      let isRateLimited = false;
      const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

      for (const modelName of ttsModels) {
        try {
          const response = await aiTts.models.generateContent({
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanText,
                    speechMetadata: {
                      style: chosenStyle,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: chosenVoice },
                },
              },
            },
          });

          const parts = response.candidates?.[0]?.content?.parts ?? [];
          const audioPart = parts.find((p) => p.inlineData?.data);
          base64Audio = audioPart?.inlineData?.data;
          if (audioPart?.inlineData?.mimeType) {
            mimeType = audioPart.inlineData.mimeType;
          }
          if (base64Audio) {
            isRateLimited = false;
            break;
          }
          lastErr = new Error('El modelo de voz no devolvió audio.');
        } catch (err: unknown) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[TTS:${modelName}]`, msg);
          if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
            isRateLimited = true;
          } else {
            isRateLimited = false;
          }
        }
      }

      if (!base64Audio) {
        if (isRateLimited) {
          res.status(429).json({
            error: 'Límite temporal de voces alcanzado. Esperá unos segundos y tocá Repetir/Escuchar.',
          });
          return;
        }
        throw lastErr instanceof Error
          ? lastErr
          : new Error('El modelo de voz no devolvió audio.');
      }

      if (ttsCache.size >= 250) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, base64Audio);
      try {
        fs.writeFileSync(diskFile, base64Audio, 'utf8');
      } catch {
        // Ignore disk cache write errors
      }

      res.json({ audioBase64: base64Audio, mimeType, cached: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar voz humana con Gemini TTS';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);

  // Real online co-op WebSocket room server (server-authoritative state)
  interface ServerRoom {
    code: string;
    clients: Map<string, { ws: WebSocket; player: OnlinePlayerState }>;
    cash: number;
    customersServed: number;
    reputation: number;
    shiftSeconds: number;
    storyIndex: number;
    nightNumber: number;
    nightServed: number;
    upgrades: KioscoUpgradeId[];
    discoveredSecrets: string[];
    activeNpc: RoomStateSnapshot['activeNpc'];
    npcStatus: RoomStateSnapshot['npcStatus'];
    stock: Record<ProductId, number>;
    sold: RoomStateSnapshot['sold'];
  }

  const rooms = new Map<string, ServerRoom>();

  const getOrCreateRoom = (code: string): ServerRoom => {
    const clean = sanitizeRoomCode(code);
    let room = rooms.get(clean);
    if (!room) {
      room = {
        code: clean,
        clients: new Map(),
        cash: 4500,
        customersServed: 0,
        reputation: 90,
        shiftSeconds: SHIFT_START_SECONDS,
        storyIndex: 0,
        nightNumber: 1,
        nightServed: 0,
        upgrades: [],
        discoveredSecrets: [],
        activeNpc: null,
        npcStatus: 'none',
        stock: createInitialStock(),
        sold: createInitialSoldRecords(),
      };
      rooms.set(clean, room);
    }
    return room;
  };

  const toSnapshot = (room: ServerRoom, selfId: string): RoomStateSnapshot => ({
    roomCode: room.code,
    selfId,
    players: Array.from(room.clients.values()).map((c) => c.player),
    cash: room.cash,
    customersServed: room.customersServed,
    reputation: room.reputation,
    shiftSeconds: room.shiftSeconds,
    storyIndex: room.storyIndex,
    nightNumber: room.nightNumber,
    nightServed: room.nightServed,
    upgrades: [...room.upgrades],
    discoveredSecrets: [...room.discoveredSecrets],
    activeNpc: room.activeNpc,
    npcStatus: room.npcStatus,
    stock: room.stock,
    sold: room.sold,
  });

  const sendWs = (ws: WebSocket, msg: WsServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const broadcastRoom = (room: ServerRoom, msg: WsServerMessage, excludeId?: string) => {
    const raw = JSON.stringify(msg);
    for (const [cid, entry] of room.clients.entries()) {
      if (cid !== excludeId && entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(raw);
      }
    }
  };

  app.get('/api/kiosco/room/:code', (req, res) => {
    const code = sanitizeRoomCode(String(req.params.code || ''));
    const room = rooms.get(code);
    res.json({
      roomCode: code,
      playersCount: room ? room.clients.size : 0,
    });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID().slice(0, 12);
    let currentRoom: ServerRoom | null = null;

    const leaveCurrentRoom = () => {
      if (!currentRoom) return;
      currentRoom.clients.delete(clientId);
      broadcastRoom(currentRoom, { type: 'peer:left', playerId: clientId });
      if (currentRoom.clients.size === 0) {
        rooms.delete(currentRoom.code);
      }
      currentRoom = null;
    };

    ws.on('message', (rawBuf) => {
      let msg: WsClientMessage;
      try {
        msg = JSON.parse(rawBuf.toString('utf8')) as WsClientMessage;
      } catch {
        sendWs(ws, { type: 'error', message: 'Mensaje inválido.' });
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

      if (msg.type === 'room:join') {
        const roomCode = sanitizeRoomCode(msg.roomCode);
        const profile = sanitizePlayerProfile(msg.profile);
        if (currentRoom && currentRoom.code !== roomCode) {
          leaveCurrentRoom();
        }
        const room = getOrCreateRoom(roomCode);
        if (!room.clients.has(clientId) && room.clients.size >= 4) {
          sendWs(ws, { type: 'error', message: `La sala ${roomCode} está llena (máx. 4 amigos).` });
          return;
        }
        const player: OnlinePlayerState = {
          id: clientId,
          x: -1.55,
          y: 0.07,
          z: -2.35,
          yaw: 0.25,
          heldProductId: null,
          profile,
        };
        room.clients.set(clientId, { ws, player });
        currentRoom = room;
        sendWs(ws, { type: 'room:snapshot', snapshot: toSnapshot(room, clientId) });
        broadcastRoom(room, { type: 'peer:joined', player }, clientId);
        return;
      }

      if (!currentRoom) return;
      const selfEntry = currentRoom.clients.get(clientId);
      if (!selfEntry) return;

      if (msg.type === 'profile:update') {
        selfEntry.player.profile = sanitizePlayerProfile(msg.profile);
        broadcastRoom(currentRoom, { type: 'peer:pose', player: selfEntry.player }, clientId);
      } else if (msg.type === 'pose:update') {
        const clampCoord = (v: unknown, min: number, max: number, fb: number) =>
          typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fb;
        selfEntry.player.x = clampCoord(msg.x, -25, 25, selfEntry.player.x);
        selfEntry.player.y = clampCoord(msg.y, -2, 6, selfEntry.player.y);
        selfEntry.player.z = clampCoord(msg.z, -20, 20, selfEntry.player.z);
        selfEntry.player.yaw = clampCoord(msg.yaw, -Math.PI * 4, Math.PI * 4, selfEntry.player.yaw);
        selfEntry.player.heldProductId =
          msg.heldProductId && PRODUCT_CATALOG[msg.heldProductId] ? msg.heldProductId : null;
        broadcastRoom(currentRoom, { type: 'peer:pose', player: selfEntry.player }, clientId);
      } else if (msg.type === 'npc:spawn') {
        const rawEnc = msg.encounter;
        if (!rawEnc || typeof rawEnc !== 'object') return;
        const normalized =
          rawEnc.source === 'story'
            ? rawEnc
            : normalizeGeminiEncounter(rawEnc, String(Date.now()));
        currentRoom.activeNpc = normalized;
        currentRoom.npcStatus = 'approaching';
        currentRoom.storyIndex = Math.max(0, Math.round(Number(msg.storyIndex) || 0));
        broadcastRoom(
          currentRoom,
          {
            type: 'npc:spawned',
            encounter: normalized,
            storyIndex: currentRoom.storyIndex,
          },
          clientId
        );
      } else if (msg.type === 'npc:status') {
        const allowedStatuses = new Set(['none', 'approaching', 'waiting', 'attacking', 'scared', 'leaving']);
        if (!allowedStatuses.has(msg.npcStatus)) return;
        const prevStatus = currentRoom.npcStatus;
        currentRoom.npcStatus = msg.npcStatus;
        if (typeof msg.reputationDelta === 'number' && Number.isFinite(msg.reputationDelta)) {
          const delta = Math.max(-25, Math.min(25, msg.reputationDelta));
          currentRoom.reputation = Math.max(0, Math.min(100, currentRoom.reputation + delta));
        }
        if (msg.npcStatus === 'scared' && prevStatus !== 'scared') {
          currentRoom.nightServed += 1;
          if (prevStatus === 'attacking' && (msg.reputationDelta ?? 0) > 0) {
            currentRoom.cash += 800;
            currentRoom.customersServed += 1;
          } else if ((msg.reputationDelta ?? 0) < 0 && prevStatus === 'attacking') {
            currentRoom.cash = Math.max(0, currentRoom.cash - 500);
          }
        }
        if (msg.npcStatus === 'none') {
          currentRoom.activeNpc = null;
        }
        broadcastRoom(
          currentRoom,
          {
            type: 'npc:status',
            npcStatus: currentRoom.npcStatus,
            reputation: currentRoom.reputation,
          },
          clientId
        );
      } else if (msg.type === 'sale:complete') {
        if (!currentRoom.activeNpc) return;
        const validItems: OrderItem[] = Array.isArray(msg.soldItems)
          ? msg.soldItems.filter((it) => it && PRODUCT_CATALOG[it.productId] && it.quantity > 0)
          : currentRoom.activeNpc.items;
        const customerName =
          typeof msg.customerName === 'string' && msg.customerName.trim()
            ? msg.customerName.trim().slice(0, 40)
            : currentRoom.activeNpc.npcName;
        const invResult = recordSaleToInventory(
          currentRoom.stock,
          currentRoom.sold,
          validItems,
          customerName
        );
        const tipBonus = currentRoom.upgrades.includes('mostrador_pro') ? 350 : 0;
        const authoritativeTotal = invResult.revenueAdded + tipBonus;
        currentRoom.stock = invResult.nextStock;
        currentRoom.sold = invResult.nextSold;
        currentRoom.cash += authoritativeTotal;
        currentRoom.customersServed += 1;
        currentRoom.nightServed += 1;
        currentRoom.reputation = Math.min(100, currentRoom.reputation + 5);
        currentRoom.npcStatus = 'leaving';
        broadcastRoom(currentRoom, {
          type: 'sale:completed',
          cash: currentRoom.cash,
          customersServed: currentRoom.customersServed,
          nightServed: currentRoom.nightServed,
          reputation: currentRoom.reputation,
          stock: currentRoom.stock,
          sold: currentRoom.sold,
          soldItems: validItems,
          customerName,
          byPlayerId: clientId,
        });
      } else if (msg.type === 'stock:restock') {
        if (!PRODUCT_CATALOG[msg.productId]) return;
        const count = Math.max(1, Math.min(6, Math.round(Number(msg.count) || 2)));
        currentRoom.stock[msg.productId] = (currentRoom.stock[msg.productId] ?? 0) + count;
        broadcastRoom(currentRoom, {
          type: 'stock:restocked',
          productId: msg.productId,
          count,
          stock: currentRoom.stock,
          byPlayerId: clientId,
        });
      } else if (msg.type === 'shelves:organize') {
        broadcastRoom(currentRoom, { type: 'shelves:organized', byPlayerId: clientId }, clientId);
      } else if (msg.type === 'secret:discover') {
        const secret = SECRET_EVENTS.find((s) => s.id === msg.secretId);
        if (!secret || currentRoom.discoveredSecrets.includes(secret.id)) return;
        currentRoom.discoveredSecrets.push(secret.id);
        currentRoom.cash += secret.rewardCash;
        currentRoom.reputation = Math.min(100, currentRoom.reputation + secret.rewardRep);
        broadcastRoom(currentRoom, {
          type: 'secret:discovered',
          secretId: secret.id,
          discoveredSecrets: [...currentRoom.discoveredSecrets],
          cash: currentRoom.cash,
          reputation: currentRoom.reputation,
          byPlayerName: selfEntry.player.profile.playerName,
        });
      } else if (msg.type === 'upgrade:buy') {
        const upg = KIOSCO_UPGRADES.find((u) => u.id === msg.upgradeId);
        if (!upg || currentRoom.upgrades.includes(upg.id) || currentRoom.cash < upg.cost) return;
        currentRoom.cash -= upg.cost;
        currentRoom.upgrades.push(upg.id);
        broadcastRoom(currentRoom, {
          type: 'upgrade:bought',
          upgradeId: upg.id,
          upgrades: [...currentRoom.upgrades],
          cash: currentRoom.cash,
        });
      } else if (msg.type === 'night:advance') {
        currentRoom.nightNumber += 1;
        currentRoom.nightServed = 0;
        currentRoom.storyIndex = 0;
        currentRoom.shiftSeconds = SHIFT_START_SECONDS;
        currentRoom.activeNpc = null;
        currentRoom.npcStatus = 'none';
        broadcastRoom(currentRoom, {
          type: 'night:advanced',
          nightNumber: currentRoom.nightNumber,
          nightServed: currentRoom.nightServed,
          shiftSeconds: currentRoom.shiftSeconds,
        });
      } else if (msg.type === 'shift:reset') {
        currentRoom.cash = 4500;
        currentRoom.customersServed = 0;
        currentRoom.reputation = 90;
        currentRoom.shiftSeconds = SHIFT_START_SECONDS;
        currentRoom.storyIndex = 0;
        currentRoom.nightNumber = 1;
        currentRoom.nightServed = 0;
        currentRoom.upgrades = [];
        currentRoom.discoveredSecrets = [];
        currentRoom.activeNpc = null;
        currentRoom.npcStatus = 'none';
        currentRoom.stock = createInitialStock();
        currentRoom.sold = createInitialSoldRecords();
        for (const [cid, entry] of currentRoom.clients.entries()) {
          sendWs(entry.ws, { type: 'shift:reset', snapshot: toSnapshot(currentRoom, cid) });
        }
      } else if (msg.type === 'chat:send') {
        const cleanText =
          typeof msg.text === 'string'
            ? msg.text.replace(/[\r\n\t<>]/g, '').trim().slice(0, 120)
            : '';
        if (!cleanText) return;
        broadcastRoom(currentRoom, {
          type: 'chat:message',
          message: {
            id: crypto.randomUUID().slice(0, 8),
            senderId: clientId,
            senderName: selfEntry.player.profile.playerName,
            text: cleanText,
            at: Date.now(),
          },
        });
      }
    });

    ws.on('close', leaveCurrentRoom);
    ws.on('error', leaveCurrentRoom);
  });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    if (!reqUrl.startsWith('/ws/kiosco')) {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kiosco Ruta 157 servidor corriendo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
