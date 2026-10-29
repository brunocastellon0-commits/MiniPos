"use client";

import { Edit2, Shield, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort } from "@/lib/dates";
import type { Profile } from "@/lib/repos/types";

export interface UsersTableProps {
  users: Profile[];
  onEditUser: (user: Profile) => void;
}

export function UsersTable({ users, onEditUser }: UsersTableProps) {
  if (users.length === 0) {
    return (
      <EmptyState
        title="No se encontraron usuarios"
        description="Aún no hay colaboradores registrados en el sistema."
        icon={<User className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/50 text-xs text-foreground-muted font-medium">
          <tr>
            <th scope="col" className="px-4 py-3">
              Nombre
            </th>
            <th scope="col" className="px-4 py-3">
              Rol
            </th>
            <th scope="col" className="px-4 py-3">
              Estado
            </th>
            <th scope="col" className="px-4 py-3 hidden sm:table-cell">
              Fecha de Registro
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => {
            const isOwner = user.role === "owner";
            const isActive = user.active;

            return (
              <tr
                key={user.id}
                className="hover:bg-surface-muted/30 transition-colors"
                data-testid={`user-row-${user.id}`}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{user.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <Badge tone={isOwner ? "accent" : "neutral"} className="gap-1">
                    {isOwner ? (
                      <>
                        <Shield className="h-3 w-3" />
                        Propietario
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3" />
                        Cajero
                      </>
                    )}
                  </Badge>
                </td>
                <td className="px-4 py-3.5">
                  <Badge tone={isActive ? "success" : "neutral"}>
                    {isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-3.5 text-xs text-foreground-muted hidden sm:table-cell">
                  {formatDateShort(new Date(user.created_at))}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditUser(user)}
                    aria-label={`Editar ${user.full_name}`}
                    className="gap-1.5 text-xs"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
