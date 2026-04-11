import { sql, DatabaseError } from "@/lib/database/InitializeDB";

export interface MediaAsset {
  id: number;
  owner_id: number;
  is_public: boolean;
  content_type: string;
  file_name: string | null;
  byte_size: number;
  created_at: string;
}

export interface MediaAssetWithData extends MediaAsset {
  data: Buffer;
}

function toBuffer(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (typeof raw === "string") {
    const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
    return Buffer.from(hex, "hex");
  }
  return Buffer.alloc(0);
}

export class MediaRepository {
  async create(asset: {
    owner_id: number;
    is_public: boolean;
    content_type: string;
    file_name?: string | null;
    data: Buffer;
  }): Promise<MediaAsset> {
    try {
      const result = await sql`
        INSERT INTO media_assets (owner_id, is_public, content_type, file_name, data, byte_size)
        VALUES (
          ${asset.owner_id},
          ${asset.is_public},
          ${asset.content_type},
          ${asset.file_name ?? null},
          ${asset.data},
          ${asset.data.length}
        )
        RETURNING id, owner_id, is_public, content_type, file_name, byte_size, created_at
      `;
      return result[0] as MediaAsset;
    } catch (error) {
      throw new DatabaseError("Failed to create media asset", error as Error);
    }
  }

  async findById(id: number): Promise<MediaAsset | null> {
    try {
      const result = await sql`
        SELECT id, owner_id, is_public, content_type, file_name, byte_size, created_at
        FROM media_assets
        WHERE id = ${id}
        LIMIT 1
      `;
      return (result[0] as MediaAsset) || null;
    } catch (error) {
      throw new DatabaseError("Failed to find media asset", error as Error);
    }
  }

  async getDataById(id: number): Promise<MediaAssetWithData | null> {
    try {
      const result = await sql`
        SELECT id, owner_id, is_public, content_type, file_name, byte_size, data, created_at
        FROM media_assets
        WHERE id = ${id}
        LIMIT 1
      `;
      if (result.length === 0) return null;
      const row = result[0] as Record<string, unknown>;
      return {
        id: row.id as number,
        owner_id: row.owner_id as number,
        is_public: row.is_public as boolean,
        content_type: row.content_type as string,
        file_name: (row.file_name as string | null) ?? null,
        byte_size: row.byte_size as number,
        created_at: row.created_at as string,
        data: toBuffer(row.data),
      };
    } catch (error) {
      throw new DatabaseError("Failed to get media asset data", error as Error);
    }
  }

  async canAccess(assetId: number, requesterId: number): Promise<boolean> {
    try {
      const assetRows = await sql`
        SELECT owner_id, is_public FROM media_assets WHERE id = ${assetId} LIMIT 1
      `;
      if (assetRows.length === 0) return false;
      const asset = assetRows[0] as { owner_id: number; is_public: boolean };
      if (asset.is_public) return true;
      if (asset.owner_id === requesterId) return true;
      const threadRows = await sql`
        SELECT 1 FROM message_threads
        WHERE (user_a_id = ${asset.owner_id} AND user_b_id = ${requesterId})
           OR (user_a_id = ${requesterId} AND user_b_id = ${asset.owner_id})
        LIMIT 1
      `;
      return threadRows.length > 0;
    } catch (error) {
      throw new DatabaseError("Failed to check media access", error as Error);
    }
  }
}
