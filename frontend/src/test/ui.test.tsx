import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BarList } from "../ui/BarList";
import { DataTable } from "../ui/DataTable";
import { Field } from "../ui/Field";
import { Tabs } from "../ui/Tabs";
import { TextInput } from "../ui/TextInput";

describe("Tabs", () => {
  const TABS = [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
  ] as const;

  function Harness() {
    const [value, setValue] = useState<(typeof TABS)[number]["id"]>("one");
    return (
      <Tabs label="Sections" tabs={TABS} value={value} onChange={setValue}>
        <p>Content of {value}</p>
      </Tabs>
    );
  }

  it("is operable from the keyboard: arrows, Home and End move and select", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const tabOne = screen.getByRole("tab", { name: "One" });
    tabOne.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Content of two")).toBeInTheDocument();

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
    await user.keyboard("{ArrowRight}"); // wraps around
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
  });

  it("has one tab stop, and the panel is named by its tab", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
  });
});

describe("BarList", () => {
  it("prints each number as text and sizes bars relative to the biggest", () => {
    const { container } = render(
      <BarList
        label="Outcomes"
        items={[
          { key: "a", label: "Answered", value: 90 },
          { key: "b", label: "Blocked", value: 45 },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Outcomes" });
    expect(within(list).getByText("90")).toBeInTheDocument();
    expect(within(list).getByText("45")).toBeInTheDocument();
    const widths = Array.from(container.querySelectorAll<HTMLElement>(".bar-list__fill")).map((bar) => bar.style.width);
    expect(widths).toEqual(["100%", "50%"]);
  });
});

describe("Field", () => {
  it("connects the label, hint and error to the control", () => {
    render(
      <Field label="Name" hint="As on your ID" error="Required">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("As on your ID Required");
  });

  it("is not marked invalid without an error", () => {
    render(
      <Field label="Name">
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });
});

describe("DataTable", () => {
  it("renders a captioned table with column headers", () => {
    render(
      <DataTable
        caption="People"
        columns={[
          { key: "name", header: "Name", cell: (row: { name: string; age: number }) => row.name },
          { key: "age", header: "Age", numeric: true, cell: (row) => row.age },
        ]}
        rows={[{ name: "Ada", age: 36 }]}
        rowKey={(row) => row.name}
      />,
    );
    const table = screen.getByRole("table", { name: "People" });
    expect(within(table).getByRole("columnheader", { name: "Age" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "Ada" })).toBeInTheDocument();
  });
});
