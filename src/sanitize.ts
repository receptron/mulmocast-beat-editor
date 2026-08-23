import DOMPurify from "dompurify";

/**
 * Strip anything executable from a beat fragment.
 *
 * `beatToHtml` deliberately does not sanitize — it has no DOM and says so in its contract:
 * raw elements, `onerror=` handlers and `javascript:` urls written into a beat arrive here
 * verbatim. Inserting that into the host page is what makes this the place to strip them.
 *
 * There is no allow-list here on purpose. DOMPurify's defaults already keep everything the
 * host drives — the `<canvas>`, its `data-mulmo-chart` config (data attributes are allowed
 * by default), the `.mermaid` container, and `<video>` with its controls — so an ADD_TAGS /
 * ADD_ATTR list would be configuration that does nothing, which is worse than none: a
 * reviewer cannot tell it is inert. `test_sanitize.ts` pins those defaults instead, so a
 * DOMPurify release that starts stripping them turns a silent blank chart into a red test.
 */
export const sanitizeFragment = (html: string): string => DOMPurify.sanitize(html);
