import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminProductForm from "./AdminProductForm";

const fetchMock = vi.fn();
const supabaseMock = vi.hoisted(() => ({
  from: (table: string) => {
    if (table === "variant_templates") {
      return {
        select() {
          return this;
        },
        async order() {
          return { data: [], error: null };
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  },
  rpc: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "admin-token" },
    user: { email: "owner@example.com" },
    configured: true,
  }),
}));

vi.mock("../lib/supabaseBrowser", () => ({
  getSupabaseBrowserClient: () => supabaseMock,
}));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderNewProductForm() {
  return render(
    <MemoryRouter initialEntries={["/admin/products/new"]}>
      <Routes>
        <Route path="/admin/products/new" element={<AdminProductForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminProductForm media and collections", () => {
  it("adds uploaded image rows and toggles collection assignment", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        object_path: "draft/uploaded.png",
        preview_url: "https://cdn.example/draft/uploaded.png",
        mime: "image/png",
      }),
    });

    const { container } = renderNewProductForm();
    fireEvent.click(screen.getByLabelText("Women"));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "uploaded.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin-product-image",
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer admin-token" },
        }),
      );
    });
    expect(await screen.findByDisplayValue("draft/uploaded.png")).toBeInTheDocument();
    expect(screen.getByLabelText("Women")).toBeChecked();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]![0]).toContain("/api/admin-product-image?");
      expect(fetchMock.mock.calls[1]![0]).toContain("object_path=");
      expect(fetchMock.mock.calls[1]![1]).toMatchObject({
        method: "DELETE",
        headers: { Authorization: "Bearer admin-token" },
      });
    });
  });
});
