export type Photo = {
  id: string;
  title: string;
  url: string;
  takenAt?: string;
  tags?: string[];
  isLive?: boolean;
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
