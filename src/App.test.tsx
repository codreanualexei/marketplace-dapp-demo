import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders marketplace app", () => {
  render(<App />);
  const linkElement = screen.getByText(/marketplace/i);
  expect(linkElement).toBeInTheDocument();
});
