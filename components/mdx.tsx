import defaultMdxComponents from "fumadocs-ui/mdx";
import type { AnchorHTMLAttributes } from "react";
import type { MDXComponents } from "mdx/types";
import { isNonPageHref } from "@/lib/links";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { File, Folder, Files } from "fumadocs-ui/components/files";

const DefaultLink = defaultMdxComponents.a;

function MdxLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (isNonPageHref(props.href)) return <a {...props} />;
  return <DefaultLink {...props} />;
}

/**
 * MDX component map for the docs. Beyond the fumadocs defaults (syntax-
 * highlighted code blocks with copy buttons, anchored headings, smart tables),
 * we expose the full rich-doc toolkit — callouts, card grids, tabbed code,
 * step-by-step guides, type tables, accordions, file trees — so any playbook
 * doc can use them inline without per-page imports.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    a: MdxLink,
    Callout,
    Card,
    Cards,
    Tab,
    Tabs,
    Step,
    Steps,
    TypeTable,
    Accordion,
    Accordions,
    File,
    Folder,
    Files,
    ...components,
  };
}
