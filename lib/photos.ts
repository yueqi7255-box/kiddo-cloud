import type { Photo } from "./types";

const mockPhotos: Photo[] = [
  {
    id: "p1",
    title: "First steps",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    takenAt: "2023-05-12",
    tags: ["milestone", "family"],
  },
  {
    id: "p2",
    title: "Weekend park",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    takenAt: "2023-08-20",
    tags: ["outdoor"],
    isLive: true,
  },
];

export function listPhotos(): Photo[] {
  return mockPhotos;
}
