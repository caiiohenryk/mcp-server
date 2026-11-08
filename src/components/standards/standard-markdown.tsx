import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { levelRuleBorder, RuleLevelMark } from "./rule-level";
import { splitIntoBlocks, stripLeadingH1 } from "./split-blocks";

export function ruleAnchor(ruleId: string): string {
  return ruleId.toLowerCase();
}

const components: Components = {
  table({ children }) {
    return (
      <div className="table-scroll">
        <table>{children}</table>
      </div>
    );
  },
  a({ href, children }) {
    const external = href?.startsWith("http");
    return (
      <a href={href} {...(external ? { rel: "noreferrer noopener", target: "_blank" } : {})}>
        {children as ReactNode}
      </a>
    );
  },
};

function Md({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </Markdown>
  );
}

/**
 * Renders a standard's markdown body. Rule headings (`### ID [LEVEL] Title`) become
 * a marked header plus a body tied to it by a vertical line in the level's color.
 */
export function StandardMarkdown({ markdown }: { markdown: string }) {
  const blocks = splitIntoBlocks(stripLeadingH1(markdown));
  return (
    <div className="standard-prose">
      {blocks.map((b, i) =>
        b.kind === "prose" ? (
          <Md key={i}>{b.markdown}</Md>
        ) : (
          <section
            key={b.id}
            aria-labelledby={ruleAnchor(b.id)}
            className={`rule border-l-4 ${levelRuleBorder[b.level]}`}
          >
            <h3 id={ruleAnchor(b.id)} className="rule-heading">
              <a href={`#${ruleAnchor(b.id)}`} className="rule-id">
                {b.id}
              </a>
              <span className="rule-title">
                <RuleLevelMark level={b.level} /> {b.title}
              </span>
            </h3>
            {b.markdown && <Md>{b.markdown}</Md>}
          </section>
        ),
      )}
    </div>
  );
}
