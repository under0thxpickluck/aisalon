import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateImage(prompt: string): Promise<string> {
  const res = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });

  const item = res.data?.[0];
  if (!item?.url) {
    throw new Error("image_generation_failed");
  }

  return item.url;
}

export async function editImage(_params: {
  imageUrl: string;
  instruction: string;
}): Promise<string> {
  // 実装時は OpenAI Images edit を利用
  throw new Error("not_implemented_yet");
}
