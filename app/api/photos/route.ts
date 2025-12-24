import { NextResponse } from "next/server";
import { listPhotos } from "@/lib/photos";

export function GET() {
  return NextResponse.json({ photos: listPhotos() });
}
