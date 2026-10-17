/**
 * Token de acceso con la forma de los de la API. La web no comprueba la firma (los recibe de la API
 * por su propio canal), solo lee de él el usuario y su correo: aquí la firma es de relleno.
 */
export function accessToken(claims: { sub: string; email?: string }): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ ...claims, exp: Math.floor(Date.now() / 1000) + 900 })}.firma`;
}

/** Respuesta de /api/v1/auth/login o /refresh. */
export function tokensResponse(token: string, refreshToken: string): Response {
  return new Response(
    JSON.stringify({ accessToken: token, expiresIn: 900, refreshToken, refreshExpiresAt: new Date(Date.now() + 43_200_000).toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
