import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LevelChangeNotice, levelChangeMessage } from "./LevelChangeNotice.js";

describe("levelChangeMessage", () => {
  it("names the direction and the new level out of 5 (AC-4.4)", () => {
    expect(levelChangeMessage("up", 4)).toBe("Level up: 4/5");
    expect(levelChangeMessage("down", 2)).toBe("Level down: 2/5");
    expect(levelChangeMessage("none", 5)).toBeNull();
  });
});

describe("LevelChangeNotice", () => {
  it('announces "Level up: 4/5" in a polite live region (AC-4.4)', () => {
    render(<LevelChangeNotice change="up" level={4} />);

    expect(screen.getByRole("status").textContent).toBe("↑Level up: 4/5");
    expect(screen.getByText("↑").getAttribute("aria-hidden")).toBe("true");
  });

  it("announces a level down (AC-4.4)", () => {
    render(<LevelChangeNotice change="down" level={2} />);

    expect(screen.getByRole("status").textContent).toBe("↓Level down: 2/5");
  });

  it("keeps the live region empty when the level does not move", () => {
    render(<LevelChangeNotice change="none" level={5} />);

    expect(screen.getByRole("status").textContent).toBe("");
  });
});
