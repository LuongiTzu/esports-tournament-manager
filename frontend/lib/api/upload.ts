import { request } from "@/lib/api/client";

export interface UploadedImage {
  url: string;
}

export function uploadImage(path: string, file: File) {
  const body = new FormData();
  body.append("file", file);

  return request<UploadedImage>(path, {
    method: "POST",
    body,
    auth: true,
  });
}
