import type { Page } from "@playwright/test";
import {
  curriculumAncestors,
  curriculumTopicChoices,
} from "../../src/lib/curriculum";
import type { Node } from "../../src/lib/types";
export async function chooseTopic(
  page: Page,
  id: string,
  context = "ثبت سؤال",
  topicLabel = "مبحث",
) {
  const nodes: Node[] = await (
    await page.request.get("/api/curriculum")
  ).json();
  const c = curriculumTopicChoices(nodes).find((c) => c.topic._id === id);
  if (!c) throw new Error("Test topic is not available");
  await page
    .getByLabel(`پایه ${context}`, { exact: true })
    .selectOption(c.grade.id);
  const track = page.getByLabel(`رشته ${context}`, { exact: true });
  if (await track.count()) await track.selectOption(c.tracks[0]);
  await page
    .getByLabel(`درس یا کتاب ${context}`, { exact: true })
    .selectOption(c.book.id);
  await page
    .getByLabel(`فصل ${context}`, { exact: true })
    .selectOption(c.chapter.id);
  await page.getByLabel(topicLabel, { exact: true }).selectOption(id);
}
export async function chooseParent(page: Page, id: string) {
  const nodes: Node[] = await (
    await page.request.get("/api/curriculum")
  ).json();
  const path = curriculumAncestors(nodes, id);
  for (let i = 0; i < path.length; i++)
    await page
      .getByLabel(`سطح ${i + 1} والد ساختار`, { exact: true })
      .selectOption(path[i]._id);
}
