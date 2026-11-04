"use client";

import { Table, Td, Th } from "@/components/ui/table";
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
      <Table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs text-foreground-muted font-medium">
          <tr>
            <Th scope="col">
              Nombre
            </Th>
            <Th scope="col">
              Rol
            </Th>
            <Th scope="col">
              Estado
            </Th>
            <Th scope="col" className="hidden sm:table-cell">
              Fecha de Registro
            </Th>
            <Th scope="col" className="text-right">
              Acciones
            </Th>
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
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{user.full_name}</span>
                  </div>
                </Td>
                <Td>
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
                </Td>
                <Td>
                  <Badge tone={isActive ? "success" : "neutral"}>
                    {isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </Td>
                <Td className="text-xs text-foreground-muted hidden sm:table-cell">
                  {formatDateShort(new Date(user.created_at))}
                </Td>
                <Td className="text-right">
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
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
