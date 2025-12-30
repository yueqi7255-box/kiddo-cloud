export type Photo = {
  id: string;
  title: string;
  url: string;
  takenAt?: string;
  tags?: string[];
  media_type?: "photo" | "video" | "live";
  format?: string;
  sizeMB?: number;
  location?: string;
  device?: string;
  storagePath?: string;
  livePlaybackUrl?: string;
};

export type ApiHealth = {
  status: "ok";
  timestamp: string;
  note?: string;
};
