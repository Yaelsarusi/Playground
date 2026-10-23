import { RigidBodyType } from "@dimforge/rapier3d-compat";
import type { RapierRigidBody } from "@react-three/rapier";
import type { BlockUpdate, Net, Quat, Vec3 } from "./net";
import { LAYOUT_BY_ID } from "./layout";

type BlockState = {
  /** Who is simulating this block right now. null = nobody, it is at rest. */
  owner: string | null;
  /** Claim time, newest claim wins a conflict. */
  ts: number;
  /** Where the owner says the block is (only used while someone else owns it). */
  target?: { p: Vec3; q: Quat };
};

/**
 * Keeps the blocks in sync between visitors with a simple ownership model:
 * whoever last touched a block simulates it and streams its transform;
 * everyone else moves it kinematically to match. When it falls asleep the
 * owner sends a final "release" and every client turns it back into a
 * regular dynamic body at the same spot.
 */
export class WorldSync {
  private bodies = new Map<string, () => RapierRigidBody | null>();
  private state = new Map<string, BlockState>();
  private gotSnapshot = false;

  constructor(
    readonly me: string,
    readonly round: number,
    readonly net: Net | null,
  ) {}

  register(id: string, get: () => RapierRigidBody | null) {
    this.bodies.set(id, get);
    this.state.set(id, { owner: null, ts: 0 });
  }

  unregister(id: string) {
    this.bodies.delete(id);
    this.state.delete(id);
  }

  body(id: string) {
    return this.bodies.get(id)?.() ?? null;
  }

  ids() {
    return this.bodies.keys();
  }

  isMine(id: string) {
    return this.state.get(id)?.owner === this.me;
  }

  /** Called when our robot (or a block we own) touches a block. */
  claim(id: string, force = false) {
    const s = this.state.get(id);
    const body = this.body(id);
    if (!s || !body || s.owner === this.me) return;
    if (s.owner && !force) return;
    s.owner = this.me;
    s.ts = Date.now();
    s.target = undefined;
    if (body.bodyType() !== RigidBodyType.Dynamic) body.setBodyType(RigidBodyType.Dynamic, true);
    body.wakeUp();
  }

  /** A block we own bumped into another one: take that one over too, unless someone else is moving it. */
  onBlockContact(id: string, otherId: string | undefined) {
    if (otherId && this.isMine(id)) this.claim(otherId);
  }

  private snapshot(id: string, owner: string | null, ts: number): BlockUpdate | null {
    const body = this.body(id);
    if (!body) return null;
    const t = body.translation();
    const r = body.rotation();
    return { id, owner, ts, p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] };
  }

  /** Runs on a timer: stream the blocks we own, release the ones that settled. */
  tick() {
    const updates: BlockUpdate[] = [];
    for (const [id, s] of this.state) {
      if (s.owner !== this.me) continue;
      const body = this.body(id);
      if (!body) continue;
      this.recoverIfFallen(id, body);
      const settled = body.isSleeping();
      if (settled) s.owner = null;
      const u = this.snapshot(id, s.owner, s.ts);
      if (u) updates.push(u);
    }
    if (updates.length) this.net?.sendBlocks({ from: this.me, round: this.round, updates });
  }

  /** Release everything we own (tab hidden / leaving). */
  releaseAll() {
    const updates: BlockUpdate[] = [];
    for (const [id, s] of this.state) {
      if (s.owner !== this.me) continue;
      s.owner = null;
      const u = this.snapshot(id, null, s.ts);
      if (u) updates.push(u);
    }
    if (updates.length) this.net?.sendBlocks({ from: this.me, round: this.round, updates });
  }

  private recoverIfFallen(id: string, body: RapierRigidBody) {
    if (body.translation().y > -10) return;
    const def = LAYOUT_BY_ID.get(id);
    if (!def) return;
    body.setTranslation({ x: def.position[0], y: def.position[1] + 3, z: def.position[2] }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  applyRemote(updates: BlockUpdate[], from: string) {
    for (const u of updates) {
      const s = this.state.get(u.id);
      const body = this.body(u.id);
      if (!s || !body) continue;

      if (s.owner === this.me) {
        // Conflict: newest claim wins, ties broken by id so both sides agree.
        const theirsWins = u.ts > s.ts || (u.ts === s.ts && from > this.me);
        if (!theirsWins) continue;
      } else if (s.owner && s.owner !== from && u.ts < s.ts) {
        continue; // stale update from a previous owner
      }

      s.ts = u.ts;
      s.owner = u.owner;
      if (u.owner === null) {
        this.settle(body, u.p, u.q);
        s.target = undefined;
      } else {
        if (body.bodyType() !== RigidBodyType.KinematicPositionBased) {
          body.setBodyType(RigidBodyType.KinematicPositionBased, true);
        }
        s.target = { p: u.p, q: u.q };
      }
    }
  }

  private settle(body: RapierRigidBody, p: Vec3, q: Quat) {
    if (body.bodyType() !== RigidBodyType.Dynamic) body.setBodyType(RigidBodyType.Dynamic, true);
    // Wake it so contacts get rebuilt at the new spot; it falls asleep again on its own.
    body.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
    body.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Before each physics step: glide remotely-owned blocks toward their latest reported transform. */
  followRemote(alpha: number) {
    for (const [id, s] of this.state) {
      if (!s.target || s.owner === this.me || s.owner === null) continue;
      const body = this.body(id);
      if (!body) continue;
      const t = body.translation();
      const [x, y, z] = s.target.p;
      body.setNextKinematicTranslation({ x: t.x + (x - t.x) * alpha, y: t.y + (y - t.y) * alpha, z: t.z + (z - t.z) * alpha });
      const [qx, qy, qz, qw] = s.target.q;
      body.setNextKinematicRotation({ x: qx, y: qy, z: qz, w: qw });
    }
  }

  /** A player left: whatever they were pushing settles where it is. */
  onPlayerLeft(id: string) {
    for (const [blockId, s] of this.state) {
      if (s.owner !== id) continue;
      const body = this.body(blockId);
      s.owner = null;
      if (body && s.target) this.settle(body, s.target.p, s.target.q);
      s.target = undefined;
    }
  }

  // --- late joiners -------------------------------------------------------

  requestSnapshot() {
    this.net?.sendSyncRequest({ from: this.me, round: this.round });
  }

  fullSnapshot(): BlockUpdate[] {
    return [...this.state.entries()]
      .map(([id, s]) => this.snapshot(id, s.owner, s.ts))
      .filter((u): u is BlockUpdate => !!u);
  }

  applySnapshot(updates: BlockUpdate[], from: string) {
    if (this.gotSnapshot) return;
    this.gotSnapshot = true;
    this.applyRemote(updates, from);
  }
}
