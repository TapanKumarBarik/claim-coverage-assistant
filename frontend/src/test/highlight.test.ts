import { highlightSegments } from "../features/assistant/assessment/highlight";

const marked = (passage: string, quote: string) =>
  highlightSegments(passage, quote)
    .filter((segment) => segment.mark)
    .map((segment) => segment.text);

describe("highlightSegments", () => {
  const passage = "Aucune garantie n’est due lorsque le local commun était ouvert, non verrouillé ou laissé ouvert.";

  it("finds a quote regardless of case, whitespace and apostrophe style", () => {
    expect(marked(passage, "aucune  garantie n'est due")).toEqual(["Aucune garantie n’est due"]);
  });

  it("highlights each fragment of an ellipsis quote, in order", () => {
    expect(marked(passage, "Aucune garantie … non verrouillé")).toEqual(["Aucune garantie", "non verrouillé"]);
  });

  it("returns the passage unmarked when the quote cannot be located", () => {
    const segments = highlightSegments(passage, "texte absent du passage");
    expect(segments).toEqual([{ text: passage, mark: false }]);
  });

  it("keeps every character of the passage so nothing is lost when rendering", () => {
    const joined = highlightSegments(passage, "local commun").map((segment) => segment.text).join("");
    expect(joined).toBe(passage);
  });

  it("treats regex metacharacters in a quote literally", () => {
    expect(marked("Franchise (250 €) par sinistre.", "(250 €)")).toEqual(["(250 €)"]);
  });
});
