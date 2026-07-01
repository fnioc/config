// Behavior tests for JsonFileSource -- a ConfigSource that reads a JSON
// file from disk and flattens it into a flat colon-delimited key ->
// string-value map (mirrors .NET's JSON configuration provider).

import { describe, expect, test } from "bun:test";
import { JsonFileSource } from "../../src/sources/json-file.js";

const FIXTURES = "test/fixtures/json-file";

describe("JsonFileSource.load", () => {
  test("flattens nested objects into colon-delimited keys", () => {
    const source = new JsonFileSource(`${FIXTURES}/nested.json`);

    const data = source.load();

    expect(data["Server:Host"]).toBe("localhost");
    expect(data["TopLevel"]).toBe("value");
  });

  test("string-converts scalar leaves (numbers and booleans)", () => {
    const source = new JsonFileSource(`${FIXTURES}/nested.json`);

    const data = source.load();

    expect(data["Server:Port"]).toBe("8080");
    expect(data["Server:UseTls"]).toBe("true");
  });

  test("index-flattens arrays as Key:0, Key:1, ...", () => {
    const source = new JsonFileSource(`${FIXTURES}/nested.json`);

    const data = source.load();

    expect(data["Server:Tags:0"]).toBe("a");
    expect(data["Server:Tags:1"]).toBe("b");
  });

  test("skips keys whose value is null", () => {
    const source = new JsonFileSource(`${FIXTURES}/nested.json`);

    const data = source.load();

    expect("Server:Nullable" in data).toBe(false);
  });

  test("recurses into arrays of objects", () => {
    const source = new JsonFileSource(`${FIXTURES}/array-of-objects.json`);

    const data = source.load();

    expect(data).toEqual({
      "Items:0:Name": "first",
      "Items:0:Count": "1",
      "Items:1:Name": "second",
      "Items:1:Count": "2",
    });
  });

  test("resolves a relative path against process.cwd()", () => {
    const source = new JsonFileSource(`${FIXTURES}/nested.json`);

    expect(() => source.load()).not.toThrow();
  });

  test("throws when the file does not exist and optional is not set", () => {
    const source = new JsonFileSource(`${FIXTURES}/does-not-exist.json`);

    expect(() => source.load()).toThrow();
  });

  test("returns an empty object when the file is missing and optional is true", () => {
    const source = new JsonFileSource(`${FIXTURES}/does-not-exist.json`, {
      optional: true,
    });

    expect(source.load()).toEqual({});
  });

  test("throws on malformed JSON even when optional is true", () => {
    const source = new JsonFileSource(`${FIXTURES}/invalid.json`, {
      optional: true,
    });

    expect(() => source.load()).toThrow();
  });
});
