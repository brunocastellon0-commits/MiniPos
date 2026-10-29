import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/repos/types";
import { EditUserDialog } from "./edit-user-dialog";
import { InviteUserDialog } from "./invite-user-dialog";
import { UsersClient } from "./users-client";
import { UsersTable } from "./users-table";

// Mock server actions
vi.mock("@/lib/actions/users", () => ({
  updateUserNameAction: vi.fn(),
  updateUserRoleAction: vi.fn(),
  toggleUserActiveAction: vi.fn(),
  listUsersAction: vi.fn(),
}));

import {
  toggleUserActiveAction,
  updateUserNameAction,
  updateUserRoleAction,
} from "@/lib/actions/users";

const mockUsers: Profile[] = [
  {
    id: "user-1",
    full_name: "Doña Elena Rodríguez",
    role: "owner",
    active: true,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
  },
  {
    id: "user-2",
    full_name: "Carlos Mamani",
    role: "cashier",
    active: true,
    created_at: "2026-01-02T10:00:00.000Z",
    updated_at: "2026-01-02T10:00:00.000Z",
  },
  {
    id: "user-3",
    full_name: "Mario Inactivo",
    role: "cashier",
    active: false,
    created_at: "2026-01-03T10:00:00.000Z",
    updated_at: "2026-01-03T10:00:00.000Z",
  },
];

describe("UsersTable", () => {
  it("renderiza la tabla con los usuarios y sus badges", () => {
    render(<UsersTable users={mockUsers} onEditUser={vi.fn()} />);

    expect(screen.getByText("Doña Elena Rodríguez")).toBeInTheDocument();
    expect(screen.getByText("Carlos Mamani")).toBeInTheDocument();
    expect(screen.getByText("Mario Inactivo")).toBeInTheDocument();

    expect(screen.getByText("Propietario")).toBeInTheDocument();
    expect(screen.getAllByText("Cajero")).toHaveLength(2);
    expect(screen.getAllByText("Activo")).toHaveLength(2);
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay usuarios", () => {
    render(<UsersTable users={[]} onEditUser={vi.fn()} />);

    expect(screen.getByText("No se encontraron usuarios")).toBeInTheDocument();
  });

  it("dispara onEditUser al hacer clic en Editar", () => {
    const handleEdit = vi.fn();
    render(<UsersTable users={mockUsers} onEditUser={handleEdit} />);

    const editButtons = screen.getAllByRole("button", { name: /editar/i });
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]!);

    expect(handleEdit).toHaveBeenCalledWith(mockUsers[0]);
  });
});

describe("InviteUserDialog", () => {
  it("muestra la guía de alta y botón de entendido", () => {
    const handleClose = vi.fn();
    render(<InviteUserDialog open={true} onClose={handleClose} />);

    expect(screen.getByText("Cómo agregar un nuevo usuario")).toBeInTheDocument();
    expect(screen.getByText(/Crear usuario en Supabase Auth/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /entendido/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});

describe("EditUserDialog", () => {
  it("permite guardar cambios exitosamente", async () => {
    const userToEdit = mockUsers[1]!;
    vi.mocked(updateUserNameAction).mockResolvedValue({
      ok: true,
      data: { ...userToEdit, full_name: "Carlos Mamani Nuevo" },
    });
    vi.mocked(updateUserRoleAction).mockResolvedValue({
      ok: true,
      data: { ...userToEdit, role: "owner" },
    });
    vi.mocked(toggleUserActiveAction).mockResolvedValue({
      ok: true,
      data: { ...userToEdit, active: false },
    });

    const handleUpdated = vi.fn();
    const handleClose = vi.fn();

    render(
      <EditUserDialog
        user={userToEdit}
        open={true}
        onClose={handleClose}
        onUserUpdated={handleUpdated}
      />,
    );

    const nameInput = screen.getByLabelText(/nombre completo/i);
    fireEvent.change(nameInput, { target: { value: "Carlos Mamani Nuevo" } });

    const roleSelect = screen.getByLabelText(/rol en el sistema/i);
    fireEvent.change(roleSelect, { target: { value: "owner" } });

    const inactiveRadio = screen.getByLabelText(/inactivo/i);
    fireEvent.click(inactiveRadio);

    const saveBtn = screen.getByRole("button", { name: /guardar cambios/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateUserNameAction).toHaveBeenCalledWith({
        id: "user-2",
        fullName: "Carlos Mamani Nuevo",
      });
      expect(updateUserRoleAction).toHaveBeenCalledWith({
        id: "user-2",
        role: "owner",
      });
      expect(toggleUserActiveAction).toHaveBeenCalledWith({
        id: "user-2",
        active: false,
      });
      expect(handleUpdated).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("muestra mensaje de error si falla la acción del servidor", async () => {
    vi.mocked(updateUserRoleAction).mockResolvedValue({
      ok: false,
      code: "BAD_REQUEST",
      message: "No se puede desactivar ni revocar el rol al único propietario activo del sistema.",
    });

    render(
      <EditUserDialog
        user={mockUsers[0]!}
        open={true}
        onClose={vi.fn()}
        onUserUpdated={vi.fn()}
      />,
    );

    const roleSelect = screen.getByLabelText(/rol en el sistema/i);
    fireEvent.change(roleSelect, { target: { value: "cashier" } });

    const saveBtn = screen.getByRole("button", { name: /guardar cambios/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/No se puede desactivar ni revocar el rol al único propietario activo/i),
      ).toBeInTheDocument();
    });
  });
});

describe("UsersClient", () => {
  it("filtra usuarios por texto de búsqueda", () => {
    render(<UsersClient initialUsers={mockUsers} />);

    const searchInput = screen.getByPlaceholderText(/buscar por nombre/i);
    fireEvent.change(searchInput, { target: { value: "Elena" } });

    expect(screen.getByText("Doña Elena Rodríguez")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Mamani")).not.toBeInTheDocument();
  });

  it("filtra usuarios por rol", () => {
    render(<UsersClient initialUsers={mockUsers} />);

    const filterSelect = screen.getByLabelText(/filtrar por rol/i);
    fireEvent.change(filterSelect, { target: { value: "owner" } });

    expect(screen.getByText("Doña Elena Rodríguez")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Mamani")).not.toBeInTheDocument();
  });

  it("abre el diálogo de invitación al hacer clic en registrar nuevo usuario", () => {
    render(<UsersClient initialUsers={mockUsers} />);

    const inviteBtn = screen.getByRole("button", { name: /registrar nuevo usuario/i });
    fireEvent.click(inviteBtn);

    expect(screen.getByText("Cómo agregar un nuevo usuario")).toBeInTheDocument();
  });
});
