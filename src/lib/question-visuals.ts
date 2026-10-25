import { z } from "zod";
const number = z.number().finite().min(-1e6).max(1e6);
const label = z.string().trim().max(100);
const range = z
  .tuple([number, number])
  .refine(
    ([a, b]) => b - a >= 0.000001,
    "حد بالای محور باید از حد پایین بیشتر باشد",
  );
const coord = z.number().finite().min(0).max(100);
const caption = z.string().trim().min(3).max(300);
export const visualKind = z.enum(["none", "chart", "geometry", "formula"]);
export const questionVisualSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("image"),
        caption,
        assetId: z.string().uuid(),
        width: z.number().int().min(1).max(4096),
        height: z.number().int().min(1).max(4096),
        crop: z
          .object({
            x: coord,
            y: coord,
            width: z.number().finite().min(1).max(100),
            height: z.number().finite().min(1).max(100),
          })
          .strict()
          .refine(
            (c) => c.x + c.width <= 100 && c.y + c.height <= 100,
            "برش باید داخل تصویر باشد",
          )
          .optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("chart"),
        caption,
        xLabel: label,
        yLabel: label,
        xRange: range,
        yRange: range,
        series: z
          .array(
            z
              .object({
                name: label,
                points: z
                  .array(z.tuple([number, number]))
                  .min(2)
                  .max(80),
              })
              .strict(),
          )
          .min(1)
          .max(4),
      })
      .strict(),
    z
      .object({
        kind: z.literal("geometry"),
        caption,
        points: z
          .array(z.object({ x: coord, y: coord, label }).strict())
          .max(30),
        segments: z
          .array(
            z
              .object({
                x1: coord,
                y1: coord,
                x2: coord,
                y2: coord,
                label,
                arrow: z.boolean(),
              })
              .strict(),
          )
          .max(30),
        circles: z
          .array(
            z
              .object({
                x: coord,
                y: coord,
                r: z.number().positive().max(50),
                label,
              })
              .strict(),
          )
          .max(10),
      })
      .strict(),
    z
      .object({
        kind: z.literal("formula"),
        caption,
        latex: z.string().trim().min(1).max(1000),
      })
      .strict(),
  ])
  .superRefine((v, c) => {
    if (v.kind === "chart")
      for (const s of v.series) {
        if (
          s.points.some(
            ([x, y]) =>
              x < v.xRange[0] ||
              x > v.xRange[1] ||
              y < v.yRange[0] ||
              y > v.yRange[1],
          )
        )
          c.addIssue({
            code: "custom",
            message: "همه نقاط نمودار باید داخل محدوده محورها باشند",
          });
      }
    if (v.kind === "geometry") {
      if (!v.points.length && !v.segments.length && !v.circles.length)
        c.addIssue({ code: "custom", message: "شکل خالی است" });
      if (
        v.circles.some(
          (p) =>
            p.x - p.r < 0 ||
            p.x + p.r > 100 ||
            p.y - p.r < 0 ||
            p.y + p.r > 100,
        )
      )
        c.addIssue({
          code: "custom",
          message: "دایره باید داخل صفحه شکل باشد",
        });
    }
  });
export const questionVisualsSchema = z.array(questionVisualSchema).max(3);
export type QuestionVisual = z.infer<typeof questionVisualSchema>;
export function visualTemplate(
  kind: "chart" | "geometry" | "formula",
): QuestionVisual {
  if (kind === "chart")
    return {
      kind,
      caption: "نمودار سرعت–زمان",
      xLabel: "زمان (s)",
      yLabel: "سرعت (m/s)",
      xRange: [0, 5],
      yRange: [0, 10],
      series: [
        {
          name: "حرکت جسم",
          points: [
            [0, 0],
            [5, 10],
          ],
        },
      ],
    };
  if (kind === "geometry")
    return {
      kind,
      caption: "مثلث ABC",
      points: [
        { x: 20, y: 20, label: "A" },
        { x: 80, y: 20, label: "B" },
        { x: 50, y: 80, label: "C" },
      ],
      segments: [
        { x1: 20, y1: 20, x2: 80, y2: 20, label: "", arrow: false },
        { x1: 80, y1: 20, x2: 50, y2: 80, label: "", arrow: false },
        { x1: 50, y1: 80, x2: 20, y2: 20, label: "", arrow: false },
      ],
      circles: [],
    };
  return {
    kind,
    caption: "رابطه ریاضی",
    latex: "v = \\frac{\\Delta x}{\\Delta t}",
  };
}
export const visualPrompt = `For requested visualKind return visuals (array, maximum 3) containing at least one object of that kind. Do not merely describe a missing graph. Use exactly these shapes:
chart: {kind:"chart",caption:"Persian accessible description",xLabel:"axis and units",yLabel:"axis and units",xRange:[min,max],yRange:[min,max],series:[{name:"label",points:[[x,y],[x,y]]}]}. Max 4 series, 80 points each, finite numeric values, min<max, all points inside ranges. Points connect in provided order.
geometry: {kind:"geometry",caption:"description",points:[{x:20,y:20,label:"A"}],segments:[{x1:20,y1:20,x2:80,y2:20,label:"",arrow:false}],circles:[{x:50,y:50,r:20,label:""}]}. Coordinates in [0,100], x rightwards and y upwards, circles fully inside canvas. At most 30 points,30 segments,10 circles. A segment with arrow:true is a vector/force. No SVG, HTML, URLs or code.
formula: {kind:"formula",caption:"description",latex:"valid KaTeX LaTeX, JSON escaped backslashes"}. Max 1000 chars, no URLs/HTML/macros. Always include every key shown for each visual type; use empty arrays for absent geometry elements. The diagram and correct reference must agree mathematically. Never put solution or answer annotations in a student visual. For visualKind none omit visuals or use []. Inline mathematics may use $...$ delimiters in statement/options.`;
