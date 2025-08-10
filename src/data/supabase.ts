import { config } from '../config.js';

export interface MediaHash {
  hash: string;
  type: 'image' | 'video';
  created_at: string;
  url?: string;
  platform?: string;
}

export interface ModerationRecord {
  id: string;
  created_at: string;
  score: number;
  label: string;
  categories: Record<string, unknown>;
  account_id?: string;
  platform: string;
  media_hash?: string;
}

export interface SupabaseClient {
  saveMediaHash(hash: Omit<MediaHash, 'created_at'>): Promise<void>;
  findNearestHash(hash: string): Promise<MediaHash[]>;
  listRecentMediaHashes(type: 'image' | 'video', limit?: number): Promise<MediaHash[]>;
  saveModerationResult(
    result: Omit<ModerationRecord, 'id' | 'created_at'>
  ): Promise<void>;
  isEnabled(): boolean;
}

class SupabaseClientImpl implements SupabaseClient {
  private client: unknown;
  private enabled: boolean;

  constructor() {
    this.enabled =
      config.enableSupabase &&
      !!config.supabase.url &&
      !!config.supabase.anonKey;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async getClient(): Promise<unknown> {
    if (!this.client && this.enabled) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        this.client = createClient(
          config.supabase.url!,
          config.supabase.anonKey!
        );
      } catch (error) {
        console.warn('Failed to create Supabase client:', error);
        this.enabled = false;
      }
    }
    return this.client;
  }

  async saveMediaHash(hash: Omit<MediaHash, 'created_at'>): Promise<void> {
    if (!this.enabled) return;

    try {
      const client = await this.getClient();
      if (!client) return;

      const fromFn = (client as { from?: (t: string) => unknown }).from;
      if (typeof fromFn !== 'function') return;
      const table = fromFn.call(client, 'media_hashes') as {
        upsert?: (data: unknown) => Promise<{ error?: unknown }>;
      };
      if (!table || typeof table.upsert !== 'function') return;
      const { error } = await table.upsert({
        ...hash,
        created_at: new Date().toISOString(),
      });
      if (error) console.warn('Failed to save media hash:', error);
    } catch (error) {
      console.warn('Error saving media hash:', error);
    }
  }

  async findNearestHash(hash: string): Promise<MediaHash[]> {
    if (!this.enabled) return [];

    try {
      const client = await this.getClient();
      if (!client) return [];

      const fromFn = (client as { from?: (t: string) => unknown }).from;
      if (typeof fromFn !== 'function') return [];
      const table = fromFn.call(client, 'media_hashes') as {
        select?: (cols: string) => {
          eq?: (
            field: string,
            value: string
          ) => Promise<{ data?: MediaHash[]; error?: unknown }>;
        };
      };
      if (!table || typeof table.select !== 'function') return [];
      const selected = table.select('*');
      if (!selected || typeof selected.eq !== 'function') return [];
      const { data, error } = await selected.eq('hash', hash);
      if (error) {
        console.warn('Failed to find nearest hash:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.warn('Error finding nearest hash:', error);
      return [];
    }
  }

  async saveModerationResult(
    result: Omit<ModerationRecord, 'id' | 'created_at'>
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const client = await this.getClient();
      if (!client) return;
      const fromFn = (client as { from?: (t: string) => unknown }).from;
      if (typeof fromFn !== 'function') return;
      const table = fromFn.call(client, 'moderation_results') as {
        insert?: (data: unknown) => Promise<{ error?: unknown }>;
      };
      if (!table || typeof table.insert !== 'function') return;
      const { error } = await table.insert({
        ...result,
        created_at: new Date().toISOString(),
      });
      if (error) console.warn('Failed to save moderation result:', error);
    } catch (error) {
      console.warn('Error saving moderation result:', error);
    }
  }

  async listRecentMediaHashes(type: 'image' | 'video', limit: number = 500): Promise<MediaHash[]> {
    if (!this.enabled) return [];

    try {
      const client = await this.getClient();
      if (!client) return [];

      const fromFn = (client as { from?: (t: string) => unknown }).from;
      if (typeof fromFn !== 'function') return [];
      const table = fromFn.call(client, 'media_hashes') as {
        select?: (cols: string) => {
          eq?: (
            field: string,
            value: string
          ) => {
            order?: (
              field: string,
              opts: { ascending: boolean }
            ) => {
              limit?: (n: number) => Promise<{ data?: MediaHash[]; error?: unknown }>;
            };
          };
        };
      };
      if (!table || typeof table.select !== 'function') return [];
      const selected = table.select('hash,type,created_at,url,platform');
      if (!selected || typeof selected.eq !== 'function') return [];
      const eqRes = selected.eq('type', type);
      if (!eqRes || typeof eqRes.order !== 'function') return [];
      const ordered = eqRes.order('created_at', { ascending: false });
      if (!ordered || typeof ordered.limit !== 'function') return [];
      const { data, error } = await ordered.limit(limit);
      if (error) {
        console.warn('Failed to list recent media hashes:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.warn('Error listing recent media hashes:', error);
      return [];
    }
  }
}

// Export singleton instance
export const supabaseClient = new SupabaseClientImpl();

// Helper functions for external use
export async function saveMediaHash(
  hash: Omit<MediaHash, 'created_at'>
): Promise<void> {
  return supabaseClient.saveMediaHash(hash);
}

export async function findNearestHash(hash: string): Promise<MediaHash[]> {
  return supabaseClient.findNearestHash(hash);
}

export async function saveModerationResult(
  result: Omit<ModerationRecord, 'id' | 'created_at'>
): Promise<void> {
  return supabaseClient.saveModerationResult(result);
}

export async function listRecentMediaHashes(
  type: 'image' | 'video',
  limit?: number
): Promise<MediaHash[]> {
  return supabaseClient.listRecentMediaHashes(type, limit);
}
