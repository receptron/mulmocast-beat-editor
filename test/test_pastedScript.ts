import test from "node:test";
import assert from "node:assert";

import { readPastedScript } from "../src/pastedScript";

const errorOf = (text: string): string => {
  const result = readPastedScript(text);
  assert.ok("error" in result, `${JSON.stringify(text)} should be refused`);
  return result.error;
};

test("readPastedScript: a script's beats come back as written", () => {
  const beats = [{ text: "one", image: { type: "markdown", markdown: "# A" } }, { text: "two" }];
  assert.deepEqual(readPastedScript(JSON.stringify({ $mulmocast: { version: "1.1" }, beats })), { beats });
});

test("readPastedScript: an element the editor cannot render is kept, not dropped", () => {
  // The editor writes the array back, so a dropped element would round-trip as a deletion.
  const beats = [null, 7, { text: "ok" }];
  assert.deepEqual(readPastedScript(JSON.stringify({ beats })), { beats });
});

test("readPastedScript: surrounding whitespace is fine", () => {
  assert.deepEqual(readPastedScript(`\n  ${JSON.stringify({ beats: [{ text: "a" }] })}  \n`), { beats: [{ text: "a" }] });
});

test("readPastedScript: every unusable input says why, never throws", () => {
  assert.match(errorOf(""), /Paste a MulmoScript/);
  assert.match(errorOf("   \n"), /Paste a MulmoScript/);
  assert.match(errorOf("{ beats: [] "), /Not valid JSON/);
  assert.match(errorOf("{'beats': []}"), /Not valid JSON/);
  ["[]", '[{"text":"a"}]', "null", "42", '"script"', "true"].forEach((text) => {
    assert.match(errorOf(text), /JSON object with a `beats` array/, text);
  });
  ["{}", '{"beats": null}', '{"beats": "no"}', '{"beats": {"0": {}}}', '{"Beats": []}'].forEach((text) => {
    assert.match(errorOf(text), /no `beats` array/, text);
  });
  assert.match(errorOf('{"beats": []}'), /`beats` array is empty/);
});
