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
    if (table === "products") {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        async single() {
          return {
            data: {
              id: "new-product-id",
              slug: "test-slug",
              title: "Draft product",
              subtitle: null,
              description: null,
              brand: "Zephyr Lux",
              category: null,
              fabric_type: null,
              care_instructions: null,
              origin: null,
              status: "draft",
              variant_template_id: null,
              product_variants: [],
              product_images: [],
              product_subscription_plans: [],
              product_collection_assignments: [],
            },
            error: null,
          };
        },
      };
      return chain;
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
        <Route path="/admin/products/:id" element={<AdminProductForm />} />
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

    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    await waitFor(() => {
      expect(screen.queryByDisplayValue("draft/uploaded.png")).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes storage only after a successful save", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        object_path: "draft/remove-after-save.png",
        preview_url: "https://cdn.example/draft/remove-after-save.png",
        mime: "image/png",
      }),
    });

    const { container } = renderNewProductForm();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "remove-after-save.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByDisplayValue("draft/remove-after-save.png");

    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: "new-product-id", error: null });

    fireEvent.change(screen.getByLabelText("Slug *"), { target: { value: "test-slug" } });
    fireEvent.change(screen.getByLabelText(/^SKU/), { target: { value: "TEST-SKU-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]![0]).toContain("/api/admin-product-image?");
      expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: "DELETE" });
    });
  });

  it("rolls back partial multi-upload failures", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          object_path: "draft/first.png",
          preview_url: "https://cdn.example/draft/first.png",
          mime: "image/png",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Upload failed" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

    const { container } = renderNewProductForm();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const first = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "first.png", {
      type: "image/png",
    });
    const second = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "second.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput, { target: { files: [first, second] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[2]![1]).toMatchObject({ method: "DELETE" });
    });
    expect(screen.queryByDisplayValue("draft/first.png")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("draft/second.png")).not.toBeInTheDocument();
  });
});
