import type { Node } from "./types";
export function curriculumPath(nodes: Node[], nodeId: string) {
  const path: string[] = [],
    seen = new Set<string>();
  let node = nodes.find((n) => n._id === nodeId);
  while (node && !seen.has(node._id)) {
    seen.add(node._id);
    path.unshift(node.title);
    node = nodes.find((n) => n._id === node!.parentId);
  }
  return path.join(" / ");
}

export interface TopicChoice {
  topic: Node;
  grade: { id: string; title: string };
  book: { id: string; title: string };
  chapter: { id: string; title: string };
  tracks: string[];
}
export function curriculumTopicChoices(nodes: Node[]): TopicChoice[] {
  const byId = new Map(nodes.map((n) => [n._id, n]));
  return nodes
    .filter((n) => n.kind === "topic")
    .map((topic) => {
      const ancestors: Node[] = [],
        seen = new Set([topic._id]);
      let current = topic.parentId ? byId.get(topic.parentId) : undefined;
      while (current && !seen.has(current._id)) {
        seen.add(current._id);
        ancestors.push(current);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      const grade = ancestors.find((n) => n.kind === "grade");
      const book = ancestors.find(
        (n) => n.kind === "course" || n.kind === "subject",
      );
      const chapter = ancestors.find((n) => n.kind === "chapter");
      return {
        topic,
        grade: grade
          ? { id: grade._id, title: grade.title }
          : { id: "ungraded", title: "بدون پایه مشخص" },
        book: book
          ? { id: book._id, title: book.title }
          : { id: "unassigned", title: "بدون درس مشخص" },
        chapter: chapter
          ? { id: chapter._id, title: chapter.title }
          : { id: "unchaptered", title: "بدون فصل مشخص" },
        tracks: book?.tracks?.length ? book.tracks : ["custom"],
      };
    });
}

export function curriculumAncestors(nodes: Node[], id: string): Node[] {
  const byId = new Map(nodes.map((n) => [n._id, n])),
    seen = new Set<string>(),
    path: Node[] = [];
  let n = byId.get(id);
  while (n && !seen.has(n._id)) {
    seen.add(n._id);
    path.unshift(n);
    n = n.parentId ? byId.get(n.parentId) : undefined;
  }
  return path;
}
export function curriculumSkills(nodes: Node[], topicId: string) {
  const ancestors = new Set(
    curriculumAncestors(nodes, topicId).map((n) => n._id),
  );
  return nodes.filter(
    (n) =>
      n.kind === "skill" &&
      (!n.parentId ||
        ancestors.has(n.parentId) ||
        curriculumAncestors(nodes, n._id).some((p) => p._id === topicId)),
  );
}
