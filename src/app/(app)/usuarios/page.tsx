import type { Metadata } from "next";
import { UsersClient } from "@/components/users/users-client";
import { listUsersAction } from "@/lib/actions/users";
import { requireRole } from "@/lib/auth";
import type { Profile } from "@/lib/repos/types";

export const metadata: Metadata = {
  title: "Gestión de Usuarios",
  description: "Administración de usuarios y roles del minimarket.",
};

export default async function UsuariosPage() {
  await requireRole("owner", "/caja");

  let initialUsers: Profile[] = [];
  try {
    const result = await listUsersAction();
    if (result.ok) {
      initialUsers = result.data;
    }
  } catch {
    // Si falla la consulta inicial, inicializa vacío
    initialUsers = [];
  }

  return <UsersClient initialUsers={initialUsers} />;
}
