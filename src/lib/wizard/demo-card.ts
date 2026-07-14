import { roundRect } from "@/lib/render-engine/geometry";

/** A placeholder card face, used only for previews (hero shot, mount picker) before a real photo exists. */
export function demoCard(): HTMLCanvasElement {
  const cw = 430;
  const ch = 600;
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const x = c.getContext("2d")!;
  x.fillStyle = "#d9b23a";
  roundRect(x, 0, 0, cw, ch, 18);
  x.fill();
  x.fillStyle = "#c73e2a";
  roundRect(x, 20, 50, cw - 40, 260, 8);
  x.fill();
  x.fillStyle = "#f5e9c0";
  x.beginPath();
  x.arc(cw / 2, 180, 85, 0, 7);
  x.fill();
  x.fillStyle = "#2b2b2b";
  x.font = "bold 26px -apple-system,sans-serif";
  x.fillText("Dracaufeu ex", 26, 40);
  x.fillStyle = "#8a8a8a";
  for (let i = 0; i < 5; i++) x.fillRect(28, 340 + i * 44, cw - 56, 16);
  return c;
}
