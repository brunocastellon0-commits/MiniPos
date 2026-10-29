"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/lib/repos/types";
import { EditUserDialog } from "./edit-user-dialog";
import { InviteUserDialog } from "./invite-user-dialog";
import { UsersTable } from "./users-table";

export interface UsersClientProps {
  initialUsers: Profile[];
}

export function UsersClient({ initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "cashier">("all");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.full_name
        .toLowerCase()
        .includes(search.toLowerCase().trim());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const handleUserUpdated = (updated: Profile) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            Administra los roles, permisos y colaboradores de tu negocio.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsInviteOpen(true)}
          className="gap-2 shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Registrar nuevo usuario
        </Button>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">Filtrar:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | "owner" | "cashier")}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filtrar por rol"
          >
            <option value="all">Todos los roles</option>
            <option value="owner">Solo Propietarios</option>
            <option value="cashier">Solo Cajeros</option>
          </select>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <UsersTable
        users={filteredUsers}
        onEditUser={(user) => setEditingUser(user)}
      />

      {/* Modales */}
      <EditUserDialog
        user={editingUser}
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        onUserUpdated={handleUserUpdated}
      />

      <InviteUserDialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </div>
  );
}
