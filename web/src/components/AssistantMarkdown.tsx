import ReactMarkdown from "react-markdown";

type Props = {
  content: string;
  /** Primary accent for links (e.g. Passage purple). */
  linkColor?: string;
};

/**
 * Renders assistant replies with safe markdown: links open in a new tab;
 * images only load from https URLs (Claude should use passagetheatre.org or excerpt-linked assets).
 */
export function AssistantMarkdown({ content, linkColor = "#5a3d7a" }: Props) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p style={{ margin: "0 0 0.65em" }}>{children}</p>,
        ul: ({ children }) => (
          <ul style={{ margin: "0.4em 0 0.65em", paddingLeft: "1.25em" }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: "0.4em 0 0.65em", paddingLeft: "1.25em" }}>{children}</ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: "0.25em" }}>{children}</li>,
        strong: ({ children }) => <strong>{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        h2: ({ children }) => (
          <h2 style={{ fontSize: "1.05em", margin: "0.5em 0 0.35em", fontWeight: 700 }}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: "1em", margin: "0.45em 0 0.3em", fontWeight: 700 }}>{children}</h3>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: linkColor, textDecoration: "underline" }}
          >
            {children}
          </a>
        ),
        img: ({ src, alt }) => {
          if (!src || !src.startsWith("https://")) {
            return (
              <span style={{ fontSize: 12, opacity: 0.75 }}>[Image link must use https]</span>
            );
          }
          return (
            <img
              src={src}
              alt={alt ?? ""}
              loading="lazy"
              style={{
                maxWidth: "100%",
                height: "auto",
                borderRadius: 8,
                display: "block",
                marginTop: 8,
                marginBottom: 8,
              }}
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
