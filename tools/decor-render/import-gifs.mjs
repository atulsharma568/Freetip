import sharp from "sharp";
import { statSync } from "node:fs";
const src = "/Users/asharm475/Downloads/";
const out = "/Users/asharm475/Documents/Freetip/public/decorations/";
const list = [
  ["Peaky Blinders.gif", "peaky-blinders"], ["Sakura.gif", "sakura"], ["Solo Leveling Banner.gif", "solo-leveling"],
  ["Apple-kitty.gif", "apple-kitty"], ["Toney.gif", "toney"], ["Eternal.gif", "eternal"], ["Fkimgworkkk.gif", "fkimgworkkk"],
  ["Explosive-cat.gif", "explosive-cat"], ["Killua.gif", "killua"], ["Angel.jpeg", "angel"], ["Nanami-happy.gif", "nanami"], ["Naoya.gif", "naoya"],
];
for (const [file, slug] of list) {
  const animated = file.endsWith(".gif");
  const img = sharp(src + file, { animated });
  await img.clone().webp({ quality: 82, effort: 5, loop: 0 }).toFile(out + slug + ".webp");
  await sharp(src + file, { page: 0 }).webp({ quality: 80 }).toFile(out + slug + ".poster.webp");
  console.log(slug, statSync(out + slug + ".webp").size, statSync(out + slug + ".poster.webp").size);
}
