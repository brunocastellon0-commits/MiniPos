// Identidad de login (E1-07): Supabase Auth solo autentica por correo, pero el
// usuario escribe únicamente su nombre de usuario. El servidor lo convierte a un
// correo sintético con dominio interno que NUNCA se muestra en la UI. Las cuentas
// se crean en el Dashboard de Supabase con este formato y "Auto Confirm" (no se
// envían correos; la recuperación de contraseña se hace desde el Dashboard).
export const LOGIN_EMAIL_DOMAIN = "lila.market";

// 3 a 20 caracteres: letras minúsculas, números, punto, guion o guion bajo.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,19}$/;

export function toLoginEmail(username: string): string {
  return `${username}@${LOGIN_EMAIL_DOMAIN}`;
}
