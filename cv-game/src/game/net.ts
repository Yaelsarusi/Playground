import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export type Player = { id: string; name: string; color: string };

export type RobotMsg = { id: string; round: number; p: Vec3; ry: number; moving: boolean };

/** owner === null means "released, settle here". */
export type BlockUpdate = { id: string; p: Vec3; q: Quat; owner: string | null; ts: number };
export type BlocksMsg = { from: string; round: number; updates: BlockUpdate[] };
export type SyncRequest = { from: string; round: number };
export type SyncResponse = { from: string; to: string; round: number; updates: BlockUpdate[] };

type Handlers = {
  robot: (m: RobotMsg) => void;
  blocks: (m: BlocksMsg) => void;
  syncRequest: (m: SyncRequest) => void;
  syncResponse: (m: SyncResponse) => void;
  players: (players: Player[]) => void;
  leave: (id: string) => void;
  ready: () => void;
};

const CHANNEL = "cv-world";

type Events = { robot: RobotMsg; blocks: BlocksMsg; "sync-req": SyncRequest; "sync-res": SyncResponse };
const EVENT_TO_HANDLER = { robot: "robot", blocks: "blocks", "sync-req": "syncRequest", "sync-res": "syncResponse" } as const;

/** Event hub shared by both transports; the game only talks to this. */
export abstract class Net {
  private handlers: { [K in keyof Handlers]: Set<Handlers[K]> } = {
    robot: new Set(),
    blocks: new Set(),
    syncRequest: new Set(),
    syncResponse: new Set(),
    players: new Set(),
    leave: new Set(),
    ready: new Set(),
  };
  ready = false;

  constructor(readonly me: Player) {}

  on<K extends keyof Handlers>(event: K, fn: Handlers[K]) {
    this.handlers[event].add(fn);
    return () => {
      this.handlers[event].delete(fn);
    };
  }

  protected emit<K extends keyof Handlers>(event: K, arg?: Parameters<Handlers[K]>[0]) {
    for (const fn of this.handlers[event]) (fn as (a: typeof arg) => void)(arg);
  }

  protected receive<E extends keyof Events>(event: E, payload: Events[E]) {
    this.emit(EVENT_TO_HANDLER[event], payload as never);
  }

  protected markReady() {
    this.ready = true;
    this.emit("ready");
  }

  protected abstract send<E extends keyof Events>(event: E, payload: Events[E]): void;
  abstract dispose(): void;

  sendRobot(m: RobotMsg) {
    this.send("robot", m);
  }
  sendBlocks(m: BlocksMsg) {
    this.send("blocks", m);
  }
  sendSyncRequest(m: SyncRequest) {
    this.send("sync-req", m);
  }
  sendSyncResponse(m: SyncResponse) {
    this.send("sync-res", m);
  }
}

/**
 * Supabase Realtime channel. No database tables are used:
 * presence tracks who is online, broadcast carries robot + block positions.
 */
class SupabaseNet extends Net {
  private supabase: SupabaseClient;
  private channel: RealtimeChannel;

  constructor(url: string, key: string, me: Player) {
    super(me);
    this.supabase = createClient(url, key, { realtime: { params: { eventsPerSecond: 30 } } });
    this.channel = this.supabase.channel(CHANNEL, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    for (const event of Object.keys(EVENT_TO_HANDLER) as (keyof Events)[]) {
      this.channel.on("broadcast", { event }, ({ payload }) => this.receive(event, payload as never));
    }
    this.channel
      .on("presence", { event: "sync" }, () => {
        const state = this.channel.presenceState<Player>();
        this.emit(
          "players",
          Object.values(state).map((metas) => metas[0]),
        );
      })
      .on("presence", { event: "leave" }, ({ key }) => this.emit("leave", key))
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await this.channel.track(me);
        this.markReady();
      });
  }

  protected send<E extends keyof Events>(event: E, payload: Events[E]) {
    if (this.ready) void this.channel.send({ type: "broadcast", event, payload });
  }

  dispose() {
    void this.supabase.removeChannel(this.channel);
  }
}

/**
 * Fallback when Supabase isn’t configured: syncs between tabs of the same
 * browser. Handy for testing multiplayer locally (open two tabs).
 */
class LocalNet extends Net {
  private bc = new BroadcastChannel(CHANNEL);
  private peers = new Map<string, { player: Player; lastSeen: number }>();
  private timer: ReturnType<typeof setInterval>;

  constructor(me: Player) {
    super(me);
    this.bc.onmessage = ({ data }) => {
      if (data.event === "hello") this.seen(data.payload as Player);
      else if (data.event === "bye") this.drop(data.payload as string);
      else this.receive(data.event, data.payload);
    };
    const heartbeat = () => {
      this.bc.postMessage({ event: "hello", payload: me });
      const now = Date.now();
      for (const [id, p] of this.peers) if (now - p.lastSeen > 4000) this.drop(id);
    };
    this.timer = setInterval(heartbeat, 1000);
    setTimeout(() => {
      heartbeat();
      this.emitPlayers();
      this.markReady();
    });
  }

  private seen(player: Player) {
    const isNew = !this.peers.has(player.id);
    this.peers.set(player.id, { player, lastSeen: Date.now() });
    if (isNew) {
      this.bc.postMessage({ event: "hello", payload: this.me });
      this.emitPlayers();
    }
  }

  private drop(id: string) {
    if (!this.peers.delete(id)) return;
    this.emit("leave", id);
    this.emitPlayers();
  }

  private emitPlayers() {
    this.emit("players", [this.me, ...[...this.peers.values()].map((p) => p.player)]);
  }

  protected send<E extends keyof Events>(event: E, payload: Events[E]) {
    this.bc.postMessage({ event, payload });
  }

  dispose() {
    clearInterval(this.timer);
    this.bc.postMessage({ event: "bye", payload: this.me.id });
    this.bc.close();
  }
}

export function createNet(me: Player): Net {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? new SupabaseNet(url, key, me) : new LocalNet(me);
}
