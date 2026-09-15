import { asStringArray } from "../../lib/json-parsers";

export type LinkedinPublishRevision = {
  hook: string;
  body: string;
  cta: string | null;
  hashtagsJson?: unknown;
  hashtags?: string[];
};

export function buildLinkedinPublishText(revision: LinkedinPublishRevision): string {
  const hook = revision.hook.trim();
  const body = revision.body.trim();
  const cta = revision.cta?.trim() ?? "";
  const hashtags = (revision.hashtags ?? asStringArray(revision.hashtagsJson, 12))
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`))
    .join(" ");

  return [hook, body, cta, hashtags].filter(Boolean).join("\n\n");
}
