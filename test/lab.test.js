const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function createElement(value = "") {
  return {
    value,
    textContent: "",
    innerHTML: "",
    className: "",
    scrollTop: 0,
    scrollLeft: 0,
    selectionStart: 0,
    selectionEnd: 0,
    handlers: {},
    addEventListener(name, callback) {
      this.handlers[name] = callback;
    }
  };
}

test("Luau editor numbers lines, escapes highlighted code, checks, formats and clears", () => {
  const ids = [
    "code-editor", "line-numbers", "code-highlight", "code-result", "example-select",
    "check-code", "format-code", "copy-code", "clear-code", "explain-code"
  ];
  const elements = new Map(ids.map((id) => [id, createElement()]));
  const dispatched = [];
  const context = {
    document: { getElementById: (id) => elements.get(id) },
    window: { dispatchEvent: (event) => dispatched.push(event.detail) },
    CustomEvent: class CustomEvent {
      constructor(name, options) {
        this.type = name;
        this.detail = options.detail;
      }
    },
    navigator: { clipboard: { writeText: async () => {} } }
  };
  vm.runInNewContext(fs.readFileSync("src/lab.js", "utf8"), context);

  const editor = elements.get("code-editor");
  editor.value = '<script>alert("x")</script>\nlocal value = 2';
  editor.handlers.input();
  assert.equal(elements.get("line-numbers").textContent, "1\n2");
  assert.equal(elements.get("code-highlight").innerHTML.includes("<script>"), false);
  assert.equal(elements.get("code-highlight").innerHTML.includes("&lt;script&gt;"), true);

  editor.value = "function sample(\nprint(1)";
  elements.get("check-code").handlers.click();
  assert.match(elements.get("code-result").textContent, /bloco function/);
  editor.value = "function sample()\nprint(1)\nend";
  elements.get("format-code").handlers.click();
  assert.equal(editor.value, "function sample()\n    print(1)\nend");
  elements.get("clear-code").handlers.click();
  assert.equal(editor.value, "");
  assert.equal(elements.get("code-result").textContent, "Editor limpo.");
});
