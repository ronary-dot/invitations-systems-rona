import { createElement, type ComponentType } from "react";
import type { TemplateProps } from "./types";
import ClassicTemplate from "./classic/Template";
import MinimalTemplate from "./minimal/Template";
import FloralTemplate from "./floral/Template";

// The remaining 7 templates arrive in stage 7; until then they fall back to
// classic, with the event's accent color still applied.
const components: Record<string, ComponentType<TemplateProps>> = {
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
  floral: FloralTemplate,
};

export function renderTemplate(id: string, props: TemplateProps) {
  return createElement(components[id] ?? ClassicTemplate, props);
}
